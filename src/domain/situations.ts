import type { Database, Protocol, ProtocolStatus, SituationCategory, SituationSnapshot, SituationType } from './model'

export const situationCategoryLabel: Record<SituationCategory, string> = {
  CADASTRADO: 'Cadastrado',
  EM_TRAMITACAO: 'Em tramitação',
  CONCLUIDO: 'Concluído',
  ARQUIVADO: 'Arquivado',
  CANCELADO: 'Cancelado',
  REABERTO: 'Reaberto',
  REJEITADO: 'Rejeitado',
}

export const systemSituationTypes = (): SituationType[] => [
  { id: 'situation-archived', name: 'Arquivado', category: 'ARQUIVADO', color: '#8E44AD', icon: 'Archive', observation: 'Processo encerrado e arquivado.', system: true, active: true },
  { id: 'situation-registered', name: 'Cadastrado', category: 'CADASTRADO', color: '#F59E0B', icon: 'FilePlus2', observation: 'Processo registrado no sistema.', system: true, active: true },
  { id: 'situation-cancelled', name: 'Cancelado', category: 'CANCELADO', color: '#E74C3C', icon: 'CircleX', observation: 'Processo cancelado.', system: true, active: true },
  { id: 'situation-completed', name: 'Concluído', category: 'CONCLUIDO', color: '#16A66A', icon: 'CircleCheck', observation: 'Processo concluído.', system: true, active: true },
  { id: 'situation-processing', name: 'Em tramitação', category: 'EM_TRAMITACAO', color: '#EA580C', icon: 'ArrowRight', observation: 'Processo em tramitação entre etapas ou unidades.', system: true, active: true },
  { id: 'situation-reopened', name: 'Reaberto', category: 'REABERTO', color: '#14A7A0', icon: 'RefreshCcw', observation: 'Processo reaberto para novas providências.', system: true, active: true },
  { id: 'situation-rejected', name: 'Rejeitado', category: 'REJEITADO', color: '#3B82F6', icon: 'Ban', observation: 'Processo rejeitado.', system: true, active: true },
]

const legacySituationIds: Record<ProtocolStatus, string> = {
  CADASTRADO: 'situation-registered',
  EM_ANDAMENTO: 'situation-processing',
  CONCLUIDO: 'situation-completed',
  ARQUIVADO: 'situation-archived',
}

export const legacySituationTypeId = (status: ProtocolStatus | undefined) => status ? legacySituationIds[status] : undefined

export const currentProtocolSituation = (db: Pick<Database, 'situations' | 'events'>, protocol: Protocol): SituationSnapshot | SituationType | undefined => {
  const systemSituation = (status: ProtocolStatus) => db.situations.find((situation) => situation.id === legacySituationTypeId(status))
  if (protocol.status === 'CONCLUIDO' || protocol.status === 'ARQUIVADO') return systemSituation(protocol.status)

  const phaseSituation = protocol.flowSnapshot?.phases.find((phase) => phase.phaseId === protocol.currentPhaseId)?.situationType
  if (phaseSituation) return phaseSituation

  const latestMovement = db.events
    .filter((event) => event.protocolId === protocol.id && event.nextStatus)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  if (latestMovement?.kind === 'REABERTURA') return db.situations.find((situation) => situation.id === 'situation-reopened')

  return systemSituation(protocol.status)
}
