import type { AuditEvent, EventKind, ProtocolEvent } from './model'
import { eventLabel, isMovementEvent } from './model'
import { auditActionLabel } from '../lib/audit'

export interface ProtocolAuditEntry {
  id: string;
  action: string;
  label: string;
  details?: string;
  actorUserId: string;
  actorUnitId: string;
  createdAt: string;
  attachmentId?: string;
  documentId?: string;
  movementId?: string;
}

const auditActions: Partial<Record<EventKind, string[]>> = {
  ABERTURA: ['PROTOCOL_CREATED'], RECEBIMENTO: ['PROTOCOL_ACKNOWLEDGED'], ATRIBUICAO: ['PROTOCOL_ASSIGNEE_CHANGED', 'PROTOCOL_ASSUMED'],
  TRAMITACAO: ['PROTOCOL_FORWARDED'], REABERTURA: ['PROTOCOL_REOPENED'], CONCLUSAO: ['PROTOCOL_COMPLETED'], ARQUIVAMENTO: ['PROTOCOL_ARCHIVED'],
  REJEICAO: ['PROTOCOL_REJECTED'], CANCELAMENTO: ['PROTOCOL_CANCELLED'], FASE_AVANCADA: ['PROTOCOL_PHASE_ADVANCED'], FASE_DEVOLVIDA: ['PROTOCOL_PHASE_RETURNED'],
  DOCUMENTO_CRIADO: ['DOCUMENT_CREATED', 'DOCUMENT_LINKED'], ANEXO_ADICIONADO: ['ATTACHMENT_ADDED'],
}

export function protocolAuditEntries(events: ProtocolEvent[], auditEvents: AuditEvent[]): ProtocolAuditEntry[] {
  const entries: ProtocolAuditEntry[] = auditEvents.map((event) => ({ id: `audit-${event.id}`, action: event.action, label: auditActionLabel(event.action), details: event.details, actorUserId: event.actorUserId, actorUnitId: event.actorUnitId, createdAt: event.createdAt, attachmentId: event.targetType === 'ATTACHMENT' ? event.targetId : undefined, documentId: event.targetType === 'DOCUMENT' ? event.targetId : undefined }))
  const matched = new Set<string>()
  for (const event of events) {
    const relatedId = event.relatedAttachmentId ?? event.relatedDocumentId ?? event.protocolId
    const candidates = auditEvents.filter((audit) => !matched.has(audit.id) && auditActions[event.kind]?.includes(audit.action) && audit.actorUserId === event.actorUserId && audit.actorUnitId === event.actorUnitId && (audit.targetId === relatedId || (audit.targetType === 'PROTOCOL' && audit.targetId === event.protocolId)) && Math.abs(Date.parse(audit.createdAt) - Date.parse(event.createdAt)) <= 1500)
    const match = candidates.sort((a, b) => Math.abs(Date.parse(a.createdAt) - Date.parse(event.createdAt)) - Math.abs(Date.parse(b.createdAt) - Date.parse(event.createdAt)))[0]
    const links = { attachmentId: event.relatedAttachmentId, documentId: event.relatedDocumentId, movementId: isMovementEvent(event) ? event.id : undefined }
    if (match) {
      matched.add(match.id)
      const entry = entries.find((item) => item.id === `audit-${match.id}`)!
      entry.attachmentId ??= links.attachmentId
      entry.documentId ??= links.documentId
      entry.movementId = links.movementId
      if (event.message && entry.details && !entry.details.includes(event.message)) entry.details += ` ${event.message}`
      else entry.details ??= event.message
    } else {
      entries.push({ id: `movement-${event.id}`, action: event.kind, label: eventLabel[event.kind], details: event.message, actorUserId: event.actorUserId, actorUnitId: event.actorUnitId, createdAt: event.createdAt, ...links })
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
