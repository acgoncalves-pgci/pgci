import { describe, expect, it } from 'vitest'
import { seedDatabase } from './seed'

describe('dados de demonstração', () => {
  it('oferece catálogos municipais completos com fluxos e checklists coerentes', () => {
    const db = seedDatabase()
    const purchaseType = db.protocolTypes.find((type) => type.id === 'pt-purchase-request')!
    const purchaseFlow = db.flows.find((flow) => flow.id === purchaseType.flowId)!
    const purchaseStages = db.flowPhases
      .filter((stage) => stage.flowId === purchaseFlow.id)
      .sort((left, right) => left.position - right.position)

    expect(db.processCategories.length).toBeGreaterThanOrEqual(5)
    expect(db.documentTypes.length).toBeGreaterThanOrEqual(8)
    expect(purchaseType).toMatchObject({
      name: 'Solicitação de compra',
      flowMode: 'REQUIRED',
      active: true,
    })
    expect(purchaseStages.length).toBeGreaterThanOrEqual(5)
    expect(purchaseStages.every((stage) => stage.destinationUnitId)).toBe(true)
    expect(purchaseStages.some((stage) => stage.requiresChecklist && stage.checklistQuestions?.length)).toBe(true)

    for (const stage of db.flowPhases) {
      expect(db.flows.some((flow) => flow.id === stage.flowId)).toBe(true)
      expect(db.phases.some((phase) => phase.id === stage.phaseId)).toBe(true)
      expect(db.situations.some((situation) => situation.id === stage.situationTypeId)).toBe(true)
    }
  })

  it('mantém os catálogos fixos e varia os processos gerados para cada restauração', () => {
    const first = seedDatabase({ variation: 101 })
    const second = seedDatabase({ variation: 202 })
    const catalogs = ['processCategories', 'protocolTypes', 'phases', 'situations', 'documentTypes', 'flows', 'flowPhases'] as const

    for (const catalog of catalogs) expect(second[catalog]).toEqual(first[catalog])
    expect(second.protocols.map((protocol) => protocol.subject)).not.toEqual(first.protocols.map((protocol) => protocol.subject))
    expect(second.protocols.map((protocol) => protocol.typeId)).not.toEqual(first.protocols.map((protocol) => protocol.typeId))
  })

  it('cria snapshots compatíveis com o fluxo de cada tipo e checklists restritos à movimentação da etapa', () => {
    const db = seedDatabase({ variation: 303 })

    for (const protocol of db.protocols) {
      const type = db.protocolTypes.find((item) => item.id === protocol.typeId)!
      if (protocol.flowSnapshot) {
        expect(protocol.flowSnapshot.flowId).toBe(type.flowId)
        expect(protocol.flowSnapshot.phases.some((phase) => phase.phaseId === protocol.currentPhaseId)).toBe(true)
      }

      const checklistEvents = db.events.filter((event) => event.protocolId === protocol.id && event.checklist?.length)
      for (const event of checklistEvents) {
        expect(event.kind).toBe('TRAMITACAO')
        const stage = protocol.flowSnapshot?.phases.find((phase) => phase.phaseId === event.phaseId)
        expect(stage?.requiresChecklist || stage?.checklistQuestions.length).toBeTruthy()
        expect(event.checklist?.map((answer) => answer.questionId)).toEqual(stage?.checklistQuestions.map((question) => question.id))
      }
    }
  })
  it('mantém integridade referencial e conteúdo operacional realista em toda a massa', () => {
    const db = seedDatabase({ variation: 404 })
    const unitIds = new Set(db.units.map((unit) => unit.id))
    const userIds = new Set(db.users.map((user) => user.id))
    const typeIds = new Set(db.protocolTypes.map((type) => type.id))
    const phaseIds = new Set(db.phases.map((phase) => phase.id))
    const personIds = new Set(db.people.map((person) => person.id))
    const assignmentIds = new Set(db.assignments.map((assignment) => assignment.id))
    const documentTypeIds = new Set(db.documentTypes.map((type) => type.id))

    expect(new Set(db.protocolTypes.map((type) => type.flowMode))).toEqual(new Set(['REQUIRED', 'SUGGESTED', 'NONE']))
    expect(db.protocols.every((protocol) => !protocol.description.includes('Registro fictício'))).toBe(true)

    for (const protocol of db.protocols) {
      expect(typeIds.has(protocol.typeId)).toBe(true)
      expect(unitIds.has(protocol.originUnitId)).toBe(true)
      expect(unitIds.has(protocol.currentUnitId)).toBe(true)
      expect(userIds.has(protocol.createdById)).toBe(true)
      expect(protocol.currentAssigneeId ? userIds.has(protocol.currentAssigneeId) : true).toBe(true)
      expect(protocol.interestedPersonId ? personIds.has(protocol.interestedPersonId) : true).toBe(true)
      expect(protocol.creditorPersonId ? personIds.has(protocol.creditorPersonId) : true).toBe(true)
      expect(protocol.typeConfigSnapshot.contractNumber?.enabled ? protocol.contractNumber : true).toBeTruthy()
      expect(protocol.typeConfigSnapshot.biddingNumber?.enabled ? protocol.biddingNumber : true).toBeTruthy()
      expect(protocol.typeConfigSnapshot.legalProcessNumber?.enabled ? protocol.legalProcessNumber : true).toBeTruthy()
      expect(protocol.typeConfigSnapshot.referenceNumber?.enabled ? protocol.referenceNumber : true).toBeTruthy()
      expect(assignmentIds.has(protocol.currentAssignmentId)).toBe(true)
      expect(protocol.currentPhaseId ? phaseIds.has(protocol.currentPhaseId) : protocol.flowModeSnapshot === 'NONE').toBe(true)
    }

    for (const document of db.documents) {
      expect(documentTypeIds.has(document.typeId)).toBe(true)
      expect(unitIds.has(document.unitId)).toBe(true)
      expect(userIds.has(document.authorUserId)).toBe(true)
      expect(document.protocolId ? db.protocols.some((protocol) => protocol.id === document.protocolId) : true).toBe(true)
      expect(document.movementEventId ? db.events.some((event) => event.id === document.movementEventId) : true).toBe(true)
    }
    expect(db.counters['document-2026']).toBe(db.documents.length)
  })
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