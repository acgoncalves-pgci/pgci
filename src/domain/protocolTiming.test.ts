import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { api } from '../services/api'
import { loadDb, saveDb } from '../storage/database'
import type { ProtocolEvent } from './model'
import { formatStageDuration, isProtocolOverdue, protocolMovementTiming } from './protocolTiming'

const minute = 60_000
const protocol = { ...seedDatabase().protocols[0], id: 'timed', status: 'EM_ANDAMENTO' as const, createdAt: '2026-10-01T10:00:00Z', dueAt: '2026-10-20T10:00:00Z' }
const movement = (id: string, createdAt: string, values: Partial<ProtocolEvent> = {}): ProtocolEvent => ({ id, protocolId: protocol.id, kind: 'TRAMITACAO', actorUserId: 'usr-clara', actorUnitId: 'u-prot', createdAt, ...values })

describe('tempo e prazo das movimentações', () => {
  it.each(['CADASTRADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ARQUIVADO', 'REJEITADO', 'CANCELADO'] as const)('mostra vencimento atual somente em processos ativos (%s)', (status) => {
    expect(isProtocolOverdue({ ...protocol, status }, Date.parse('2026-10-21T10:00:00Z'))).toBe(status === 'CADASTRADO' || status === 'EM_ANDAMENTO')
  })

  it('não considera vencido um prazo futuro, ausente ou inválido', () => {
    const now = Date.parse('2026-10-01T10:00:00Z')
    expect(isProtocolOverdue(protocol, now)).toBe(false)
    expect(isProtocolOverdue({ ...protocol, dueAt: undefined }, now)).toBe(false)
    expect(isProtocolOverdue({ ...protocol, dueAt: 'data inválida' }, now)).toBe(false)
  })

  it.each([[0, 'Menos de 1 min'], [45, '45 min'], [125, '2 h 5 min'], [2940, '2 dias 1 h'], [43200, '1 mês'], [44640, '1 mês 1 dia'], [-10, 'Menos de 1 min']])('formata %s minutos como %s', (minutes, expected) => {
    expect(formatStageDuration(Number(minutes) * minute)).toBe(expected)
  })

  it('encerra o tempo na próxima movimentação, mesmo dentro da mesma unidade ou fase', () => {
    const first = movement('first', '2026-10-01T10:00:00Z', { dueAt: '2026-10-01T11:00:00Z' })
    const next = movement('next', '2026-10-01T12:05:00Z')
    const received = movement('received', '2026-10-01T10:10:00Z', { kind: 'RECEBIMENTO' })
    expect(protocolMovementTiming(protocol, [first, received, next], first)).toMatchObject({ duration: '2 h 5 min', endedAt: next.createdAt, running: false, dueAt: first.dueAt, overdue: true })
  })

  it('atualiza a duração da etapa ativa e usa seu prazo atual', () => {
    const current = movement('active', '2026-10-01T10:00:00Z', { dueAt: null })
    expect(protocolMovementTiming(protocol, [current], current, Date.parse('2026-10-01T10:45:00Z'))).toMatchObject({ duration: '45 min', running: true, dueAt: protocol.dueAt, overdue: false })
  })

  it.each(['REJEICAO', 'CANCELAMENTO', 'CONCLUSAO', 'ARQUIVAMENTO'] as const)('congela a duração de %s, inclusive após reabrir', (kind) => {
    const first = movement('first', '2026-10-01T10:00:00Z')
    const closed = movement('closed', '2026-10-01T12:00:00Z', { kind, dueAt: '2026-10-01T13:00:00Z' })
    const reopened = movement('reopened', '2026-10-05T10:00:00Z', { kind: 'REABERTURA' })
    const events = [first, closed, reopened]
    expect(protocolMovementTiming(protocol, events, first)).toMatchObject({ duration: '2 h', running: false })
    expect(protocolMovementTiming(protocol, events, closed)).toMatchObject({ duration: '2 h', endedAt: closed.createdAt, running: false, overdue: false })
    expect(protocolMovementTiming(protocol, events, reopened, Date.parse('2026-10-05T10:30:00Z'))).toMatchObject({ duration: '30 min', running: true })
  })

  it('não soma o período parado entre conclusão e arquivamento', () => {
    const events = [movement('first', '2026-10-01T10:00:00Z'), movement('closed', '2026-10-01T12:00:00Z', { kind: 'CONCLUSAO' }), movement('archived', '2026-10-03T12:00:00Z', { kind: 'ARQUIVAMENTO' })]
    expect(protocolMovementTiming({ ...protocol, status: 'ARQUIVADO' }, events, events[2])).toMatchObject({ duration: '2 h', endedAt: events[1].createdAt, running: false })
  })

  it('preserva a ordem de eventos registrados no mesmo instante e não inventa prazo para o histórico legado', () => {
    const first = movement('first', '2026-10-01T10:00:00Z')
    const second = movement('second', first.createdAt, { dueAt: null })
    expect(protocolMovementTiming(protocol, [first, second], first)).toMatchObject({ duration: 'Menos de 1 min', running: false, dueAt: undefined })
  })
})

