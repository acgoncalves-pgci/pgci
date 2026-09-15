import { beforeEach, describe, expect, it } from 'vitest'
import { canView, isDueSoon, isOverdue } from './rules'
import { seedDatabase } from '../mocks/seed'
import { api } from '../services/api'
import { DATABASE_KEY, loadDb, saveDb, StorageError, storageErrorMessage } from '../storage/database'

describe('regras do MVP', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('considera vencido somente protocolo ativo com prazo no passado', () => {
    const db = seedDatabase(); const active = db.protocols.find((p) => p.id === 'pr-2')!; const archived = db.protocols.find((p) => p.id === 'pr-11')!
    expect(isOverdue(active)).toBe(true); expect(isOverdue(archived)).toBe(false)
  })
  it('calcula a janela de 24 horas sem incluir prazo atrasado', () => {
    const db = seedDatabase(); expect(isDueSoon(db.protocols.find((p) => p.id === 'pr-4')!)).toBe(true); expect(isDueSoon(db.protocols.find((p) => p.id === 'pr-2')!)).toBe(false)
  })
  it('mantém visibilidade de quem participou do histórico', () => {
    const db = seedDatabase(); const protocol = db.protocols.find((p) => p.id === 'pr-5')!
    expect(canView(db, protocol, { userId: 'usr-bruno', activeUnitId: 'u-adm' })).toBe(true)
  })
  it('gera números sequenciais mesmo após uma nova leitura do armazenamento', async () => {
    const ctx = { userId: 'usr-clara', activeUnitId: 'u-prot' }
    const common = { typeId: 'pt-admin', subject: 'Teste sequencial', description: 'Descrição de teste.', interestedPersonId: 'p-1' }
    const first = await api.createProtocol(ctx, common); const second = await api.createProtocol(ctx, common)
    expect(first.number).toMatch(/^2026\./); expect(Number(second.number.split('.')[1])).toBe(Number(first.number.split('.')[1]) + 1)
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
})


describe('validação de hierarquia', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa tornar uma unidade subordinada de sua descendente', async () => {
    await expect(api.updateUnit({ userId: 'usr-admin', activeUnitId: 'u-prot' }, 'u-adm', {
      name: 'Administração', abbreviation: 'ADM', parentId: 'u-fin', active: true
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('tipos de protocolo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin crie tipo com configuração de campos válida', async () => {
    const type = await api.createProtocolType({ userId: 'usr-admin', activeUnitId: 'u-prot' }, {
      name: 'Novo tipo', description: 'Descrição do novo tipo', color: '#17628b', defaultDeadlineDays: 5, active: true,
      fieldsConfig: { interested: { enabled: true, required: true }, creditor: { enabled: false, required: false }, amount: { enabled: false, required: false } }
    })
    expect(type.name).toBe('Novo tipo')
    expect(type.fieldsConfig.interested.required).toBe(true)
  })
})

describe('tipos de documento', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin crie tipo de documento', async () => {
    const type = await api.createDocumentType({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Circular', description: 'Comunicação circular', color: '#17628b', active: true })
    expect(type.name).toBe('Circular')
  })
})

describe('usuários de demonstração', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('permite que admin crie operador vinculado a uma unidade ativa', async () => {
    const user = await api.createUser({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { name: 'Paula Nery', email: 'paula.nery@example.com', role: 'OPERADOR', unitId: 'u-edu', active: true })
    expect(user.unitId).toBe('u-edu')
    expect(user.role).toBe('OPERADOR')
  })
})

describe('designação de responsável', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('reinicia a ciência ao designar responsável ativo da unidade atual', async () => {
    const db = seedDatabase(); const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    const updated = await api.assign({ userId: 'usr-admin', activeUnitId: 'u-prot' }, protocol.id, protocol.version, 'usr-admin')
    expect(updated.currentAssigneeId).toBe('usr-admin')
    const detail = await api.getProtocol({ userId: 'usr-admin', activeUnitId: 'u-prot' }, protocol.id)
    expect(detail.assignment.receivedAt).toBeUndefined()
  })
})

describe('filtros avançados de protocolos', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('filtra protocolos pela unidade atual selecionada', async () => {
    const result = await api.listProtocols({ userId: 'usr-admin', activeUnitId: 'u-prot' }, { tab: 'all', unitId: 'u-fin' })
    expect(result.items.every((protocol) => protocol.currentUnitId === 'u-fin')).toBe(true)
    expect(result.total).toBe(3)
  })
})

describe('destinatário de documento', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('recusa documento com destinatário inexistente', async () => {
    await expect(api.createDocument({ userId: 'usr-clara', activeUnitId: 'u-prot' }, {
      typeId: 'dt-oficio', subject: 'Comunicado', body: 'Texto do comunicado.', recipientPersonId: 'p-inexistente'
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
describe('contexto de unidade em protocolos', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('recusa designação por admin fora da unidade atual do protocolo', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api.assign({ userId: 'usr-admin', activeUnitId: 'u-fin' }, protocol.id, protocol.version, 'usr-clara')).rejects.toMatchObject({ code: 'FORBIDDEN' })
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
  it('oferece cerca de vinte protocolos e todos os estados de trabalho esperados', () => {
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
describe('regras avançadas de protocolo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('recusa encaminhamento que não altera unidade nem responsável', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await expect(api.forward({ userId: 'usr-clara', activeUnitId: 'u-prot' }, protocol.id, protocol.version, {
      unitId: 'u-prot', assigneeId: 'usr-clara', message: 'Manter a mesma atribuição.'
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('registra ciência uma única vez por ciclo de atribuição', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-19')!
    const first = await api.acknowledge({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id, protocol.version)
    const second = await api.acknowledge({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id, first.version)
    const detail = await api.getProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, protocol.id)

    expect(second.version).toBe(first.version)
    expect(detail.events.filter((event) => event.kind === 'RECEBIMENTO' && event.assignmentId === detail.protocol.currentAssignmentId)).toHaveLength(1)
  })

  it('reabre protocolo arquivado removendo datas de encerramento e criando novo ciclo', async () => {
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

  it('permite ao admin consultar qualquer protocolo e bloqueia operador sem participação', async () => {
    await expect(api.getProtocol({ userId: 'usr-admin', activeUnitId: 'u-prot' }, 'pr-3')).resolves.toMatchObject({ protocol: { id: 'pr-3' } })
    await expect(api.getProtocol({ userId: 'usr-bruno', activeUnitId: 'u-adm' }, 'pr-3')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('bloqueia a inativação de unidade com descendente ativo', async () => {
    const unit = loadDb().units.find((item) => item.id === 'u-adm')!
    await expect(api.updateUnit({ userId: 'usr-admin', activeUnitId: 'u-prot' }, unit.id, { ...unit, active: false })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('bloqueia a inativação de usuário responsável por protocolo ativo', async () => {
    const user = loadDb().users.find((item) => item.id === 'usr-bruno')!
    await expect(api.updateUser({ userId: 'usr-admin', activeUnitId: 'u-prot' }, user.id, { ...user, active: false })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})