import { describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { forwardPendingIssues, phaseChecklistMovement } from './protocolPending'

describe('pendências da tramitação', () => {
  it('aponta checklist, data, observação e anexo exigidos, e libera após resolver tudo', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const movement = db.events.find((item) => item.id === 'ev-open-1')!
    const phase = protocol.flowSnapshot!.phases.find((item) => item.phaseId === protocol.currentPhaseId)!
    const question = phase.checklistQuestions![0]
    question.requiresDate = true
    question.requiresObservation = true
    question.requiresAttachment = true
    phase.requiredAttachmentTypes = ['application/pdf']

    expect(forwardPendingIssues(db, protocol, movement)).toEqual(expect.arrayContaining([
      expect.stringContaining(question.text),
      expect.stringContaining('PDF'),
    ]))

    movement.checklist = [{ questionId: question.id, text: question.text, checked: true }]
    expect(forwardPendingIssues(db, protocol, movement)).toEqual(expect.arrayContaining([
      expect.stringContaining('data'),
      expect.stringContaining('observação'),
      expect.stringContaining('PDF'),
    ]))

    movement.checklist[0].date = '2026-09-28'
    movement.checklist[0].observation = 'Conferido.'
    db.attachments.push({
      id: 'attachment-required', protocolId: protocol.id, movementEventId: movement.id,
      filename: 'comprovante.pdf', mimeType: 'application/pdf', sizeBytes: 1,
      blobKey: 'blob-required', uploadedById: 'usr-clara', createdAt: '2026-09-28T12:00:00.000Z',
    })
    expect(forwardPendingIssues(db, protocol, movement)).toEqual([])
  })

  it('mantém o checklist concluído ao tramitar novamente dentro da mesma fase', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const opening = db.events.find((item) => item.id === 'ev-open-1')!
    opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    const laterMovement = { ...opening, id: 'ev-same-phase', kind: 'TRAMITACAO' as const, checklist: undefined }
    db.events.push(laterMovement)

    expect(phaseChecklistMovement(db, protocol, laterMovement).id).toBe(opening.id)
    expect(forwardPendingIssues(db, protocol, laterMovement)).toEqual([])
  })

  it('não exige os itens da fase cadastrada quando o fluxo sugerido não foi aplicado', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const movement = db.events.find((item) => item.id === 'ev-open-1')!
    protocol.flowModeSnapshot = 'SUGGESTED'
    protocol.flowSnapshot = undefined
    protocol.currentPhaseId = 'phase-payment-review'
    movement.phaseId = protocol.currentPhaseId

    expect(db.phases.find((phase) => phase.id === protocol.currentPhaseId)?.checklistItems.length).toBeGreaterThan(0)
    expect(forwardPendingIssues(db, protocol, movement)).toEqual([])
  })
})
