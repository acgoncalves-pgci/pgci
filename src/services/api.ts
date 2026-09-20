import type { AppDocument, AppUser, Attachment, AuditEvent, Context, Database, Person, Protocol, Unit, ProtocolType, DocumentType, ProtocolEvent, ProtocolStatus, ProtocolPhase, ProtocolFlow, ChecklistAnswer, ChecklistQuestion, FlowPhase, Role, SituationType, UserUnitMembership, ProcessCategory } from '../domain/model';
import { isActive, isLegacyAssumptionEvent, isMovementEvent } from '../domain/model';
import { canAct, canOpenProtocolType, canReceiveWorkInUnit, canView, DomainError, getAssignment, getProtocol, getUser, requireActive, requireActor, requireAdmin, requireAssignmentReceived, requireOperationalMembership, requireVersion, unitIdsForScope } from '../domain/rules';
import { cleanupOrphanedBlobs, deleteBlob, getBlob, loadDb, putBlob, saveDb } from '../storage/database';
import { isoDaysFromNow } from '../lib/format';
import { currentProtocolSituation } from '../domain/situations';
const sleep = () => new Promise((resolve) => window.setTimeout(resolve, 110));
const id = () => crypto.randomUUID();
const event = (db: Database, data: Omit<ProtocolEvent, 'id' | 'createdAt'>) => {
    const created = { ...data, id: id(), createdAt: new Date().toISOString() };
    db.events.push(created);
    return created;
};
const audit = (db: Database, data: Omit<AuditEvent, 'id' | 'createdAt'>) => {
    const created = { ...data, id: id(), createdAt: new Date().toISOString() };
    db.auditEvents.push(created);
    return created;
};
const resolveMovement = (db: Database, protocol: Protocol, requestedId?: string) => {
    const protocolEvents = db.events.filter((item) => item.protocolId === protocol.id);
    const movements = protocolEvents.filter((item) => isMovementEvent(item) && !isLegacyAssumptionEvent(protocolEvents, item));
    const movement = requestedId
        ? movements.find((item) => item.id === requestedId)
        : movements.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (!movement)
        throw new DomainError('VALIDATION', 'A movimentação selecionada não pertence a este processo.');
    return movement;
};
const mutate = async <T>(fn: (db: Database) => T) => { await sleep(); const db = loadDb(); const value = fn(db); saveDb(db); window.dispatchEvent(new Event('fluxo-publico:changed')); window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'success', message: 'Alteração salva com sucesso.' } })); return value; };
const protocolType = (db: Database, typeId: string) => db.protocolTypes.find((t) => t.id === typeId) ?? (() => { throw new DomainError('NOT_FOUND', 'Tipo de processo não encontrado.'); })();
type ChecklistSource = Pick<ProtocolPhase, 'checklistItems' | 'checklistQuestions'>;
const phaseQuestions = (phase: ChecklistSource): ChecklistQuestion[] => (phase.checklistQuestions?.length ? phase.checklistQuestions : phase.checklistItems.map((text, order) => ({ id: `legacy-${order}`, text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }))).slice().sort((a, b) => a.order - b.order);
const emptyChecklist = (phase: ChecklistSource): ChecklistAnswer[] => phaseQuestions(phase).map((question) => ({ questionId: question.id, text: question.text, checked: false }));
const phaseForChecklist = (db: Database, protocol: Protocol, phaseId = protocol.currentPhaseId): ChecklistSource | undefined => protocol.flowSnapshot?.phases.find((phase) => phase.phaseId === phaseId) ?? db.phases.find((phase) => phase.id === phaseId);
const checklistAnswersFor = (phase: ChecklistSource, values: ChecklistAnswer[]): ChecklistAnswer[] => phaseQuestions(phase).map((question) => {
    const value = values.find((answer) => answer.questionId === question.id);
    return {
        questionId: question.id,
        text: question.text,
        checked: Boolean(value?.checked),
        date: value?.date || undefined,
        observation: value?.observation?.trim() || undefined,
        attachmentProvided: value?.attachmentProvided,
    };
});
const normalizedAnswers = (phase: ReturnType<typeof currentPhase>, values: ChecklistAnswer[] | string[]) => (values as (ChecklistAnswer | string)[]).map((value) => typeof value === 'string' ? { questionId: phaseQuestions(phase).find((question) => question.text === value)?.id ?? value, text: value, checked: true } : value);
const flowModeFor = (type: ProtocolType) => type.flowMode ?? (type.flowId ? 'REQUIRED' : 'NONE')
const flowSnapshotFor = (db: Database, type: ProtocolType, useSuggestedFlow = true) => {
    const mode = flowModeFor(type);
    if (mode === 'NONE' || (mode === 'SUGGESTED' && !useSuggestedFlow))
        return { mode, snapshot: undefined };
    const flow = type.flowId ? db.flows.find((item) => item.id === type.flowId && item.active) : undefined;
    if (!flow) {
        if (mode === 'SUGGESTED') return { mode, snapshot: undefined };
        throw new DomainError('VALIDATION', 'O fluxo obrigatório deste tipo ainda não foi configurado.');
    }
    const phases = db.flowPhases.filter((item) => item.flowId === flow.id).sort((a, b) => a.position - b.position).map((flowPhase) => {
        const phase = db.phases.find((item) => item.id === flowPhase.phaseId && item.active);
        if (!phase)
            throw new DomainError('VALIDATION', 'O fluxo possui uma fase indisponível.');
        const situation = flowPhase.situationTypeId ? db.situations.find((item) => item.id === flowPhase.situationTypeId) : undefined;
        return { phaseId: phase.id, name: phase.name, code: phase.code, position: flowPhase.position, required: flowPhase.required, eligibleUnitIds: phase.eligibleUnitIds, checklistItems: flowPhase.checklistQuestions?.map((question) => question.text) ?? phase.checklistItems, checklistQuestions: flowPhase.checklistQuestions ?? phaseQuestions(phase), requiredAttachmentTypes: phase.requiredAttachmentTypes, situation: flowPhase.situation, situationType: situation ? { id: situation.id, name: situation.name, category: situation.category, color: situation.color, icon: situation.icon } : undefined, destinationUnitId: flowPhase.destinationUnitId, requiresChecklist: flowPhase.requiresChecklist, requiresAttachment: flowPhase.requiresAttachment, observation: flowPhase.observation, color: flowPhase.color, icon: flowPhase.icon };
    });
    if (!phases.length) {
        if (mode === 'SUGGESTED') return { mode, snapshot: undefined };
        throw new DomainError('VALIDATION', 'O fluxo obrigatório precisa possuir ao menos uma fase ativa.');
    }
    return { mode, snapshot: { flowId: flow.id, flowName: flow.name, version: flow.version, phases } };
};const nextNumber = (db: Database, scope: 'protocol' | 'document') => { const year = new Date().getFullYear(); const key = `${scope}-${year}`; db.counters[key] = (db.counters[key] ?? 0) + 1; return `${scope === 'protocol' ? year : `DOC-${year}`}.${String(db.counters[key]).padStart(6, '0')}`; };
const bump = (p: Protocol) => { p.version += 1; p.updatedAt = new Date().toISOString(); };
const currentPhase = (protocol: Protocol) => {
    const phase = protocol.flowSnapshot?.phases.find((item) => item.phaseId === protocol.currentPhaseId);
    if (!phase)
        throw new DomainError('INVALID_STATE', 'Este processo não possui uma fase atual válida.');
    return phase;
};
const orderedPhases = (protocol: Protocol) => protocol.flowSnapshot?.phases.slice().sort((a, b) => a.position - b.position) ?? [];
const validatePhaseExit = (db: Database, protocol: Protocol, values: ChecklistAnswer[] | string[]) => {
    const phase = currentPhase(protocol);
    const answers = normalizedAnswers(phase, values);
    const pending = phaseQuestions(phase).filter((question) => question.required && !answers.find((answer) => answer.questionId === question.id)?.checked);
    if (pending.length)
        throw new DomainError('VALIDATION', `Conclua o checklist da fase: ${pending.map((question) => question.text).join(', ')}.`);
    const missingDate = phaseQuestions(phase).filter((question) => question.requiresDate && answers.find((answer) => answer.questionId === question.id)?.checked && !answers.find((answer) => answer.questionId === question.id)?.date);
    if (missingDate.length) throw new DomainError('VALIDATION', 'Informe a data solicitada no checklist.');
    const missingObservation = phaseQuestions(phase).filter((question) => question.requiresObservation && answers.find((answer) => answer.questionId === question.id)?.checked && !answers.find((answer) => answer.questionId === question.id)?.observation?.trim());
    if (missingObservation.length) throw new DomainError('VALIDATION', 'Informe a observação solicitada no checklist.');
    const requiresAttachment = phaseQuestions(phase).some((question) => question.requiresAttachment && answers.find((answer) => answer.questionId === question.id)?.checked) || phase.requiresAttachment;
    if (requiresAttachment && !db.attachments.some((attachment) => attachment.protocolId === protocol.id)) throw new DomainError('VALIDATION', 'Inclua o anexo exigido antes de avançar a fase.');
    const missingTypes = phase.requiredAttachmentTypes.filter((mimeType) => !db.attachments.some((attachment) => attachment.protocolId === protocol.id && attachment.mimeType === mimeType));
    if (missingTypes.length) throw new DomainError('VALIDATION', `Anexe os arquivos obrigatórios: ${missingTypes.join(', ')}.`);
    return { phase, answers };
};
const validatePhaseDestination = (eligibleUnitIds: string[], unitId: string) => {
    if (eligibleUnitIds.length && !eligibleUnitIds.includes(unitId))
        throw new DomainError('VALIDATION', 'A unidade de destino não é elegível para executar esta fase.');
};
const endCurrent = (db: Database, p: Protocol) => { getAssignment(db, p).endedAt = new Date().toISOString(); };
const addAssignment = (db: Database, p: Protocol, unitId: string, assigneeId?: string) => { const assignment = { id: id(), protocolId: p.id, unitId, assigneeId, startedAt: new Date().toISOString() }; db.assignments.push(assignment); p.currentAssignmentId = assignment.id; p.currentUnitId = unitId; p.currentAssigneeId = assigneeId; return assignment; };
type PersonInput = Omit<Person, 'id'>;
const documentIsValid = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14)
        return false;
    if (/^(\d)\1+$/.test(digits))
        return false;
    const weights = digits.length === 11 ? [10, 9, 8, 7, 6, 5, 4, 3, 2] : [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const check = (source: string, factors: number[]) => { const sum = source.split('').reduce((total, digit, index) => total + Number(digit) * factors[index], 0); const result = sum % 11; return result < 2 ? 0 : 11 - result; };
    const first = check(digits.slice(0, -2), weights);
    const secondWeights = digits.length === 11 ? [11, 10, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    return Number(digits.at(-2)) === first && Number(digits.at(-1)) === check(`${digits.slice(0, -2)}${first}`, secondWeights);
};
const attachmentPreviewKind = (mimeType: string): 'pdf' | 'image' | 'text' | undefined => { if (mimeType === 'application/pdf')
    return 'pdf'; if (mimeType === 'image/png' || mimeType === 'image/jpeg')
    return 'image'; if (mimeType === 'text/plain')
    return 'text'; return undefined; };
const validatePerson = (input: PersonInput) => {
    if (!input.name.trim() || !input.roles.length)
        throw new DomainError('VALIDATION', 'Informe nome e ao menos um papel.');
    if (input.document && !documentIsValid(input.document))
        throw new DomainError('VALIDATION', 'CPF ou CNPJ inválido.');
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
        throw new DomainError('VALIDATION', 'E-mail inválido.');
    if (input.phone && input.phone.replace(/\D/g, '').length < 10)
        throw new DomainError('VALIDATION', 'Telefone inválido.');
    const periods = input.responsibilityPeriods ?? [];
    if (periods.some((period) => !period.description.trim() || !period.startsAt))
        throw new DomainError('VALIDATION', 'Preencha a descrição e a data inicial dos períodos de responsabilidade.');
    if (periods.some((period) => period.endsAt && period.endsAt < period.startsAt))
        throw new DomainError('VALIDATION', 'A data final da responsabilidade não pode ser anterior à data inicial.');
};
const normalizePersonInput = (input: PersonInput): PersonInput => ({
    ...input,
    roles: [...new Set(input.roles)],
    responsibilityPeriods: input.roles.includes('RESPONSAVEL')
        ? (input.responsibilityPeriods ?? []).map((period) => ({ ...period, id: period.id || id(), description: period.description.trim(), endsAt: period.endsAt || undefined }))
        : [],
});
type ProtocolTypeInput = Omit<ProtocolType, 'id'>;
type ProtocolPhaseInput = Omit<ProtocolPhase, 'id'>;
type SituationTypeInput = Omit<SituationType, 'id' | 'system'>;
type ProcessCategoryInput = Omit<ProcessCategory, 'id'>;
type StageInput = Omit<FlowPhase, 'id' | 'flowId' | 'position'> & { position?: number };
type ProtocolFlowInput = Omit<ProtocolFlow, 'id'> & { phaseIds?: string[]; stages?: StageInput[] };
const stagesFor = (input: ProtocolFlowInput): Array<StageInput & { position: number }> => input.stages?.map((stage, position) => ({ ...stage, position })) ?? (input.phaseIds ?? []).map((phaseId, position) => ({ phaseId, position, required: true }));
const cleanQuestions = (questions: ChecklistQuestion[] | undefined, checklistItems: string[]) => (questions?.length ? questions : checklistItems.map((text, order) => ({ id: id(), text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }))).map((question, index) => ({ ...question, id: question.id || id(), text: question.text.trim(), order: Number.isInteger(question.order) && question.order > 0 ? question.order : index + 1 })).filter((question) => question.text);
const validateProtocolType = (db: Database, input: ProtocolTypeInput) => {
    if (!input.name.trim() || !input.description.trim())
        throw new DomainError('VALIDATION', 'Informe nome e descrição do tipo.');
    if (input.categoryId && !db.processCategories.some((category) => category.id === input.categoryId && category.active))
        throw new DomainError('VALIDATION', 'Selecione uma categoria de processo ativa.');
    if (input.flowId && !db.flows.some((flow) => flow.id === input.flowId && flow.active))
        throw new DomainError('VALIDATION', 'Selecione um fluxo ativo para o tipo de processo.');
    if (input.defaultDeadlineDays !== undefined && (!Number.isInteger(input.defaultDeadlineDays) || input.defaultDeadlineDays < 1))
        throw new DomainError('VALIDATION', 'Prazo padrão deve ser um número inteiro positivo.');
    if (input.authorizedUserIds?.some((userId) => !db.users.some((user) => user.id === userId && user.active)))
        throw new DomainError('VALIDATION', 'Há usuário autorizado inválido ou inativo.');
    if (input.authorizedUnitIds?.some((unitId) => !db.units.some((unit) => unit.id === unitId && unit.active)))
        throw new DomainError('VALIDATION', 'Há unidade autorizada inválida ou inativa.');
    for (const config of Object.values(input.fieldsConfig))
        if (config.required && !config.enabled)
            throw new DomainError('VALIDATION', 'Não é possível exigir um campo desabilitado.');
};
const validateProcessCategory = (db: Database, input: ProcessCategoryInput, ignoreId?: string) => {
    const code = input.code.trim();
    const name = input.name.trim();
    if (!code || !name)
        throw new DomainError('VALIDATION', 'Informe código e nome da categoria.');
    if (!/^#[0-9a-f]{6}$/i.test(input.color))
        throw new DomainError('VALIDATION', 'Informe uma cor hexadecimal válida.');
    if (!input.icon.trim())
        throw new DomainError('VALIDATION', 'Selecione um ícone.');
    if (db.processCategories.some((item) => item.id !== ignoreId && item.code.toLocaleLowerCase() === code.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe uma categoria com este código.');
    if (db.processCategories.some((item) => item.id !== ignoreId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe uma categoria com este nome.');
};const validateSituationType = (db: Database, input: SituationTypeInput, ignoreId?: string) => {
    if (!input.name.trim())
        throw new DomainError('VALIDATION', 'Informe a descrição da situação.');
    if (!/^#[0-9a-f]{6}$/i.test(input.color))
        throw new DomainError('VALIDATION', 'Informe uma cor hexadecimal válida.');
    if (!input.icon.trim())
        throw new DomainError('VALIDATION', 'Selecione um ícone.');
    if (db.situations.some((item) => item.id !== ignoreId && item.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe uma situação com essa descrição.');
};

const validatePhase = (db: Database, input: ProtocolPhaseInput, ignoreId?: string) => {
    if (!input.name.trim() || !input.code.trim())
        throw new DomainError('VALIDATION', 'Informe nome e código da fase.');
    if (db.phases.some((phase) => phase.id !== ignoreId && phase.code.toLocaleLowerCase() === input.code.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe uma fase com este código.');
    if (db.phases.some((phase) => phase.id !== ignoreId && phase.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe uma fase com esta descrição.');
    if (input.defaultDeadlineDays !== undefined && (!Number.isInteger(input.defaultDeadlineDays) || input.defaultDeadlineDays < 1))
        throw new DomainError('VALIDATION', 'Prazo da fase deve ser um número inteiro positivo.');
    if (input.eligibleUnitIds.some((unitId) => !db.units.some((unit) => unit.id === unitId && unit.active)))
        throw new DomainError('VALIDATION', 'Há unidade elegível inválida ou inativa.');
};
const validateFlow = (db: Database, input: ProtocolFlowInput, ignoreId?: string) => {
    if (!input.name.trim() || !Number.isInteger(input.version) || input.version < 1)
        throw new DomainError('VALIDATION', 'Informe nome e versão válida do fluxo.');
    if (db.flows.some((flow) => flow.id !== ignoreId && flow.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase() && flow.version === input.version))
        throw new DomainError('VALIDATION', 'Já existe um fluxo com esse nome e versão.');
    const stages = stagesFor(input);
    if (!stages.length || new Set(stages.map((stage) => stage.phaseId)).size !== stages.length)
        throw new DomainError('VALIDATION', 'Defina ao menos uma fase sem repetições.');
    if (stages.some((stage) => !db.phases.some((phase) => phase.id === stage.phaseId && phase.active)))
        throw new DomainError('VALIDATION', 'Selecione apenas fases ativas.');
    if (stages.some((stage) => stage.destinationUnitId && !db.units.some((unit) => unit.id === stage.destinationUnitId && unit.active)))
        throw new DomainError('VALIDATION', 'Selecione um destino organizacional ativo.');
    if (stages.some((stage) => stage.situationTypeId && !db.situations.some((situation) => situation.id === stage.situationTypeId && situation.active)))
        throw new DomainError('VALIDATION', 'Selecione uma situação ativa para cada etapa.');
};
type UserInput = Omit<AppUser, 'id'>;
export type MembershipInput = { unitId: string; role: Role; title?: string };
const validateUser = (db: Database, input: UserInput, ignoreId?: string) => {
    if (!input.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
        throw new DomainError('VALIDATION', 'Informe nome e e-mail válidos.');
    if (!db.units.some((unit) => unit.id === input.unitId && unit.active))
        throw new DomainError('VALIDATION', 'Selecione uma unidade ativa.');
    if (db.users.some((user) => user.id !== ignoreId && user.email.toLocaleLowerCase() === input.email.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um usuário com este e-mail.');
};
export interface ProtocolFilters {
    tab?: 'mine' | 'unit' | 'created' | 'participated' | 'all';
    search?: string;
    statuses?: ProtocolStatus[];
    situationIds?: string[];
    typeId?: string;
    interestedId?: string;
    creditorId?: string;
    number?: string;
    description?: string;
    attachments?: '' | 'with' | 'without';
    unitId?: string;
    assigneeId?: string;
    createdFrom?: string;
    createdTo?: string;
    sort?: 'updated-desc' | 'created-desc' | 'due-asc' | 'number-asc';
    shortcut?: 'unassigned' | 'unacknowledged' | 'overdue' | 'soon' | '';
    page?: number;
    pageSize?: number;
}
export const api = {
    attachmentPreviewKind,
    async dashboard(ctx: Context) {
        await sleep();
        const db = loadDb();
        requireActor(db, ctx);
        const now = new Date();
        const visible = db.protocols.filter((p) => canView(db, p, ctx));
        const mine = visible.filter((p) => isActive(p) && p.currentAssigneeId === ctx.userId);
        const unit = visible.filter((p) => isActive(p) && p.currentUnitId === ctx.activeUnitId);
        const currentAssignment = (p: Protocol) => getAssignment(db, p);
        return { counts: { mine: mine.length, unassigned: unit.filter((p) => !p.currentAssigneeId).length, overdue: unit.filter((p) => !!p.dueAt && new Date(p.dueAt) < now).length, soon: unit.filter((p) => !!p.dueAt && new Date(p.dueAt) >= now && new Date(p.dueAt).getTime() <= now.getTime() + 86400000).length }, priorities: [...mine, ...unit.filter((p) => !p.currentAssigneeId)].filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).sort((a, b) => Number(!!b.dueAt && new Date(b.dueAt) < now) - Number(!!a.dueAt && new Date(a.dueAt) < now) || (a.dueAt ?? 'z').localeCompare(b.dueAt ?? 'z')).slice(0, 8), events: db.events.filter((e) => visible.some((p) => p.id === e.protocolId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7), received: currentAssignment };
    },
    async listProtocols(ctx: Context, filters: ProtocolFilters = {}) {
        await sleep();
        const db = loadDb();
        const user = requireActor(db, ctx);
        const scopeUnitIds = unitIdsForScope(db, ctx);
        let items = db.protocols.filter((p) => canView(db, p, ctx));
        const tab = filters.tab ?? 'mine';
        if (tab === 'mine')
            items = items.filter((p) => isActive(p) && p.currentAssigneeId === user.id);
        if (tab === 'unit')
            items = items.filter((p) => isActive(p) && scopeUnitIds.includes(p.currentUnitId));
        if (tab === 'created')
            items = items.filter((p) => p.createdById === user.id);
        if (tab === 'participated')
            items = items.filter((p) => db.events.some((event) => event.protocolId === p.id && (event.actorUserId === user.id || event.toUserId === user.id || event.fromUserId === user.id)));
        if (filters.search) {
            const q = filters.search.toLocaleLowerCase();
            items = items.filter((p) => p.number.includes(q) || p.subject.toLocaleLowerCase().includes(q) || db.people.find((x) => x.id === p.interestedPersonId)?.name.toLocaleLowerCase().includes(q));
        }
        if (filters.statuses?.length)
            items = items.filter((p) => filters.statuses!.includes(p.status));
        if (filters.situationIds?.length)
            items = items.filter((p) => {
                const situationId = currentProtocolSituation(db, p)?.id;
                return Boolean(situationId && filters.situationIds!.includes(situationId));
            });
        if (filters.typeId)
            items = items.filter((p) => p.typeId === filters.typeId);
        if (filters.interestedId)
            items = items.filter((p) => p.interestedPersonId === filters.interestedId);
        if (filters.creditorId)
            items = items.filter((p) => p.creditorPersonId === filters.creditorId);
        if (filters.number) {
            const number = filters.number.toLocaleLowerCase();
            items = items.filter((p) => p.number.toLocaleLowerCase().includes(number));
        }
        if (filters.description) {
            const description = filters.description.toLocaleLowerCase();
            items = items.filter((p) => p.subject.toLocaleLowerCase().includes(description) || p.description.toLocaleLowerCase().includes(description));
        }
        if (filters.attachments === 'with')
            items = items.filter((p) => db.attachments.some((attachment) => attachment.protocolId === p.id));
        if (filters.attachments === 'without')
            items = items.filter((p) => !db.attachments.some((attachment) => attachment.protocolId === p.id));
        if (filters.unitId)
            items = items.filter((p) => p.currentUnitId === filters.unitId);
        if (filters.assigneeId)
            items = items.filter((p) => p.currentAssigneeId === filters.assigneeId);
        if (filters.createdFrom)
            items = items.filter((p) => p.createdAt >= filters.createdFrom!);
        if (filters.createdTo) {
            const end = new Date(filters.createdTo);
            end.setHours(23, 59, 59, 999);
            items = items.filter((p) => new Date(p.createdAt) <= end);
        }
        ;
        const now = new Date();
        if (filters.shortcut === 'unassigned')
            items = items.filter((p) => !p.currentAssigneeId);
        if (filters.shortcut === 'unacknowledged')
            items = items.filter((p) => !getAssignment(db, p).receivedAt);
        if (filters.shortcut === 'overdue')
            items = items.filter((p) => isActive(p) && !!p.dueAt && new Date(p.dueAt) < now);
        if (filters.shortcut === 'soon')
            items = items.filter((p) => isActive(p) && !!p.dueAt && new Date(p.dueAt) >= now && new Date(p.dueAt).getTime() < now.getTime() + 86400000);
        items.sort((a, b) => { if (filters.sort === 'created-desc')
            return b.createdAt.localeCompare(a.createdAt); if (filters.sort === 'number-asc')
            return a.number.localeCompare(b.number); if (filters.sort === 'due-asc')
            return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'); return b.updatedAt.localeCompare(a.updatedAt); });
        const pageSize = filters.pageSize ?? 10;
        const total = items.length;
        const page = Math.min(filters.page ?? 1, Math.max(1, Math.ceil(total / pageSize)));
        const unassignedInUnit = db.protocols.filter((p) => canView(db, p, ctx) && isActive(p) && scopeUnitIds.includes(p.currentUnitId) && !p.currentAssigneeId).length;
        return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, unassignedInUnit };
    },
    async getProtocol(ctx: Context, protocolId: string) { await sleep(); const db = loadDb(); requireActor(db, ctx); const protocol = getProtocol(db, protocolId); if (!canView(db, protocol, ctx))
        throw new DomainError('FORBIDDEN', 'Você não possui acesso a este processo.'); return { protocol, assignment: getAssignment(db, protocol), events: db.events.filter((e) => e.protocolId === protocolId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), attachments: db.attachments.filter((a) => a.protocolId === protocolId), documents: db.documents.filter((d) => d.protocolId === protocolId), db }; },
    async createProtocol(ctx: Context, input: {
        typeId: string;
        subject: string;
        description: string;
        observations?: string;
        interestedPersonId?: string;
        creditorPersonId?: string;
        amountCents?: number;
        contractNumber?: string;
        biddingNumber?: string;
        legalProcessNumber?: string;
        referenceNumber?: string;
        assigneeId?: string;
        dueAt?: string;
        files?: File[];
        useSuggestedFlow?: boolean;
    }) {
        const files = input.files ?? [];
        if (files.length > 5)
            throw new DomainError('VALIDATION', 'Selecione no máximo 5 arquivos.');
        for (const file of files)
            if (!['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type) || file.size > 5 * 1024 * 1024)
                throw new DomainError('VALIDATION', 'Envie PDF, PNG, JPEG ou TXT de até 5 MB.');
        const preflightDb = loadDb();
        requireActor(preflightDb, ctx);
        requireOperationalMembership(preflightDb, ctx);
        const preflightType = protocolType(preflightDb, input.typeId);
        if (!preflightType.active || !canOpenProtocolType(preflightDb, preflightType, ctx))
            throw new DomainError('FORBIDDEN', 'Você não possui autorização para abrir processos deste tipo na unidade selecionada.');
        if (files.length && !preflightType.fieldsConfig.arquivos?.enabled)
            throw new DomainError('VALIDATION', 'Este tipo de processo não permite anexos ou documentos.');
        const staged = files.map((file) => ({ file, blobKey: id() }));
        try {
            await Promise.all(staged.map(({ blobKey, file }) => putBlob(blobKey, file)));
            return await mutate((db) => {
                const user = requireActor(db, ctx);
                requireOperationalMembership(db, ctx);
                const type = protocolType(db, input.typeId);
                if (!type.active || !canOpenProtocolType(db, type, ctx))
                    throw new DomainError('FORBIDDEN', 'Você não possui autorização para abrir processos deste tipo na unidade selecionada.');
                if (files.length && !type.fieldsConfig.arquivos?.enabled)
                    throw new DomainError('VALIDATION', 'Este tipo de processo não permite anexos ou documentos.');
                const { mode: flowModeSnapshot, snapshot: flowSnapshot } = flowSnapshotFor(db, type, input.useSuggestedFlow ?? true);
                if (!input.subject.trim() || input.subject.length > 160)
                    throw new DomainError('VALIDATION', 'Informe um assunto de até 160 caracteres.');
                if (!input.description.trim() || input.description.length > 4000)
                    throw new DomainError('VALIDATION', 'Informe uma descrição de até 4.000 caracteres.');
                const configuredValues = {
                    interested: input.interestedPersonId,
                    creditor: input.creditorPersonId,
                    amount: input.amountCents,
                    contractNumber: input.contractNumber,
                    biddingNumber: input.biddingNumber,
                    legalProcessNumber: input.legalProcessNumber,
                    referenceNumber: input.referenceNumber,
                };
                const configuredLabels: Record<keyof typeof configuredValues, string> = {
                    interested: 'interessado', creditor: 'credor', amount: 'valor', contractNumber: 'número de contrato', biddingNumber: 'número de licitação', legalProcessNumber: 'número de processo jurídico', referenceNumber: 'número',
                };
                for (const [key, value] of Object.entries(configuredValues) as Array<[keyof typeof configuredValues, string | number | undefined]>) {
                    const setting = type.fieldsConfig[key];
                    if (setting?.required && (value === undefined || value === ''))
                        throw new DomainError('VALIDATION', 'Preencha o campo obrigatório: ' + configuredLabels[key] + '.');
                    if (!setting?.enabled && value !== undefined && value !== '')
                        throw new DomainError('VALIDATION', `O campo ${configuredLabels[key]} não está habilitado para este tipo de processo.`);
                    if (typeof value === 'string' && value.trim().length > 120)
                        throw new DomainError('VALIDATION', `O campo ${configuredLabels[key]} deve ter até 120 caracteres.`);
                }
                if (type.fieldsConfig.arquivos?.required && files.length === 0)
                    throw new DomainError('VALIDATION', 'Anexe ao menos um arquivo.');
                if (input.amountCents !== undefined && input.amountCents < 0)
                    throw new DomainError('VALIDATION', 'Valor não pode ser negativo.');

                const responsibleSetting = type.fieldsConfig.responsavel;
                const assigneeId = responsibleSetting?.enabled ? input.assigneeId : user.id;
                if (responsibleSetting?.enabled && responsibleSetting.required !== false && !assigneeId)
                    throw new DomainError('VALIDATION', 'Selecione o responsável.');
                if (assigneeId) {
                    const assignee = getUser(db, assigneeId);
                    if (!assignee.active || !canReceiveWorkInUnit(db, assignee.id, ctx.activeUnitId))
                        throw new DomainError('VALIDATION', 'O responsável deve estar ativo e possuir vínculo operacional vigente com a unidade atual.');
                }

                const createdAt = new Date().toISOString();
                const creatorReceived = assigneeId === user.id;
                const assignment = {
                    id: id(),
                    protocolId: id(),
                    unitId: ctx.activeUnitId,
                    assigneeId,
                    startedAt: createdAt,
                    receivedAt: creatorReceived ? createdAt : undefined,
                    receivedById: creatorReceived ? user.id : undefined,
                };
                const protocol: Protocol = {
                    id: assignment.protocolId,
                    number: nextNumber(db, 'protocol'),
                    typeId: type.id,
                    typeConfigSnapshot: structuredClone(type.fieldsConfig),
                    flowModeSnapshot,
                    flowSnapshot,
                    currentPhaseId: flowSnapshot?.phases[0].phaseId,
                    subject: input.subject.trim(),
                    description: input.description.trim(),
                    observations: input.observations?.trim() || undefined,
                    interestedPersonId: input.interestedPersonId,
                    creditorPersonId: input.creditorPersonId,
                    amountCents: input.amountCents,
                    contractNumber: input.contractNumber?.trim() || undefined,
                    biddingNumber: input.biddingNumber?.trim() || undefined,
                    legalProcessNumber: input.legalProcessNumber?.trim() || undefined,
                    referenceNumber: input.referenceNumber?.trim() || undefined,
                    status: 'CADASTRADO',
                    originUnitId: ctx.activeUnitId,
                    currentUnitId: ctx.activeUnitId,
                    currentAssigneeId: assigneeId,
                    currentAssignmentId: assignment.id,
                    dueAt: input.dueAt,
                    createdById: user.id,
                    createdAt,
                    updatedAt: createdAt,
                    version: 1,
                };
                db.protocols.push(protocol);
                db.assignments.push(assignment);
                const openingPhase = phaseForChecklist(db, protocol);
                const opening = event(db, { protocolId: protocol.id, kind: 'ABERTURA', actorUserId: user.id, actorUnitId: ctx.activeUnitId, toUnitId: ctx.activeUnitId, toUserId: assigneeId, assignmentId: assignment.id, phaseId: protocol.currentPhaseId, nextStatus: 'CADASTRADO', checklist: openingPhase ? emptyChecklist(openingPhase) : undefined });
                if (creatorReceived)
                    event(db, { protocolId: protocol.id, kind: 'RECEBIMENTO', actorUserId: user.id, actorUnitId: ctx.activeUnitId, assignmentId: assignment.id });
                for (const { file, blobKey } of staged) {
                    const attachment: Attachment = { id: id(), protocolId: protocol.id, movementEventId: opening.id, filename: file.name, mimeType: file.type, sizeBytes: file.size, blobKey, uploadedById: user.id, createdAt };
                    db.attachments.push(attachment);
                    audit(db, { action: 'ATTACHMENT_ADDED', actorUserId: user.id, actorUnitId: ctx.activeUnitId, targetType: 'ATTACHMENT', targetId: attachment.id, details: `Arquivo “${attachment.filename}” anexado à movimentação de abertura do processo ${protocol.number}.` });
                }
                return protocol;
            });
        } catch (error) {
            await Promise.all(staged.map(({ blobKey }) => deleteBlob(blobKey).catch(() => undefined)));
            throw error;
        }
    },    async updateProtocol(ctx: Context, protocolId: string, expectedVersion: number, input: { subject: string; description: string; dueAt?: string }) { return mutate((db) => { const protocol = getProtocol(db, protocolId); requireVersion(protocol, expectedVersion); requireActive(protocol); requireAdmin(db, ctx); if (protocol.currentUnitId !== ctx.activeUnitId) throw new DomainError('FORBIDDEN', 'Selecione a unidade atual do processo para editá-lo.'); if (!input.subject.trim() || input.subject.trim().length > 160) throw new DomainError('VALIDATION', 'Informe um assunto de até 160 caracteres.'); if (!input.description.trim() || input.description.trim().length > 4000) throw new DomainError('VALIDATION', 'Informe uma descrição de até 4.000 caracteres.'); if (input.dueAt && new Date(input.dueAt).getTime() < Date.now()) throw new DomainError('VALIDATION', 'O prazo não pode estar no passado.'); protocol.subject = input.subject.trim(); protocol.description = input.description.trim(); protocol.dueAt = input.dueAt; bump(protocol); return protocol; }); },
    async deleteProtocol(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const protocol = getProtocol(db, protocolId); requireVersion(protocol, expectedVersion); requireAdmin(db, ctx); if (protocol.currentUnitId !== ctx.activeUnitId || protocol.status !== 'CADASTRADO') throw new DomainError('FORBIDDEN', 'Somente processos cadastrados, na unidade atual, podem ser excluídos.'); db.protocols = db.protocols.filter((item) => item.id !== protocolId); db.assignments = db.assignments.filter((item) => item.protocolId !== protocolId); db.events = db.events.filter((item) => item.protocolId !== protocolId); db.documents = db.documents.filter((item) => item.protocolId !== protocolId); db.attachments = db.attachments.filter((item) => item.protocolId !== protocolId); return undefined; }); },
    async assume(ctx: Context, protocolId: string, expectedVersion: number) {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            const user = requireActor(db, ctx);
            requireOperationalMembership(db, ctx);
            if (protocol.currentUnitId !== ctx.activeUnitId || protocol.currentAssigneeId)
                throw new DomainError('FORBIDDEN', 'Apenas a fila da sua unidade pode ser assumida.');

            const assignment = getAssignment(db, protocol);
            const movement = resolveMovement(db, protocol);
            assignment.assigneeId = user.id;
            assignment.receivedAt = new Date().toISOString();
            assignment.receivedById = user.id;
            protocol.currentAssigneeId = user.id;
            movement.toUnitId ??= protocol.currentUnitId;
            movement.toUserId = user.id;
            bump(protocol);
            return protocol;
        });
    },
    async acknowledge(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActive(p); requireActor(db, ctx); requireOperationalMembership(db, ctx); if (p.currentAssigneeId !== ctx.userId)
        throw new DomainError('FORBIDDEN', 'Somente o responsável atual pode dar ciência.'); const a = getAssignment(db, p); if (!a.receivedAt) {
        a.receivedAt = new Date().toISOString();
        a.receivedById = ctx.userId;
        bump(p);
    } ; return p; }); },
    async updateMovementChecklist(ctx: Context, protocolId: string, expectedVersion: number, movementEventId: string, values: ChecklistAnswer[]) {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            requireActor(db, ctx);
            if (!canAct(db, protocol, ctx))
                throw new DomainError('FORBIDDEN', 'Você não pode preencher o checklist desta movimentação.');
            requireAssignmentReceived(db, protocol);

            const movement = resolveMovement(db, protocol, movementEventId);
            const latestMovement = resolveMovement(db, protocol);
            if (movement.id !== latestMovement.id || movement.assignmentId !== protocol.currentAssignmentId)
                throw new DomainError('INVALID_STATE', 'Somente o checklist da movimentação atual pode ser alterado.');
            const phase = phaseForChecklist(db, protocol);
            if (!phase)
                throw new DomainError('INVALID_STATE', 'A movimentação atual não possui uma fase com checklist.');
            const questions = phaseQuestions(phase);
            if (!questions.length)
                throw new DomainError('INVALID_STATE', 'A fase atual não possui itens de checklist.');
            if (values.some((answer) => (answer.observation?.trim().length ?? 0) > 1000))
                throw new DomainError('VALIDATION', 'A observação do item deve ter até 1.000 caracteres.');

            movement.phaseId = protocol.currentPhaseId;
            movement.checklist = checklistAnswersFor(phase, values);
            bump(protocol);
            return movement;
        });
    },

    async assign(ctx: Context, protocolId: string, expectedVersion: number, assigneeId: string) {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            const actor = requireAdmin(db, ctx);
            if (ctx.activeUnitId !== protocol.currentUnitId)
                throw new DomainError('FORBIDDEN', 'Apenas admin no contexto da unidade atual pode designar responsável.');
            const assignee = getUser(db, assigneeId);
            if (!assignee.active || !canReceiveWorkInUnit(db, assignee.id, protocol.currentUnitId))
                throw new DomainError('VALIDATION', 'Responsável deve estar ativo e vinculado à unidade atual.');

            const assignment = getAssignment(db, protocol);
            const movement = resolveMovement(db, protocol);
            const previousAssigneeId = protocol.currentAssigneeId;
            const previousAssignee = previousAssigneeId ? db.users.find((user) => user.id === previousAssigneeId) : undefined;
            assignment.assigneeId = assigneeId;
            assignment.receivedAt = undefined;
            assignment.receivedById = undefined;
            protocol.currentAssigneeId = assigneeId;
            movement.toUnitId ??= protocol.currentUnitId;
            movement.toUserId = assigneeId;
            bump(protocol);
            audit(db, {
                action: 'PROTOCOL_ASSIGNEE_CHANGED',
                actorUserId: actor.id,
                actorUnitId: ctx.activeUnitId,
                targetType: 'PROTOCOL',
                targetId: protocol.id,
                details: `Responsável alterado de ${previousAssignee?.name ?? 'fila da unidade'} para ${assignee.name}.`,
            });
            return protocol;
        });
    },
    async forward(ctx: Context, protocolId: string, expectedVersion: number, input: {
        unitId: string;
        assigneeId?: string;
        phaseId?: string;
        message: string;
        dueAt?: string;
        activity?: string;
        result?: string;
    }) {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            requireActor(db, ctx);
            if (!canAct(db, protocol, ctx))
                throw new DomainError('FORBIDDEN', 'Somente o responsável ou admin no contexto atual pode tramitar.');
            requireAssignmentReceived(db, protocol);

            const unit = db.units.find((item) => item.id === input.unitId && item.active);
            if (!unit)
                throw new DomainError('VALIDATION', 'Selecione uma unidade destino ativa.');
            if (!input.message.trim() || input.message.length > 4000)
                throw new DomainError('VALIDATION', 'Despacho é obrigatório e tem até 4.000 caracteres.');
            if (input.dueAt && new Date(input.dueAt) <= new Date())
                throw new DomainError('VALIDATION', 'Prazo deve estar no futuro.');

            const activity = input.activity?.trim();
            const result = input.result?.trim();
            if (Boolean(activity) !== Boolean(result))
                throw new DomainError('VALIDATION', 'Informe a atividade e o resultado para registrar a produtividade.');
            if ((activity?.length ?? 0) > 4000 || (result?.length ?? 0) > 4000)
                throw new DomainError('VALIDATION', 'Atividade e resultado devem ter até 4.000 caracteres.');

            const orderedSnapshot = protocol.flowSnapshot?.phases.slice().sort((left, right) => left.position - right.position) ?? [];
            const currentConfiguredPhase = orderedSnapshot.find((phase) => phase.phaseId === protocol.currentPhaseId);
            const configuredPhase = currentConfiguredPhase
                ? orderedSnapshot.find((phase) => phase.position > currentConfiguredPhase.position) ?? currentConfiguredPhase
                : orderedSnapshot[0];
            const selectedPhaseId = configuredPhase?.phaseId ?? input.phaseId;
            const selectedPhase = selectedPhaseId ? phaseForChecklist(db, protocol, selectedPhaseId) : undefined;
            if (!selectedPhaseId || !selectedPhase || (!configuredPhase && !db.phases.some((phase) => phase.id === selectedPhaseId && phase.active)))
                throw new DomainError('VALIDATION', 'Selecione uma fase ativa para a tramitação.');
            if (configuredPhase && input.phaseId && input.phaseId !== configuredPhase.phaseId)
                throw new DomainError('VALIDATION', 'A fase da tramitação é definida pelo fluxo do processo.');
            if (configuredPhase?.destinationUnitId && input.unitId !== configuredPhase.destinationUnitId)
                throw new DomainError('VALIDATION', 'O destino da tramitação é definido pela próxima etapa do fluxo.');
            const eligibleUnitIds = configuredPhase?.eligibleUnitIds
                ?? db.phases.find((phase) => phase.id === selectedPhaseId)?.eligibleUnitIds
                ?? [];
            validatePhaseDestination(eligibleUnitIds, input.unitId);

            const phaseChanges = Boolean(configuredPhase && configuredPhase.phaseId !== protocol.currentPhaseId);
            if (phaseChanges) {
                const currentMovement = resolveMovement(db, protocol);
                const { answers } = validatePhaseExit(db, protocol, currentMovement.checklist ?? []);
                currentMovement.checklist = answers;
            }

            const recipient = input.assigneeId ? getUser(db, input.assigneeId) : undefined;
            if (recipient && (!recipient.active || !canReceiveWorkInUnit(db, recipient.id, input.unitId)))
                throw new DomainError('VALIDATION', 'O destinatário precisa pertencer à unidade destino.');
            if (input.unitId === protocol.currentUnitId && input.assigneeId === protocol.currentAssigneeId && !phaseChanges)
                throw new DomainError('VALIDATION', 'A tramitação deve alterar unidade, responsável ou fase.');

            const oldUnit = protocol.currentUnitId;
            const oldUser = protocol.currentAssigneeId;
            const previousStatus = protocol.status;
            endCurrent(db, protocol);
            const next = addAssignment(db, protocol, input.unitId, input.assigneeId);
            protocol.currentPhaseId = selectedPhaseId;
            protocol.dueAt = input.dueAt;
            protocol.status = 'EM_ANDAMENTO';
            bump(protocol);
            event(db, {
                protocolId,
                kind: 'TRAMITACAO',
                actorUserId: ctx.userId,
                actorUnitId: ctx.activeUnitId,
                fromUnitId: oldUnit,
                toUnitId: input.unitId,
                fromUserId: oldUser,
                toUserId: input.assigneeId,
                assignmentId: next.id,
                phaseId: selectedPhaseId,
                checklist: phaseChanges ? emptyChecklist(selectedPhase) : undefined,
                message: input.message.trim(),
                activity,
                result,
                previousStatus,
                nextStatus: 'EM_ANDAMENTO',
            });
            return protocol;
        });
    },
    async complete(ctx: Context, protocolId: string, expectedVersion: number, message: string) {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            requireActor(db, ctx);
            if (!canAct(db, protocol, ctx))
                throw new DomainError('FORBIDDEN', 'Você não pode concluir este processo.');
            requireAssignmentReceived(db, protocol);
            const phases = orderedPhases(protocol);
            if (phases.length) {
                const phase = currentPhase(protocol);
                if (phase.position !== phases.at(-1)?.position)
                    throw new DomainError('INVALID_STATE', 'Conclua as fases anteriores antes de concluir o processo.');
            }
            if (!message.trim())
                throw new DomainError('VALIDATION', 'Informe o resultado da conclusão.');
            const previousStatus = protocol.status;
            protocol.status = 'CONCLUIDO';
            protocol.completedAt = new Date().toISOString();
            bump(protocol);
            event(db, { protocolId, kind: 'CONCLUSAO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: protocol.currentAssignmentId, phaseId: protocol.currentPhaseId, message: message.trim(), previousStatus, nextStatus: 'CONCLUIDO' });
            return protocol;
        });
    },
    async advancePhase(ctx: Context, protocolId: string, expectedVersion: number, checklist: ChecklistAnswer[] | string[], message = '') {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            requireActor(db, ctx);
            if (!canAct(db, protocol, ctx))
                throw new DomainError('FORBIDDEN', 'Você não pode avançar esta fase.');
            requireAssignmentReceived(db, protocol);
            const currentMovement = resolveMovement(db, protocol);
            const checklistValues = checklist.length ? checklist : currentMovement.checklist ?? [];
            const { phase: current, answers } = validatePhaseExit(db, protocol, checklistValues);
            currentMovement.checklist = answers;
            const next = orderedPhases(protocol).find((phase) => phase.position > current.position);
            if (!next)
                throw new DomainError('INVALID_STATE', 'Esta é a última fase. Conclua o processo.');
            validatePhaseDestination(next.eligibleUnitIds, next.destinationUnitId ?? protocol.currentUnitId);

            const previousStatus = protocol.status;
            const fromUnitId = protocol.currentUnitId;
            let assignmentId = protocol.currentAssignmentId;
            if (next.destinationUnitId && next.destinationUnitId !== protocol.currentUnitId) {
                endCurrent(db, protocol);
                assignmentId = addAssignment(db, protocol, next.destinationUnitId).id;
            }
            protocol.currentPhaseId = next.phaseId;
            protocol.status = 'EM_ANDAMENTO';
            bump(protocol);
            event(db, {
                protocolId,
                kind: 'FASE_AVANCADA',
                actorUserId: ctx.userId,
                actorUnitId: ctx.activeUnitId,
                assignmentId,
                fromUnitId: fromUnitId !== protocol.currentUnitId ? fromUnitId : undefined,
                toUnitId: fromUnitId !== protocol.currentUnitId ? protocol.currentUnitId : undefined,
                phaseId: next.phaseId,
                checklist: emptyChecklist(next),
                message: message.trim() || `${current.name} → ${next.name}`,
                previousStatus,
                nextStatus: protocol.status,
            });
            return protocol;
        });
    },
    async returnPhase(ctx: Context, protocolId: string, expectedVersion: number, message: string) {
        return mutate((db) => {
            const protocol = getProtocol(db, protocolId);
            requireVersion(protocol, expectedVersion);
            requireActive(protocol);
            requireActor(db, ctx);
            if (!canAct(db, protocol, ctx))
                throw new DomainError('FORBIDDEN', 'Você não pode devolver esta fase.');
            requireAssignmentReceived(db, protocol);
            if (!message.trim())
                throw new DomainError('VALIDATION', 'Informe o motivo da devolução.');
            const current = currentPhase(protocol);
            const previous = orderedPhases(protocol).filter((phase) => phase.position < current.position).at(-1);
            if (!previous)
                throw new DomainError('INVALID_STATE', 'Esta é a primeira fase do fluxo.');

            const previousStatus = protocol.status;
            const fromUnitId = protocol.currentUnitId;
            let assignmentId = protocol.currentAssignmentId;
            if (previous.destinationUnitId && previous.destinationUnitId !== protocol.currentUnitId) {
                endCurrent(db, protocol);
                assignmentId = addAssignment(db, protocol, previous.destinationUnitId).id;
            }
            protocol.currentPhaseId = previous.phaseId;
            protocol.status = 'EM_ANDAMENTO';
            bump(protocol);
            event(db, {
                protocolId,
                kind: 'FASE_DEVOLVIDA',
                actorUserId: ctx.userId,
                actorUnitId: ctx.activeUnitId,
                assignmentId,
                fromUnitId: fromUnitId !== protocol.currentUnitId ? fromUnitId : undefined,
                toUnitId: fromUnitId !== protocol.currentUnitId ? protocol.currentUnitId : undefined,
                phaseId: previous.phaseId,
                checklist: emptyChecklist(previous),
                message: `${current.name} → ${previous.name}: ${message.trim()}`,
                previousStatus,
                nextStatus: protocol.status,
            });
            return protocol;
        });
    },
    async archive(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActor(db, ctx); if (p.status !== 'CONCLUIDO' || !canAct(db, p, ctx))
        throw new DomainError('FORBIDDEN', 'Apenas processo concluído pode ser arquivado pelo responsável ou admin.'); p.status = 'ARQUIVADO'; p.archivedAt = new Date().toISOString(); bump(p); event(db, { protocolId, kind: 'ARQUIVAMENTO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: p.currentAssignmentId, previousStatus: 'CONCLUIDO', nextStatus: 'ARQUIVADO' }); return p; }); },
    async reopen(ctx: Context, protocolId: string, expectedVersion: number, input: {
        unitId: string;
        assigneeId?: string;
        message: string;
        dueAt?: string;
    }) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); const user = requireAdmin(db, ctx); if (ctx.activeUnitId !== p.currentUnitId || (p.status !== 'CONCLUIDO' && p.status !== 'ARQUIVADO'))
        throw new DomainError('FORBIDDEN', 'Apenas admin no contexto da unidade atual pode reabrir processo concluído ou arquivado.'); if (!input.message.trim())
        throw new DomainError('VALIDATION', 'Informe o motivo da reabertura.'); const dest = db.units.find((u) => u.id === input.unitId && u.active); if (!dest)
        throw new DomainError('VALIDATION', 'Selecione uma unidade destino ativa.'); const recipient = input.assigneeId ? getUser(db, input.assigneeId) : undefined; if (recipient && (!recipient.active || !canReceiveWorkInUnit(db, recipient.id, input.unitId)))
        throw new DomainError('VALIDATION', 'Responsável incompatível com a unidade destino.'); endCurrent(db, p); const next = addAssignment(db, p, input.unitId, input.assigneeId); const previous = p.status; p.status = 'EM_ANDAMENTO'; p.completedAt = undefined; p.archivedAt = undefined; p.dueAt = input.dueAt; bump(p); event(db, { protocolId, kind: 'REABERTURA', actorUserId: user.id, actorUnitId: ctx.activeUnitId, toUnitId: input.unitId, toUserId: input.assigneeId, assignmentId: next.id, message: input.message.trim(), previousStatus: previous, nextStatus: 'EM_ANDAMENTO' }); return p; }); },
    async addAttachments(ctx: Context, protocolId: string, expectedVersion: number, files: File[], movementEventId?: string) {
        if (!files.length || files.length > 5)
            throw new DomainError('VALIDATION', 'Selecione de 1 a 5 arquivos por operação.');
        for (const file of files)
            if (!['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type) || file.size > 5 * 1024 * 1024)
                throw new DomainError('VALIDATION', 'Envie PDF, PNG, JPEG ou TXT de até 5 MB.');
        const preflightDb = loadDb();
        const preflightProtocol = getProtocol(preflightDb, protocolId);
        requireVersion(preflightProtocol, expectedVersion);
        requireActive(preflightProtocol);
        if (!preflightProtocol.typeConfigSnapshot.arquivos?.enabled)
            throw new DomainError('VALIDATION', 'Este tipo de processo não permite anexos ou documentos.');
        if (!canAct(preflightDb, preflightProtocol, ctx))
            throw new DomainError('FORBIDDEN', 'Você não pode anexar neste processo.');        const staged = files.map((file) => ({ file, blobKey: id() }));
        try {
            await cleanupOrphanedBlobs(loadDb().attachments.map((attachment) => attachment.blobKey)).catch(() => undefined);
            await Promise.all(staged.map(({ blobKey, file }) => putBlob(blobKey, file)));
            const attachments = await mutate((db) => {
                const p = getProtocol(db, protocolId);
                requireVersion(p, expectedVersion);
                requireActive(p);
                if (!p.typeConfigSnapshot.arquivos?.enabled)
                    throw new DomainError('VALIDATION', 'Este tipo de processo não permite anexos ou documentos.');
                if (!canAct(db, p, ctx))
                    throw new DomainError('FORBIDDEN', 'Você não pode anexar neste processo.');
                const createdAt = new Date().toISOString();
                const movement = resolveMovement(db, p, movementEventId);
                const created = staged.map(({ file, blobKey }) => {
                    const attachment: Attachment = { id: id(), protocolId, movementEventId: movement.id, filename: file.name, mimeType: file.type, sizeBytes: file.size, blobKey, uploadedById: ctx.userId, createdAt };
                    db.attachments.push(attachment);
                    audit(db, { action: 'ATTACHMENT_ADDED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'ATTACHMENT', targetId: attachment.id, details: `Arquivo “${attachment.filename}” anexado à movimentação do processo ${p.number}.` });
                    return attachment;
                });
                bump(p);
                return created;
            });
            await cleanupOrphanedBlobs(loadDb().attachments.map((attachment) => attachment.blobKey)).catch(() => undefined);
            return attachments;
        }
        catch (error) {
            await Promise.allSettled(staged.map(({ blobKey }) => deleteBlob(blobKey)));
            throw error;
        }
    }, async addAttachment(ctx: Context, protocolId: string, expectedVersion: number, file: File, movementEventId?: string) { const [attachment] = await this.addAttachments(ctx, protocolId, expectedVersion, [file], movementEventId); return attachment; },
    async addProtocolTypeAttachments(ctx: Context, typeId: string, files: File[]) {
        if (!files.length || files.length > 5) throw new DomainError('VALIDATION', 'Selecione de 1 a 5 arquivos por operação.');
        for (const file of files) if (!['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new DomainError('VALIDATION', 'Envie PDF, PNG, JPEG ou TXT de até 5 MB.');
        const staged = files.map((file) => ({ file, blobKey: id() }));
        try {
            await cleanupOrphanedBlobs(loadDb().attachments.map((attachment) => attachment.blobKey)).catch(() => undefined);
            await Promise.all(staged.map(({ blobKey, file }) => putBlob(blobKey, file)));
            const attachments = await mutate((db) => {
                requireAdmin(db, ctx); protocolType(db, typeId);
                const createdAt = new Date().toISOString();
                const created = staged.map(({ file, blobKey }) => ({ id: id(), typeId, filename: file.name, mimeType: file.type, sizeBytes: file.size, blobKey, uploadedById: ctx.userId, createdAt } satisfies Attachment));
                db.attachments.push(...created);
                return created;
            });
            await cleanupOrphanedBlobs(loadDb().attachments.map((attachment) => attachment.blobKey)).catch(() => undefined);
            return attachments;
        } catch (error) { await Promise.allSettled(staged.map(({ blobKey }) => deleteBlob(blobKey))); throw error; }
    },
    async removeProtocolTypeAttachment(ctx: Context, attachmentId: string) {
        const blobKey = await mutate((db) => { requireAdmin(db, ctx); const index = db.attachments.findIndex((attachment) => attachment.id === attachmentId && attachment.typeId); if (index < 0) throw new DomainError('NOT_FOUND', 'Arquivo do tipo não encontrado.'); return db.attachments.splice(index, 1)[0].blobKey; });
        await deleteBlob(blobKey); await cleanupOrphanedBlobs(loadDb().attachments.map((attachment) => attachment.blobKey)).catch(() => undefined);
        return true;
    },    async listDocuments(ctx: Context, search = '', typeId = '') { await sleep(); const db = loadDb(); requireActor(db, ctx); const q = search.toLocaleLowerCase(); const scopeUnitIds = unitIdsForScope(db, ctx); const items = db.documents.filter((d) => { const p = d.protocolId ? db.protocols.find((x) => x.id === d.protocolId) : undefined; return (!p || canView(db, p, ctx) || d.authorUserId === ctx.userId || scopeUnitIds.includes(d.unitId)) && (!q || d.number.toLowerCase().includes(q) || d.subject.toLowerCase().includes(q)) && (!typeId || d.typeId === typeId); }); return { items, db }; },
    async createDocument(ctx: Context, input: Omit<AppDocument, 'id' | 'number' | 'unitId' | 'authorUserId' | 'createdAt'>) { return mutate((db) => { const author = requireActor(db, ctx); if (!author.active)
        throw new DomainError('FORBIDDEN', 'Usuário inativo não pode criar documentos.'); const type = db.documentTypes.find((t) => t.id === input.typeId && t.active); if (!type || !input.subject.trim() || !input.body.trim())
        throw new DomainError('VALIDATION', 'Preencha tipo, assunto e corpo do documento.'); if (input.recipientPersonId && !db.people.some((person) => person.id === input.recipientPersonId && person.active))
        throw new DomainError('VALIDATION', 'Selecione um destinatário ativo.'); let linkedProtocol: Protocol | undefined; let movementEventId = input.movementEventId; if (input.protocolId) {
        linkedProtocol = getProtocol(db, input.protocolId);
        if (!linkedProtocol.typeConfigSnapshot.arquivos?.enabled)
            throw new DomainError('VALIDATION', 'Este tipo de processo não permite anexos ou documentos.');
        if (!isActive(linkedProtocol) || !canAct(db, linkedProtocol, ctx))
            throw new DomainError('FORBIDDEN', 'Documento vinculado exige atuação em processo ativo.');
        movementEventId = resolveMovement(db, linkedProtocol, movementEventId).id;
    } else if (movementEventId) throw new DomainError('VALIDATION', 'Uma movimentação só pode ser informada para documento vinculado a processo.');
    const doc: AppDocument = { ...input, movementEventId, id: id(), number: nextNumber(db, 'document'), subject: input.subject.trim(), body: input.body.trim(), unitId: ctx.activeUnitId, authorUserId: author.id, createdAt: new Date().toISOString() }; db.documents.push(doc); if (linkedProtocol)
        audit(db, { action: 'DOCUMENT_CREATED', actorUserId: author.id, actorUnitId: ctx.activeUnitId, targetType: 'DOCUMENT', targetId: doc.id, details: `Documento ${doc.number} — “${doc.subject}” anexado à movimentação do processo ${linkedProtocol.number}.` }); return doc; }); },
    async listData() { await sleep(); return loadDb(); },
    async listPeople(ctx: Context, search = '') { await sleep(); const db = loadDb(); requireActor(db, ctx); const query = search.trim().toLocaleLowerCase(); return { items: db.people.filter((person) => !query || person.name.toLocaleLowerCase().includes(query) || person.document?.includes(query)), db }; },
    async createUnit(ctx: Context, input: Omit<Unit, 'id'>) { return mutate((db) => { requireAdmin(db, ctx); const name = input.name.trim(); const abbreviation = input.abbreviation.trim().toUpperCase(); if (!name || !abbreviation)
        throw new DomainError('VALIDATION', 'Informe nome e sigla da unidade.'); if (db.units.some((unit) => unit.name.toLocaleLowerCase() === name.toLocaleLowerCase() || unit.abbreviation.toLocaleLowerCase() === abbreviation.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Nome ou sigla já está em uso.'); if (input.parentId && !db.units.some((unit) => unit.id === input.parentId && unit.active))
        throw new DomainError('VALIDATION', 'Selecione uma unidade superior ativa.'); const unit: Unit = { id: id(), name, abbreviation, parentId: input.parentId, position: input.position ?? db.units.filter((item) => item.parentId === input.parentId).length, active: input.active }; db.units.push(unit); return unit; }); },
    async updateUnit(ctx: Context, unitId: string, input: Omit<Unit, 'id'>) { return mutate((db) => { requireAdmin(db, ctx); const unit = db.units.find((item) => item.id === unitId); if (!unit)
        throw new DomainError('NOT_FOUND', 'Unidade não encontrada.'); const name = input.name.trim(); const abbreviation = input.abbreviation.trim().toUpperCase(); if (!name || !abbreviation)
        throw new DomainError('VALIDATION', 'Informe nome e sigla da unidade.'); if (db.units.some((item) => item.id !== unitId && (item.name.toLocaleLowerCase() === name.toLocaleLowerCase() || item.abbreviation.toLocaleLowerCase() === abbreviation.toLocaleLowerCase())))
        throw new DomainError('VALIDATION', 'Nome ou sigla já está em uso.'); if (input.parentId) {
        const parent = db.units.find((item) => item.id === input.parentId && item.active);
        if (!parent)
            throw new DomainError('VALIDATION', 'Selecione uma unidade superior ativa.');
        let ancestor: Unit | undefined = parent;
        while (ancestor) {
            if (ancestor.id === unitId)
                throw new DomainError('VALIDATION', 'Uma unidade não pode ser subordinada a si mesma ou a uma descendente.');
            ancestor = ancestor.parentId ? db.units.find((item) => item.id === ancestor?.parentId) : undefined;
        }
    } if (!input.active) {
        if (db.units.some((item) => item.parentId === unitId && item.active))
            throw new DomainError('VALIDATION', 'Não é possível inativar unidade com filhos ativos.');
        if (db.memberships.some((membership) => membership.unitId === unitId && membership.active))
            throw new DomainError('VALIDATION', 'Não é possível inativar unidade com usuários ativos vinculados.');
        if (db.protocols.some((item) => item.currentUnitId === unitId && isActive(item)))
            throw new DomainError('VALIDATION', 'Não é possível inativar unidade com processos ativos.');
    } Object.assign(unit, { name, abbreviation, parentId: input.parentId, active: input.active }); return unit; }); },
    async deleteUnit(ctx: Context, unitId: string) { return mutate((db) => {
        requireAdmin(db, ctx);
        const index = db.units.findIndex((item) => item.id === unitId);
        if (index < 0)
            throw new DomainError('NOT_FOUND', 'Unidade não encontrada.');
        const unit = db.units[index];
        if (db.units.some((item) => item.parentId === unitId))
            throw new DomainError('VALIDATION', 'Não é possível excluir uma unidade que possui unidades subordinadas.');
        const isReferenced = db.users.some((user) => user.unitId === unitId)
            || db.memberships.some((membership) => membership.unitId === unitId)
            || db.protocols.some((protocol) => protocol.originUnitId === unitId || protocol.currentUnitId === unitId || protocol.flowSnapshot?.phases.some((phase) => phase.destinationUnitId === unitId))
            || db.assignments.some((assignment) => assignment.unitId === unitId)
            || db.events.some((event) => event.actorUnitId === unitId || event.fromUnitId === unitId || event.toUnitId === unitId)
            || db.documents.some((document) => document.unitId === unitId)
            || db.phases.some((phase) => phase.eligibleUnitIds.includes(unitId))
            || db.flowPhases.some((stage) => stage.destinationUnitId === unitId)
            || db.protocolTypes.some((type) => type.authorizedUnitIds?.includes(unitId));
        if (isReferenced)
            throw new DomainError('VALIDATION', 'Não é possível excluir uma unidade que possui vínculos ou histórico no sistema.');
        db.units.splice(index, 1);
        audit(db, { action: 'UNIT_DELETED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'UNIT', targetId: unit.id, details: `Unidade “${unit.name}” excluída.` });
        return true;
    }); },
    async createPerson(ctx: Context, input: PersonInput) {
        return mutate((db) => {
            requireActor(db, ctx);
            const normalized = normalizePersonInput(input);
            validatePerson(normalized);
            const person: Person = { ...normalized, document: normalized.document?.replace(/\D/g, ''), id: id(), name: normalized.name.trim() };
            db.people.push(person);
            audit(db, { action: 'PERSON_CREATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'PERSON', targetId: person.id, details: 'Pessoa “' + person.name + '” criada.' });
            return person;
        });
    },
    async createSituationType(ctx: Context, input: SituationTypeInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            validateSituationType(db, input);
            const situation: SituationType = { ...input, id: id(), name: input.name.trim(), observation: input.observation?.trim(), system: false };
            db.situations.push(situation);
            audit(db, { action: 'SITUATION_CREATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'SITUATION', targetId: situation.id, details: `Situação “${situation.name}” criada.` });
            return situation;
        });
    },
    async updateSituationType(ctx: Context, situationId: string, input: SituationTypeInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const situation = db.situations.find((item) => item.id === situationId);
            if (!situation)
                throw new DomainError('NOT_FOUND', 'Situação não encontrada.');
            validateSituationType(db, input, situationId);
            if (!input.active && db.flowPhases.some((stage) => stage.situationTypeId === situationId))
                throw new DomainError('VALIDATION', 'Não é possível inativar uma situação usada em uma etapa de fluxo.');
            Object.assign(situation, { ...input, name: input.name.trim(), observation: input.observation?.trim() });
            audit(db, { action: 'SITUATION_UPDATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'SITUATION', targetId: situation.id, details: `Situação “${situation.name}” atualizada.` });
            return situation;
        });
    },
    async deleteSituationType(ctx: Context, situationId: string) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const index = db.situations.findIndex((item) => item.id === situationId);
            if (index < 0)
                throw new DomainError('NOT_FOUND', 'Situação não encontrada.');
            const situation = db.situations[index];
            if (situation.system)
                throw new DomainError('VALIDATION', 'Situações de sistema não podem ser excluídas.');
            if (db.flowPhases.some((stage) => stage.situationTypeId === situationId))
                throw new DomainError('VALIDATION', 'Esta situação está sendo usada em uma etapa de fluxo.');
            db.situations.splice(index, 1);
            audit(db, { action: 'SITUATION_DELETED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'SITUATION', targetId: situation.id, details: `Situação “${situation.name}” excluída.` });
            return true;
        });
    },
    async createPhase(ctx: Context, input: ProtocolPhaseInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            validatePhase(db, input);
            const checklistQuestions = cleanQuestions(input.checklistQuestions, input.checklistItems);
            const phase: ProtocolPhase = { ...input, id: id(), name: input.name.trim(), code: input.code.trim().toUpperCase(), description: input.description?.trim(), checklistQuestions, checklistItems: checklistQuestions.map((question) => question.text), requiredAttachmentTypes: input.requiredAttachmentTypes.map((item) => item.trim()).filter(Boolean) };
            db.phases.push(phase);
            audit(db, { action: 'PHASE_CREATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'PHASE', targetId: phase.id, details: 'Fase “' + phase.name + '” criada.' });
            return phase;
        });
    },
    async updatePhase(ctx: Context, phaseId: string, input: ProtocolPhaseInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const phase = db.phases.find((item) => item.id === phaseId);
            if (!phase)
                throw new DomainError('NOT_FOUND', 'Fase não encontrada.');
            validatePhase(db, input, phaseId);
            if (!input.active && db.flowPhases.some((item) => item.phaseId === phaseId && db.flows.some((flow) => flow.id === item.flowId && flow.active)))
                throw new DomainError('VALIDATION', 'Não é possível inativar fase usada por fluxo ativo.');
            const checklistQuestions = cleanQuestions(input.checklistQuestions, input.checklistItems);
            Object.assign(phase, { ...input, name: input.name.trim(), code: input.code.trim().toUpperCase(), description: input.description?.trim(), checklistQuestions, checklistItems: checklistQuestions.map((question) => question.text), requiredAttachmentTypes: input.requiredAttachmentTypes.map((item) => item.trim()).filter(Boolean) });
            audit(db, { action: 'PHASE_UPDATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'PHASE', targetId: phase.id, details: 'Fase “' + phase.name + '” atualizada.' });
            return phase;
        });
    },
    async deletePhase(ctx: Context, phaseId: string) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const index = db.phases.findIndex((item) => item.id === phaseId);
            if (index < 0)
                throw new DomainError('NOT_FOUND', 'Fase não encontrada.');
            const phase = db.phases[index];
            if (db.flowPhases.some((stage) => stage.phaseId === phaseId))
                throw new DomainError('VALIDATION', 'Esta fase está sendo usada em um fluxo.');
            db.phases.splice(index, 1);
            audit(db, { action: 'PHASE_DELETED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'PHASE', targetId: phase.id, details: 'Fase “' + phase.name + '” excluída.' });
            return true;
        });
    },
    async createFlow(ctx: Context, input: ProtocolFlowInput) { return mutate((db) => { requireAdmin(db, ctx); validateFlow(db, input); const flow: ProtocolFlow = { id: id(), name: input.name.trim(), version: input.version, active: input.active, startsAt: input.startsAt, endsAt: input.endsAt }; db.flows.push(flow); stagesFor(input).forEach((stage) => db.flowPhases.push({ id: id(), flowId: flow.id, ...stage })); return flow; }); },
    async updateFlow(ctx: Context, flowId: string, input: ProtocolFlowInput) { return mutate((db) => { requireAdmin(db, ctx); const flow = db.flows.find((item) => item.id === flowId); if (!flow) throw new DomainError('NOT_FOUND', 'Fluxo não encontrado.'); validateFlow(db, input, flowId); if (!input.active && db.protocolTypes.some((type) => type.flowId === flowId && type.active)) throw new DomainError('VALIDATION', 'Não é possível inativar fluxo vinculado a tipo ativo.'); Object.assign(flow, { name: input.name.trim(), version: input.version, active: input.active, startsAt: input.startsAt, endsAt: input.endsAt }); db.flowPhases = db.flowPhases.filter((item) => item.flowId !== flowId); stagesFor(input).forEach((stage) => db.flowPhases.push({ id: id(), flowId, ...stage })); return flow; }); },    async saveProtocolTypeFlow(ctx: Context, typeId: string, stages: StageInput[]) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const type = db.protocolTypes.find((item) => item.id === typeId);
            if (!type)
                throw new DomainError('NOT_FOUND', 'Tipo de processo não encontrado.');
            const linkedFlow = type.flowId ? db.flows.find((item) => item.id === type.flowId) : undefined;
            const linkedFlowIsShared = Boolean(linkedFlow && db.protocolTypes.some((item) => item.id !== type.id && item.flowId === linkedFlow.id));
            const flowName = `Fluxo — ${type.name}`;
            const orphanFlow = db.flows.find((item) => item.name.toLocaleLowerCase() === flowName.toLocaleLowerCase() && item.version === 1 && !db.protocolTypes.some((protocolType) => protocolType.flowId === item.id));
            const targetFlow = linkedFlow && !linkedFlowIsShared ? linkedFlow : orphanFlow;
            const reusingLinkedFlow = Boolean(linkedFlow && targetFlow?.id === linkedFlow.id);
            const input: ProtocolFlowInput = {
                name: targetFlow?.name ?? flowName,
                version: targetFlow?.version ?? 1,
                active: reusingLinkedFlow ? targetFlow!.active : true,
                startsAt: targetFlow?.startsAt ?? new Date().toISOString(),
                endsAt: reusingLinkedFlow ? targetFlow?.endsAt : undefined,
                stages,
            };
            validateFlow(db, input, targetFlow?.id);
            const flow: ProtocolFlow = targetFlow ?? { id: id(), name: input.name.trim(), version: input.version, active: input.active, startsAt: input.startsAt, endsAt: input.endsAt };
            if (!targetFlow)
                db.flows.push(flow);
            else
                Object.assign(flow, { name: input.name.trim(), version: input.version, active: input.active, startsAt: input.startsAt, endsAt: input.endsAt });
            db.flowPhases = db.flowPhases.filter((item) => item.flowId !== flow.id);
            stagesFor(input).forEach((stage) => db.flowPhases.push({ id: id(), flowId: flow.id, ...stage }));
            const typeInput = { ...type, flowId: flow.id, flowMode: type.flowMode === 'NONE' ? 'SUGGESTED' as const : type.flowMode ?? 'SUGGESTED' as const, fieldsConfig: { ...type.fieldsConfig, tramitacao: { enabled: true } } };
            validateProtocolType(db, typeInput);
            Object.assign(type, typeInput);
            return { flow, type };
        });
    },
    async clearProtocolTypeFlow(ctx: Context, typeId: string) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const type = db.protocolTypes.find((item) => item.id === typeId);
            if (!type)
                throw new DomainError('NOT_FOUND', 'Tipo de processo não encontrado.');
            const detachedFlowId = type.flowId;
            Object.assign(type, { flowId: undefined, flowMode: 'NONE' as const, fieldsConfig: { ...type.fieldsConfig, tramitacao: { enabled: false } } });
            if (detachedFlowId && !db.protocolTypes.some((item) => item.flowId === detachedFlowId)) {
                db.flows = db.flows.filter((item) => item.id !== detachedFlowId);
                db.flowPhases = db.flowPhases.filter((item) => item.flowId !== detachedFlowId);
            }
            return type;
        });
    },
    async createProcessCategory(ctx: Context, input: ProcessCategoryInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            validateProcessCategory(db, input);
            const category: ProcessCategory = { ...input, id: id(), code: input.code.trim().toUpperCase(), name: input.name.trim(), observation: input.observation?.trim() };
            db.processCategories.push(category);
            audit(db, { action: 'CATEGORY_CREATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'CATEGORY', targetId: category.id, details: `Categoria “${category.name}” criada.` });
            return category;
        });
    },
    async updateProcessCategory(ctx: Context, categoryId: string, input: ProcessCategoryInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const category = db.processCategories.find((item) => item.id === categoryId);
            if (!category) throw new DomainError('NOT_FOUND', 'Categoria de processo não encontrada.');
            validateProcessCategory(db, input, categoryId);
            if (!input.active && db.protocolTypes.some((type) => type.categoryId === categoryId && type.active))
                throw new DomainError('VALIDATION', 'Não é possível inativar uma categoria vinculada a um tipo ativo.');
            Object.assign(category, { ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), observation: input.observation?.trim() });
            audit(db, { action: 'CATEGORY_UPDATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'CATEGORY', targetId: category.id, details: `Categoria “${category.name}” atualizada.` });
            return category;
        });
    },
    async deleteProcessCategory(ctx: Context, categoryId: string) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const index = db.processCategories.findIndex((item) => item.id === categoryId);
            if (index < 0) throw new DomainError('NOT_FOUND', 'Categoria de processo não encontrada.');
            const category = db.processCategories[index];
            if (db.protocolTypes.some((type) => type.categoryId === categoryId))
                throw new DomainError('VALIDATION', 'Esta categoria está vinculada a um tipo de processo.');
            db.processCategories.splice(index, 1);
            audit(db, { action: 'CATEGORY_DELETED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'CATEGORY', targetId: category.id, details: `Categoria “${category.name}” excluída.` });
            return true;
        });
    },
    async createProtocolTypeWithFlow(ctx: Context, input: Omit<ProtocolTypeInput, 'flowId'>, stages: StageInput[]) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const normalizedStages = stages.map((stage) => ({ ...stage, checklistQuestions: stage.requiresChecklist ? cleanQuestions(stage.checklistQuestions, []) : [] }));
            const flowMode = input.flowMode ?? 'NONE';
            if (flowMode === 'NONE' && normalizedStages.length)
                throw new DomainError('VALIDATION', 'Um tipo sem fluxo não pode possuir etapas.');
            if (flowMode !== 'NONE' && !normalizedStages.length)
                throw new DomainError('VALIDATION', 'Defina ao menos uma etapa para o fluxo sugerido ou obrigatório.');
            const normalized = {
                ...input,
                flowMode,
                flowId: undefined as string | undefined,
                authorizedUserIds: [...new Set(input.authorizedUserIds ?? [])],
                authorizedUnitIds: [...new Set(input.authorizedUnitIds ?? [])],
                fieldsConfig: { ...input.fieldsConfig, tramitacao: { enabled: normalizedStages.length > 0 } },
            };
            if (db.protocolTypes.some((type) => type.name.toLocaleLowerCase() === normalized.name.trim().toLocaleLowerCase()))
                throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.');

            let flow: ProtocolFlow | undefined;
            if (normalizedStages.length) {
                const flowInput: ProtocolFlowInput = {
                    name: `Fluxo — ${normalized.name.trim()}`,
                    version: 1,
                    active: true,
                    startsAt: new Date().toISOString(),
                    stages: normalizedStages,
                };
                validateFlow(db, flowInput);
                flow = { id: id(), name: flowInput.name, version: flowInput.version, active: flowInput.active, startsAt: flowInput.startsAt };
                db.flows.push(flow);
                stagesFor(flowInput).forEach((stage) => db.flowPhases.push({ id: id(), flowId: flow!.id, ...stage }));
                normalized.flowId = flow.id;
            }

            validateProtocolType(db, normalized);
            const type: ProtocolType = { ...normalized, id: id(), name: normalized.name.trim(), description: normalized.description.trim() };
            db.protocolTypes.push(type);
            return { type, flow };
        });
    },
    async createProtocolType(ctx: Context, input: ProtocolTypeInput) { return mutate((db) => { requireAdmin(db, ctx); const normalized = { ...input, authorizedUserIds: [...new Set(input.authorizedUserIds ?? [])], authorizedUnitIds: [...new Set(input.authorizedUnitIds ?? [])] }; validateProtocolType(db, normalized); if (db.protocolTypes.some((type) => type.name.toLocaleLowerCase() === normalized.name.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); const type: ProtocolType = { ...normalized, id: id(), name: normalized.name.trim(), description: normalized.description.trim() }; db.protocolTypes.push(type); return type; }); },
    async updateProtocolType(ctx: Context, typeId: string, input: ProtocolTypeInput) { return mutate((db) => { requireAdmin(db, ctx); const normalized = { ...input, authorizedUserIds: [...new Set(input.authorizedUserIds ?? [])], authorizedUnitIds: [...new Set(input.authorizedUnitIds ?? [])] }; validateProtocolType(db, normalized); const type = db.protocolTypes.find((item) => item.id === typeId); if (!type)
        throw new DomainError('NOT_FOUND', 'Tipo de processo não encontrado.'); if (db.protocolTypes.some((item) => item.id !== typeId && item.name.toLocaleLowerCase() === normalized.name.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); Object.assign(type, { ...normalized, name: normalized.name.trim(), description: normalized.description.trim() }); return type; }); },
    async deleteAllProtocolTypes(ctx: Context) { return mutate((db) => { requireAdmin(db, ctx); if (db.protocols.length) throw new DomainError('VALIDATION', 'Não é possível excluir os tipos enquanto existirem processos vinculados.'); db.protocolTypes.splice(0, db.protocolTypes.length); return true; }); },    async createDocumentType(ctx: Context, input: Omit<DocumentType, 'id'>) { return mutate((db) => { requireAdmin(db, ctx); const name = input.name.trim(); const description = input.description.trim(); if (!name || !description)
        throw new DomainError('VALIDATION', 'Informe nome e descrição do tipo.'); if (db.documentTypes.some((type) => type.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); const type: DocumentType = { ...input, id: id(), name, description }; db.documentTypes.push(type); return type; }); },
    async updateDocumentType(ctx: Context, typeId: string, input: Omit<DocumentType, 'id'>) { return mutate((db) => { requireAdmin(db, ctx); const type = db.documentTypes.find((item) => item.id === typeId); if (!type)
        throw new DomainError('NOT_FOUND', 'Tipo de documento não encontrado.'); const name = input.name.trim(); const description = input.description.trim(); if (!name || !description)
        throw new DomainError('VALIDATION', 'Informe nome e descrição do tipo.'); if (db.documentTypes.some((item) => item.id !== typeId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); Object.assign(type, { ...input, name, description }); return type; }); },
    async createUser(ctx: Context, input: UserInput) { return mutate((db) => {
        requireAdmin(db, ctx);
        validateUser(db, input);
        const user: AppUser = { ...input, id: id(), name: input.name.trim(), email: input.email.trim().toLocaleLowerCase() };
        db.users.push(user);
        db.memberships.push({ id: id(), userId: user.id, unitId: user.unitId, role: user.role, title: user.role === 'ADMIN' ? 'Administrador geral' : 'Operador', startsAt: new Date().toISOString(), active: user.active });
        audit(db, { action: 'USER_CREATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'USER', targetId: user.id, details: 'Usuário criado com acesso inicial à unidade principal.' });
        return user;
    }); },
    async updateUser(ctx: Context, userId: string, input: UserInput) { return mutate((db) => {
        requireAdmin(db, ctx);
        const user = db.users.find((item) => item.id === userId);
        if (!user) throw new DomainError('NOT_FOUND', 'Usuário não encontrado.');
        validateUser(db, input, userId);
        if (!input.active && user.active) {
            if (user.id === ctx.userId) throw new DomainError('VALIDATION', 'Não é possível inativar o usuário atual.');
            if (user.role === 'ADMIN' && db.users.filter((item) => item.active && item.role === 'ADMIN').length === 1) throw new DomainError('VALIDATION', 'Não é possível inativar o último administrador ativo.');
            if (db.protocols.some((protocol) => isActive(protocol) && protocol.currentAssigneeId === user.id)) throw new DomainError('VALIDATION', 'Redistribua os processos ativos antes de inativar este usuário.');
        }
        Object.assign(user, { ...input, name: input.name.trim(), email: input.email.trim().toLocaleLowerCase() });
        let primary = db.memberships.find((membership) => membership.userId === user.id && membership.unitId === input.unitId && membership.active);
        if (!primary) {
            primary = { id: id(), userId: user.id, unitId: input.unitId, role: input.role, title: input.role === 'ADMIN' ? 'Administrador geral' : 'Operador', startsAt: new Date().toISOString(), active: true };
            db.memberships.push(primary);
        } else {
            primary.role = input.role;
            primary.title = input.role === 'ADMIN' ? 'Administrador geral' : primary.title || 'Operador';
        }
        audit(db, { action: 'USER_UPDATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'USER', targetId: user.id, details: 'Dados cadastrais e unidade principal do usuário atualizados.' });
        return user;
    }); },
    async saveUserMembership(ctx: Context, userId: string, membershipId: string | undefined, input: MembershipInput) { return mutate((db) => {
        requireAdmin(db, ctx);
        const user = db.users.find((item) => item.id === userId);
        if (!user) throw new DomainError('NOT_FOUND', 'Usuário não encontrado.');
        const unit = db.units.find((item) => item.id === input.unitId && item.active);
        if (!unit) throw new DomainError('VALIDATION', 'Selecione uma unidade ativa.');
        const duplicate = db.memberships.find((item) => item.userId === userId && item.unitId === input.unitId && item.active && item.id !== membershipId);
        if (duplicate) throw new DomainError('VALIDATION', 'O usuário já possui acesso ativo a esta unidade.');
        const title = input.title?.trim() || (input.role === 'ADMIN' ? 'Administrador' : input.role === 'GESTOR' ? 'Gestor' : input.role === 'LEITOR' ? 'Leitor' : 'Operador');
        let membership: UserUnitMembership | undefined;
        if (membershipId) {
            membership = db.memberships.find((item) => item.id === membershipId && item.userId === userId && item.active);
            if (!membership) throw new DomainError('NOT_FOUND', 'Vínculo de unidade não encontrado.');
            const previousUnitId = membership.unitId;
            Object.assign(membership, { unitId: input.unitId, role: input.role, title });
            if (user.unitId === previousUnitId) {
                user.unitId = input.unitId;
                user.role = input.role;
            }
        } else {
            membership = db.memberships.find((item) => item.userId === userId && item.unitId === input.unitId && !item.active);
            if (membership) {
                Object.assign(membership, { role: input.role, title, startsAt: new Date().toISOString(), endsAt: undefined, active: true });
            } else {
                membership = { id: id(), userId, unitId: input.unitId, role: input.role, title, startsAt: new Date().toISOString(), active: true };
                db.memberships.push(membership);
            }
        }
        audit(db, { action: membershipId ? 'USER_MEMBERSHIP_UPDATED' : 'USER_MEMBERSHIP_CREATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'USER', targetId: user.id, details: 'Acesso à unidade ' + unit.name + ' salvo com o perfil ' + title + '.' });
        return membership;
    }); },
    async removeUserMembership(ctx: Context, userId: string, membershipId: string) { return mutate((db) => {
        requireAdmin(db, ctx);
        const user = db.users.find((item) => item.id === userId);
        if (!user) throw new DomainError('NOT_FOUND', 'Usuário não encontrado.');
        const membership = db.memberships.find((item) => item.id === membershipId && item.userId === userId && item.active);
        if (!membership) throw new DomainError('NOT_FOUND', 'Vínculo de unidade não encontrado.');
        const activeMemberships = db.memberships.filter((item) => item.userId === userId && item.active);
        if (user.active && activeMemberships.length <= 1) throw new DomainError('VALIDATION', 'O usuário ativo precisa manter acesso a pelo menos uma unidade.');
        if (user.id === ctx.userId && membership.unitId === ctx.activeUnitId) throw new DomainError('VALIDATION', 'Não é possível remover o acesso usado na sessão atual.');
        membership.active = false;
        membership.endsAt = new Date().toISOString();
        if (user.unitId === membership.unitId) {
            const replacement = activeMemberships.find((item) => item.id !== membership.id);
            if (replacement) {
                user.unitId = replacement.unitId;
                user.role = replacement.role;
            }
        }
        const unitName = db.units.find((item) => item.id === membership.unitId)?.name ?? 'unidade';
        audit(db, { action: 'USER_MEMBERSHIP_REMOVED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'USER', targetId: user.id, details: 'Acesso à unidade ' + unitName + ' removido.' });
        return membership;
    }); },
    async updatePerson(ctx: Context, personId: string, input: PersonInput) {
        return mutate((db) => {
            requireAdmin(db, ctx);
            const person = db.people.find((item) => item.id === personId);
            if (!person)
                throw new DomainError('NOT_FOUND', 'Pessoa não encontrada.');
            const normalized = normalizePersonInput(input);
            validatePerson(normalized);
            Object.assign(person, { ...normalized, document: normalized.document?.replace(/\D/g, ''), name: normalized.name.trim() });
            audit(db, { action: 'PERSON_UPDATED', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, targetType: 'PERSON', targetId: person.id, details: 'Pessoa “' + person.name + '” atualizada.' });
            return person;
        });
    },
    getBlob
};
export const suggestedDeadline = (days?: number) => days ? isoDaysFromNow(days).slice(0, 16) : '';
