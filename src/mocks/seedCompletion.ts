import type { Assignment, Attachment, Database, ProtocolEvent } from '../domain/model'
import { isMovementEvent } from '../domain/model'
import { defaultDocumentMargins } from '../lib/documentMargins'
import { formatConfiguredNumber, numberingCounterKey, readNumberingSettings } from '../lib/numbering'
import { seedAttachmentBlob } from './seedFiles'

const after = (date: string, minutes: number) => new Date(Date.parse(date) + minutes * 60_000).toISOString()

// Build the trail of destination assignments for the specialized required flows.
// The general flow keeps its explicit scenarios (unacknowledged, queue, three units).
function seedDestinationHistory(db: Database) {
  for (const protocol of db.protocols) {
    if (protocol.flowModeSnapshot !== 'REQUIRED' || protocol.flowSnapshot?.flowId === 'flow-standard-v1') continue
    const stages = protocol.flowSnapshot?.phases ?? []
    const position = stages.findIndex((stage) => stage.phaseId === protocol.currentPhaseId)
    if (position < 0) continue
    const oldAssignment = db.assignments.find((item) => item.id === protocol.currentAssignmentId)!
    const actorFor = (unitId: string) => db.users.find((user) => user.active && user.unitId === unitId && user.role !== 'ADMIN')?.id ?? 'usr-admin'
    const lastDate = protocol.completedAt ? after(protocol.completedAt, -1440) : oldAssignment.startedAt
    const window = Math.max(Date.parse(lastDate) - Date.parse(protocol.createdAt), 2 * 60 * 60_000)
    const suffix = protocol.id.slice(3)
    db.events = db.events.filter((event) => event.protocolId !== protocol.id || !isMovementEvent(event) && event.kind !== 'RECEBIMENTO')
    db.assignments = db.assignments.filter((assignment) => assignment.protocolId !== protocol.id)
    let previous: Assignment = { id: `as-${suffix}-origin`, protocolId: protocol.id, unitId: protocol.originUnitId, assigneeId: protocol.createdById, startedAt: protocol.createdAt, receivedAt: protocol.createdAt, receivedById: protocol.createdById }
    db.assignments.push(previous)
    db.events.push({ id: `ev-open-${suffix}`, protocolId: protocol.id, kind: 'ABERTURA', actorUserId: protocol.createdById, actorUnitId: protocol.originUnitId, toUnitId: protocol.originUnitId, toUserId: protocol.createdById, assignmentId: previous.id, phaseId: stages[0].phaseId, nextStatus: 'CADASTRADO', createdAt: protocol.createdAt })
    for (let index = 0; index <= position; index++) {
      const stage = stages[index]
      const final = index === position
      const unitId = stage.destinationUnitId ?? protocol.currentUnitId
      const assigneeId = final ? (protocol.currentUnitId === unitId ? protocol.currentAssigneeId : actorFor(unitId)) : actorFor(unitId)
      const startedAt = new Date(Date.parse(protocol.createdAt) + window * (index + 1) / (position + 1)).toISOString()
      const assignment = { id: final ? protocol.currentAssignmentId : `as-${suffix}-stage-${index}`, protocolId: protocol.id, unitId, assigneeId, startedAt, receivedAt: assigneeId ? after(startedAt, 10) : undefined, receivedById: assigneeId, endedAt: undefined as string | undefined }
      previous.endedAt = startedAt
      db.assignments.push(assignment)
      const actorUserId = previous.assigneeId ?? actorFor(previous.unitId)
      db.events.push({ id: final ? `ev-move-${suffix}` : `ev-stage-${index}-${suffix}`, protocolId: protocol.id, kind: 'TRAMITACAO', actorUserId, actorUnitId: previous.unitId, fromUnitId: previous.unitId, fromUserId: previous.assigneeId, toUnitId: unitId, toUserId: assigneeId, assignmentId: assignment.id, phaseId: stage.phaseId, previousStatus: index === 0 ? 'CADASTRADO' : 'EM_ANDAMENTO', nextStatus: 'EM_ANDAMENTO', message: `Encaminhado para ${db.units.find((unit) => unit.id === unitId)!.name} — ${stage.name}.`, checklist: stage.checklistQuestions.map((question, questionIndex) => {
        const checked = !final || Boolean(protocol.completedAt) || Boolean(assigneeId && Number(suffix) % 2 === 0 && questionIndex === 0)
        return { questionId: question.id, text: question.text, checked, date: checked && question.requiresDate ? startedAt.slice(0, 10) : undefined, observation: checked && question.requiresObservation ? `${stage.name}: dados conferidos e providências registradas pela unidade responsável.` : undefined, attachmentProvided: checked && question.requiresAttachment ? true : undefined }
      }), createdAt: startedAt })
      if (assigneeId) db.events.push({ id: final ? `ev-ack-${suffix}` : `ev-ack-stage-${index}-${suffix}`, protocolId: protocol.id, kind: 'RECEBIMENTO', actorUserId: assigneeId, actorUnitId: unitId, assignmentId: assignment.id, createdAt: assignment.receivedAt! })
      if (final) { protocol.currentUnitId = unitId; protocol.currentAssigneeId = assigneeId }
      // Keep the object stored in db.assignments, so the next step closes it.
      previous = assignment
    }
    if (protocol.completedAt) db.events.push({ id: `ev-done-${suffix}`, protocolId: protocol.id, kind: 'CONCLUSAO', actorUserId: protocol.currentAssigneeId ?? actorFor(protocol.currentUnitId), actorUnitId: protocol.currentUnitId, assignmentId: protocol.currentAssignmentId, phaseId: protocol.currentPhaseId, previousStatus: 'EM_ANDAMENTO', nextStatus: 'CONCLUIDO', message: 'Entrega conferida, resultado comunicado e processo concluído.', createdAt: protocol.completedAt })
  }
}

