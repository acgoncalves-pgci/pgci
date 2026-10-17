import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { api } from '../services/api'
import { loadDb, saveDb } from '../storage/database'
import { isActive, isMovementEvent } from './model'
import { currentProtocolSituation } from './situations'
import { allPermissions, hasPermission } from './permissions'

const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
const cases = [
  { action: 'reject', status: 'REJEITADO', kind: 'REJEICAO', audit: 'PROTOCOL_REJECTED', label: 'Rejeitado' },
  { action: 'cancel', status: 'CANCELADO', kind: 'CANCELAMENTO', audit: 'PROTOCOL_CANCELLED', label: 'Cancelado' },
] as const

describe.each(cases)('encerramento por $action', ({ action, status, kind, audit, label }) => {
  beforeEach(() => {
    localStorage.clear()
    saveDb(seedDatabase())
  })

  it('persiste a situação final, o motivo, autor, unidade e histórico sem alterar movimentos anteriores', async () => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    const updated = await api[action](ctx, protocol.id, protocol.version, '  Motivo do encerramento.  ')
    const after = loadDb()
    expect(updated).toMatchObject({ status, version: protocol.version + 1 })
    expect(after.protocols.find((item) => item.id === protocol.id)).toMatchObject(updated)
    expect(isActive(updated)).toBe(false)
    expect(currentProtocolSituation(after, updated)).toMatchObject({ name: label, category: status })
    expect(after.events).toEqual(expect.arrayContaining(before.events.map((item) => expect.objectContaining(item))))
    const movement = after.events.find((item) => item.protocolId === protocol.id && item.kind === kind)!
    expect(movement).toMatchObject({ actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: protocol.currentAssignmentId, phaseId: protocol.currentPhaseId, previousStatus: protocol.status, nextStatus: status, message: 'Motivo do encerramento.', createdAt: expect.any(String) })
    expect(isMovementEvent(movement)).toBe(true)
    expect(after.auditEvents).toContainEqual(expect.objectContaining({ action: audit, actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetId: protocol.id, details: expect.stringContaining('Motivo do encerramento.') }))
    await expect(api.forward(ctx, protocol.id, updated.version, { unitId: 'u-adm', message: 'Nova tramitação.' })).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await expect(api.complete(ctx, protocol.id, updated.version, 'Conclusão posterior.')).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect(loadDb().events.filter((item) => item.protocolId === protocol.id && item.kind === kind)).toHaveLength(1)
  })

  it.each(['', '  ', 'x'.repeat(4001)])('recusa motivo vazio ou acima do limite (%#)', async (message) => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    await expect(api[action](ctx, protocol.id, protocol.version, message)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(loadDb()).toEqual(before)
  })

  it('exige ciência antes do encerramento e mantém o histórico intacto quando recusado', async () => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    before.assignments.find((item) => item.id === protocol.currentAssignmentId)!.receivedAt = undefined
    saveDb(before)
    await expect(api[action](ctx, protocol.id, protocol.version, 'Motivo.')).rejects.toMatchObject({ code: 'ACK_REQUIRED' })
    expect(loadDb()).toEqual(before)
  })

  it('recusa uma versão desatualizada sem duplicar o encerramento', async () => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    await expect(api[action](ctx, protocol.id, protocol.version - 1, 'Motivo.')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(loadDb()).toEqual(before)
  })

  it.each(['CONCLUIDO', 'ARQUIVADO', 'REJEITADO', 'CANCELADO'] as const)('recusa processo já encerrado como %s', async (previousStatus) => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = previousStatus
    saveDb(before)
    await expect(api[action](ctx, protocol.id, protocol.version, 'Motivo.')).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect(loadDb()).toEqual(before)
  })

  it.each([
    { userId: 'usr-bruno', activeUnitId: 'u-adm' },
    { userId: 'usr-admin', activeUnitId: 'u-adm' },
    { ...ctx, tenantId: 'outra-prefeitura' },
  ])('recusa acesso fora da unidade ou prefeitura atual (%#)', async (actor) => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    await expect(api[action](actor, protocol.id, protocol.version, 'Motivo.')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(loadDb()).toEqual(before)
  })

  it('recusa usuário inativo ou sem permissão operacional, mesmo sendo o responsável', async () => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    before.users.find((item) => item.id === ctx.userId)!.active = false
    saveDb(before)
    await expect(api[action](ctx, protocol.id, protocol.version, 'Motivo.')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    before.users.find((item) => item.id === ctx.userId)!.active = true
    before.memberships.filter((item) => item.userId === ctx.userId && item.unitId === ctx.activeUnitId).forEach((item) => { item.permissions = [] })
    saveDb(before)
    await expect(api[action](ctx, protocol.id, protocol.version, 'Motivo.')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(loadDb()).toEqual(before)
  })

  it('permite ao administrador encerrar na unidade atual sem ser o responsável', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api[action]({ userId: 'usr-admin', activeUnitId: 'u-prot' }, protocol.id, protocol.version, 'Encerrado pelo administrador.')).resolves.toMatchObject({ status })
  })
})

