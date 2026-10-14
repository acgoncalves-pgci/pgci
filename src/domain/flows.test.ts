import { describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { migrateDatabase } from '../storage/migrations'
import { flowSnapshotFor, recommendedFlowPhase } from './flows'

describe('orientação de fluxo sugerido', () => {
  it('mantém a próxima recomendação quando a movimentação sai do fluxo', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'SUGGESTED'
    expect(recommendedFlowPhase(db, protocol)?.phaseId).toBe('phase-analysis')
    protocol.currentPhaseId = 'phase-payment-review'
    db.events.push({ id: 'free-movement', protocolId: protocol.id, kind: 'TRAMITACAO', phaseId: protocol.currentPhaseId, actorUserId: 'usr-clara', actorUnitId: 'u-prot', createdAt: new Date().toISOString() })
    expect(recommendedFlowPhase(db, protocol)?.phaseId).toBe('phase-analysis')
    protocol.currentPhaseId = 'phase-analysis'
    expect(recommendedFlowPhase(db, protocol)?.phaseId).toBe('phase-completion')
  })

  it('recupera somente a orientação ausente sem alterar fase, unidade, versão ou histórico', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'SUGGESTED'; protocol.flowSnapshot = undefined; protocol.currentPhaseId = 'phase-payment-review'
    const before = structuredClone(protocol)
    const migrated = migrateDatabase(db)
    const result = migrated.protocols.find((item) => item.id === protocol.id)!
    expect(result.flowSnapshot?.phases.length).toBeGreaterThan(0)
    expect({ ...result, flowSnapshot: undefined }).toEqual(before)
    expect(migrated.events).toEqual(db.events)
    expect(migrateDatabase(migrated)).toEqual(migrated)
  })

  it('preserva o snapshot existente e o fluxo livre sem adicionar orientação', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'SUGGESTED'
    const snapshot = structuredClone(protocol.flowSnapshot)
    db.flowPhases = []
    expect(migrateDatabase(db).protocols.find((item) => item.id === protocol.id)?.flowSnapshot).toEqual(snapshot)
    expect(flowSnapshotFor(db, { ...db.protocolTypes[0], flowMode: 'NONE' }).snapshot).toBeUndefined()
  })
})