function numberSeed(db: Database) {
  const settings = readNumberingSettings()
  const replacements = new Map<string, string>()
  db.counters = {}
  for (const scope of ['protocol', 'document'] as const) {
    const records = scope === 'protocol' ? db.protocols : db.documents
    for (const record of [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
      const date = new Date(record.createdAt)
      const key = numberingCounterKey(scope, settings, date)
      const number = formatConfiguredNumber(scope, (db.counters[key] ?? 0) + 1, settings, date)
      db.counters[key] = (db.counters[key] ?? 0) + 1
      replacements.set(record.number, number)
      record.number = number
    }
  }
  const rewrite = (value: string) => value.replace(/(?:DOC-)?2026\.\d{6}\b/g, (number) => replacements.get(number) ?? number)
  db.documents.forEach((document) => { document.body = rewrite(document.body) })
  db.events.forEach((event) => { if (event.message) event.message = rewrite(event.message) })
  db.demoNumberingVersion = 1
}

export function completeSeed(db: Database): Database {
  seedDestinationHistory(db)
  db.events = db.events.filter((event) => event.id !== 'ev-phase-analysis-21')
  for (const protocol of db.protocols) {
    if (protocol.typeConfigSnapshot.responsavel?.enabled) protocol.responsiblePersonId = 'p-1'
    if (protocol.typeId === 'pt-expense-reimbursement') { protocol.creditorPersonId = 'p-12'; protocol.interestedPersonId = 'p-12' }
    if (protocol.typeId === 'pt-pay') {
      protocol.creditorPersonId = protocol.subject.includes('água') ? 'p-9' : protocol.subject.includes('didático') ? 'p-10' : protocol.subject.includes('tecnologia') || protocol.subject.includes('tributário') ? 'p-11' : 'p-7'
    }
    for (const event of db.events.filter((item) => item.protocolId === protocol.id)) {
      const assignment = db.assignments.find((item) => item.id === event.assignmentId)
      if (event.checklist) event.checklist.forEach((answer) => {
        if (answer.date) answer.date = event.createdAt.slice(0, 10)
      })
      if (assignment && event.createdAt < assignment.startedAt) event.createdAt = assignment.startedAt
    }
    if (protocol.completedAt) for (const stage of protocol.flowSnapshot?.phases ?? []) {
      const movement = db.events.filter((event) => event.protocolId === protocol.id && event.phaseId === stage.phaseId && isMovementEvent(event)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)
      if (!movement) continue // Suggested flows can finish without visiting every stage.
      movement.checklist = stage.checklistQuestions.map((question) => ({ questionId: question.id, text: question.text, checked: true, date: question.requiresDate ? movement.createdAt.slice(0, 10) : undefined, observation: question.requiresObservation ? `${stage.name}: resultado conferido e registrado pela unidade.` : undefined, attachmentProvided: question.requiresAttachment ? true : undefined }))
    }
  }
  for (const document of db.documents) {
    const movement = db.events.find((event) => event.id === document.movementEventId)
    const assignment = db.assignments.find((item) => item.id === movement?.assignmentId)
    if (movement && assignment) {
      document.unitId = assignment.unitId
      document.authorUserId = assignment.assigneeId ?? db.users.find((user) => user.unitId === assignment.unitId && user.active && user.role !== 'ADMIN')?.id ?? 'usr-admin'
      document.createdAt = after(movement.createdAt, 30)
    }
    document.description = `Documento de ${db.documentTypes.find((type) => type.id === document.typeId)!.name.toLocaleLowerCase('pt-BR')} para instrução e acompanhamento da demanda.`
    document.signerName = db.users.find((user) => user.id === document.authorUserId)!.name
    document.signerTitle = db.memberships.find((membership) => membership.userId === document.authorUserId && membership.unitId === document.unitId && membership.active)?.title
    document.pageMargins = { ...defaultDocumentMargins }
    if (!document.body.trim().startsWith('<')) document.body = `<h2>${document.subject}</h2>${document.body.split(/\n\n/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('')}<p style="text-align:center">${document.signerName}<br>${document.signerTitle ?? ''}</p>`
    const createdEvent = db.events.find((event) => event.relatedDocumentId === document.id)
    if (createdEvent) { createdEvent.createdAt = document.createdAt; createdEvent.actorUserId = document.authorUserId; createdEvent.actorUnitId = document.unitId; createdEvent.assignmentId = assignment?.id }
  }
  numberSeed(db)
  const legacyAttachment = db.attachments[0]
  legacyAttachment.createdAt = after(db.protocols.find((protocol) => protocol.id === legacyAttachment.protocolId)!.createdAt, 20)
  legacyAttachment.description = 'Registro de recebimento dos documentos apresentados na abertura. Conteúdo fictício para demonstração.'
  legacyAttachment.sizeBytes = seedAttachmentBlob(legacyAttachment, db)!.size
  // Supply the actual evidence for every checked attachment question and every
  // required file on opening, rather than setting flags without any file.
  for (const movement of [...db.events].filter(isMovementEvent)) {
    const protocol = db.protocols.find((item) => item.id === movement.protocolId)!
    const stage = protocol.flowSnapshot?.phases.find((item) => item.phaseId === movement.phaseId)
    const openingRequired = movement.kind === 'ABERTURA' && protocol.typeConfigSnapshot.arquivos?.required
    const stageFile = (movement.kind === 'TRAMITACAO' && stage?.requiresAttachment) || movement.checklist?.some((answer) => answer.attachmentProvided)
    const example = ['pr-2', 'pr-5', 'pr-21', 'pr-23', 'pr-25', 'pr-27'].includes(protocol.id) && movement.kind === 'TRAMITACAO'
    if (!openingRequired && !stageFile && !example) continue
    const label = openingRequired ? 'Documentação inicial' : stage?.name ?? 'Relatório de vistoria'
    const id = `att-${movement.id}`
    const uploadUnitId = movement.toUnitId ?? movement.actorUnitId
    const uploadedById = movement.toUserId ?? db.users.find((user) => user.active && user.unitId === uploadUnitId && db.memberships.some((membership) => membership.userId === user.id && membership.unitId === uploadUnitId && membership.active && (membership.role === 'ADMIN' || membership.permissions?.includes('attachments.create'))))?.id ?? 'usr-admin'
    const attachment: Attachment = { id, protocolId: protocol.id, movementEventId: movement.id, filename: `${label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${protocol.number}.pdf`, description: `${label} — ${protocol.subject}. Evidência vinculada à movimentação para conferência da unidade.`, mimeType: 'application/pdf', sizeBytes: 0, blobKey: `seed-v2:${id}`, uploadedById, createdAt: after(movement.createdAt, 20) }
    attachment.sizeBytes = seedAttachmentBlob(attachment, db)!.size
    db.attachments.push(attachment)
  }
  for (const attachment of db.attachments) {
    const movement = db.events.find((event) => event.id === attachment.movementEventId)!
    db.events.push({ id: `ev-file-${attachment.id}`, protocolId: attachment.protocolId!, kind: 'ANEXO_ADICIONADO', actorUserId: attachment.uploadedById, actorUnitId: movement.toUnitId ?? movement.actorUnitId, assignmentId: movement.assignmentId, relatedAttachmentId: attachment.id, createdAt: attachment.createdAt })
  }
  const auditActions: Partial<Record<ProtocolEvent['kind'], string>> = { ABERTURA: 'PROTOCOL_CREATED', RECEBIMENTO: 'PROTOCOL_ACKNOWLEDGED', TRAMITACAO: 'PROTOCOL_FORWARDED', FASE_AVANCADA: 'PROTOCOL_PHASE_ADVANCED', CONCLUSAO: 'PROTOCOL_COMPLETED', ARQUIVAMENTO: 'PROTOCOL_ARCHIVED', DOCUMENTO_CRIADO: 'DOCUMENT_CREATED', ANEXO_ADICIONADO: 'ATTACHMENT_ADDED' }
  db.auditEvents = db.events.flatMap((event) => {
    const action = auditActions[event.kind]
    if (!action) return []
    const protocol = db.protocols.find((item) => item.id === event.protocolId)!
    const targetType = event.relatedDocumentId ? 'DOCUMENT' : event.relatedAttachmentId ? 'ATTACHMENT' : 'PROTOCOL'
    return [{ id: `audit-${event.id}`, action, actorUserId: event.actorUserId, actorUnitId: event.actorUnitId, targetType: targetType as 'DOCUMENT' | 'ATTACHMENT' | 'PROTOCOL', targetId: event.relatedDocumentId ?? event.relatedAttachmentId ?? protocol.id, details: event.message ?? `${action === 'ATTACHMENT_ADDED' ? 'Arquivo anexado' : action === 'DOCUMENT_CREATED' ? 'Documento criado' : action === 'PROTOCOL_ACKNOWLEDGED' ? 'Ciência registrada' : 'Registro de movimentação'} no processo ${protocol.number} — ${protocol.subject}.`, createdAt: event.createdAt }]
  })
  for (const profile of db.profiles.filter((item) => !item.system)) db.auditEvents.push({ id: `audit-${profile.id}`, action: 'PROFILE_CREATED', actorUserId: 'usr-admin', actorUnitId: 'u-prot', targetType: 'PROFILE', targetId: profile.id, details: `Perfil “${profile.name}” criado para concessão de permissões por unidade.`, createdAt: db.memberships[0].startsAt })
  for (const document of db.documents.filter((item) => !item.protocolId)) db.auditEvents.push({ id: `audit-${document.id}`, action: 'DOCUMENT_CREATED', actorUserId: document.authorUserId, actorUnitId: document.unitId, targetType: 'DOCUMENT', targetId: document.id, details: `Documento avulso ${document.number} — ${document.subject}.`, createdAt: document.createdAt })
  for (const membership of db.memberships.filter((item) => item.profileId?.startsWith('profile-reception'))) db.auditEvents.push({ id: `audit-${membership.id}`, action: 'USER_MEMBERSHIP_CREATED', actorUserId: 'usr-admin', actorUnitId: 'u-prot', targetType: 'USER', targetId: membership.userId, details: `Acesso à unidade ${db.units.find((unit) => unit.id === membership.unitId)!.name} concedido com perfil Atendimento e protocolo e permissões individuais.`, createdAt: membership.startsAt })
  db.events.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  db.auditEvents.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  for (const protocol of db.protocols) protocol.updatedAt = db.events.filter((event) => event.protocolId === protocol.id).at(-1)?.createdAt ?? protocol.createdAt
  return db
}
