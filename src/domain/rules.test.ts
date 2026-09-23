import { beforeEach, describe, expect, it } from 'vitest'
import { canAct, canView, isDueSoon, isOverdue } from './rules'
import { seedDatabase } from '../mocks/seed'
import { isMovementEvent } from './model'
import { api } from '../services/api'
import { DATABASE_KEY, loadDb, saveDb, StorageError, storageErrorMessage } from '../storage/database'
import { GENERAL_SETTINGS_KEY } from '../lib/numbering'
import { participantOptions } from './participants'

describe('regras do MVP', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('considera vencido somente processo ativo com prazo no passado', () => {
    const db = seedDatabase(); const active = db.protocols.find((p) => p.id === 'pr-2')!; const archived = db.protocols.find((p) => p.id === 'pr-11')!
    expect(isOverdue(active)).toBe(true); expect(isOverdue(archived)).toBe(false)
  })
  it('calcula a janela de 24 horas sem incluir prazo atrasado', () => {
    const db = seedDatabase(); expect(isDueSoon(db.protocols.find((p) => p.id === 'pr-4')!)).toBe(true); expect(isDueSoon(db.protocols.find((p) => p.id === 'pr-2')!)).toBe(false)
  })
  it('mantém visibilidade de quem participou do histórico fora da unidade selecionada', async () => {
    const db = seedDatabase(); const protocol = db.protocols.find((p) => p.id === 'pr-5')!
    const ctx = { userId: 'usr-bruno', activeUnitId: 'u-adm', scopeUnitId: 'u-adm' }
    expect(canView(db, protocol, ctx)).toBe(true)
    expect(canAct(db, protocol, ctx)).toBe(false)
    await expect(api.getProtocol(ctx, protocol.id)).resolves.toMatchObject({ protocol: { id: protocol.id } })
  })
  it('opera pela unidade secundária sem alterar a unidade principal dos usuários', async () => {
    const db = seedDatabase()
    db.memberships.push({
      id: 'membership-clara-adm',
      userId: 'usr-clara',
      unitId: 'u-adm',
      role: 'OPERADOR',
      title: 'Apoio administrativo',
      startsAt: new Date(Date.now() - 1000).toISOString(),
      active: true,
    })
    saveDb(db)
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-adm', scopeUnitId: 'u-adm' }

    const created = await api.createProtocol(ctx, {
      typeId: 'pt-info',
      subject: 'Processo criado em unidade secundária',
      description: 'Validação do vínculo operacional sem troca da unidade principal.',
      interestedPersonId: 'p-1',
      assigneeId: 'usr-clara',
    })
    expect(created).toMatchObject({
      originUnitId: 'u-adm',
      currentUnitId: 'u-adm',
      currentAssigneeId: 'usr-clara',
    })

    const createdDb = loadDb()
    const openingMovement = createdDb.events.find((event) => event.protocolId === created.id && event.kind === 'ABERTURA')!
    openingMovement.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    saveDb(createdDb)

    const forwarded = await api.forward(ctx, created.id, created.version, {
      unitId: 'u-adm',
      assigneeId: 'usr-admin',
      message: 'Designação para administrador com vínculo secundário.',
    })
    expect(forwarded.currentAssigneeId).toBe('usr-admin')

    const queue = loadDb().protocols.find((protocol) => protocol.id === 'pr-9')!
    const assumed = await api.assume(ctx, queue.id, queue.version)
    const persisted = loadDb()
    expect(assumed.currentAssigneeId).toBe('usr-clara')
    expect(canAct(persisted, assumed, ctx)).toBe(true)
    expect(persisted.users.find((user) => user.id === 'usr-clara')?.unitId).toBe('u-prot')
    expect(persisted.users.find((user) => user.id === 'usr-admin')?.unitId).toBe('u-prot')
  })
  it('usa o responsável configurado na abertura e preserva as observações', async () => {
    const db = seedDatabase()
    const type = db.protocolTypes.find((item) => item.id === 'pt-admin')!
    type.fieldsConfig = { ...type.fieldsConfig, responsavel: { enabled: true, required: true } }
    saveDb(db)
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }

    await expect(api.createProtocol(ctx, {
      typeId: type.id,
      subject: 'Processo com responsável',
      description: 'Descrição do processo.',
      interestedPersonId: 'p-1',
    })).rejects.toMatchObject({ code: 'VALIDATION' })

    const protocol = await api.createProtocol(ctx, {
      typeId: type.id,
      subject: 'Processo com responsável',
      description: 'Descrição do processo.',
      observations: 'Observação registrada na abertura.',
      interestedPersonId: 'p-1',
      assigneeId: 'usr-admin',
    })
    const persisted = loadDb()
    const assignment = persisted.assignments.find((item) => item.id === protocol.currentAssignmentId)

    expect(protocol).toMatchObject({
      currentAssigneeId: 'usr-admin',
      observations: 'Observação registrada na abertura.',
    })
    expect(assignment?.receivedAt).toBeUndefined()
  })
  it('gera números sequenciais mesmo após uma nova leitura do armazenamento', async () => {
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
    const common = { typeId: 'pt-admin', subject: 'Teste sequencial', description: 'Descrição de teste.', interestedPersonId: 'p-1' }
    const first = await api.createProtocol(ctx, common); const second = await api.createProtocol(ctx, common)
    expect(first.number).toMatch(/^2026\./); expect(Number(second.number.split('.').at(-1))).toBe(Number(first.number.split('.').at(-1)) + 1)
  })
})