describe('reabertura com permissão específica', () => {
  beforeEach(() => {
    localStorage.clear()
    saveDb(seedDatabase())
  })
  const grantReopen = () => {
    const db = loadDb()
    const membership = db.memberships.find((item) => item.userId === ctx.userId && item.unitId === ctx.activeUnitId)!
    membership.permissions = ['processes.view', 'processes.reopen']
    saveDb(db)
  }
  const input = { unitId: 'u-prot', message: 'Reabertura para corrigir a análise.' }

  it.each(['REJEITADO', 'CANCELADO', 'CONCLUIDO', 'ARQUIVADO'] as const)('reabre %s sem exigir a permissão de editar e preserva o histórico', async (status) => {
    const original = loadDb()
    const protocol = original.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = status
    saveDb(original)
    grantReopen()
    expect(hasPermission(loadDb(), ctx, 'processes.edit')).toBe(false)
    const reopened = await api.reopen(ctx, protocol.id, protocol.version, input)
    const db = loadDb()
    expect(reopened).toMatchObject({ status: 'EM_ANDAMENTO', version: protocol.version + 1, currentUnitId: input.unitId })
    expect(reopened.currentAssigneeId).toBeUndefined()
    expect(reopened.currentAssignmentId).not.toBe(protocol.currentAssignmentId)
    expect(db.assignments.find((item) => item.id === protocol.currentAssignmentId)?.endedAt).toBeTruthy()
    expect(db.events).toEqual(expect.arrayContaining(original.events.map((item) => expect.objectContaining(item))))
    expect(db.events).toContainEqual(expect.objectContaining({ kind: 'REABERTURA', protocolId: protocol.id, previousStatus: status, nextStatus: 'EM_ANDAMENTO', message: input.message, actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, phaseId: protocol.currentPhaseId, assignmentId: reopened.currentAssignmentId }))
    expect(db.auditEvents).toContainEqual(expect.objectContaining({ action: 'PROTOCOL_REOPENED', protocolId: protocol.id, details: expect.stringContaining(input.message) }))
    expect(currentProtocolSituation(db, reopened)?.name).toBe('Reaberto')
    await expect(api.reopen(ctx, protocol.id, protocol.version, input)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(loadDb().events.filter((item) => item.kind === 'REABERTURA' && item.protocolId === protocol.id)).toHaveLength(1)
  })

  it('recusa quem possui apenas permissão de editar, inclusive sendo o responsável', async () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = 'CANCELADO'
    db.memberships.find((item) => item.userId === ctx.userId && item.unitId === ctx.activeUnitId)!.permissions = ['processes.view', 'processes.edit']
    saveDb(db)
    await expect(api.reopen(ctx, protocol.id, protocol.version, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(loadDb()).toEqual(db)
  })

  it.each([
    { input: { ...input, message: '' }, code: 'VALIDATION' },
    { input: { ...input, message: 'x'.repeat(4001) }, code: 'VALIDATION' },
    { input: { ...input, unitId: 'inexistente' }, code: 'VALIDATION' },
    { input: { ...input, assigneeId: 'usr-bruno' }, code: 'VALIDATION' },
    { input: { ...input, dueAt: '2000-01-01T00:00:00Z' }, code: 'VALIDATION' },
  ])('recusa dados inválidos sem abrir nova atribuição (%#)', async (scenario) => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = 'REJEITADO'
    saveDb(db)
    grantReopen()
    const before = loadDb()
    await expect(api.reopen(ctx, protocol.id, protocol.version, scenario.input)).rejects.toMatchObject({ code: scenario.code })
    expect(loadDb()).toEqual(before)
  })

  it('recusa processo ativo e administrador fora da unidade atual', async () => {
    grantReopen()
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api.reopen(ctx, protocol.id, protocol.version, input)).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await expect(api.reopen({ userId: 'usr-admin', activeUnitId: 'u-adm' }, protocol.id, protocol.version, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('oferece a permissão em perfis personalizados sem concedê-la aos operadores por padrão', async () => {
    expect(allPermissions).toContain('processes.reopen')
    expect(hasPermission(loadDb(), ctx, 'processes.reopen')).toBe(false)
    const profile = await api.createProfile({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Reabertura autorizada', isAdmin: false, permissions: ['processes.view', 'processes.reopen'] })
    expect(loadDb().profiles.find((item) => item.id === profile.id)?.permissions).toContain('processes.reopen')
  })

  it('vincula a auditoria de anexo ao processo e preserva o vínculo após excluir o arquivo', async () => {
    const db = loadDb()
    const attachment = db.attachments.find((item) => item.protocolId === 'pr-1')!
    await api.updateAttachment(ctx, attachment.id, { filename: 'Anexo renomeado.txt' })
    const updated = loadDb()
    expect(updated.auditEvents).toContainEqual(expect.objectContaining({ action: 'ATTACHMENT_UPDATED', targetType: 'ATTACHMENT', targetId: attachment.id, protocolId: 'pr-1' }))
    const protocol = updated.protocols.find((item) => item.id === 'pr-1')!
    await api.removeAttachment(ctx, protocol.id, protocol.version, attachment.id)
    expect(loadDb().auditEvents).toContainEqual(expect.objectContaining({ action: 'ATTACHMENT_UPDATED', targetId: attachment.id, protocolId: 'pr-1' }))
  })
})
