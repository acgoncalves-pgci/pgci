import { isMovementEvent } from '../domain/model'
import type { Database, FlowPhase, ProtocolEvent, ProtocolFlow, ProtocolFlowSnapshot, ProtocolPhase, ProtocolStatus, Unit } from '../domain/model'
import { legacySituationTypeId, systemSituationTypes } from '../domain/situations'
import { defaultProcessCategories } from '../domain/processCategories'

type LegacyDatabaseV1 = Omit<Database, 'schemaVersion' | 'units' | 'memberships' | 'auditEvents' | 'phases' | 'flows' | 'flowPhases' | 'situations' | 'processCategories'> & {
  schemaVersion: 1
  units: Array<Omit<Unit, 'position'>>
}
type LegacyDatabaseV2 = Omit<Database, 'schemaVersion' | 'phases' | 'flows' | 'flowPhases' | 'situations' | 'processCategories'> & {
  schemaVersion: 2
}
type LegacyDatabaseV3 = Omit<Database, 'schemaVersion' | 'situations' | 'processCategories'> & {
  schemaVersion: 3
}
type LegacyDatabaseV4 = Omit<Database, 'schemaVersion' | 'processCategories'> & {
  schemaVersion: 4
}

const isDatabaseShape = (
  value: unknown,
): value is { schemaVersion?: number; users?: unknown[]; units?: unknown[]; protocols?: unknown[] } =>
  typeof value === 'object' && value !== null

const migrateV1 = (legacy: LegacyDatabaseV1): LegacyDatabaseV2 => {
  const positions = new Map<string, number>()
  const units = legacy.units.map((unit) => {
    const parentKey = unit.parentId ?? 'root'
    const position = positions.get(parentKey) ?? 0
    positions.set(parentKey, position + 1)
    return { ...unit, position }
  })
  const memberships = legacy.users.flatMap((user) => {
    const linkedUnits = user.role === 'ADMIN'
      ? units.filter((unit) => unit.active)
      : units.filter((unit) => unit.id === user.unitId)
    return linkedUnits.map((unit) => ({
      id: `membership-${user.id}-${unit.id}`,
      userId: user.id,
      unitId: unit.id,
      role: user.role,
      title: user.role === 'ADMIN' ? 'Administrador geral' : 'Operador',
      startsAt: legacy.initializedAt,
      active: user.active,
    }))
  })
  return { ...legacy, schemaVersion: 2, units, memberships, auditEvents: [] }
}

const migrateV2 = (legacy: LegacyDatabaseV2): LegacyDatabaseV3 => {
  const phases: ProtocolPhase[] = [
    { id: 'phase-triage', name: 'Triagem', code: 'TRIAGEM', description: 'Conferência inicial e definição do destino.', eligibleUnitIds: [], checklistItems: [], requiredAttachmentTypes: [], active: true },
    { id: 'phase-analysis', name: 'Análise', code: 'ANALISE', description: 'Tratamento pela unidade responsável.', eligibleUnitIds: [], checklistItems: [], requiredAttachmentTypes: [], active: true },
    { id: 'phase-completion', name: 'Conclusão', code: 'CONCLUSAO', description: 'Registro do resultado e encerramento.', eligibleUnitIds: [], checklistItems: [], requiredAttachmentTypes: [], active: true },
  ]
  const flow: ProtocolFlow = { id: 'flow-standard-v1', name: 'Fluxo padrão de processos', version: 1, active: true, startsAt: legacy.initializedAt }
  const flowPhases: FlowPhase[] = phases.map((phase, index) => ({
    id: `flow-phase-standard-${index + 1}`,
    flowId: flow.id,
    phaseId: phase.id,
    position: index,
    required: true,
  }))
  const snapshot: ProtocolFlowSnapshot = {
    flowId: flow.id,
    flowName: flow.name,
    version: flow.version,
    phases: flowPhases.map((flowPhase) => {
      const phase = phases.find((item) => item.id === flowPhase.phaseId)!
      return {
        phaseId: phase.id,
        name: phase.name,
        code: phase.code,
        position: flowPhase.position,
        required: flowPhase.required,
        eligibleUnitIds: phase.eligibleUnitIds,
        checklistItems: phase.checklistItems,
        checklistQuestions: phase.checklistQuestions ?? [],
        requiredAttachmentTypes: phase.requiredAttachmentTypes,
      }
    }),
  }
  return {
    ...legacy,
    schemaVersion: 3,
    phases,
    flows: [flow],
    flowPhases,
    protocolTypes: legacy.protocolTypes.map((type) => ({ ...type, flowId: type.flowId ?? flow.id })),
    protocols: legacy.protocols.map((protocol) => ({
      ...protocol,
      flowSnapshot: protocol.flowSnapshot ?? structuredClone(snapshot),
      currentPhaseId: protocol.currentPhaseId ?? phases[0].id,
    })),
  }
}

