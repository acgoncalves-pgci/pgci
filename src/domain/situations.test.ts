import { describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { currentProtocolSituation } from './situations'

describe('situação atual do processo', () => {
  it('usa a situação configurada na fase atual do snapshot', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-2')!
    const currentPhase = protocol.flowSnapshot!.phases.find((phase) => phase.phaseId === protocol.currentPhaseId)!
    currentPhase.situationType = {
      id: 'situation-awaiting-review',
      name: 'Aguardando parecer',
      category: 'EM_TRAMITACAO',
      color: '#2563EB',
      icon: 'Clock3',
    }

    expect(currentProtocolSituation(db, protocol)).toMatchObject({
      id: 'situation-awaiting-review',
      name: 'Aguardando parecer',
    })
  })

  it('prioriza as situações finais de sistema para processos concluídos ou arquivados', () => {
    const db = seedDatabase()
    const completed = db.protocols.find((item) => item.status === 'CONCLUIDO')!
    const archived = db.protocols.find((item) => item.status === 'ARQUIVADO')!

    expect(currentProtocolSituation(db, completed)?.name).toBe('Concluído')
    expect(currentProtocolSituation(db, archived)?.name).toBe('Arquivado')
  })

  it('usa a situação de sistema quando o processo não possui fluxo', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-2')!
    protocol.flowSnapshot = undefined
    protocol.currentPhaseId = undefined

    expect(currentProtocolSituation(db, protocol)?.name).toBe('Em tramitação')
  })

  it('identifica um processo reaberto sem fluxo pela movimentação mais recente', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-2')!
    protocol.flowSnapshot = undefined
    protocol.currentPhaseId = undefined
    db.events.push({
      id: 'event-reopened-test',
      protocolId: protocol.id,
      kind: 'REABERTURA',
      actorUserId: 'usr-admin',
      actorUnitId: protocol.currentUnitId,
      assignmentId: protocol.currentAssignmentId,
      previousStatus: 'CONCLUIDO',
      nextStatus: 'EM_ANDAMENTO',
      createdAt: '2099-01-01T00:00:00.000Z',
    })

    expect(currentProtocolSituation(db, protocol)?.name).toBe('Reaberto')
  })
})