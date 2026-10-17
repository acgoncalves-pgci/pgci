import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { saveDb } from '../storage/database'
import { api } from './api'

const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }

describe('escopo das métricas da tela inicial', () => {
  beforeEach(() => {
    localStorage.clear()
    const db = seedDatabase()
    const template = db.protocols[0]
    db.memberships.push({ id: 'clara-adm-dashboard', userId: ctx.userId, unitId: 'u-adm', role: 'OPERADOR', startsAt: '2020-01-01T00:00:00Z', active: true })
    const fixtures = [
      { id: 'mine-prot', unit: 'u-prot', assignee: ctx.userId, hours: -12, received: false },
      { id: 'other-prot', unit: 'u-prot', assignee: 'usr-admin', hours: 12, received: true },
      { id: 'mine-adm', unit: 'u-adm', assignee: ctx.userId, hours: 12, received: false },
      { id: 'other-adm', unit: 'u-adm', assignee: 'usr-bruno', hours: -12, received: true },
      { id: 'queue-adm', unit: 'u-adm', assignee: undefined, hours: -12, received: false },
      { id: 'hidden-fin', unit: 'u-fin', assignee: 'usr-rafael', hours: -12, received: false },
      { id: 'ended-prot', unit: 'u-prot', assignee: ctx.userId, hours: -12, received: false },
    ]
    db.protocols = fixtures.map((item) => ({ ...structuredClone(template), id: item.id, subject: item.id, createdById: item.assignee === ctx.userId ? ctx.userId : 'usr-admin', currentUnitId: item.unit, currentAssigneeId: item.assignee, currentAssignmentId: `assignment-${item.id}`, dueAt: new Date(Date.now() + item.hours * 3600000).toISOString(), status: item.id === 'ended-prot' ? 'CONCLUIDO' : 'EM_ANDAMENTO' }))
    db.assignments = fixtures.map((item) => ({ id: `assignment-${item.id}`, protocolId: item.id, unitId: item.unit, assigneeId: item.assignee, startedAt: template.createdAt, receivedAt: item.received ? template.createdAt : undefined }))
    db.events = []
    saveDb(db)
  })

  it('Todos agrega todos os processos acessíveis, preservando as métricas pessoais e excluindo encerrados', async () => {
    const result = await api.dashboard({ ...ctx, scopeUnitId: 'ALL' })
    expect(result.counts).toEqual({ mine: 2, unacknowledged: 2, unassigned: 1, overdue: 3, soon: 2 })
    expect(result.priorities.map((item) => item.id).sort()).toEqual(['mine-adm', 'mine-prot', 'queue-adm'])
    expect(result.priorities.some((item) => item.id === 'hidden-fin')).toBe(false)
  })

  it('uma unidade limita todas as métricas, inclusive caixa e ciência de quem possui vínculos em mais unidades', async () => {
    const result = await api.dashboard({ ...ctx, scopeUnitId: 'u-prot' })
    expect(result.counts).toEqual({ mine: 1, unacknowledged: 1, unassigned: 0, overdue: 1, soon: 1 })
    expect(result.priorities.map((item) => item.id)).toEqual(['mine-prot'])
    const secondary = await api.dashboard({ ...ctx, activeUnitId: 'u-adm', scopeUnitId: 'u-adm' })
    expect(secondary.counts).toEqual({ mine: 1, unacknowledged: 1, unassigned: 1, overdue: 2, soon: 1 })
  })

  it('Todos do administrador inclui processos de outros responsáveis e unidades da entidade', async () => {
    const result = await api.dashboard({ userId: 'usr-admin', activeUnitId: 'u-prot', scopeUnitId: 'ALL' })
    expect(result.counts.overdue).toBe(4)
    expect(result.counts.soon).toBe(2)
    expect(result.counts.mine).toBe(1)
  })

  it.each(['overdue', 'soon', 'unacknowledged'] as const)('o atalho %s lista exatamente os processos contabilizados em Todos e na unidade', async (shortcut) => {
    for (const scopeUnitId of ['u-prot', 'ALL']) {
      const scoped = { ...ctx, scopeUnitId }
      const dashboard = await api.dashboard(scoped)
      const items = await api.listProtocols(scoped, { tab: shortcut === 'unacknowledged' ? 'mine' : scopeUnitId === 'ALL' ? 'all' : 'unit', unitId: scopeUnitId === 'ALL' ? undefined : ctx.activeUnitId, shortcut })
      expect(items.total).toBe(dashboard.counts[shortcut])
    }
  })
})