const migrateV3 = (legacy: LegacyDatabaseV3): LegacyDatabaseV4 => {
  const situations = systemSituationTypes()
  const situationSnapshot = (status: ProtocolStatus | undefined) => {
    const situation = situations.find((item) => item.id === legacySituationTypeId(status))
    return situation ? { id: situation.id, name: situation.name, category: situation.category, color: situation.color, icon: situation.icon } : undefined
  }
  return {
    ...legacy,
    schemaVersion: 4,
    situations,
    flowPhases: legacy.flowPhases.map((stage) => ({ ...stage, situationTypeId: legacySituationTypeId(stage.situation) })),
    protocols: legacy.protocols.map((protocol) => ({
      ...protocol,
      flowSnapshot: protocol.flowSnapshot ? {
        ...protocol.flowSnapshot,
        phases: protocol.flowSnapshot.phases.map((phase) => ({ ...phase, situationType: situationSnapshot(phase.situation) })),
      } : undefined,
    })),
  }
}

const migrateV4 = (legacy: LegacyDatabaseV4): Database => {
  const processCategories = defaultProcessCategories()
  return {
    ...legacy,
    schemaVersion: 5,
    processCategories,
    protocolTypes: legacy.protocolTypes.map((type) => ({
      ...type,
      categoryId: type.categoryId ?? (type.id === 'pt-info' || type.id === 'pt-serv' ? 'category-service' : 'category-administrative'),
    })),
  }
}
const relatedMovement = (database: Database, protocolId: string | undefined, createdAt: string, legacyEvent?: ProtocolEvent) => {
  if (!protocolId) return undefined
  const candidates = database.events
    .filter((event) => event.protocolId === protocolId && isMovementEvent(event) && event.createdAt <= (legacyEvent?.createdAt ?? createdAt))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return candidates.find((event) => legacyEvent?.assignmentId && event.assignmentId === legacyEvent.assignmentId)?.id ?? candidates[0]?.id
}

const normalizeProcessTerminology = (database: Database): Database => ({
  ...database,
  units: database.units.map((unit) => unit.name === 'Protocolo Geral' || unit.name === 'Processo Geral'
    ? { ...unit, name: 'Gestão de Processos', abbreviation: 'GP' }
    : unit),
  flows: database.flows.map((flow) => flow.name === 'Fluxo padrão de protocolos'
    ? { ...flow, name: 'Fluxo padrão de processos' }
    : flow),
  documents: database.documents.map((document) => document.movementEventId ? document : {
    ...document,
    movementEventId: relatedMovement(database, document.protocolId, document.createdAt, database.events.find((event) => event.relatedDocumentId === document.id)),
  }),
  attachments: database.attachments.map((attachment) => attachment.movementEventId ? attachment : {
    ...attachment,
    movementEventId: relatedMovement(database, attachment.protocolId, attachment.createdAt, database.events.find((event) => event.relatedAttachmentId === attachment.id)),
  }),
})

export const migrateDatabase = (value: unknown): Database => {
  if (
    !isDatabaseShape(value) ||
    !Array.isArray(value.users) ||
    !Array.isArray(value.units) ||
    !Array.isArray(value.protocols)
  ) {
    throw new Error('Dados locais incompatíveis.')
  }
  if (value.schemaVersion === 5) return normalizeProcessTerminology(value as Database)
  if (value.schemaVersion === 4) return normalizeProcessTerminology(migrateV4(value as LegacyDatabaseV4))
  if (value.schemaVersion === 3) return normalizeProcessTerminology(migrateV4(migrateV3(value as LegacyDatabaseV3)))
  if (value.schemaVersion === 2) return normalizeProcessTerminology(migrateV4(migrateV3(migrateV2(value as LegacyDatabaseV2))))
  if (value.schemaVersion === 1) return normalizeProcessTerminology(migrateV4(migrateV3(migrateV2(migrateV1(value as LegacyDatabaseV1)))))
  throw new Error('Versão de dados não suportada.')
}