describe('persistência dos prazos da etapa', () => {
  const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('guarda o prazo anterior e o novo prazo ao tramitar entre etapas', async () => {
    const db = loadDb()
    const original = db.protocols.find((item) => item.id === 'pr-1')!
    const originalDue = new Date(Date.now() + 2 * 86400000).toISOString()
    const nextDue = new Date(Date.now() + 5 * 86400000).toISOString()
    original.dueAt = originalDue
    const opening = db.events.find((item) => item.id === 'ev-open-1')!
    opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    saveDb(db)
    await api.forward(ctx, original.id, original.version, { unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-analysis', message: 'Encaminhar para análise.', dueAt: nextDue })
    const events = loadDb().events.filter((item) => item.protocolId === original.id)
    expect(events.find((item) => item.kind === 'ABERTURA')?.dueAt).toBe(originalDue)
    expect(events.find((item) => item.kind === 'TRAMITACAO')?.dueAt).toBe(nextDue)
  })

  it('mantém o prazo anterior ao cancelar e reabrir com um prazo novo, e permite editar e remover o prazo atual', async () => {
    const db = loadDb()
    const original = db.protocols.find((item) => item.id === 'pr-1')!
    const originalDue = new Date(Date.now() + 2 * 86400000).toISOString()
    original.dueAt = originalDue
    saveDb(db)
    const cancelled = await api.cancel(ctx, original.id, original.version, 'Aguardar nova análise.')
    const nextDue = new Date(Date.now() + 5 * 86400000).toISOString()
    const reopened = await api.reopen(ctx, original.id, cancelled.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: 'Retomar.', dueAt: nextDue })
    const after = loadDb().events.filter((item) => item.protocolId === original.id)
    expect(after.find((item) => item.kind === 'ABERTURA')?.dueAt).toBe(originalDue)
    expect(after.find((item) => item.kind === 'CANCELAMENTO')?.dueAt).toBe(originalDue)
    expect(after.find((item) => item.kind === 'REABERTURA')?.dueAt).toBe(nextDue)
    const editedDue = new Date(Date.now() + 7 * 86400000).toISOString()
    const edited = await api.updateProtocol(ctx, original.id, reopened.version, { subject: original.subject, description: original.description, dueAt: editedDue })
    expect(loadDb().events.find((item) => item.protocolId === original.id && item.kind === 'REABERTURA')?.dueAt).toBe(editedDue)
    await api.updateProtocol(ctx, original.id, edited.version, { subject: original.subject, description: original.description })
    expect(loadDb().events.find((item) => item.protocolId === original.id && item.kind === 'REABERTURA')?.dueAt).toBeNull()
    expect(loadDb().events.find((item) => item.protocolId === original.id && item.kind === 'CANCELAMENTO')?.dueAt).toBe(originalDue)
  })
})
