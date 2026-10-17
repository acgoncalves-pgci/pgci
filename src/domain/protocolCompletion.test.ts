import { beforeEach, describe, expect, it } from 'vitest'
import type { ChecklistAnswer } from './model'
import { seedDatabase } from '../mocks/seed'
import { loadDb, saveDb } from '../storage/database'
import { api } from '../services/api'

const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
const answer: ChecklistAnswer = { questionId: 'q-completion-result', text: 'Registrar resultado final', checked: true, date: '2026-10-16', observation: 'Resultado final conferido.' }

function finalStage() {
  const db = loadDb()
  const protocol = db.protocols.find((item) => item.id === 'pr-1')!
  protocol.status = 'EM_ANDAMENTO'
  protocol.flowModeSnapshot = 'REQUIRED'
  protocol.currentPhaseId = 'phase-completion'
  const phase = protocol.flowSnapshot!.phases.find((item) => item.phaseId === protocol.currentPhaseId)!
  const movement = db.events.find((item) => item.id === 'ev-open-1')!
  movement.phaseId = phase.phaseId
  movement.checklist = [{ ...answer, checked: false }]
  return { db, protocol, phase, movement }
}

describe('conclusão da fase final obrigatória', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it.each([
    { name: 'item desmarcado', values: [{ ...answer, checked: false }], issue: 'Conclua o item do checklist' },
    { name: 'data ausente', values: [{ ...answer, date: undefined }], issue: 'Informe a data do item' },
    { name: 'observação ausente', values: [{ ...answer, observation: '   ' }], issue: 'Informe a observação do item' },
    { name: 'resposta de outra pergunta', values: [{ ...answer, questionId: 'outra-pergunta' }], issue: 'Conclua o item do checklist' },
  ])('recusa $name pela API, inclusive para administrador, sem modificar o processo', async ({ values, issue }) => {
    const { db, protocol, movement } = finalStage()
    movement.checklist = values
    saveDb(db)
    const before = loadDb()
    await expect(api.complete(ctx, protocol.id, protocol.version, 'Encerramento.')).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining(issue) })
    expect(loadDb()).toEqual(before)
  })

  it.each(['pergunta', 'fase', 'tipo de arquivo'])('exige o anexo obrigatório configurado em %s', async (requirement) => {
    const { db, protocol, phase, movement } = finalStage()
    movement.checklist = [answer]
    db.attachments = db.attachments.filter((item) => item.protocolId !== protocol.id)
    if (requirement === 'pergunta') phase.checklistQuestions[0].requiresAttachment = true
    if (requirement === 'fase') phase.requiresAttachment = true
    if (requirement === 'tipo de arquivo') phase.requiredAttachmentTypes = ['application/pdf']
    saveDb(db)
    const before = loadDb()
    await expect(api.complete(ctx, protocol.id, protocol.version, 'Encerramento.')).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining(requirement === 'tipo de arquivo' ? 'PDF' : 'Anexe') })
    expect(loadDb()).toEqual(before)
  })

  it('permite concluir apenas depois de preencher todos os requisitos', async () => {
    const { db, protocol, movement } = finalStage()
    movement.checklist = [answer]
    saveDb(db)
    await expect(api.complete(ctx, protocol.id, protocol.version, 'Resultado entregue.')).resolves.toMatchObject({ status: 'CONCLUIDO' })
    expect(loadDb().events.filter((item) => item.protocolId === protocol.id && item.kind === 'CONCLUSAO')).toHaveLength(1)
  })

  it('não exige preenchimento de uma pergunta opcional desmarcada', async () => {
    const { db, protocol, phase } = finalStage()
    phase.checklistQuestions[0].required = false
    saveDb(db)
    await expect(api.complete(ctx, protocol.id, protocol.version, 'Resultado entregue.')).resolves.toMatchObject({ status: 'CONCLUIDO' })
  })

  it('valida o checklist atual após reabrir, sem aceitar respostas antigas que foram desmarcadas', async () => {
    const { db, protocol, movement } = finalStage()
    movement.checklist = [answer]
    saveDb(db)
    const cancelled = await api.cancel(ctx, protocol.id, protocol.version, 'Revisar resultado.')
    const reopened = await api.reopen(ctx, protocol.id, cancelled.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: 'Refazer conferência.' })
    const acknowledged = await api.acknowledge(ctx, protocol.id, reopened.version)
    const current = (await api.getProtocol(ctx, protocol.id)).events[0]
    await api.updateMovementChecklist(ctx, protocol.id, acknowledged.version, current.id, [{ ...answer, checked: false }])
    const pending = loadDb().protocols.find((item) => item.id === protocol.id)!
    await expect(api.complete(ctx, pending.id, pending.version, 'Ainda pendente.')).rejects.toMatchObject({ code: 'VALIDATION' })
    await api.updateMovementChecklist(ctx, pending.id, pending.version, current.id, [answer])
    const ready = loadDb().protocols.find((item) => item.id === protocol.id)!
    await expect(api.complete(ctx, ready.id, ready.version, 'Conferência finalizada.')).resolves.toMatchObject({ status: 'CONCLUIDO' })
    expect(loadDb().events.find((item) => item.id === movement.id)?.checklist).toEqual([answer])
  })

  it('mantém a liberdade de conclusão de um fluxo sugerido', async () => {
    const { db, protocol } = finalStage()
    protocol.flowModeSnapshot = 'SUGGESTED'
    saveDb(db)
    await expect(api.complete(ctx, protocol.id, protocol.version, 'Conclusão em fluxo sugerido.')).resolves.toMatchObject({ status: 'CONCLUIDO' })
  })
})
