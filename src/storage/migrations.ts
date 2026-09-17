import type { Database, FlowPhase, ProtocolFlow, ProtocolFlowSnapshot, ProtocolPhase, Unit } from '../domain/model'

type LegacyDatabaseV1 = Omit<Database, 'schemaVersion' | 'units' | 'memberships' | 'auditEvents' | 'phases' | 'flows' | 'flowPhases'> & {
  schemaVersion: 1
  units: Array<Omit<Unit, 'position'>>
}
type LegacyDatabaseV2 = Omit<Database, 'schemaVersion' | 'phases' | 'flows' | 'flowPhases'> & {
  schemaVersion: 2
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

const migrateV2 = (legacy: LegacyDatabaseV2): Database => {
  const phases: ProtocolPhase[] = [
    { id: 'phase-triage', name: 'Triagem', code: 'TRIAGEM', description: 'Conferência inicial e definição do destino.', eligibleUnitIds: [], checklistItems: [], requiredAttachmentTypes: [], active: true },
    { id: 'phase-analysis', name: 'Análise', code: 'ANALISE', description: 'Tratamento pela unidade responsável.', eligibleUnitIds: [], checklistItems: [], requiredAttachmentTypes: [], active: true },
    { id: 'phase-completion', name: 'Conclusão', code: 'CONCLUSAO', description: 'Registro do resultado e encerramento.', eligibleUnitIds: [], checklistItems: [], requiredAttachmentTypes: [], active: true },
  ]
  const flow: ProtocolFlow = { id: 'flow-standard-v1', name: 'Fluxo padrão de protocolos', version: 1, active: true, startsAt: legacy.initializedAt }
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

export const migrateDatabase = (value: unknown): Database => {
  if (
    !isDatabaseShape(value) ||
    !Array.isArray(value.users) ||
    !Array.isArray(value.units) ||
    !Array.isArray(value.protocols)
  ) {
    throw new Error('Dados locais incompatíveis.')
  }
  if (value.schemaVersion === 3) return value as Database
  if (value.schemaVersion === 2) return migrateV2(value as LegacyDatabaseV2)
  if (value.schemaVersion === 1) return migrateV2(migrateV1(value as LegacyDatabaseV1))
  throw new Error('Versão de dados não suportada.')
}