import type { ChecklistQuestion, Database, Protocol, ProtocolPhase, ProtocolType } from './model'
import { isMovementEvent } from './model'
import { DomainError } from './rules'

export const phaseQuestionsFor = (phase: Pick<ProtocolPhase, 'checklistItems' | 'checklistQuestions'>): ChecklistQuestion[] =>
  (phase.checklistQuestions?.length ? phase.checklistQuestions : phase.checklistItems.map((text, order) => ({ id: `legacy-${order}`, text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }))).slice().sort((a, b) => a.order - b.order)

export function flowSnapshotFor(db: Database, type: ProtocolType) {
  const mode = type.flowMode ?? (type.flowId ? 'REQUIRED' : 'NONE')
  if (mode === 'NONE') return { mode, snapshot: undefined }
  const flow = type.flowId ? db.flows.find((item) => item.id === type.flowId && item.active) : undefined
  if (!flow) {
    if (mode === 'SUGGESTED') return { mode, snapshot: undefined }
    throw new DomainError('VALIDATION', 'O fluxo obrigatório deste tipo ainda não foi configurado.')
  }
  const phases = db.flowPhases.filter((item) => item.flowId === flow.id).sort((a, b) => a.position - b.position).map((stage) => {
    const phase = db.phases.find((item) => item.id === stage.phaseId && item.active)
    if (!phase) throw new DomainError('VALIDATION', 'O fluxo possui uma fase indisponível.')
    const situation = stage.situationTypeId ? db.situations.find((item) => item.id === stage.situationTypeId) : undefined
    return { phaseId: phase.id, name: phase.name, code: phase.code, position: stage.position, required: stage.required, eligibleUnitIds: phase.eligibleUnitIds, checklistItems: stage.checklistQuestions?.map((question) => question.text) ?? phase.checklistItems, checklistQuestions: stage.checklistQuestions ?? phaseQuestionsFor(phase), requiredAttachmentTypes: phase.requiredAttachmentTypes, situation: stage.situation, situationType: situation ? { id: situation.id, name: situation.name, category: situation.category, color: situation.color, icon: situation.icon } : undefined, destinationUnitId: stage.destinationUnitId, requiresChecklist: stage.requiresChecklist, requiresAttachment: stage.requiresAttachment, observation: stage.observation, color: stage.color, icon: stage.icon }
  })
  if (!phases.length) {
    if (mode === 'SUGGESTED') return { mode, snapshot: undefined }
    throw new DomainError('VALIDATION', 'O fluxo obrigatório precisa possuir ao menos uma fase ativa.')
  }
  return { mode, snapshot: { flowId: flow.id, flowName: flow.name, version: flow.version, phases } }
}

export function recommendedFlowPhase(db: Pick<Database, 'events'>, protocol: Protocol) {
  const phases = protocol.flowSnapshot?.phases.slice().sort((left, right) => left.position - right.position) ?? []
  const current = phases.find((phase) => phase.phaseId === protocol.currentPhaseId)
  const latest = current ?? db.events.filter((event) => event.protocolId === protocol.id && isMovementEvent(event) && phases.some((phase) => phase.phaseId === event.phaseId))
    .slice().reverse().sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((event) => phases.find((phase) => phase.phaseId === event.phaseId))[0]
  return latest ? phases.find((phase) => phase.position > latest.position) ?? latest : phases[0]
}
