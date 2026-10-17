import type { Context, Database, Protocol } from './model'
import { isActive } from './model'
import { canView } from './rules'

export interface ForwardInput {
  unitId: string;
  assigneeId?: string;
  phaseId?: string;
  message: string;
  dueAt?: string;
  activity?: string;
  result?: string;
}

export type BatchMovementInput = Pick<ForwardInput, 'unitId' | 'assigneeId' | 'phaseId' | 'message' | 'dueAt'>
export interface BatchForwardInput {
  requestId: string;
  typeIds: string[];
  processes: Array<{ protocolId: string; expectedVersion: number }>;
  movement: BatchMovementInput;
}

export function batchCandidateProtocols(db: Database, ctx: Context): Protocol[] {
  return db.protocols.filter((protocol) => isActive(protocol)
    && (protocol.currentAssigneeId === ctx.userId || protocol.createdById === ctx.userId)
    && canView(db, protocol, ctx))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function batchPhaseOptions(db: Database, protocols: Protocol[]) {
  const options = new Map<string, { id: string; name: string }>()
  for (const protocol of protocols) {
    const phases = protocol.flowSnapshot?.phases.slice().sort((a, b) => a.position - b.position) ?? []
    if (phases.length && protocol.flowModeSnapshot !== 'SUGGESTED') {
      const current = phases.find((phase) => phase.phaseId === protocol.currentPhaseId)
      const next = current ? phases.find((phase) => phase.position > current.position) ?? current : phases[0]
      options.set(next.phaseId, { id: next.phaseId, name: next.name })
    } else {
      db.phases.filter((phase) => phase.active).forEach((phase) => options.set(phase.id, { id: phase.id, name: phase.name }))
    }
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
