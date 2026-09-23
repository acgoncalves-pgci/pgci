export const STATUSES = ['CADASTRADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ARQUIVADO'] as const
export type ProtocolStatus = (typeof STATUSES)[number]
export type Role = 'ADMIN' | 'GESTOR' | 'OPERADOR' | 'LEITOR'
export type PersonRole = 'INTERESSADO' | 'CREDOR' | 'RESPONSAVEL'
export type FlowMode = 'NONE' | 'SUGGESTED' | 'REQUIRED'
export type SituationCategory = 'CADASTRADO' | 'EM_TRAMITACAO' | 'CONCLUIDO' | 'ARQUIVADO' | 'CANCELADO' | 'REABERTO' | 'REJEITADO'
export type EventKind = 'ABERTURA' | 'RECEBIMENTO' | 'ATRIBUICAO' | 'TRAMITACAO' | 'DOCUMENTO_CRIADO' | 'ANEXO_ADICIONADO' | 'CONCLUSAO' | 'ARQUIVAMENTO' | 'REABERTURA' | 'FASE_AVANCADA' | 'FASE_DEVOLVIDA'

export interface Unit { id: string; name: string; abbreviation: string; parentId?: string; position?: number; active: boolean }
export interface AppUser { id: string; name: string; email: string; role: Role; unitId: string; active: boolean }
export interface UserUnitMembership { id: string; userId: string; unitId: string; role: Role; title?: string; signature?: string; startsAt: string; endsAt?: string; active: boolean }
export interface AuditEvent { id: string; action: string; actorUserId: string; actorUnitId: string; targetType: 'UNIT' | 'USER' | 'MEMBERSHIP' | 'PROTOCOL' | 'ATTACHMENT' | 'DOCUMENT' | 'FLOW' | 'PHASE' | 'SITUATION' | 'CATEGORY' | 'PERSON'; targetId: string; details?: string; createdAt: string }
export interface ResponsibilityPeriod { id: string; description: string; startsAt: string; endsAt?: string }
export interface Person { id: string; kind: 'PF' | 'PJ'; name: string; document?: string; email?: string; phone?: string; roles: PersonRole[]; responsibilityPeriods?: ResponsibilityPeriod[]; active: boolean }
export interface FieldRequirement { enabled: boolean; required?: boolean }
export interface FieldsConfig { interested: FieldRequirement; creditor: FieldRequirement; amount: FieldRequirement; tramitacao?: FieldRequirement; responsavel?: FieldRequirement; assunto?: FieldRequirement; arquivos?: FieldRequirement; contractNumber?: FieldRequirement; biddingNumber?: FieldRequirement; legalProcessNumber?: FieldRequirement; referenceNumber?: FieldRequirement; portal?: FieldRequirement }
export interface ChecklistQuestion { id: string; text: string; order: number; required: boolean; requiresAttachment: boolean; requiresDate: boolean; requiresObservation: boolean }
export interface ChecklistAnswer { questionId: string; text: string; checked: boolean; date?: string; observation?: string; attachmentProvided?: boolean }
export interface ProtocolPhase { id: string; name: string; code: string; description?: string; eligibleUnitIds: string[]; defaultDeadlineDays?: number; checklistItems: string[]; checklistQuestions?: ChecklistQuestion[]; requiredAttachmentTypes: string[]; color?: string; icon?: string; active: boolean }
export interface ProtocolFlow { id: string; name: string; version: number; active: boolean; startsAt: string; endsAt?: string }
export interface SituationType { id: string; name: string; category?: SituationCategory; color: string; icon: string; observation?: string; system: boolean; active: boolean }
export interface SituationSnapshot { id: string; name: string; category?: SituationCategory; color: string; icon: string }
export interface FlowPhase { id: string; flowId: string; phaseId: string; position: number; required: boolean; entryRule?: string; exitRule?: string; situation?: ProtocolStatus; situationTypeId?: string; destinationUnitId?: string; requiresChecklist?: boolean; requiresAttachment?: boolean; checklistQuestions?: ChecklistQuestion[]; observation?: string; color?: string; icon?: string }
export interface ProtocolFlowSnapshot { flowId: string; flowName: string; version: number; phases: Array<{ phaseId: string; name: string; code: string; position: number; required: boolean; eligibleUnitIds: string[]; checklistItems: string[]; checklistQuestions: ChecklistQuestion[]; requiredAttachmentTypes: string[]; situation?: ProtocolStatus; situationType?: SituationSnapshot; destinationUnitId?: string; requiresChecklist?: boolean; requiresAttachment?: boolean; observation?: string; color?: string; icon?: string }> }
export interface ProcessCategory { id: string; code: string; name: string; color: string; icon: string; observation?: string; active: boolean }
export interface ProtocolType { id: string; categoryId: string; name: string; description: string; color: string; icon?: string; defaultDeadlineDays?: number; fieldsConfig: FieldsConfig; flowId?: string; flowMode?: FlowMode; authorizedUserIds?: string[]; authorizedUnitIds?: string[]; active: boolean }
export interface DocumentType { id: string; name: string; description: string; color: string; active: boolean }
export interface DocumentTemplate { id: string; typeId: string; name: string; subject: string; body: string; active: boolean; createdAt: string; updatedAt: string }
export interface Assignment { id: string; protocolId: string; unitId: string; assigneeId?: string; startedAt: string; receivedAt?: string; receivedById?: string; endedAt?: string }
export interface Protocol { id: string; number: string; typeId: string; typeConfigSnapshot: FieldsConfig; flowModeSnapshot?: FlowMode; flowSnapshot?: ProtocolFlowSnapshot; currentPhaseId?: string; subject: string; description: string; observations?: string; interestedPersonId?: string; creditorPersonId?: string; amountCents?: number; contractNumber?: string; biddingNumber?: string; legalProcessNumber?: string; referenceNumber?: string; status: ProtocolStatus; originUnitId: string; currentUnitId: string; currentAssigneeId?: string; currentAssignmentId: string; dueAt?: string; createdById: string; createdAt: string; updatedAt: string; completedAt?: string; archivedAt?: string; version: number }
export interface ProtocolEvent { id: string; protocolId: string; kind: EventKind; actorUserId: string; actorUnitId: string; fromUnitId?: string; toUnitId?: string; fromUserId?: string; toUserId?: string; assignmentId?: string; phaseId?: string; message?: string; activity?: string; result?: string; previousStatus?: ProtocolStatus; nextStatus?: ProtocolStatus; relatedDocumentId?: string; relatedAttachmentId?: string; checklist?: ChecklistAnswer[]; createdAt: string }
export interface AppDocument { id: string; number: string; typeId: string; protocolId?: string; movementEventId?: string; subject: string; body: string; recipientPersonId?: string; unitId: string; authorUserId: string; createdAt: string }
export interface Attachment { id: string; protocolId?: string; movementEventId?: string; typeId?: string; filename: string; mimeType: string; sizeBytes: number; blobKey: string; uploadedById: string; createdAt: string }
export interface Database { schemaVersion: 7; initializedAt: string; organization: { id: string; name: string; abbreviation: string }; counters: Record<string, number>; units: Unit[]; users: AppUser[]; memberships: UserUnitMembership[]; auditEvents: AuditEvent[]; people: Person[]; processCategories: ProcessCategory[]; protocolTypes: ProtocolType[]; phases: ProtocolPhase[]; flows: ProtocolFlow[]; flowPhases: FlowPhase[]; situations: SituationType[]; documentTypes: DocumentType[]; documentTemplates: DocumentTemplate[]; protocols: Protocol[]; assignments: Assignment[]; events: ProtocolEvent[]; documents: AppDocument[]; attachments: Attachment[] }
export interface Context { userId: string; activeUnitId: string; scopeUnitId?: string }
export const isActive = (protocol: Protocol) => protocol.status === 'CADASTRADO' || protocol.status === 'EM_ANDAMENTO'
export const isMovementEvent = (event: ProtocolEvent) => event.kind !== 'DOCUMENTO_CRIADO' && event.kind !== 'ANEXO_ADICIONADO' && event.kind !== 'RECEBIMENTO'
export const isLegacyAssumptionEvent = (events: ProtocolEvent[], candidate: ProtocolEvent) =>
  candidate.kind === 'ATRIBUICAO' &&
  Boolean(candidate.assignmentId && candidate.toUserId) &&
  events.some((event) =>
    event.kind === 'RECEBIMENTO' &&
    event.assignmentId === candidate.assignmentId &&
    event.actorUserId === candidate.toUserId &&
    event.createdAt >= candidate.createdAt
  ) &&
  events.some((event) =>
    event.assignmentId === candidate.assignmentId &&
    event.id !== candidate.id &&
    event.kind !== 'ATRIBUICAO' &&
    event.kind !== 'RECEBIMENTO' &&
    isMovementEvent(event) &&
    event.createdAt <= candidate.createdAt
  )
export const statusLabel: Record<ProtocolStatus, string> = { CADASTRADO: 'Cadastrado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', ARQUIVADO: 'Arquivado' }
export const eventLabel: Record<EventKind, string> = { ABERTURA: 'Processo aberto', RECEBIMENTO: 'Ciência registrada', ATRIBUICAO: 'Responsável designado', TRAMITACAO: 'Tramitado', DOCUMENTO_CRIADO: 'Documento criado', ANEXO_ADICIONADO: 'Anexo adicionado', CONCLUSAO: 'Concluído', ARQUIVAMENTO: 'Arquivado', REABERTURA: 'Reaberto', FASE_AVANCADA: 'Fase avançada', FASE_DEVOLVIDA: 'Fase devolvida' }
