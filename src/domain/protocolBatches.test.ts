import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { api } from '../services/api'
import { loadDb, saveDb } from '../storage/database'
import type { Protocol } from './model'
import type { BatchForwardInput } from './protocolBatches'
import { batchPhaseOptions } from './protocolBatches'

const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
const movement = { unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-analysis', message: 'Conferência em lote para análise administrativa.' }

function prepare() {
  const db = seedDatabase()
  const template = db.protocols.find((protocol) => protocol.id === 'pr-1')!
  const originals = [0, 1].map((index): Protocol => ({ ...structuredClone(template), id: `batch-protocol-${index}`, number: `2026.90.00.000${index}`, typeId: index ? 'pt-admin' : 'pt-buy', flowModeSnapshot: 'NONE', flowSnapshot: undefined, currentPhaseId: undefined, currentAssignmentId: `batch-assignment-${index}`, createdById: ctx.userId, currentAssigneeId: ctx.userId, currentUnitId: ctx.activeUnitId, status: 'CADASTRADO', version: 1 }))
  for (const protocol of originals) {
    db.protocols.push(protocol)
    db.assignments.push({ id: protocol.currentAssignmentId, protocolId: protocol.id, unitId: ctx.activeUnitId, assigneeId: ctx.userId, startedAt: protocol.createdAt, receivedAt: protocol.createdAt, receivedById: ctx.userId })
    db.events.push({ id: `opening-${protocol.id}`, protocolId: protocol.id, kind: 'ABERTURA', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: protocol.currentAssignmentId, createdAt: protocol.createdAt, nextStatus: 'CADASTRADO' })
  }
  saveDb(db)
  return { db, originals }
}
function input(): BatchForwardInput {
  return { requestId: 'test-batch-request-1', typeIds: ['pt-buy', 'pt-admin'], movement: { ...movement }, processes: [0, 1].map((index) => ({ protocolId: `batch-protocol-${index}`, expectedVersion: 1 })) }
}

describe('tramitação em lote', () => {
  beforeEach(() => { localStorage.clear(); prepare() })

  it('movimenta tipos diferentes, registra lote e autoria no histórico de cada processo e preserva o prazo anterior', async () => {
    const before = loadDb()
    const request = input()
    request.movement.dueAt = new Date(Date.now() + 86400000).toISOString()
    const batch = await api.forwardBatch(ctx, request)
    const after = loadDb()
    expect(batch.protocols).toHaveLength(2)
    expect(batch).toMatchObject({ actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, phaseId: movement.phaseId, unitId: movement.unitId, assigneeId: movement.assigneeId, message: movement.message })
    for (const selected of request.processes) {
      const protocol = after.protocols.find((item) => item.id === selected.protocolId)!
      expect(protocol).toMatchObject({ currentUnitId: 'u-adm', currentAssigneeId: 'usr-bruno', currentPhaseId: 'phase-analysis', version: 2, dueAt: request.movement.dueAt })
      expect(after.events).toContainEqual(expect.objectContaining({ protocolId: protocol.id, kind: 'TRAMITACAO', batchId: batch.id, actorUserId: ctx.userId, message: movement.message }))
      expect(after.auditEvents).toContainEqual(expect.objectContaining({ targetId: protocol.id, action: 'PROTOCOL_FORWARDED', details: expect.stringContaining(`Lote ${batch.number}`) }))
      expect(after.assignments.find((item) => item.id === protocol.currentAssignmentId)?.receivedAt).toBeUndefined()
      expect(after.events.find((item) => item.id === `opening-${protocol.id}`)?.dueAt).toBe(before.protocols.find((item) => item.id === protocol.id)?.dueAt ?? null)
    }
    expect((await api.listBatches(ctx))[0]).toEqual(batch)
  })

  it('a prévia usa as mesmas regras e não grava movimentações', async () => {
    const before = loadDb()
    const rows = await api.previewBatch(ctx, input().typeIds, movement)
    expect(rows.filter((row) => input().processes.some((item) => item.protocolId === row.protocol.id)).every((row) => row.issues.length === 0)).toBe(true)
    expect(loadDb()).toEqual(before)
  })

  it('recusa tudo se um único processo tiver versão desatualizada, sem tramitar o primeiro', async () => {
    const request = input()
    request.processes[1].expectedVersion = 100
    const before = loadDb()
    await expect(api.forwardBatch(ctx, request)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('Nenhum processo foi movimentado') })
    expect(loadDb()).toEqual(before)
  })

  it('impede reenviar o mesmo lote e recusa reutilizar seu identificador com outra observação', async () => {
    const request = input()
    const first = await api.forwardBatch(ctx, request)
    const saved = loadDb()
    expect(await api.forwardBatch(ctx, request)).toEqual(first)
    expect(loadDb()).toEqual(saved)
    await expect(api.forwardBatch(ctx, { ...request, movement: { ...movement, message: 'Outra observação.' } })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(loadDb()).toEqual(saved)
  })

  it.each(['', '  ', 'x'.repeat(4001)])('exige observação obrigatória válida (%#)', async (message) => {
    const before = loadDb()
    await expect(api.forwardBatch(ctx, { ...input(), movement: { ...movement, message } })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(loadDb()).toEqual(before)
  })

  it.each(['vazio', 'duplicado', 'tipo incompatível', 'fora da caixa'])('recusa uma seleção inválida: %s', async (scenario) => {
    const request = input()
    if (scenario === 'vazio') request.processes = []
    if (scenario === 'duplicado') request.processes = [request.processes[0], request.processes[0]]
    if (scenario === 'tipo incompatível') request.typeIds = ['pt-admin']
    if (scenario === 'fora da caixa') request.processes[1].protocolId = 'processo-inexistente'
    const before = loadDb()
    await expect(api.forwardBatch(ctx, request)).rejects.toMatchObject({ code: scenario === 'vazio' || scenario === 'duplicado' ? 'VALIDATION' : 'FORBIDDEN' })
    expect(loadDb()).toEqual(before)
  })

  it('mostra somente a caixa do usuário ou processos abertos por ele, mesmo quando é administrador', async () => {
    const db = loadDb()
    const sample = db.protocols.find((item) => item.id === 'batch-protocol-0')!
    db.protocols.push({ ...sample, id: 'other-owner', createdById: 'usr-admin', currentAssigneeId: 'usr-admin' })
    db.protocols.push({ ...sample, id: 'only-inbox', createdById: 'usr-admin' })
    db.protocols.push({ ...sample, id: 'only-created', currentAssigneeId: 'usr-admin' })
    db.protocols.push({ ...sample, id: 'closed-owner', status: 'CONCLUIDO' })
    saveDb(db)
    const ids = (await api.batchCandidates(ctx)).map((protocol) => protocol.id)
    expect(ids).toContain('only-inbox')
    expect(ids).toContain('only-created')
    expect(ids).not.toContain('other-owner')
    expect(ids).not.toContain('closed-owner')
    const adminIds = (await api.batchCandidates({ userId: 'usr-admin', activeUnitId: 'u-prot' })).map((protocol) => protocol.id)
    expect(adminIds).not.toContain('batch-protocol-0')
    expect(adminIds).toContain('other-owner')
  })

  it('não autoriza tramitar um processo apenas porque foi aberto pelo usuário', async () => {
    const db = loadDb()
    db.protocols.find((item) => item.id === 'batch-protocol-1')!.currentAssigneeId = 'usr-admin'
    saveDb(db)
    const before = loadDb()
    const preview = await api.previewBatch(ctx, input().typeIds, movement)
    expect(preview.find((row) => row.protocol.id === 'batch-protocol-1')?.issues.join(' ')).toContain('responsável')
    await expect(api.forwardBatch(ctx, input())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(loadDb()).toEqual(before)
  })

  it.each(['ciência', 'checklist', 'fase', 'destino', 'fase final'])('respeita o fluxo obrigatório e bloqueia %s pendente', async (scenario) => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'batch-protocol-1')!
    protocol.flowModeSnapshot = 'REQUIRED'
    protocol.flowSnapshot = structuredClone(db.protocols.find((item) => item.id === 'pr-1')!.flowSnapshot)
    protocol.currentPhaseId = 'phase-triage'
    const opening = db.events.find((item) => item.id === `opening-${protocol.id}`)!
    opening.phaseId = 'phase-triage'
    opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: scenario !== 'checklist' }]
    const request = input()
    if (scenario === 'ciência') db.assignments.find((item) => item.id === protocol.currentAssignmentId)!.receivedAt = undefined
    if (scenario === 'fase') request.movement.phaseId = 'phase-completion'
    if (scenario === 'destino') protocol.flowSnapshot!.phases.find((phase) => phase.phaseId === 'phase-analysis')!.destinationUnitId = 'u-fin'
    if (scenario === 'fase final') protocol.currentPhaseId = 'phase-completion'
    saveDb(db)
    const before = loadDb()
    await expect(api.forwardBatch(ctx, request)).rejects.toBeInstanceOf(Error)
    expect(loadDb()).toEqual(before)
  })

  it.each(['permissão', 'visualização', 'inativo', 'outra prefeitura'])('valida acesso: %s', async (scenario) => {
    const db = loadDb()
    const otherCtx = { ...ctx, ...(scenario === 'outra prefeitura' ? { tenantId: 'outro-tenant' } : {}) }
    if (scenario === 'inativo') db.users.find((user) => user.id === ctx.userId)!.active = false
    if (scenario === 'permissão' || scenario === 'visualização') {
      const membership = db.memberships.find((item) => item.userId === ctx.userId && item.unitId === ctx.activeUnitId)!
      membership.permissions = membership.permissions!.filter((permission) => permission !== (scenario === 'permissão' ? 'processes.act' : 'processes.view'))
    }
    saveDb(db)
    const before = loadDb()
    await expect(api.batchCandidates(otherCtx)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.forwardBatch(otherCtx, input())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(loadDb()).toEqual(before)
  })

  it('restringe o histórico de lotes ao autor e à unidade de origem', async () => {
    await api.forwardBatch(ctx, input())
    expect(await api.listBatches({ userId: 'usr-admin', activeUnitId: 'u-prot' })).toEqual([])
    expect(await api.listBatches({ userId: 'usr-bruno', activeUnitId: 'u-adm' })).toEqual([])
    expect(await api.listBatches(ctx)).toHaveLength(1)
  })

  it('não encaminha para um responsável fora da unidade nem para uma fila sem usuários operacionais', async () => {
    const before = loadDb()
    await expect(api.forwardBatch(ctx, { ...input(), movement: { ...movement, assigneeId: 'usr-clara' } })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(loadDb()).toEqual(before)
    const db = loadDb()
    db.units.push({ id: 'empty-unit', name: 'Fila sem usuário', abbreviation: 'VAZIA', active: true })
    saveDb(db)
    await expect(api.forwardBatch(ctx, { ...input(), movement: { ...movement, unitId: 'empty-unit', assigneeId: undefined } })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(loadDb().batches).toBeUndefined()
  })

  it('oferece a próxima fase de fluxos obrigatórios e fases livres de outros fluxos', () => {
    const db = loadDb()
    const required = db.protocols.find((item) => item.id === 'pr-1')!
    expect(batchPhaseOptions(db, [required])).toEqual([{ id: 'phase-analysis', name: 'Análise' }])
    expect(batchPhaseOptions(db, [db.protocols.find((item) => item.id === 'batch-protocol-0')!]).some((phase) => phase.id === 'phase-completion')).toBe(true)
  })

  it('salva os dados históricos necessários ao comprovante e autoriza sua leitura somente no contexto do lote', async () => {
    const before = loadDb()
    const batch = await api.forwardBatch(ctx, input())
    expect(batch.actorName).toBe('Clara Nunes')
    expect(batch.destinationPath).toBe('Administração')
    expect(batch.typeNames).toEqual(['Compra de material', 'Solicitação administrativa'])
    for (const item of batch.protocols) {
      const original = before.protocols.find((protocol) => protocol.id === item.protocolId)!
      expect(item).toMatchObject({ description: original.description, createdAt: original.createdAt })
    }
    expect((await api.getBatchReceipt(ctx, batch.id)).batch).toEqual(batch)
    await expect(api.getBatchReceipt({ userId: 'usr-admin', activeUnitId: 'u-prot' }, batch.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.getBatchReceipt(ctx, 'lote-inexistente')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.getBatchReceipt({ ...ctx, tenantId: 'outra-prefeitura' }, batch.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const db = loadDb()
    db.memberships.find((membership) => membership.userId === ctx.userId && membership.unitId === ctx.activeUnitId)!.permissions = []
    saveDb(db)
    await expect(api.getBatchReceipt(ctx, batch.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('tramita fluxos obrigatórios de tipos distintos após validar os checklists de cada processo', async () => {
    const db = loadDb()
    for (const selected of input().processes) {
      const protocol = db.protocols.find((item) => item.id === selected.protocolId)!
      protocol.flowModeSnapshot = 'REQUIRED'
      protocol.flowSnapshot = structuredClone(db.protocols.find((item) => item.id === 'pr-1')!.flowSnapshot)
      protocol.currentPhaseId = 'phase-triage'
      const opening = db.events.find((item) => item.id === `opening-${protocol.id}`)!
      opening.phaseId = 'phase-triage'
      opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    }
    saveDb(db)
    const batch = await api.forwardBatch(ctx, input())
    const after = loadDb()
    expect(batch.protocols).toHaveLength(2)
    for (const selected of batch.protocols) {
      expect(after.protocols.find((item) => item.id === selected.protocolId)?.currentPhaseId).toBe('phase-analysis')
      expect(after.events.find((item) => item.id === selected.eventId)?.checklist).toContainEqual(expect.objectContaining({ questionId: 'q-analysis-result', checked: false }))
      expect(after.events.find((item) => item.id === `opening-${selected.protocolId}`)?.checklist?.[0].checked).toBe(true)
    }
  })

  it('não permite que outro autor reutilize o identificador de um lote existente', async () => {
    await api.forwardBatch(ctx, input())
    const before = loadDb()
    await expect(api.forwardBatch({ userId: 'usr-admin', activeUnitId: 'u-prot' }, input())).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(loadDb()).toEqual(before)
  })

  it('impede todo o lote quando falta um anexo obrigatório na fase de um processo', async () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'batch-protocol-1')!
    protocol.flowModeSnapshot = 'REQUIRED'
    protocol.flowSnapshot = structuredClone(db.protocols.find((item) => item.id === 'pr-1')!.flowSnapshot)
    protocol.currentPhaseId = 'phase-triage'
    protocol.flowSnapshot!.phases.find((phase) => phase.phaseId === 'phase-triage')!.requiredAttachmentTypes = ['application/pdf']
    const opening = db.events.find((item) => item.id === `opening-${protocol.id}`)!
    opening.phaseId = 'phase-triage'
    opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    saveDb(db)
    const before = loadDb()
    await expect(api.forwardBatch(ctx, input())).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('PDF') })
    expect(loadDb()).toEqual(before)
  })
})
