import { describe, expect, it } from 'vitest'
import { seedDatabase } from './seed'

describe('dados de demonstração', () => {
  it('representa usuários com unidade principal e vínculos secundários', () => {
    const db = seedDatabase()
    const marina = db.users.find((user) => user.id === 'usr-admin')!
    const joana = db.users.find((user) => user.id === 'usr-joana')!
    const activeUnitIds = db.units.filter((unit) => unit.active).map((unit) => unit.id).sort()
    const marinaUnitIds = db.memberships
      .filter((membership) => membership.userId === marina.id && membership.active)
      .map((membership) => membership.unitId)
      .sort()
    const joanaMemberships = db.memberships.filter(
      (membership) => membership.userId === joana.id && membership.active,
    )

    expect(marina.unitId).toBe('u-prot')
    expect(marinaUnitIds).toEqual(activeUnitIds)
    expect(joana.unitId).toBe('u-edu')
    expect(joanaMemberships).toEqual(expect.arrayContaining([
      expect.objectContaining({ unitId: 'u-edu', role: 'OPERADOR' }),
      expect.objectContaining({ unitId: 'u-adm', role: 'GESTOR' }),
    ]))
  })

  it('mantém atribuições e movimentações coerentes para processos enviados a outra unidade', () => {
    const db = seedDatabase()
    const transferred = db.protocols.filter(
      (protocol) => protocol.currentUnitId !== protocol.originUnitId,
    )

    expect(transferred.length).toBeGreaterThan(0)
    for (const protocol of transferred) {
      const opening = db.events.find(
        (event) => event.protocolId === protocol.id && event.kind === 'ABERTURA',
      )!
      const openingAssignment = db.assignments.find(
        (assignment) => assignment.id === opening.assignmentId,
      )!
      const currentAssignment = db.assignments.find(
        (assignment) => assignment.id === protocol.currentAssignmentId,
      )!
      const movementToCurrentUnit = db.events.some(
        (event) =>
          event.protocolId === protocol.id &&
          event.kind === 'TRAMITACAO' &&
          event.toUnitId === protocol.currentUnitId,
      )

      expect(openingAssignment.unitId).toBe(protocol.originUnitId)
      expect(currentAssignment.unitId).toBe(protocol.currentUnitId)
      expect(openingAssignment.id).not.toBe(currentAssignment.id)
      expect(movementToCurrentUnit).toBe(true)
    }
  })

  it('registra todas as fases concluídas no histórico dos processos encerrados', () => {
    const db = seedDatabase()
    const finished = db.protocols.filter(
      (protocol) => protocol.status === 'CONCLUIDO' || protocol.status === 'ARQUIVADO',
    )

    expect(finished.length).toBeGreaterThan(0)
    for (const protocol of finished) {
      const phaseIds = db.events
        .filter((event) => event.protocolId === protocol.id && event.phaseId)
        .map((event) => event.phaseId)

      expect(protocol.currentPhaseId).toBe('phase-completion')
      expect(phaseIds).toEqual(expect.arrayContaining([
        'phase-triage',
        'phase-analysis',
        'phase-completion',
      ]))
    }
  })

  it('inclui uma fila financeira sem destinatário com histórico completo para demonstração', () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-18')!
    const assignment = db.assignments.find(
      (item) => item.id === protocol.currentAssignmentId,
    )!
    const movement = db.events.find((event) => event.id === 'ev-move-18')!
    const phaseIds = db.events
      .filter((event) => event.protocolId === protocol.id && event.phaseId)
      .map((event) => event.phaseId)

    expect(protocol).toMatchObject({
      createdById: 'usr-admin',
      currentUnitId: 'u-fin',
      currentAssigneeId: undefined,
      currentPhaseId: 'phase-completion',
      status: 'EM_ANDAMENTO',
    })
    expect(assignment).toMatchObject({ unitId: 'u-fin', assigneeId: undefined })
    expect(movement).toMatchObject({ toUnitId: 'u-fin', toUserId: undefined })
    expect(phaseIds).toEqual(expect.arrayContaining([
      'phase-triage',
      'phase-analysis',
      'phase-completion',
    ]))
  })
})