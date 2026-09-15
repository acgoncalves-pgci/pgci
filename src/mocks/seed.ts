import type { AppDocument, Assignment, Database, FieldsConfig, Protocol, ProtocolEvent, ProtocolStatus } from '../domain/model'
import { isoDaysFromNow } from '../lib/format'

const blank: FieldsConfig = { interested: { enabled: false, required: false }, creditor: { enabled: false, required: false }, amount: { enabled: false, required: false } }
const interested: FieldsConfig = { ...blank, interested: { enabled: true, required: true } }
const payment: FieldsConfig = { interested: { enabled: true, required: true }, creditor: { enabled: true, required: true }, amount: { enabled: true, required: true } }
const now = () => new Date().toISOString()
const uid = (prefix: string, n: number) => `${prefix}-${n}`

export function seedDatabase(): Database {
  const units = [
    { id: 'u-prot', name: 'Protocolo Geral', abbreviation: 'PG', active: true },
    { id: 'u-adm', name: 'Administração', abbreviation: 'ADM', active: true },
    { id: 'u-fin', name: 'Financeiro', abbreviation: 'FIN', parentId: 'u-adm', active: true },
    { id: 'u-jur', name: 'Jurídico', abbreviation: 'JUR', active: true },
    { id: 'u-edu', name: 'Educação', abbreviation: 'EDU', active: true }
  ]
  const users = [
    { id: 'usr-admin', name: 'Marina Duarte', email: 'marina.duarte@example.com', role: 'ADMIN' as const, unitId: 'u-prot', active: true },
    { id: 'usr-clara', name: 'Clara Nunes', email: 'clara.nunes@example.com', role: 'OPERADOR' as const, unitId: 'u-prot', active: true },
    { id: 'usr-bruno', name: 'Bruno Lima', email: 'bruno.lima@example.com', role: 'OPERADOR' as const, unitId: 'u-adm', active: true },
    { id: 'usr-rafael', name: 'Rafael Reis', email: 'rafael.reis@example.com', role: 'OPERADOR' as const, unitId: 'u-fin', active: true },
    { id: 'usr-luisa', name: 'Luísa Azevedo', email: 'luisa.azevedo@example.com', role: 'OPERADOR' as const, unitId: 'u-jur', active: true },
    { id: 'usr-joana', name: 'Joana Melo', email: 'joana.melo@example.com', role: 'OPERADOR' as const, unitId: 'u-edu', active: true }
  ]
  const people = [
    ['p-1', 'PF', 'Ana Beatriz Costa', ['INTERESSADO']], ['p-2', 'PF', 'Caio Mendes', ['INTERESSADO']], ['p-3', 'PF', 'Fernanda Alves', ['INTERESSADO']], ['p-4', 'PF', 'Igor Rocha', ['INTERESSADO']], ['p-5', 'PF', 'Sofia Martins', ['INTERESSADO']], ['p-6', 'PF', 'Vitor Ramos', ['INTERESSADO']],
    ['p-7', 'PJ', 'Papelaria Horizonte Ltda.', ['CREDOR']], ['p-8', 'PJ', 'Construtora Boa Obra S.A.', ['CREDOR']], ['p-9', 'PJ', 'Água Clara Serviços Ltda.', ['CREDOR']], ['p-10', 'PJ', 'Editora Escola Viva Ltda.', ['CREDOR']], ['p-11', 'PJ', 'Tecnologia Cívica Ltda.', ['CREDOR']], ['p-12', 'PF', 'Helena Duarte', ['INTERESSADO', 'CREDOR']]
  ].map(([id, kind, name, roles]) => ({ id: id as string, kind: kind as 'PF' | 'PJ', name: name as string, roles: roles as ('INTERESSADO' | 'CREDOR')[], active: true, email: `${String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '.')}@example.com` }))
  const protocolTypes = [
    ['pt-admin', 'Solicitação administrativa', 'Demandas internas e administrativas', '#17628b', 7, interested], ['pt-buy', 'Compra de material', 'Aquisição de materiais para unidades', '#8b5a17', 10, interested], ['pt-info', 'Pedido de informação', 'Solicitações de acesso a informação', '#3d6f54', 20, interested], ['pt-serv', 'Requerimento de servidor', 'Requerimentos funcionais', '#7c4d99', 15, interested], ['pt-contract', 'Análise de contrato', 'Análise jurídica de instrumentos', '#9b3e48', 10, interested], ['pt-pay', 'Pagamento de fornecedor', 'Liquidação de fornecedor', '#7a6618', 5, payment]
  ].map(([id, name, description, color, defaultDeadlineDays, fieldsConfig]) => ({ id: id as string, name: name as string, description: description as string, color: color as string, defaultDeadlineDays: defaultDeadlineDays as number, fieldsConfig: fieldsConfig as FieldsConfig, active: true }))
  const documentTypes = [['dt-oficio', 'Ofício', 'Comunicação oficial', '#17628b'], ['dt-memo', 'Memorando', 'Comunicação interna', '#3d6f54'], ['dt-parecer', 'Parecer', 'Manifestação técnica', '#7c4d99'], ['dt-despacho', 'Despacho', 'Registro de encaminhamento', '#8b5a17']].map(([id, name, description, color]) => ({ id, name, description, color, active: true }))
  const protocols: Protocol[] = []; const assignments: Assignment[] = []; const events: ProtocolEvent[] = []
  const add = (n: number, subject: string, typeId: string, unitId: string, assigneeId: string | undefined, status: ProtocolStatus, dueDays?: number, creator = 'usr-clara') => {
    const id = uid('pr', n); const assignmentId = uid('as', n); const createdAt = isoDaysFromNow(-n - 1)
    const type = protocolTypes.find((t) => t.id === typeId)!
    protocols.push({ id, number: `2026.${String(n).padStart(6, '0')}`, typeId, typeConfigSnapshot: type.fieldsConfig, subject, description: `Registro fictício sobre ${subject.toLowerCase()}.`, interestedPersonId: type.fieldsConfig.interested.enabled ? `p-${(n % 6) + 1}` : undefined, creditorPersonId: typeId === 'pt-pay' ? `p-${7 + (n % 5)}` : undefined, amountCents: typeId === 'pt-pay' ? (n + 1) * 14500 : undefined, status, originUnitId: 'u-prot', currentUnitId: unitId, currentAssigneeId: assigneeId, currentAssignmentId: assignmentId, dueAt: dueDays === undefined ? undefined : isoDaysFromNow(dueDays), createdById: creator, createdAt, updatedAt: now(), completedAt: status === 'CONCLUIDO' || status === 'ARQUIVADO' ? isoDaysFromNow(-2) : undefined, archivedAt: status === 'ARQUIVADO' ? isoDaysFromNow(-1) : undefined, version: 1 })
    assignments.push({ id: assignmentId, protocolId: id, unitId, assigneeId, startedAt: createdAt, receivedAt: assigneeId ? createdAt : undefined, receivedById: assigneeId ? assigneeId : undefined })
    events.push({ id: `ev-open-${n}`, protocolId: id, kind: 'ABERTURA', actorUserId: creator, actorUnitId: 'u-prot', toUnitId: 'u-prot', toUserId: creator, assignmentId, nextStatus: 'CADASTRADO', createdAt })
    if (assigneeId) events.push({ id: `ev-ack-${n}`, protocolId: id, kind: 'RECEBIMENTO', actorUserId: assigneeId, actorUnitId: unitId, assignmentId, createdAt })
    if (status === 'CONCLUIDO' || status === 'ARQUIVADO') events.push({ id: `ev-done-${n}`, protocolId: id, kind: 'CONCLUSAO', actorUserId: assigneeId ?? creator, actorUnitId: unitId, assignmentId, message: 'Demanda analisada e concluída.', previousStatus: 'EM_ANDAMENTO', nextStatus: 'CONCLUIDO', createdAt: isoDaysFromNow(-2) })
    if (status === 'ARQUIVADO') events.push({ id: `ev-arc-${n}`, protocolId: id, kind: 'ARQUIVAMENTO', actorUserId: assigneeId ?? creator, actorUnitId: unitId, assignmentId, previousStatus: 'CONCLUIDO', nextStatus: 'ARQUIVADO', createdAt: isoDaysFromNow(-1) })
  }
  add(1, 'Reposição de materiais de expediente', 'pt-buy', 'u-prot', 'usr-clara', 'CADASTRADO', 2)
  add(2, 'Pagamento de fornecimento de água', 'pt-pay', 'u-fin', undefined, 'EM_ANDAMENTO', -2)
  add(3, 'Informações sobre transporte escolar', 'pt-info', 'u-jur', 'usr-luisa', 'EM_ANDAMENTO', 1)
  add(4, 'Pedido de acesso a processo administrativo', 'pt-info', 'u-prot', undefined, 'CADASTRADO', 0.5)
  add(5, 'Análise de aditivo contratual', 'pt-contract', 'u-jur', 'usr-luisa', 'EM_ANDAMENTO', 4)
  add(6, 'Requerimento de férias', 'pt-serv', 'u-adm', 'usr-bruno', 'EM_ANDAMENTO')
  add(7, 'Solicitação de manutenção predial', 'pt-admin', 'u-edu', 'usr-joana', 'EM_ANDAMENTO', -1)
  add(8, 'Pagamento de material didático', 'pt-pay', 'u-fin', 'usr-rafael', 'EM_ANDAMENTO', 3)
  add(9, 'Aquisição de equipamentos de rede', 'pt-buy', 'u-adm', undefined, 'CADASTRADO', 7)
  add(10, 'Informação sobre licitação', 'pt-info', 'u-prot', 'usr-clara', 'CONCLUIDO')
  add(11, 'Análise de contrato de locação', 'pt-contract', 'u-jur', 'usr-luisa', 'ARQUIVADO')
  add(12, 'Solicitação de mobiliário escolar', 'pt-buy', 'u-edu', 'usr-joana', 'EM_ANDAMENTO', 2)
  add(13, 'Requerimento de licença', 'pt-serv', 'u-adm', 'usr-bruno', 'CONCLUIDO')
  add(14, 'Pagamento de serviços de tecnologia', 'pt-pay', 'u-fin', 'usr-rafael', 'EM_ANDAMENTO', 9)
  add(15, 'Pedido de cópia documental', 'pt-info', 'u-prot', 'usr-clara', 'EM_ANDAMENTO', 5)
  add(16, 'Solicitação de treinamento', 'pt-admin', 'u-adm', 'usr-bruno', 'EM_ANDAMENTO')
  add(17, 'Análise de convênio educacional', 'pt-contract', 'u-jur', undefined, 'CADASTRADO', 14)
  add(18, 'Compra de toners', 'pt-buy', 'u-prot', 'usr-clara', 'EM_ANDAMENTO', 1)
  add(19, 'Atualização cadastral pendente de ciência', 'pt-admin', 'u-adm', 'usr-bruno', 'EM_ANDAMENTO', 6)
  add(20, 'Organização de arquivo físico', 'pt-admin', 'u-edu', 'usr-joana', 'CADASTRADO')
  const pendingAcknowledgement = assignments.find((assignment) => assignment.id === 'as-19')!; pendingAcknowledgement.receivedAt = undefined; pendingAcknowledgement.receivedById = undefined
  const acknowledgementEvent = events.findIndex((event) => event.id === 'ev-ack-19'); if (acknowledgementEvent >= 0) events.splice(acknowledgementEvent, 1)
  // Um histórico com passagens por três unidades para demonstrar a linha do tempo.
  const trail = protocols.find((p) => p.id === 'pr-5')!; const current = assignments.find((a) => a.id === trail.currentAssignmentId)!; current.startedAt = isoDaysFromNow(-1)
  assignments.push({ id: 'as-5a', protocolId: 'pr-5', unitId: 'u-prot', assigneeId: 'usr-clara', startedAt: isoDaysFromNow(-12), receivedAt: isoDaysFromNow(-12), receivedById: 'usr-clara', endedAt: isoDaysFromNow(-9) }, { id: 'as-5b', protocolId: 'pr-5', unitId: 'u-adm', assigneeId: 'usr-bruno', startedAt: isoDaysFromNow(-9), receivedAt: isoDaysFromNow(-8), receivedById: 'usr-bruno', endedAt: isoDaysFromNow(-1) })
  events.push({ id: 'ev-5a', protocolId: 'pr-5', kind: 'TRAMITACAO', actorUserId: 'usr-clara', actorUnitId: 'u-prot', fromUnitId: 'u-prot', toUnitId: 'u-adm', fromUserId: 'usr-clara', toUserId: 'usr-bruno', message: 'Encaminho para providências administrativas.', createdAt: isoDaysFromNow(-9) }, { id: 'ev-5b', protocolId: 'pr-5', kind: 'TRAMITACAO', actorUserId: 'usr-bruno', actorUnitId: 'u-adm', fromUnitId: 'u-adm', toUnitId: 'u-jur', fromUserId: 'usr-bruno', toUserId: 'usr-luisa', message: 'Solicito análise jurídica.', createdAt: isoDaysFromNow(-1) })
  const documents: AppDocument[] = Array.from({ length: 6 }, (_, index) => ({ id: `doc-${index + 1}`, number: `DOC-2026.${String(index + 1).padStart(6, '0')}`, typeId: documentTypes[index % 4].id, protocolId: index < 4 ? `pr-${index + 1}` : undefined, subject: ['Resposta preliminar', 'Solicitação de empenho', 'Manifestação técnica', 'Despacho de encaminhamento', 'Memorando interno', 'Parecer administrativo'][index], body: 'Documento de demonstração do Fluxo Público.\n\nO conteúdo preserva parágrafos e quebras de linha para impressão.', unitId: protocols[index].currentUnitId, authorUserId: protocols[index].currentAssigneeId ?? 'usr-clara', createdAt: isoDaysFromNow(-index - 1) }))
  documents.filter((d) => d.protocolId).forEach((d) => events.push({ id: `ev-doc-${d.id}`, protocolId: d.protocolId!, kind: 'DOCUMENTO_CRIADO', actorUserId: d.authorUserId, actorUnitId: d.unitId, relatedDocumentId: d.id, createdAt: d.createdAt }))
  return { schemaVersion: 1, initializedAt: now(), organization: { id: 'org-1', name: 'Prefeitura de Vila Exemplo', abbreviation: 'PVE' }, counters: { 'protocol-2026': 20, 'document-2026': 6 }, units, users, people, protocolTypes, documentTypes, protocols, assignments, events, documents, attachments: [{ id: 'att-seed', protocolId: 'pr-1', filename: 'comprovante-demo.txt', mimeType: 'text/plain', sizeBytes: 52, blobKey: 'seed-comprovante', uploadedById: 'usr-clara', createdAt: isoDaysFromNow(-1) }] }
}
