export const STATUSES = ['CADASTRADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ARQUIVADO'] as const
export type ProtocolStatus = (typeof STATUSES)[number]
export type Role = 'ADMIN' | 'OPERADOR'
export type PersonRole = 'INTERESSADO' | 'CREDOR'
export type EventKind = 'ABERTURA' | 'RECEBIMENTO' | 'ATRIBUICAO' | 'TRAMITACAO' | 'DOCUMENTO_CRIADO' | 'ANEXO_ADICIONADO' | 'CONCLUSAO' | 'ARQUIVAMENTO' | 'REABERTURA'

export interface Unit { id: string; name: string; abbreviation: string; parentId?: string; active: boolean }
export interface AppUser { id: string; name: string; email: string; role: Role; unitId: string; active: boolean }
export interface Person { id: string; kind: 'PF' | 'PJ'; name: string; document?: string; email?: string; phone?: string; roles: PersonRole[]; active: boolean }
export interface FieldsConfig { interested: { enabled: boolean; required: boolean }; creditor: { enabled: boolean; required: boolean }; amount: { enabled: boolean; required: boolean } }
export interface ProtocolType { id: string; name: string; description: string; color: string; defaultDeadlineDays?: number; fieldsConfig: FieldsConfig; active: boolean }
export interface DocumentType { id: string; name: string; description: string; color: string; active: boolean }
export interface Assignment { id: string; protocolId: string; unitId: string; assigneeId?: string; startedAt: string; receivedAt?: string; receivedById?: string; endedAt?: string }
export interface Protocol { id: string; number: string; typeId: string; typeConfigSnapshot: FieldsConfig; subject: string; description: string; interestedPersonId?: string; creditorPersonId?: string; amountCents?: number; status: ProtocolStatus; originUnitId: string; currentUnitId: string; currentAssigneeId?: string; currentAssignmentId: string; dueAt?: string; createdById: string; createdAt: string; updatedAt: string; completedAt?: string; archivedAt?: string; version: number }
export interface ProtocolEvent { id: string; protocolId: string; kind: EventKind; actorUserId: string; actorUnitId: string; fromUnitId?: string; toUnitId?: string; fromUserId?: string; toUserId?: string; assignmentId?: string; message?: string; previousStatus?: ProtocolStatus; nextStatus?: ProtocolStatus; relatedDocumentId?: string; relatedAttachmentId?: string; createdAt: string }
export interface AppDocument { id: string; number: string; typeId: string; protocolId?: string; subject: string; body: string; recipientPersonId?: string; unitId: string; authorUserId: string; createdAt: string }
export interface Attachment { id: string; protocolId: string; filename: string; mimeType: string; sizeBytes: number; blobKey: string; uploadedById: string; createdAt: string }
export interface Database { schemaVersion: 1; initializedAt: string; organization: { id: string; name: string; abbreviation: string }; counters: Record<string, number>; units: Unit[]; users: AppUser[]; people: Person[]; protocolTypes: ProtocolType[]; documentTypes: DocumentType[]; protocols: Protocol[]; assignments: Assignment[]; events: ProtocolEvent[]; documents: AppDocument[]; attachments: Attachment[] }
export interface Context { userId: string; activeUnitId: string }
export const isActive = (p: Protocol) => p.status === 'CADASTRADO' || p.status === 'EM_ANDAMENTO'
export const statusLabel: Record<ProtocolStatus, string> = { CADASTRADO: 'Cadastrado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', ARQUIVADO: 'Arquivado' }
export const eventLabel: Record<EventKind, string> = { ABERTURA: 'Protocolo aberto', RECEBIMENTO: 'Ciência registrada', ATRIBUICAO: 'Responsável designado', TRAMITACAO: 'Tramitado', DOCUMENTO_CRIADO: 'Documento criado', ANEXO_ADICIONADO: 'Anexo adicionado', CONCLUSAO: 'Concluído', ARQUIVAMENTO: 'Arquivado', REABERTURA: 'Reaberto' }
