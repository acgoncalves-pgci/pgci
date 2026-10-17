import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { api } from '../services/api'
import { loadDb, saveDb } from '../storage/database'
import { forwardPendingIssues, phaseChecklistAnswers, phaseChecklistMovement } from './protocolPending'

const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }

describe('retomada do processo após reabertura', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it.each(['REJEITADO', 'CANCELADO', 'CONCLUIDO', 'ARQUIVADO'] as const)('retoma o checklist de %s sem editar o histórico anterior', async (status) => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const opening = db.events.find((item) => item.id === 'ev-open-1')!
    opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: false, observation: 'Observação anterior.' }]
    protocol.status = status
    saveDb(db)
    const reopened = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: 'Retomar análise pendente.' })
    const after = loadDb()
    const movement = after.events.find((item) => item.kind === 'REABERTURA' && item.protocolId === protocol.id)!
    expect(movement.checklist).toEqual([expect.objectContaining({ questionId: 'q-triage-data', checked: false, observation: 'Observação anterior.' })])
    const received = await api.acknowledge(ctx, protocol.id, reopened.version)
    await api.updateMovementChecklist(ctx, protocol.id, received.version, movement.id, [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true, observation: 'Conferido após reabrir.' }])
    const completed = loadDb()
    expect(completed.events.find((item) => item.id === opening.id)?.checklist).toEqual(opening.checklist)
    const current = completed.protocols.find((item) => item.id === protocol.id)!
    expect(forwardPendingIssues(completed, current, completed.events.find((item) => item.id === movement.id)!)).toEqual([])
    await expect(api.forward(ctx, protocol.id, current.version, { unitId: 'u-adm', assigneeId: 'usr-bruno', message: 'Prosseguir após reabrir.' })).resolves.toMatchObject({ currentPhaseId: 'phase-analysis' })
  })

  it('retoma ciclos repetidos sem reaproveitar respostas antigas que foram desmarcadas', async () => {
    let protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    for (let cycle = 0; cycle < 2; cycle++) {
      protocol = await api.cancel(ctx, protocol.id, protocol.version, `Cancelamento ${cycle}.`)
      protocol = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: `Reabertura ${cycle}.` })
      protocol = await api.acknowledge(ctx, protocol.id, protocol.version)
      const data = await api.getProtocol(ctx, protocol.id)
      const movement = data.events[0]
      await api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }])
      protocol = loadDb().protocols.find((item) => item.id === protocol.id)!
      await api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: false }])
      protocol = loadDb().protocols.find((item) => item.id === protocol.id)!
      const currentDb = loadDb()
      expect(forwardPendingIssues(currentDb, protocol, currentDb.events.find((item) => item.id === movement.id)!)).toContain('Conclua o item do checklist: Conferir dados de abertura.')
    }
    expect(loadDb().events.filter((item) => item.protocolId === protocol.id && item.kind === 'REABERTURA')).toHaveLength(2)
  })

  it('exige ciência, permite assumir uma fila reaberta e salva o checklist na atribuição nova', async () => {
    let protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    protocol = await api.reject(ctx, protocol.id, protocol.version, 'Revisão necessária.')
    protocol = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-prot', message: 'Retomar na fila.' })
    const movement = (await api.getProtocol(ctx, protocol.id)).events[0]
    await expect(api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [])).rejects.toMatchObject({ code: 'ACK_REQUIRED' })
    protocol = await api.assume(ctx, protocol.id, protocol.version)
    await expect(api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }])).resolves.toMatchObject({ assignmentId: protocol.currentAssignmentId, checklist: [expect.objectContaining({ checked: true })] })
    await expect(api.updateMovementChecklist(ctx, protocol.id, loadDb().protocols.find((item) => item.id === protocol.id)!.version, 'ev-open-1', [])).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })

  it('exige ciência do destinatário ao reabrir em outra unidade e libera o checklist depois dela', async () => {
    let protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    protocol = await api.cancel(ctx, protocol.id, protocol.version, 'Cancelar para análise complementar.')
    protocol = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-adm', assigneeId: 'usr-bruno', message: 'Reanalisar na Administração.' })
    const recipient = { userId: 'usr-bruno', activeUnitId: 'u-adm' }
    const movement = (await api.getProtocol(recipient, protocol.id)).events[0]
    await expect(api.updateMovementChecklist(recipient, protocol.id, protocol.version, movement.id, [])).rejects.toMatchObject({ code: 'ACK_REQUIRED' })
    protocol = await api.acknowledge(recipient, protocol.id, protocol.version)
    await expect(api.updateMovementChecklist(recipient, protocol.id, protocol.version, movement.id, [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }])).resolves.toMatchObject({ checklist: [expect.objectContaining({ checked: true })] })
  })

  it.each(['NONE', 'SUGGESTED', 'REQUIRED'] as const)('permite prosseguir após reabrir um fluxo %s', async (mode) => {
    const db = loadDb()
    let protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = 'CANCELADO'
    protocol.flowModeSnapshot = mode
    if (mode === 'NONE') { protocol.flowSnapshot = undefined; protocol.currentPhaseId = undefined }
    saveDb(db)
    protocol = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: 'Retomar fluxo.' })
    protocol = await api.acknowledge(ctx, protocol.id, protocol.version)
    if (mode === 'REQUIRED') {
      const movement = (await api.getProtocol(ctx, protocol.id)).events[0]
      await api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }])
      protocol = loadDb().protocols.find((item) => item.id === protocol.id)!
    }
    await expect(api.forward(ctx, protocol.id, protocol.version, { unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-analysis', message: 'Prosseguir no fluxo.' })).resolves.toMatchObject({ currentPhaseId: 'phase-analysis', currentUnitId: 'u-adm' })
  })

  it.each(['CONCLUIDO', 'ARQUIVADO'] as const)('retoma a fase final de %s e permite concluir novamente', async (status) => {
    const db = loadDb()
    let protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = status
    protocol.currentPhaseId = 'phase-completion'
    protocol.completedAt = '2026-01-01T00:00:00Z'
    protocol.archivedAt = '2026-01-02T00:00:00Z'
    protocol.dueAt = '2026-01-03T00:00:00Z'
    saveDb(db)
    protocol = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: 'Rever resultado final.' })
    expect(protocol.completedAt).toBeUndefined()
    expect(protocol.archivedAt).toBeUndefined()
    expect(protocol.dueAt).toBeUndefined()
    protocol = await api.acknowledge(ctx, protocol.id, protocol.version)
    const movement = (await api.getProtocol(ctx, protocol.id)).events[0]
    await api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [{ questionId: 'q-completion-result', text: 'Registrar resultado final', checked: true, date: '2026-10-16', observation: 'Resultado revisto.' }])
    protocol = loadDb().protocols.find((item) => item.id === protocol.id)!
    await expect(api.complete(ctx, protocol.id, protocol.version, 'Análise concluída após revisão.')).resolves.toMatchObject({ status: 'CONCLUIDO' })
  })

  it('recupera a última fase válida de um processo encerrado com referência antiga', async () => {
    const db = loadDb()
    let protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = 'CANCELADO'
    protocol.currentPhaseId = 'phase-antiga-inexistente'
    saveDb(db)
    protocol = await api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-prot', message: 'Recuperar fase anterior.' })
    expect(protocol.currentPhaseId).toBe('phase-triage')
  })

  it('recusa reabrir para uma unidade sem ninguém que possa assumir, sem alterar o processo', async () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = 'CANCELADO'
    db.units.push({ id: 'u-sem-operador', name: 'Sem operadores', abbreviation: 'SO', active: true })
    saveDb(db)
    await expect(api.reopen(ctx, protocol.id, protocol.version, { unitId: 'u-sem-operador', message: 'Retomar em outra unidade.' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(loadDb()).toEqual(db)
  })

  it('usa o checklist correto mesmo com eventos fora de ordem ou com o mesmo horário', () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const original = db.events.find((item) => item.id === 'ev-open-1')!
    const reopened = { ...original, id: 'reopen-ordered', kind: 'REABERTURA' as const, checklist: [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: false }], createdAt: new Date().toISOString() }
    const future = { ...reopened, id: 'future-cycle', checklist: [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }], createdAt: '2099-01-01T00:00:00Z' }
    db.events.unshift(future)
    db.events.push(reopened)
    expect(phaseChecklistMovement(db, protocol, reopened).id).toBe(reopened.id)
    expect(phaseChecklistAnswers(db, protocol, reopened)[0].checked).toBe(false)
  })
})