describe('cadastro de pessoas', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin edite uma pessoa e preserve o identificador', async () => {
    const person = await api.updatePerson({ userId: 'usr-admin', activeUnitId: 'u-prot' }, 'p-1', {
      kind: 'PF', name: 'Ana Beatriz Atualizada', roles: ['INTERESSADO'], email: 'ana.atualizada@example.com', active: true
    })
    expect(person.id).toBe('p-1')
    expect(person.name).toBe('Ana Beatriz Atualizada')
  })
  it('recusa edição de pessoa por operador', async () => {
    await expect(api.updatePerson({ userId: 'usr-clara', activeUnitId: 'u-prot' }, 'p-1', {
      kind: 'PF', name: 'Alteração indevida', roles: ['INTERESSADO'], active: true
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('estrutura de unidades', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin crie unidade subordinada', async () => {
    const unit = await api.createUnit({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Almoxarifado', abbreviation: 'ALM', parentId: 'u-adm', active: true })
    expect(unit.name).toBe('Almoxarifado')
    expect(unit.parentId).toBe('u-adm')
  })

  it('exclui uma unidade sem vínculos e preserva unidades em uso', async () => {
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const unit = await api.createUnit(ctx, { name: 'Unidade temporária', abbreviation: 'TMP', parentId: 'u-adm', active: true })

    await expect(api.deleteUnit(ctx, unit.id)).resolves.toBe(true)
    expect(loadDb().units.some((item) => item.id === unit.id)).toBe(false)
    await expect(api.deleteUnit(ctx, 'u-adm')).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})


describe('validação de hierarquia', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa tornar uma unidade subordinada de sua descendente', async () => {
    await expect(api.updateUnit({ userId: 'usr-admin', activeUnitId: 'u-prot' }, 'u-adm', {
      name: 'Administração', abbreviation: 'ADM', parentId: 'u-fin', active: true
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('tipos de processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa criar tipo de processo sem uma categoria ativa', async () => {
    const existing = loadDb().protocolTypes[0]
    await expect(api.createProtocolType({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      ...existing,
      name: 'Tipo sem categoria',
      categoryId: '',
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('permite que admin crie tipo com configuração de campos válida', async () => {
    const type = await api.createProtocolType({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      name: 'Novo tipo', categoryId: 'category-administrative', description: 'Descrição do novo tipo', color: '#17628b', flowId: 'flow-standard-v1', defaultDeadlineDays: 5, active: true,
      fieldsConfig: { interested: { enabled: true, required: true }, creditor: { enabled: false, required: false }, amount: { enabled: false, required: false } }
    })
    expect(type.name).toBe('Novo tipo')
    expect(type.fieldsConfig.interested.required).toBe(true)
  })

  it('persiste os campos complementares e as autorizações do tipo', async () => {
    const type = await api.createProtocolType({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      name: 'Contrato administrativo restrito', categoryId: 'category-administrative', description: 'Contratos disponíveis para usuários e unidades autorizados.', color: '#17628b', flowMode: 'NONE', active: true,
      authorizedUserIds: ['usr-clara', 'usr-clara'], authorizedUnitIds: ['u-jur'],
      fieldsConfig: {
        interested: { enabled: false }, creditor: { enabled: false }, amount: { enabled: true }, arquivos: { enabled: true },
        contractNumber: { enabled: true, required: true }, biddingNumber: { enabled: true }, legalProcessNumber: { enabled: true }, referenceNumber: { enabled: true },
      },
    })

    expect(type.authorizedUserIds).toEqual(['usr-clara'])
    expect(type.authorizedUnitIds).toEqual(['u-jur'])
    expect(type.fieldsConfig.contractNumber).toEqual({ enabled: true, required: true })
  })

  it('autoriza a abertura pelo usuário ou pela unidade configurada', async () => {
    const db = loadDb()
    const type = db.protocolTypes.find((item) => item.id === 'pt-admin')!
    type.authorizedUserIds = ['usr-clara']
    type.authorizedUnitIds = []
    saveDb(db)
    const input = { typeId: type.id, subject: 'Processo com acesso restrito', description: 'Teste de autorização para abertura.', interestedPersonId: 'p-1' }

    await expect(api.createProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.createProtocol({ userId: 'usr-clara', activeUnitId: 'u-prot' }, input)).resolves.toMatchObject({ typeId: type.id })

    const updated = loadDb()
    const updatedType = updated.protocolTypes.find((item) => item.id === type.id)!
    updatedType.authorizedUserIds = []
    updatedType.authorizedUnitIds = ['u-adm']
    saveDb(updated)
    await expect(api.createProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, input)).resolves.toMatchObject({ typeId: type.id })
  })

  it('salva os novos campos no processo e bloqueia arquivos e documentos quando desabilitados', async () => {
    const context = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const type = await api.createProtocolType(context, {
      name: 'Registro sem arquivos', categoryId: 'category-administrative', description: 'Tipo que recebe referências, mas não aceita arquivos.', color: '#17628b', flowMode: 'NONE', active: true,
      fieldsConfig: {
        interested: { enabled: false }, creditor: { enabled: false }, amount: { enabled: false }, arquivos: { enabled: false },
        contractNumber: { enabled: true }, biddingNumber: { enabled: true }, legalProcessNumber: { enabled: true }, referenceNumber: { enabled: true },
      },
    })
    const protocol = await api.createProtocol(context, {
      typeId: type.id, subject: 'Registro contratual', description: 'Registro dos identificadores externos.',
      contractNumber: '042/2026', biddingNumber: 'PE 018/2026', legalProcessNumber: 'PAJ 2026/00182', referenceNumber: 'REF-0091/2026',
    })

    expect(protocol).toMatchObject({ contractNumber: '042/2026', biddingNumber: 'PE 018/2026', legalProcessNumber: 'PAJ 2026/00182', referenceNumber: 'REF-0091/2026' })
    await expect(api.addAttachments(context, protocol.id, protocol.version, [new File(['pdf'], 'arquivo.pdf', { type: 'application/pdf' })])).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.createDocument(context, { typeId: 'dt-memo', protocolId: protocol.id, subject: 'Documento indevido', body: 'Este documento não deve ser aceito.' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('cria tipo e fluxo da proposta de IA em uma única operação', async () => {
    const result = await api.createProtocolTypeWithFlow({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      name: 'Processo criado com IA',
      description: 'Fluxo administrativo gerado e confirmado pelo usuário.',
      categoryId: 'category-administrative',
      color: '#7C3AED',
      icon: 'FileText',
      defaultDeadlineDays: 8,
      flowMode: 'REQUIRED',
      authorizedUserIds: [],
      authorizedUnitIds: [],
      active: true,
      fieldsConfig: {
        interested: { enabled: true }, creditor: { enabled: false }, amount: { enabled: false }, assunto: { enabled: true }, arquivos: { enabled: true },
      },
    }, [{
      phaseId: 'phase-triage',
      situationTypeId: 'situation-technical-analysis',
      destinationUnitId: 'u-adm',
      required: true,
      requiresChecklist: true,
      requiresAttachment: false,
      checklistQuestions: [{ id: '', text: 'Conferir documentação apresentada', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true }],
      color: '#2563EB',
      icon: 'ClipboardCheck',
    }])

    const db = loadDb()
    expect(result.type.flowId).toBe(result.flow?.id)
    expect(result.type.fieldsConfig.tramitacao).toEqual({ enabled: true })
    expect(db.flows.find((flow) => flow.id === result.flow?.id)?.name).toBe('Fluxo — Processo criado com IA')
    expect(db.flowPhases.filter((stage) => stage.flowId === result.flow?.id)).toEqual([
      expect.objectContaining({ phaseId: 'phase-triage', situationTypeId: 'situation-technical-analysis', destinationUnitId: 'u-adm' }),
    ])
    expect(db.flowPhases.find((stage) => stage.flowId === result.flow?.id)?.checklistQuestions?.[0].id).toBeTruthy()
  })
})

describe('tipos de documento', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin crie tipo de documento', async () => {
    const type = await api.createDocumentType({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Circular', description: 'Comunicação circular', color: '#17628b', active: true })
    expect(type.name).toBe('Circular')
  })

  it('cria, sanitiza, atualiza e exclui modelos de documento', async () => {
    const context = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const created = await api.createDocumentTemplate(context, {
      typeId: 'dt-oficio',
      name: 'Resposta padrão',
      subject: 'Resposta ao processo {{numero_processo}}',
      body: '<p>Olá, {{destinatario}}</p><script>alert(1)</script>',
      active: true,
    })
    expect(created.body).toBe('<p>Olá, {{destinatario}}</p>')

    const updated = await api.updateDocumentTemplate(context, created.id, {
      typeId: created.typeId,
      name: created.name,
      subject: created.subject,
      body: '<p>Conteúdo atualizado.</p>',
      active: true,
    })
    expect(updated.body).toBe('<p>Conteúdo atualizado.</p>')
    await expect(api.deleteDocumentTemplate(context, created.id)).resolves.toBe(true)
    expect(loadDb().documentTemplates.some((item) => item.id === created.id)).toBe(false)
  })
})

describe('usuários de demonstração', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin crie operador sem vínculo com pessoa', async () => {
    const peopleBefore = loadDb().people.length
    const user = await api.createUser({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Servidor Independente', email: 'servidor.independente@example.com', role: 'OPERADOR', unitId: 'u-edu', active: true })
    expect(user.unitId).toBe('u-edu')
    expect(user.role).toBe('OPERADOR')
    expect(user).toMatchObject({ name: 'Servidor Independente', email: 'servidor.independente@example.com' })
    expect(user).not.toHaveProperty('personId')
    expect(loadDb().people).toHaveLength(peopleBefore)
    await expect(api.createUser({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Outro servidor', email: 'servidor.independente@example.com', role: 'LEITOR', unitId: 'u-prot', active: true })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('oferece e aceita usuários ativos como interessado e credor sem criar pessoas artificiais', async () => {
    const db = loadDb()
    expect(participantOptions(db, 'INTERESSADO')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'usr-admin', name: 'Marina Duarte', source: 'user' }),
    ]))
    expect(participantOptions(db, 'CREDOR')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'usr-clara', name: 'Clara Nunes', source: 'user' }),
    ]))
    expect(db.people.some((person) => person.id === 'person-usr-admin')).toBe(false)
    const protocol = await api.createProtocol({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      typeId: 'pt-pay',
      subject: 'Pagamento entre usuários cadastrados',
      description: 'Valida usuário como participante sem cadastro de pessoa.',
      interestedPersonId: 'usr-admin',
      creditorPersonId: 'usr-clara',
      amountCents: 100,
    })
    expect(protocol).toMatchObject({ interestedPersonId: 'usr-admin', creditorPersonId: 'usr-clara' })
  })

  it('permite administrar acessos por unidade e preserva ao menos um vínculo ativo', async () => {
    const context = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const created = await api.saveUserMembership(context, 'usr-clara', undefined, {
      unitId: 'u-adm',
      role: 'GESTOR',
      title: 'Coordenadora administrativa',
    })
    expect(created).toMatchObject({ userId: 'usr-clara', unitId: 'u-adm', role: 'GESTOR', active: true })

    const updated = await api.saveUserMembership(context, 'usr-clara', created.id, {
      unitId: 'u-adm',
      role: 'LEITOR',
      title: 'Consulta administrativa',
    })
    expect(updated).toMatchObject({ role: 'LEITOR', title: 'Consulta administrativa' })

    await api.removeUserMembership(context, 'usr-clara', created.id)
    const database = loadDb()
    expect(database.memberships.find((membership) => membership.id === created.id)).toMatchObject({
      active: false,
      endsAt: expect.any(String),
    })
    expect(database.auditEvents.map((event) => event.action)).toEqual(expect.arrayContaining([
      'USER_MEMBERSHIP_CREATED',
      'USER_MEMBERSHIP_UPDATED',
      'USER_MEMBERSHIP_REMOVED',
    ]))

    const onlyMembership = database.memberships.find((membership) => membership.userId === 'usr-clara' && membership.active)!
    await expect(api.removeUserMembership(context, 'usr-clara', onlyMembership.id)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })
})

describe('designação de responsável', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('troca o responsável na movimentação atual, reinicia a ciência e registra somente auditoria', async () => {
    const before = loadDb()
    const protocol = before.protocols.find((item) => item.id === 'pr-1')!
    const assignmentId = protocol.currentAssignmentId
    const movement = before.events.find((event) => event.assignmentId === assignmentId && isMovementEvent(event))!
    const assignmentCount = before.assignments.length
    const eventCount = before.events.length
    const auditCount = before.auditEvents.length

    const updated = await api.assign({ userId: 'usr-admin', activeUnitId: 'u-prot' }, protocol.id, protocol.version, 'usr-admin')
    const detail = await api.getProtocol({ userId: 'usr-admin', activeUnitId: 'u-prot' }, protocol.id)
    const persisted = loadDb()

    expect(updated).toMatchObject({ currentAssigneeId: 'usr-admin', currentAssignmentId: assignmentId })
    expect(detail.assignment).toMatchObject({ id: assignmentId, assigneeId: 'usr-admin' })
    expect(detail.assignment).not.toHaveProperty('receivedAt')
    expect(detail.assignment).not.toHaveProperty('receivedById')
    expect(detail.events.find((event) => event.id === movement.id)).toMatchObject({ toUserId: 'usr-admin' })
    expect(persisted.assignments).toHaveLength(assignmentCount)
    expect(persisted.events).toHaveLength(eventCount)
    expect(persisted.auditEvents).toHaveLength(auditCount + 1)
    expect(persisted.auditEvents.at(-1)).toMatchObject({ action: 'PROTOCOL_ASSIGNEE_CHANGED', targetId: protocol.id })
  })
})

describe('filtros avançados de processos', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }

  it('filtra processos pela unidade atual selecionada', async () => {
    const result = await api.listProtocols(admin, { tab: 'all', unitId: 'u-fin' })
    expect(result.items.every((process) => process.currentUnitId === 'u-fin')).toBe(true)
    expect(result.total).toBe(4)
  })

  it('combina situação, tipo, credor, número, descrição e ausência de anexos', async () => {
    const result = await api.listProtocols(admin, {
      tab: 'all',
      statuses: ['EM_ANDAMENTO'],
      typeId: 'pt-pay',
      creditorId: 'p-9',
      number: '000002',
      description: 'fornecimento de água',
      attachments: 'without',
    })
    expect(result.items.map((process) => process.id)).toEqual(['pr-2'])
  })

  it('filtra processos com anexos e calcula a fila sem responsável da unidade', async () => {
    const result = await api.listProtocols(admin, { tab: 'all', attachments: 'with' })
    expect(result.items.map((process) => process.id)).toEqual(['pr-1'])
    expect(result.unassignedInUnit).toBe(1)
  })

  it('lista os processos em que o usuário já participou', async () => {
    const result = await api.listProtocols({ userId: 'usr-bruno', activeUnitId: 'u-adm', scopeUnitId: 'u-adm' }, { tab: 'participated', pageSize: 30 })
    expect(result.items.some((process) => process.id === 'pr-5')).toBe(true)
    expect(result.items.every((process) => loadDb().events.some((event) => event.protocolId === process.id && [event.actorUserId, event.toUserId, event.fromUserId].includes('usr-bruno')))).toBe(true)
  })
})

describe('destinatário de documento', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa documento com destinatário inexistente', async () => {
    await expect(api.createDocument({ userId: 'usr-clara', activeUnitId: 'u-prot' }, {
      typeId: 'dt-oficio', subject: 'Comunicado', body: 'Texto do comunicado.', recipientPersonId: 'p-inexistente'
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('aplica a configuração de numeração também aos documentos', async () => {
    localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify({ numberFormat: 'Anual — YYYY.NNNN', sequencePadding: '3' }))
    const context = { userId: 'usr-clara', activeUnitId: 'u-prot' }
    const first = await api.createDocument(context, { typeId: 'dt-oficio', subject: 'Primeiro ofício', body: '<p>Conteúdo.</p>' })
    const second = await api.createDocument(context, { typeId: 'dt-oficio', subject: 'Segundo ofício', body: '<p>Conteúdo.</p>' })
    const prefix = `DOC-${new Date().getFullYear()}.`
    expect(first.number).toMatch(new RegExp(`^${prefix}\\d{3}$`))
    expect(Number(second.number.slice(prefix.length))).toBe(Number(first.number.slice(prefix.length)) + 1)
  })
})

describe('itens vinculados à movimentação', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('anexa o documento à movimentação existente e registra somente auditoria', async () => {
    const before = loadDb()
    const processEventsBefore = before.events.filter((event) => event.protocolId === 'pr-1')
    const document = await api.createDocument({ userId: 'usr-clara', activeUnitId: 'u-prot' }, {
      typeId: 'dt-oficio',
      protocolId: 'pr-1',
      movementEventId: 'ev-open-1',
      subject: 'Documento da movimentação',
      body: 'Conteúdo do documento vinculado.',
    })

    const after = loadDb()
    expect(document.movementEventId).toBe('ev-open-1')
    expect(after.events.filter((event) => event.protocolId === 'pr-1')).toHaveLength(processEventsBefore.length)
    expect(after.auditEvents).toContainEqual(expect.objectContaining({
      action: 'DOCUMENT_CREATED',
      targetType: 'DOCUMENT',
      targetId: document.id,
    }))
  })

  it('recusa vínculo com uma movimentação de outro processo', async () => {
    await expect(api.createDocument({ userId: 'usr-clara', activeUnitId: 'u-prot' }, {
      typeId: 'dt-oficio',
      protocolId: 'pr-1',
      movementEventId: 'ev-open-2',
      subject: 'Documento inválido',
      body: 'Conteúdo do documento.',
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('anexos múltiplos', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa uma operação com mais de cinco anexos antes de persistir arquivos', async () => {
    const db = seedDatabase(); const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const files = Array.from({ length: 6 }, (_, index) => new File([`arquivo ${index}`], `arquivo-${index}.txt`, { type: 'text/plain' }))
    await expect(api.addAttachments({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, files)).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

it('classifica anexos permitidos para uma visualização segura', () => {
  expect(api.attachmentPreviewKind('application/pdf')).toBe('pdf')
  expect(api.attachmentPreviewKind('image/png')).toBe('image')
  expect(api.attachmentPreviewKind('image/jpeg')).toBe('image')
  expect(api.attachmentPreviewKind('text/plain')).toBe('text')
  expect(api.attachmentPreviewKind('application/octet-stream')).toBeUndefined()
})

describe('autorização de documento avulso', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa documento avulso quando o contexto não é a unidade de vínculo do usuário', async () => {
    await expect(api.createDocument({ userId: 'usr-clara', activeUnitId: 'u-fin' }, {
      typeId: 'dt-oficio', subject: 'Ofício fora da unidade', body: 'Conteúdo do documento avulso.'
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('falhas de armazenamento', () => {
  it('traduz quota e indisponibilidade do IndexedDB em mensagens acionáveis', () => {
    expect(storageErrorMessage({ name: 'QuotaExceededError' })).toContain('espaço de armazenamento')
    expect(storageErrorMessage({ name: 'InvalidStateError' })).toContain('armazenamento de arquivos')
  })
})
it('sinaliza recuperação obrigatória para dados locais corrompidos', () => {
  localStorage.setItem(DATABASE_KEY, '{dados inválidos')
  expect(() => loadDb()).toThrow(StorageError)
})
describe('autorização na camada mockada', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('recusa mutação administrativa chamada diretamente por operador', async () => {
    await expect(api.createDocumentType({ userId: 'usr-clara', activeUnitId: 'u-prot' }, {
      name: 'Circular interna', description: 'Comunicação administrativa', color: '#17628b', active: true
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('recusa usuário inativo mesmo quando ele possui o papel de administrador', async () => {
    const db = loadDb()
    db.users.find((user) => user.id === 'usr-admin')!.active = false
    saveDb(db)

    await expect(api.createUnit({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      name: 'Almoxarifado', abbreviation: 'ALM', active: true
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('recusa contexto de unidade forjado por operador nas operações permitidas pela interface', async () => {
    await expect(api.createPerson({ userId: 'usr-clara', activeUnitId: 'u-fin' }, {
      kind: 'PF', name: 'Pessoa fora do contexto', roles: ['INTERESSADO'], active: true
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
describe('contexto de unidade em processos', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('recusa designação por admin fora da unidade atual do processo', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api.assign({ userId: 'usr-admin', activeUnitId: 'u-fin' }, protocol.id, protocol.version, 'usr-clara')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('recusa edição de processo concluído sem alterar seus dados', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-10')!
    const original = { subject: protocol.subject, description: protocol.description, version: protocol.version }

    await expect(api.updateProtocol({ userId: 'usr-admin', activeUnitId: protocol.currentUnitId }, protocol.id, protocol.version, {
      subject: 'Assunto alterado indevidamente', description: 'Descrição alterada indevidamente.', dueAt: protocol.dueAt,
    })).rejects.toMatchObject({ code: 'INVALID_STATE' })

    expect(loadDb().protocols.find((item) => item.id === protocol.id)).toMatchObject(original)
  })
  it('registra na auditoria a alteração dos dados gerais do processo', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await api.updateProtocol({ userId: 'usr-admin', activeUnitId: protocol.currentUnitId }, protocol.id, protocol.version, {
      subject: 'Assunto atualizado e auditado',
      description: 'Descrição atualizada com registro obrigatório de auditoria.',
      dueAt: protocol.dueAt,
    })
    expect(loadDb().auditEvents).toContainEqual(expect.objectContaining({
      action: 'PROTOCOL_UPDATED',
      targetType: 'PROTOCOL',
      targetId: protocol.id,
    }))
  })
  it('recusa tramitação por operador com contexto diferente de seu vínculo', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-fin' }, protocol.id, protocol.version, {
      unitId: 'u-adm', message: 'Tentativa fora do contexto.'
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('permite reabertura somente ao admin no contexto da unidade atual', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-11')!
    const input = { unitId: 'u-jur', assigneeId: 'usr-luisa', message: 'Reabrir para nova análise.' }

    await expect(api.reopen({ userId: 'usr-admin', activeUnitId: 'u-prot' }, protocol.id, protocol.version, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.reopen({ userId: 'usr-admin', activeUnitId: 'u-jur' }, protocol.id, protocol.version, input)).resolves.toMatchObject({ status: 'EM_ANDAMENTO', currentUnitId: 'u-jur' })
  })
})
describe('cenários de aceite dos dados de demonstração', () => {
  it('oferece cerca de vinte processos e todos os estados de trabalho esperados', () => {
    const db = seedDatabase()
    const pendingAcknowledgement = db.protocols.find((protocol) => protocol.id === 'pr-19')!
    const pendingAssignment = db.assignments.find((assignment) => assignment.id === pendingAcknowledgement.currentAssignmentId)!

    expect(db.protocols).toHaveLength(20)
    expect(db.protocols.find((protocol) => protocol.id === 'pr-2')?.currentAssigneeId).toBeUndefined()
    expect(pendingAcknowledgement.currentAssigneeId).toBe('usr-bruno')
    expect(pendingAssignment.receivedAt).toBeUndefined()
    expect(isOverdue(db.protocols.find((protocol) => protocol.id === 'pr-7')!)).toBe(true)
    expect(isDueSoon(db.protocols.find((protocol) => protocol.id === 'pr-4')!)).toBe(true)
    expect(db.protocols.find((protocol) => protocol.id === 'pr-6')?.dueAt).toBeUndefined()
    expect(db.protocols.find((protocol) => protocol.id === 'pr-10')?.status).toBe('CONCLUIDO')
    expect(db.protocols.find((protocol) => protocol.id === 'pr-11')?.status).toBe('ARQUIVADO')
  })

  it('mantém documento, anexo e passagem por três unidades acessíveis no roteiro', async () => {
    const db = seedDatabase()
    const trailUnits = new Set(db.assignments.filter((assignment) => assignment.protocolId === 'pr-5').map((assignment) => assignment.unitId))
    expect(trailUnits).toEqual(new Set(['u-prot', 'u-adm', 'u-jur']))
    expect(db.documents.some((document) => document.protocolId === 'pr-1')).toBe(true)
    expect(db.attachments.some((attachment) => attachment.protocolId === 'pr-1')).toBe(true)

    saveDb(db)
    await expect(api.getProtocol({ userId: 'usr-clara', activeUnitId: 'u-prot' }, 'pr-1')).resolves.toMatchObject({ documents: [expect.objectContaining({ protocolId: 'pr-1' })], attachments: [expect.objectContaining({ protocolId: 'pr-1' })] })
  })
})
describe('regras avançadas de processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('recusa encaminhamento que não altera unidade nem responsável', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-prot', assigneeId: 'usr-clara', message: 'Manter a mesma atribuição.'
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('exige fase no fluxo livre e registra atividade e resultado na tramitação', async () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'NONE'
    protocol.flowSnapshot = undefined
    protocol.currentPhaseId = undefined
    saveDb(db)

    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-adm', assigneeId: 'usr-bruno', message: 'Encaminhar sem informar a fase.'
    })).rejects.toMatchObject({ code: 'VALIDATION' })

    const forwarded = await api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-analysis', message: 'Encaminhado para análise.', activity: 'Conferência da solicitação', result: 'Solicitação validada e encaminhada'
    })
    const persisted = loadDb()
    const movement = persisted.events.filter((event) => event.protocolId === protocol.id && event.kind === 'TRAMITACAO').at(-1)

    expect(forwarded.currentPhaseId).toBe('phase-analysis')
    expect(movement).toMatchObject({ phaseId: 'phase-analysis', activity: 'Conferência da solicitação', result: 'Solicitação validada e encaminhada' })
  })

  it('permite sair de fase legada em unidade diferente e valida a unidade da próxima fase', async () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'REQUIRED'
    protocol.currentPhaseId = 'phase-triage'
    protocol.flowSnapshot!.phases[0].eligibleUnitIds = ['u-fin']
    protocol.flowSnapshot!.phases[1].eligibleUnitIds = ['u-adm']
    protocol.flowSnapshot!.phases[1].destinationUnitId = 'u-adm'
    db.events.find((event) => event.id === 'ev-open-1')!.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    saveDb(db)

    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-analysis', message: 'Seguir a unidade definida pelo fluxo obrigatório.'
    })).resolves.toMatchObject({ currentUnitId: 'u-adm', currentPhaseId: 'phase-analysis' })
  })
  it('impede alterar fase e destino definidos pelo fluxo sugerido', async () => {
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'SUGGESTED'
    protocol.currentPhaseId = 'phase-triage'
    protocol.flowSnapshot!.phases[1].destinationUnitId = 'u-adm'
    db.events.find((event) => event.id === 'ev-open-1')!.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    saveDb(db)

    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-fin', phaseId: 'phase-analysis', message: 'Tentativa de ignorar a sugestão.'
    })).rejects.toMatchObject({ code: 'VALIDATION' })

    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-analysis', message: 'Destino conforme o fluxo sugerido.'
    })).resolves.toMatchObject({ currentUnitId: 'u-adm', currentPhaseId: 'phase-analysis' })
  })
  it('marca ciência na atribuição sem criar outra movimentação', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-19')!
    const before = await api.getProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id)
    const first = await api.acknowledge({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id, protocol.version)
    const second = await api.acknowledge({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id, first.version)
    const detail = await api.getProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id)

    expect(second.version).toBe(first.version)
    expect(detail.assignment.receivedAt).toBeTruthy()
    expect(detail.assignment.receivedById).toBe('usr-bruno')
    expect(detail.events).toHaveLength(before.events.length)
  })

  it('assume a fila e libera o checklist sem criar outra movimentação', async () => {
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-fin' }
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-18')!
    const before = await api.getProtocol(ctx, protocol.id)
    const movement = before.events.find((event) => event.id === 'ev-move-18')!

    const assumed = await api.assume(ctx, protocol.id, protocol.version)
    const after = await api.getProtocol(ctx, protocol.id)

    expect(after.events).toHaveLength(before.events.length)
    expect(after.assignment).toMatchObject({ id: protocol.currentAssignmentId, assigneeId: 'usr-admin', receivedById: 'usr-admin' })
    expect(after.events.find((event) => event.id === movement.id)).toMatchObject({ toUnitId: 'u-fin', toUserId: 'usr-admin' })
    await expect(api.updateMovementChecklist(ctx, protocol.id, assumed.version, movement.id, [
      { questionId: 'q-completion-result', text: 'Registrar resultado final', checked: true },
    ])).resolves.toMatchObject({ id: movement.id, checklist: [expect.objectContaining({ checked: true })] })
  })

  it('mantém o checklist na tramitação ao ler registros antigos de assumir e dar ciência', async () => {
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-fin' }
    const database = loadDb()
    const protocol = database.protocols.find((item) => item.id === 'pr-18')!
    const assignment = database.assignments.find((item) => item.id === protocol.currentAssignmentId)!
    const movement = database.events.find((event) => event.id === 'ev-move-18')!
    const assumedAt = new Date().toISOString()
    protocol.currentAssigneeId = 'usr-admin'
    assignment.assigneeId = 'usr-admin'
    assignment.receivedAt = assumedAt
    assignment.receivedById = 'usr-admin'
    database.events.push(
      { id: 'legacy-assignment', protocolId: protocol.id, kind: 'ATRIBUICAO', actorUserId: 'usr-admin', actorUnitId: 'u-fin', toUserId: 'usr-admin', assignmentId: assignment.id, createdAt: assumedAt },
      { id: 'legacy-receipt', protocolId: protocol.id, kind: 'RECEBIMENTO', actorUserId: 'usr-admin', actorUnitId: 'u-fin', assignmentId: assignment.id, createdAt: assumedAt },
    )
    saveDb(database)

    await expect(api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, [
      { questionId: 'q-completion-result', text: 'Registrar resultado final', checked: true },
    ])).resolves.toMatchObject({ id: movement.id, checklist: [expect.objectContaining({ checked: true })] })
    expect(loadDb().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'legacy-assignment' }),
      expect.objectContaining({ id: 'legacy-receipt' }),
    ]))
  })

  it('libera o checklist da movimentação somente depois da ciência e salva observações', async () => {
    const ctx = { userId: 'usr-bruno', activeUnitId: 'u-adm' }
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-19')!
    const detail = await api.getProtocol(ctx, protocol.id)
    const movement = detail.events.find((event) => event.kind === 'TRAMITACAO' && event.assignmentId === protocol.currentAssignmentId)!
    const answers = [{ questionId: 'q-analysis-result', text: 'Registrar despacho ou resultado', checked: true, observation: 'Resultado conferido pela unidade.' }]

    await expect(api.updateMovementChecklist(ctx, protocol.id, protocol.version, movement.id, answers)).rejects.toMatchObject({ code: 'ACK_REQUIRED' })
    const acknowledged = await api.acknowledge(ctx, protocol.id, protocol.version)
    await expect(api.updateMovementChecklist(ctx, protocol.id, acknowledged.version, movement.id, answers)).resolves.toMatchObject({ checklist: [expect.objectContaining({ checked: true, observation: 'Resultado conferido pela unidade.' })] })

    const persistedMovement = loadDb().events.find((event) => event.id === movement.id)
    expect(persistedMovement?.phaseId).toBe('phase-analysis')
    expect(persistedMovement?.checklist).toEqual([expect.objectContaining({ questionId: 'q-analysis-result', checked: true, observation: 'Resultado conferido pela unidade.' })])
  })
  it('reabre processo arquivado removendo datas de encerramento e criando novo ciclo', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-11')!
    const reopened = await api.reopen({ userId: 'usr-admin', activeUnitId: 'u-jur' }, protocol.id, protocol.version, {
      unitId: 'u-jur', assigneeId: 'usr-luisa', message: 'Necessária nova análise.'
    })

    expect(reopened).toMatchObject({ status: 'EM_ANDAMENTO', completedAt: undefined, archivedAt: undefined, currentUnitId: 'u-jur', currentAssigneeId: 'usr-luisa' })
    expect(reopened.currentAssignmentId).not.toBe(protocol.currentAssignmentId)
  })
})

describe('acesso e inativação', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('permite ao admin consultar qualquer processo e bloqueia operador sem participação', async () => {
    await expect(api.getProtocol({ userId: 'usr-admin', activeUnitId: 'u-prot' }, 'pr-3')).resolves.toMatchObject({ protocol: { id: 'pr-3' } })
    await expect(api.getProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, 'pr-3')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('bloqueia a inativação de unidade com descendente ativo', async () => {
    const unit = loadDb().units.find((item) => item.id === 'u-adm')!
    await expect(api.updateUnit({ userId: 'usr-admin', activeUnitId: 'u-prot' }, unit.id, { ...unit, active: false })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('bloqueia a inativação de usuário responsável por processo ativo', async () => {
    const user = loadDb().users.find((item) => item.id === 'usr-bruno')!
    await expect(api.updateUser({ userId: 'usr-admin', activeUnitId: 'u-prot' }, user.id, { ...user, active: false })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('vínculos ativos por unidade', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('bloqueia contexto que não possui vínculo ativo', async () => {
    await expect(api.listPeople({ userId: 'usr-clara', activeUnitId: 'u-adm' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('permite contexto secundário quando o vínculo foi concedido explicitamente', async () => {
    await expect(api.listPeople({ userId: 'usr-admin', activeUnitId: 'u-jur' })).resolves.toMatchObject({
      db: expect.objectContaining({ organization: expect.any(Object) }),
    })
  })
})

describe('fluxos e fases de processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('cria fases e um fluxo ordenado, e preserva seu snapshot ao abrir processo', async () => {
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const phase = await api.createPhase(ctx, {
      name: 'Validação técnica',
      code: 'VALIDACAO_TECNICA',
      eligibleUnitIds: ['u-adm'],
      checklistItems: ['Validar documentos'],
      requiredAttachmentTypes: ['application/pdf'],
      active: true,
    })
    const flow = await api.createFlow(ctx, {
      name: 'Fluxo técnico',
      version: 1,
      active: true,
      startsAt: new Date().toISOString(),
      phaseIds: [phase.id],
    })
    const type = await api.createProtocolType(ctx, {
      name: 'Demanda técnica',
      categoryId: 'category-administrative',
      description: 'Tipo configurado para validação.',
      color: '#17628b',
      flowId: flow.id,
      active: true,
      fieldsConfig: { interested: { enabled: false, required: false }, creditor: { enabled: false, required: false }, amount: { enabled: false, required: false } },
    })
    const protocol = await api.createProtocol(ctx, { typeId: type.id, subject: 'Novo processo técnico', description: 'Conteúdo da abertura.' })

    expect(protocol.currentPhaseId).toBe(phase.id)
    expect(protocol.flowSnapshot).toMatchObject({ flowId: flow.id, version: 1 })
    expect(protocol.flowSnapshot?.phases).toEqual([expect.objectContaining({ phaseId: phase.id, code: 'VALIDACAO_TECNICA' })])
    expect(loadDb().events.find((event) => event.protocolId === protocol.id && event.kind === 'ABERTURA')?.phaseId).toBe(phase.id)
  })

  it('reaproveita fluxo órfão ao criar a primeira etapa e o remove ao limpar o fluxo', async () => {
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const type = await api.createProtocolType(ctx, {
      name: 'Demanda sem etapas',
      categoryId: 'category-administrative',
      description: 'Tipo criado para validar a recuperação de fluxo.',
      color: '#17628b',
      flowMode: 'SUGGESTED',
      active: true,
      fieldsConfig: {
        interested: { enabled: false, required: false },
        creditor: { enabled: false, required: false },
        amount: { enabled: false, required: false },
        tramitacao: { enabled: true },
      },
    })
    const orphan = await api.createFlow(ctx, {
      name: `Fluxo — ${type.name}`,
      version: 1,
      active: true,
      startsAt: new Date().toISOString(),
      stages: [{ phaseId: 'phase-triage', required: true }],
    })

    const saved = await api.saveProtocolTypeFlow(ctx, type.id, [{ phaseId: 'phase-triage', required: true }])
    let persisted = loadDb()

    expect(saved.flow.id).toBe(orphan.id)
    expect(persisted.flows.filter((flow) => flow.name === orphan.name && flow.version === 1)).toHaveLength(1)
    expect(persisted.protocolTypes.find((item) => item.id === type.id)?.flowId).toBe(orphan.id)
    expect(persisted.flowPhases.filter((stage) => stage.flowId === orphan.id)).toHaveLength(1)

    await api.clearProtocolTypeFlow(ctx, type.id)
    persisted = loadDb()
    expect(persisted.protocolTypes.find((item) => item.id === type.id)?.flowId).toBeUndefined()
    expect(persisted.flows.some((flow) => flow.id === orphan.id)).toBe(false)
    expect(persisted.flowPhases.some((stage) => stage.flowId === orphan.id)).toBe(false)
  })
})

describe('execução das fases do processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('bloqueia checklist pendente, avança e registra o evento de fase', async () => {
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!

    await expect(api.advancePhase(ctx, protocol.id, protocol.version, [])).rejects.toMatchObject({ code: 'VALIDATION' })
    const advanced = await api.advancePhase(ctx, protocol.id, protocol.version, ['Conferir dados de abertura'])
    const persisted = loadDb()

    expect(advanced.currentPhaseId).toBe('phase-analysis')
    expect(persisted.events.some((event) => event.protocolId === protocol.id && event.kind === 'FASE_AVANCADA')).toBe(true)
    expect(persisted.events.find((event) => event.protocolId === protocol.id && event.kind === 'ABERTURA')).toMatchObject({
      phaseId: 'phase-triage',
      checklist: [expect.objectContaining({ text: 'Conferir dados de abertura', checked: true })],
    })
    expect(persisted.events.find((event) => event.protocolId === protocol.id && event.kind === 'FASE_AVANCADA')).toMatchObject({
      phaseId: 'phase-analysis',
      checklist: [expect.objectContaining({ text: 'Registrar despacho ou resultado', checked: false })],
    })
    await expect(api.returnPhase(ctx, protocol.id, advanced.version, '')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.returnPhase(ctx, protocol.id, advanced.version, 'Revisar abertura.')).resolves.toMatchObject({ currentPhaseId: 'phase-triage' })
  })
  it('não replica o checklist ao tramitar dentro da mesma fase', async () => {
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
    const db = loadDb()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.status = 'EM_ANDAMENTO'
    protocol.currentPhaseId = 'phase-completion'
    saveDb(db)

    await api.forward(ctx, protocol.id, protocol.version, {
      unitId: 'u-adm', assigneeId: 'usr-bruno', phaseId: 'phase-completion', message: 'Encaminhar sem reiniciar o checklist da fase.',
    })

    const movement = loadDb().events.filter((event) => event.protocolId === protocol.id && event.kind === 'TRAMITACAO').at(-1)
    expect(movement).toMatchObject({ phaseId: 'phase-completion' })
    expect(movement).not.toHaveProperty('checklist')
  })
  it('impede a conclusão antes da última fase do fluxo', async () => {
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!

    await expect(api.complete(ctx, protocol.id, protocol.version, 'Encerrar antes do fluxo.')).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
})
describe('modos do fluxo no tipo de processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  const context = { userId: 'usr-clara', activeUnitId: 'u-prot' }
  const input = {
    typeId: 'pt-admin',
    subject: 'Validação do modo de fluxo',
    description: 'Processo criado para validar a configuração das fases.',
    interestedPersonId: 'p-1',
  }

  it('sempre aplica o fluxo obrigatório, mesmo quando a abertura tenta dispensá-lo', async () => {
    const db = loadDb()
    const type = db.protocolTypes.find((item) => item.id === input.typeId)!
    type.flowMode = 'REQUIRED'
    saveDb(db)

    const protocol = await api.createProtocol(context, { ...input, useSuggestedFlow: false })

    expect(protocol.flowModeSnapshot).toBe('REQUIRED')
    expect(protocol.currentPhaseId).toBe('phase-triage')
    expect(protocol.flowSnapshot?.phases.map((phase) => phase.phaseId)).toEqual([
      'phase-triage',
      'phase-analysis',
      'phase-completion',
    ])
  })

  it('permite aplicar ou dispensar o fluxo sugerido e preserva a escolha no processo', async () => {
    const db = loadDb()
    const type = db.protocolTypes.find((item) => item.id === input.typeId)!
    type.flowMode = 'SUGGESTED'
    saveDb(db)

    const withFlow = await api.createProtocol(context, { ...input, useSuggestedFlow: true })
    const withoutFlow = await api.createProtocol(context, {
      ...input,
      subject: 'Processo sem o fluxo sugerido',
      useSuggestedFlow: false,
    })

    expect(withFlow.flowModeSnapshot).toBe('SUGGESTED')
    expect(withFlow.flowSnapshot?.phases).toHaveLength(3)
    expect(withoutFlow).toMatchObject({
      flowModeSnapshot: 'SUGGESTED',
      flowSnapshot: undefined,
      currentPhaseId: undefined,
    })
    await expect(api.complete(context, withoutFlow.id, withoutFlow.version, 'Concluído sem fluxo sugerido.')).resolves.toMatchObject({
      status: 'CONCLUIDO',
    })
  })

  it('bloqueia tipo obrigatório sem fases e aceita tipo sugerido ainda não configurado', async () => {
    const db = loadDb()
    const type = db.protocolTypes.find((item) => item.id === input.typeId)!
    type.flowMode = 'REQUIRED'
    type.flowId = undefined
    saveDb(db)

    await expect(api.createProtocol(context, input)).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'O fluxo obrigatório deste tipo ainda não foi configurado.',
    })

    const suggestedDb = loadDb()
    const suggestedType = suggestedDb.protocolTypes.find((item) => item.id === input.typeId)!
    suggestedType.flowMode = 'SUGGESTED'
    saveDb(suggestedDb)

    await expect(api.createProtocol(context, input)).resolves.toMatchObject({
      flowModeSnapshot: 'SUGGESTED',
      flowSnapshot: undefined,
      currentPhaseId: undefined,
    })
  })

  it('move o processo para a unidade configurada ao entrar na próxima fase', async () => {
    const db = loadDb()
    const type = db.protocolTypes.find((item) => item.id === input.typeId)!
    type.flowMode = 'REQUIRED'
    const stages = db.flowPhases.filter((stage) => stage.flowId === type.flowId).sort((left, right) => left.position - right.position)
    stages[0].destinationUnitId = 'u-prot'
    stages[1].destinationUnitId = 'u-adm'
    saveDb(db)

    const protocol = await api.createProtocol(context, input)
    const advanced = await api.advancePhase(context, protocol.id, protocol.version, ['Conferir dados de abertura'])
    const persisted = loadDb()
    const phaseEvent = persisted.events.find((event) => event.protocolId === protocol.id && event.kind === 'FASE_AVANCADA')

    expect(advanced).toMatchObject({
      currentPhaseId: 'phase-analysis',
      currentUnitId: 'u-adm',
      currentAssigneeId: undefined,
      status: 'EM_ANDAMENTO',
    })
    expect(phaseEvent).toMatchObject({
      fromUnitId: 'u-prot',
      toUnitId: 'u-adm',
      phaseId: 'phase-analysis',
      nextStatus: 'EM_ANDAMENTO',
    })
    expect(persisted.assignments.filter((assignment) => assignment.protocolId === protocol.id)).toHaveLength(2)
  })

  it('mantém o snapshot original quando a configuração do tipo muda depois da abertura', async () => {
    const db = loadDb()
    const type = db.protocolTypes.find((item) => item.id === input.typeId)!
    type.flowMode = 'SUGGESTED'
    saveDb(db)

    const protocol = await api.createProtocol(context, input)
    const changed = loadDb()
    changed.flowPhases = changed.flowPhases.filter((stage) => stage.flowId !== type.flowId || stage.phaseId === 'phase-triage')
    saveDb(changed)

    const persisted = loadDb().protocols.find((item) => item.id === protocol.id)!
    expect(persisted.flowSnapshot?.phases.map((phase) => phase.phaseId)).toEqual([
      'phase-triage',
      'phase-analysis',
      'phase-completion',
    ])
  })
})

describe('tipos de situação', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('cria, edita e preserva a situação configurada na cópia do fluxo', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const created = await api.createSituationType(admin, {
      name: 'Aguardando parecer',
      category: 'EM_TRAMITACAO',
      color: '#2563EB',
      icon: 'Clock3',
      observation: 'Aguardando manifestação técnica.',
      active: true,
    })
    const updated = await api.updateSituationType(admin, created.id, {
      name: 'Aguardando análise',
      category: 'EM_TRAMITACAO',
      color: '#1D4ED8',
      icon: 'Clock3',
      observation: 'Aguardando análise técnica.',
      active: true,
    })

    await api.saveProtocolTypeFlow(admin, 'pt-admin', [{
      phaseId: 'phase-triage',
      required: true,
      situationTypeId: updated.id,
    }])
    const protocol = await api.createProtocol({ userId: 'usr-clara', activeUnitId: 'u-prot' }, {
      typeId: 'pt-admin',
      subject: 'Solicitação com situação personalizada',
      description: 'Processo usado para validar a cópia da situação.',
      interestedPersonId: 'p-1',
    })

    expect(protocol.flowSnapshot?.phases[0].situationType).toEqual({
      id: updated.id,
      name: 'Aguardando análise',
      category: 'EM_TRAMITACAO',
      color: '#1D4ED8',
      icon: 'Clock3',
    })
    await expect(api.updateSituationType(admin, updated.id, { ...updated, active: false })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.deleteSituationType(admin, updated.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.deleteSituationType(admin, 'situation-registered')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('permite excluir uma situação personalizada que não está em uso', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const created = await api.createSituationType(admin, {
      name: 'Situação temporária',
      color: '#334155',
      icon: 'CircleDot',
      observation: '',
      active: true,
    })

    await api.deleteSituationType(admin, created.id)

    expect(loadDb().situations.some((item) => item.id === created.id)).toBe(false)
  })
})

describe('cadastro de fases', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('cria, edita e exclui uma fase que não está em uso', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const created = await api.createPhase(admin, {
      name: 'Parecer técnico',
      code: 'PARECER_TECNICO',
      description: 'Elaboração de manifestação técnica.',
      eligibleUnitIds: [],
      checklistItems: [],
      checklistQuestions: [],
      requiredAttachmentTypes: [],
      color: '#2563EB',
      icon: 'FilePenLine',
      active: true,
    })
    const updated = await api.updatePhase(admin, created.id, {
      ...created,
      name: 'Parecer jurídico',
      description: 'Elaboração de manifestação jurídica.',
      color: '#16A66A',
    })

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Parecer jurídico',
      code: 'PARECER_TECNICO',
      color: '#16A66A',
    })

    await api.deletePhase(admin, created.id)

    expect(loadDb().phases.some((phase) => phase.id === created.id)).toBe(false)
  })

  it('impede excluir ou inativar uma fase usada em fluxo ativo', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const phase = loadDb().phases.find((item) => item.id === 'phase-triage')!

    await expect(api.deletePhase(admin, phase.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.updatePhase(admin, phase.id, { ...phase, active: false })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('responsabilidade de pessoas', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('persiste períodos somente enquanto a pessoa possui o papel de responsável', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const person = await api.createPerson(admin, {
      kind: 'PF',
      name: 'Responsável de teste',
      email: 'responsavel@example.com',
      roles: ['INTERESSADO', 'RESPONSAVEL'],
      responsibilityPeriods: [{
        id: 'period-test',
        description: 'Secretaria de Administração',
        startsAt: '2026-01-01',
      }],
      active: true,
    })

    expect(person.responsibilityPeriods).toEqual([{
      id: 'period-test',
      description: 'Secretaria de Administração',
      startsAt: '2026-01-01',
      endsAt: undefined,
    }])

    const updated = await api.updatePerson(admin, person.id, {
      ...person,
      roles: ['INTERESSADO'],
    })

    expect(updated.responsibilityPeriods).toEqual([])
  })

  it('recusa período incompleto ou com data final anterior à inicial', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }

    await expect(api.createPerson(admin, {
      kind: 'PF',
      name: 'Período inválido',
      roles: ['RESPONSAVEL'],
      responsibilityPeriods: [{
        id: 'invalid-period',
        description: '',
        startsAt: '2026-05-10',
        endsAt: '2026-05-01',
      }],
      active: true,
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('escopo de estruturas', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('reúne unidades vinculadas em Todos e restringe quando uma estrutura é selecionada', async () => {
    const database = loadDb()
    const finance = database.protocols.find((protocol) => protocol.currentUnitId === 'u-fin')!

    expect(canView(database, finance, { userId: 'usr-admin', activeUnitId: 'u-prot', scopeUnitId: 'ALL' })).toBe(true)
    expect(canView(database, finance, { userId: 'usr-admin', activeUnitId: 'u-prot', scopeUnitId: 'u-prot' })).toBe(false)

    const result = await api.listProtocols({ userId: 'usr-admin', activeUnitId: 'u-prot', scopeUnitId: 'u-prot' }, { tab: 'all', pageSize: 50 })
    expect(result.items.some((protocol) => protocol.id === 'pr-18' && protocol.currentUnitId === 'u-fin')).toBe(true)
    expect(result.items.every((protocol) =>
      protocol.currentUnitId === 'u-prot' ||
      database.events.some((event) =>
        event.protocolId === protocol.id &&
        (event.actorUserId === 'usr-admin' || event.toUserId === 'usr-admin' || event.fromUserId === 'usr-admin'),
      ),
    )).toBe(true)
  })
})

describe('categorias de processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('cria e vincula uma categoria a um tipo de processo', async () => {
    const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const category = await api.createProcessCategory(admin, {
      code: '07', name: 'Atendimento ao cidadão', color: '#2563EB', icon: 'HeartHandshake', observation: 'Demandas externas.', active: true,
    })
    const base = loadDb().protocolTypes.find((type) => type.id === 'pt-admin')!
    const updated = await api.updateProtocolType(admin, base.id, { ...base, categoryId: category.id })

    expect(updated.categoryId).toBe(category.id)
    await expect(api.deleteProcessCategory(admin, category.id)).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
