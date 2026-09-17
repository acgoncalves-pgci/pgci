import type { AppDocument, AppUser, Attachment, Context, Database, Person, Protocol, Unit, ProtocolType, DocumentType, ProtocolEvent, ProtocolStatus, ProtocolPhase, ProtocolFlow, ChecklistAnswer, ChecklistQuestion, FlowPhase } from '../domain/model';
import { isActive } from '../domain/model';
import { canAct, canView, DomainError, getAssignment, getProtocol, getUser, requireActive, requireActor, requireAdmin, requireAssignmentReceived, requireVersion } from '../domain/rules';
import { cleanupOrphanedBlobs, deleteBlob, getBlob, loadDb, putBlob, saveDb } from '../storage/database';
import { isoDaysFromNow } from '../lib/format';
const sleep = () => new Promise((resolve) => window.setTimeout(resolve, 110));
const id = () => crypto.randomUUID();
const event = (db: Database, data: Omit<ProtocolEvent, 'id' | 'createdAt'>) => db.events.push({ ...data, id: id(), createdAt: new Date().toISOString() });
const mutate = async <T>(fn: (db: Database) => T) => { await sleep(); const db = loadDb(); const value = fn(db); saveDb(db); window.dispatchEvent(new Event('fluxo-publico:changed')); window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'success', message: 'Alteração salva com sucesso.' } })); return value; };
const protocolType = (db: Database, typeId: string) => db.protocolTypes.find((t) => t.id === typeId) ?? (() => { throw new DomainError('NOT_FOUND', 'Tipo de protocolo não encontrado.'); })();
type ChecklistSource = Pick<ProtocolPhase, 'checklistItems' | 'checklistQuestions'>;
const phaseQuestions = (phase: ChecklistSource): ChecklistQuestion[] => (phase.checklistQuestions?.length ? phase.checklistQuestions : phase.checklistItems.map((text, order) => ({ id: `legacy-${order}`, text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }))).slice().sort((a, b) => a.order - b.order);
const normalizedAnswers = (phase: ReturnType<typeof currentPhase>, values: ChecklistAnswer[] | string[]) => (values as (ChecklistAnswer | string)[]).map((value) => typeof value === 'string' ? { questionId: phaseQuestions(phase).find((question) => question.text === value)?.id ?? value, text: value, checked: true } : value);
const flowSnapshotFor = (db: Database, type: ProtocolType) => {
    const flow = type.flowId ? db.flows.find((item) => item.id === type.flowId && item.active) : undefined;
    if (!flow)
        throw new DomainError('VALIDATION', 'O tipo de protocolo precisa estar vinculado a um fluxo ativo.');
    const phases = db.flowPhases.filter((item) => item.flowId === flow.id).sort((a, b) => a.position - b.position).map((flowPhase) => {
        const phase = db.phases.find((item) => item.id === flowPhase.phaseId && item.active);
        if (!phase)
            throw new DomainError('VALIDATION', 'O fluxo possui uma fase indisponível.');
        return { phaseId: phase.id, name: phase.name, code: phase.code, position: flowPhase.position, required: flowPhase.required, eligibleUnitIds: phase.eligibleUnitIds, checklistItems: flowPhase.checklistQuestions?.map((question) => question.text) ?? phase.checklistItems, checklistQuestions: flowPhase.checklistQuestions ?? phaseQuestions(phase), requiredAttachmentTypes: phase.requiredAttachmentTypes, situation: flowPhase.situation, destinationUnitId: flowPhase.destinationUnitId, requiresChecklist: flowPhase.requiresChecklist, requiresAttachment: flowPhase.requiresAttachment, observation: flowPhase.observation, color: flowPhase.color, icon: flowPhase.icon };
    });
    if (!phases.length)
        throw new DomainError('VALIDATION', 'O fluxo precisa possuir ao menos uma fase ativa.');
    return { flowId: flow.id, flowName: flow.name, version: flow.version, phases };
};
const nextNumber = (db: Database, scope: 'protocol' | 'document') => { const year = new Date().getFullYear(); const key = `${scope}-${year}`; db.counters[key] = (db.counters[key] ?? 0) + 1; return `${scope === 'protocol' ? year : `DOC-${year}`}.${String(db.counters[key]).padStart(6, '0')}`; };
const bump = (p: Protocol) => { p.version += 1; p.updatedAt = new Date().toISOString(); };
const currentPhase = (protocol: Protocol) => {
    const phase = protocol.flowSnapshot?.phases.find((item) => item.phaseId === protocol.currentPhaseId);
    if (!phase)
        throw new DomainError('INVALID_STATE', 'Este protocolo não possui uma fase atual válida.');
    return phase;
};
const orderedPhases = (protocol: Protocol) => protocol.flowSnapshot?.phases.slice().sort((a, b) => a.position - b.position) ?? [];
const validatePhaseExit = (db: Database, protocol: Protocol, ctx: Context, values: ChecklistAnswer[] | string[]) => {
    const phase = currentPhase(protocol);
    if (phase.eligibleUnitIds.length && !phase.eligibleUnitIds.includes(ctx.activeUnitId))
        throw new DomainError('FORBIDDEN', 'A unidade ativa não é elegível para executar esta fase.');
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
};
type ProtocolTypeInput = Omit<ProtocolType, 'id'>;
type ProtocolPhaseInput = Omit<ProtocolPhase, 'id'>;
type StageInput = Omit<FlowPhase, 'id' | 'flowId' | 'position'> & { position?: number };
type ProtocolFlowInput = Omit<ProtocolFlow, 'id'> & { phaseIds?: string[]; stages?: StageInput[] };
const stagesFor = (input: ProtocolFlowInput): Array<StageInput & { position: number }> => input.stages?.map((stage, position) => ({ ...stage, position })) ?? (input.phaseIds ?? []).map((phaseId, position) => ({ phaseId, position, required: true }));
const cleanQuestions = (questions: ChecklistQuestion[] | undefined, checklistItems: string[]) => (questions?.length ? questions : checklistItems.map((text, order) => ({ id: id(), text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }))).map((question, index) => ({ ...question, id: question.id || id(), text: question.text.trim(), order: Number.isInteger(question.order) && question.order > 0 ? question.order : index + 1 })).filter((question) => question.text);
const validateProtocolType = (db: Database, input: ProtocolTypeInput) => {
    if (!input.name.trim() || !input.description.trim())
        throw new DomainError('VALIDATION', 'Informe nome e descrição do tipo.');
    if (input.flowId && !db.flows.some((flow) => flow.id === input.flowId && flow.active))
        throw new DomainError('VALIDATION', 'Selecione um fluxo ativo para o tipo de protocolo.');
    if (input.defaultDeadlineDays !== undefined && (!Number.isInteger(input.defaultDeadlineDays) || input.defaultDeadlineDays < 1))
        throw new DomainError('VALIDATION', 'Prazo padrão deve ser um número inteiro positivo.');
    for (const config of Object.values(input.fieldsConfig))
        if (config.required && !config.enabled)
            throw new DomainError('VALIDATION', 'Não é possível exigir um campo desabilitado.');
};
const validatePhase = (db: Database, input: ProtocolPhaseInput, ignoreId?: string) => {
    if (!input.name.trim() || !input.code.trim())
        throw new DomainError('VALIDATION', 'Informe nome e código da fase.');
    if (db.phases.some((phase) => phase.id !== ignoreId && phase.code.toLocaleLowerCase() === input.code.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe uma fase com este código.');
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
};
type UserInput = Omit<AppUser, 'id'>;
const validateUser = (db: Database, input: UserInput, ignoreId?: string) => {
    if (!input.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
        throw new DomainError('VALIDATION', 'Informe nome e e-mail válidos.');
    if (!db.units.some((unit) => unit.id === input.unitId && unit.active))
        throw new DomainError('VALIDATION', 'Selecione uma unidade ativa.');
    if (db.users.some((user) => user.id !== ignoreId && user.email.toLocaleLowerCase() === input.email.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um usuário com este e-mail.');
};
export interface ProtocolFilters {
    tab?: 'mine' | 'unit' | 'created' | 'all';
    search?: string;
    status?: ProtocolStatus | '';
    typeId?: string;
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
        let items = db.protocols.filter((p) => canView(db, p, ctx));
        const tab = filters.tab ?? 'mine';
        if (tab === 'mine')
            items = items.filter((p) => isActive(p) && p.currentAssigneeId === user.id);
        if (tab === 'unit')
            items = items.filter((p) => isActive(p) && p.currentUnitId === ctx.activeUnitId);
        if (tab === 'created')
            items = items.filter((p) => p.createdById === user.id);
        if (filters.search) {
            const q = filters.search.toLocaleLowerCase();
            items = items.filter((p) => p.number.includes(q) || p.subject.toLocaleLowerCase().includes(q) || db.people.find((x) => x.id === p.interestedPersonId)?.name.toLocaleLowerCase().includes(q));
        }
        if (filters.status)
            items = items.filter((p) => p.status === filters.status);
        if (filters.typeId)
            items = items.filter((p) => p.typeId === filters.typeId);
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
        return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
    },
    async getProtocol(ctx: Context, protocolId: string) { await sleep(); const db = loadDb(); requireActor(db, ctx); const protocol = getProtocol(db, protocolId); if (!canView(db, protocol, ctx))
        throw new DomainError('FORBIDDEN', 'Você não possui acesso a este protocolo.'); return { protocol, assignment: getAssignment(db, protocol), events: db.events.filter((e) => e.protocolId === protocolId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), attachments: db.attachments.filter((a) => a.protocolId === protocolId), documents: db.documents.filter((d) => d.protocolId === protocolId), db }; },
    async createProtocol(ctx: Context, input: {
        typeId: string;
        subject: string;
        description: string;
        interestedPersonId?: string;
        creditorPersonId?: string;
        amountCents?: number;
        dueAt?: string;
    }) { return mutate((db) => { const user = requireActor(db, ctx); const type = protocolType(db, input.typeId); const flowSnapshot = flowSnapshotFor(db, type); if (!input.subject.trim() || input.subject.length > 160)
        throw new DomainError('VALIDATION', 'Informe um assunto de até 160 caracteres.'); if (!input.description.trim() || input.description.length > 4000)
        throw new DomainError('VALIDATION', 'Informe uma descrição de até 4.000 caracteres.'); for (const [key, value] of Object.entries({ interested: input.interestedPersonId, creditor: input.creditorPersonId, amount: input.amountCents })) {
        const setting = type.fieldsConfig[key as keyof typeof type.fieldsConfig];
        if (setting?.required && (value === undefined || value === ''))
            throw new DomainError('VALIDATION', `Preencha o campo obrigatório: ${key}.`);
    } if (input.amountCents !== undefined && input.amountCents < 0)
        throw new DomainError('VALIDATION', 'Valor não pode ser negativo.'); const createdAt = new Date().toISOString(); const assignment = { id: id(), protocolId: id(), unitId: ctx.activeUnitId, assigneeId: user.id, startedAt: createdAt, receivedAt: createdAt, receivedById: user.id }; const p: Protocol = { id: assignment.protocolId, number: nextNumber(db, 'protocol'), typeId: type.id, typeConfigSnapshot: structuredClone(type.fieldsConfig), flowSnapshot, currentPhaseId: flowSnapshot.phases[0].phaseId, subject: input.subject.trim(), description: input.description.trim(), interestedPersonId: input.interestedPersonId, creditorPersonId: input.creditorPersonId, amountCents: input.amountCents, status: 'CADASTRADO', originUnitId: ctx.activeUnitId, currentUnitId: ctx.activeUnitId, currentAssigneeId: user.id, currentAssignmentId: assignment.id, dueAt: input.dueAt, createdById: user.id, createdAt, updatedAt: createdAt, version: 1 }; db.protocols.push(p); db.assignments.push(assignment); event(db, { protocolId: p.id, kind: 'ABERTURA', actorUserId: user.id, actorUnitId: ctx.activeUnitId, toUnitId: ctx.activeUnitId, toUserId: user.id, assignmentId: assignment.id, nextStatus: 'CADASTRADO' }); event(db, { protocolId: p.id, kind: 'RECEBIMENTO', actorUserId: user.id, actorUnitId: ctx.activeUnitId, assignmentId: assignment.id }); return p; }); },
    async updateProtocol(ctx: Context, protocolId: string, expectedVersion: number, input: { subject: string; description: string; dueAt?: string }) { return mutate((db) => { const protocol = getProtocol(db, protocolId); requireVersion(protocol, expectedVersion); requireAdmin(db, ctx); if (protocol.currentUnitId !== ctx.activeUnitId) throw new DomainError('FORBIDDEN', 'Selecione a unidade atual do protocolo para editá-lo.'); if (!input.subject.trim() || input.subject.trim().length > 160) throw new DomainError('VALIDATION', 'Informe um assunto de até 160 caracteres.'); if (!input.description.trim() || input.description.trim().length > 4000) throw new DomainError('VALIDATION', 'Informe uma descrição de até 4.000 caracteres.'); if (input.dueAt && new Date(input.dueAt).getTime() < Date.now() && isActive(protocol)) throw new DomainError('VALIDATION', 'O prazo não pode estar no passado.'); protocol.subject = input.subject.trim(); protocol.description = input.description.trim(); protocol.dueAt = input.dueAt; bump(protocol); return protocol; }); },
    async deleteProtocol(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const protocol = getProtocol(db, protocolId); requireVersion(protocol, expectedVersion); requireAdmin(db, ctx); if (protocol.currentUnitId !== ctx.activeUnitId || protocol.status !== 'CADASTRADO') throw new DomainError('FORBIDDEN', 'Somente protocolos cadastrados, na unidade atual, podem ser excluídos.'); db.protocols = db.protocols.filter((item) => item.id !== protocolId); db.assignments = db.assignments.filter((item) => item.protocolId !== protocolId); db.events = db.events.filter((item) => item.protocolId !== protocolId); db.documents = db.documents.filter((item) => item.protocolId !== protocolId); db.attachments = db.attachments.filter((item) => item.protocolId !== protocolId); return undefined; }); },    async assume(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActive(p); const user = requireActor(db, ctx); if (p.currentUnitId !== ctx.activeUnitId || p.currentAssigneeId)
        throw new DomainError('FORBIDDEN', 'Apenas a fila da sua unidade pode ser assumida.'); const a = getAssignment(db, p); a.assigneeId = user.id; a.receivedAt = new Date().toISOString(); a.receivedById = user.id; p.currentAssigneeId = user.id; bump(p); event(db, { protocolId, kind: 'ATRIBUICAO', actorUserId: user.id, actorUnitId: ctx.activeUnitId, toUserId: user.id, assignmentId: a.id }); event(db, { protocolId, kind: 'RECEBIMENTO', actorUserId: user.id, actorUnitId: ctx.activeUnitId, assignmentId: a.id }); return p; }); },
    async acknowledge(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActive(p); requireActor(db, ctx); if (p.currentAssigneeId !== ctx.userId)
        throw new DomainError('FORBIDDEN', 'Somente o responsável atual pode dar ciência.'); const a = getAssignment(db, p); if (!a.receivedAt) {
        a.receivedAt = new Date().toISOString();
        a.receivedById = ctx.userId;
        bump(p);
        event(db, { protocolId, kind: 'RECEBIMENTO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: a.id });
    } ; return p; }); },
    async assign(ctx: Context, protocolId: string, expectedVersion: number, assigneeId: string) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActive(p); const actor = requireAdmin(db, ctx); if (ctx.activeUnitId !== p.currentUnitId)
        throw new DomainError('FORBIDDEN', 'Apenas admin no contexto da unidade atual pode designar responsável.'); const assignee = getUser(db, assigneeId); if (!assignee.active || !db.memberships.some((membership) => membership.userId === assignee.id && membership.unitId === p.currentUnitId && membership.active))
        throw new DomainError('VALIDATION', 'Responsável deve estar ativo e vinculado à unidade atual.'); endCurrent(db, p); const next = addAssignment(db, p, p.currentUnitId, assigneeId); bump(p); event(db, { protocolId, kind: 'ATRIBUICAO', actorUserId: actor.id, actorUnitId: ctx.activeUnitId, toUnitId: p.currentUnitId, toUserId: assigneeId, assignmentId: next.id }); return p; }); },
    async forward(ctx: Context, protocolId: string, expectedVersion: number, input: {
        unitId: string;
        assigneeId?: string;
        message: string;
        dueAt?: string;
    }) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActive(p); requireActor(db, ctx); if (!canAct(db, p, ctx))
        throw new DomainError('FORBIDDEN', 'Somente o responsável ou admin no contexto atual pode tramitar.'); requireAssignmentReceived(db, p); const unit = db.units.find((u) => u.id === input.unitId && u.active); if (!unit)
        throw new DomainError('VALIDATION', 'Selecione uma unidade destino ativa.'); if (!input.message.trim() || input.message.length > 4000)
        throw new DomainError('VALIDATION', 'Despacho é obrigatório e tem até 4.000 caracteres.'); if (input.dueAt && new Date(input.dueAt) <= new Date())
        throw new DomainError('VALIDATION', 'Prazo deve estar no futuro.'); const recipient = input.assigneeId ? getUser(db, input.assigneeId) : undefined; if (recipient && (!recipient.active || !db.memberships.some((membership) => membership.userId === recipient.id && membership.unitId === input.unitId && membership.active)))
        throw new DomainError('VALIDATION', 'O destinatário precisa pertencer à unidade destino.'); if (input.unitId === p.currentUnitId && input.assigneeId === p.currentAssigneeId)
        throw new DomainError('VALIDATION', 'A tramitação deve alterar unidade ou responsável.'); const oldUnit = p.currentUnitId; const oldUser = p.currentAssigneeId; endCurrent(db, p); const next = addAssignment(db, p, input.unitId, input.assigneeId); p.dueAt = input.dueAt; p.status = 'EM_ANDAMENTO'; bump(p); event(db, { protocolId, kind: 'TRAMITACAO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, fromUnitId: oldUnit, toUnitId: input.unitId, fromUserId: oldUser, toUserId: input.assigneeId, assignmentId: next.id, message: input.message.trim(), previousStatus: 'CADASTRADO', nextStatus: 'EM_ANDAMENTO' }); return p; }); },
    async complete(ctx: Context, protocolId: string, expectedVersion: number, message: string) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActive(p); requireActor(db, ctx); if (!canAct(db, p, ctx))
        throw new DomainError('FORBIDDEN', 'Você não pode concluir este protocolo.'); requireAssignmentReceived(db, p); const phases = orderedPhases(p); const phase = currentPhase(p); if (phase.position !== phases.at(-1)?.position) throw new DomainError('INVALID_STATE', 'Conclua as fases anteriores antes de concluir o protocolo.'); if (!message.trim())
        throw new DomainError('VALIDATION', 'Informe o resultado da conclusão.'); p.status = 'CONCLUIDO'; p.completedAt = new Date().toISOString(); bump(p); event(db, { protocolId, kind: 'CONCLUSAO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: p.currentAssignmentId, message: message.trim(), previousStatus: 'EM_ANDAMENTO', nextStatus: 'CONCLUIDO' }); return p; }); },
    async advancePhase(ctx: Context, protocolId: string, expectedVersion: number, checklist: ChecklistAnswer[] | string[], message = '') { return mutate((db) => { const protocol = getProtocol(db, protocolId); requireVersion(protocol, expectedVersion); requireActive(protocol); requireActor(db, ctx); if (!canAct(db, protocol, ctx)) throw new DomainError('FORBIDDEN', 'Você não pode avançar esta fase.'); requireAssignmentReceived(db, protocol); const { phase: current, answers } = validatePhaseExit(db, protocol, ctx, checklist); const phases = orderedPhases(protocol); const next = phases.find((phase) => phase.position > current.position); if (!next) throw new DomainError('INVALID_STATE', 'Esta é a última fase. Conclua o protocolo.'); protocol.currentPhaseId = next.phaseId; bump(protocol); event(db, { protocolId, kind: 'FASE_AVANCADA', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: protocol.currentAssignmentId, message: message.trim() || `${current.name} → ${next.name}`, checklist: answers }); return protocol; }); },
    async returnPhase(ctx: Context, protocolId: string, expectedVersion: number, message: string) { return mutate((db) => { const protocol = getProtocol(db, protocolId); requireVersion(protocol, expectedVersion); requireActive(protocol); requireActor(db, ctx); if (!canAct(db, protocol, ctx)) throw new DomainError('FORBIDDEN', 'Você não pode devolver esta fase.'); requireAssignmentReceived(db, protocol); if (!message.trim()) throw new DomainError('VALIDATION', 'Informe o motivo da devolução.'); const current = currentPhase(protocol); const previous = orderedPhases(protocol).filter((phase) => phase.position < current.position).at(-1); if (!previous) throw new DomainError('INVALID_STATE', 'Esta é a primeira fase do fluxo.'); protocol.currentPhaseId = previous.phaseId; bump(protocol); event(db, { protocolId, kind: 'FASE_DEVOLVIDA', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: protocol.currentAssignmentId, message: `${current.name} → ${previous.name}: ${message.trim()}` }); return protocol; }); },    async archive(ctx: Context, protocolId: string, expectedVersion: number) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); requireActor(db, ctx); if (p.status !== 'CONCLUIDO' || !canAct(db, p, ctx))
        throw new DomainError('FORBIDDEN', 'Apenas protocolo concluído pode ser arquivado pelo responsável ou admin.'); p.status = 'ARQUIVADO'; p.archivedAt = new Date().toISOString(); bump(p); event(db, { protocolId, kind: 'ARQUIVAMENTO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: p.currentAssignmentId, previousStatus: 'CONCLUIDO', nextStatus: 'ARQUIVADO' }); return p; }); },
    async reopen(ctx: Context, protocolId: string, expectedVersion: number, input: {
        unitId: string;
        assigneeId?: string;
        message: string;
        dueAt?: string;
    }) { return mutate((db) => { const p = getProtocol(db, protocolId); requireVersion(p, expectedVersion); const user = requireAdmin(db, ctx); if (ctx.activeUnitId !== p.currentUnitId || (p.status !== 'CONCLUIDO' && p.status !== 'ARQUIVADO'))
        throw new DomainError('FORBIDDEN', 'Apenas admin no contexto da unidade atual pode reabrir protocolo concluído ou arquivado.'); if (!input.message.trim())
        throw new DomainError('VALIDATION', 'Informe o motivo da reabertura.'); const dest = db.units.find((u) => u.id === input.unitId && u.active); if (!dest)
        throw new DomainError('VALIDATION', 'Selecione uma unidade destino ativa.'); if (input.assigneeId && !db.memberships.some((membership) => membership.userId === input.assigneeId && membership.unitId === input.unitId && membership.active))
        throw new DomainError('VALIDATION', 'Responsável incompatível com a unidade destino.'); endCurrent(db, p); const next = addAssignment(db, p, input.unitId, input.assigneeId); const previous = p.status; p.status = 'EM_ANDAMENTO'; p.completedAt = undefined; p.archivedAt = undefined; p.dueAt = input.dueAt; bump(p); event(db, { protocolId, kind: 'REABERTURA', actorUserId: user.id, actorUnitId: ctx.activeUnitId, toUnitId: input.unitId, toUserId: input.assigneeId, assignmentId: next.id, message: input.message.trim(), previousStatus: previous, nextStatus: 'EM_ANDAMENTO' }); return p; }); },
    async addAttachments(ctx: Context, protocolId: string, expectedVersion: number, files: File[]) {
        if (!files.length || files.length > 5)
            throw new DomainError('VALIDATION', 'Selecione de 1 a 5 arquivos por operação.');
        for (const file of files)
            if (!['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type) || file.size > 5 * 1024 * 1024)
                throw new DomainError('VALIDATION', 'Envie PDF, PNG, JPEG ou TXT de até 5 MB.');
        const staged = files.map((file) => ({ file, blobKey: id() }));
        try {
            await cleanupOrphanedBlobs(loadDb().attachments.map((attachment) => attachment.blobKey)).catch(() => undefined);
            await Promise.all(staged.map(({ blobKey, file }) => putBlob(blobKey, file)));
            const attachments = await mutate((db) => {
                const p = getProtocol(db, protocolId);
                requireVersion(p, expectedVersion);
                requireActive(p);
                if (!canAct(db, p, ctx))
                    throw new DomainError('FORBIDDEN', 'Você não pode anexar neste protocolo.');
                const createdAt = new Date().toISOString();
                const created = staged.map(({ file, blobKey }) => {
                    const attachment: Attachment = { id: id(), protocolId, filename: file.name, mimeType: file.type, sizeBytes: file.size, blobKey, uploadedById: ctx.userId, createdAt };
                    db.attachments.push(attachment);
                    event(db, { protocolId, kind: 'ANEXO_ADICIONADO', actorUserId: ctx.userId, actorUnitId: ctx.activeUnitId, assignmentId: p.currentAssignmentId, relatedAttachmentId: attachment.id });
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
    }, async addAttachment(ctx: Context, protocolId: string, expectedVersion: number, file: File) { const [attachment] = await this.addAttachments(ctx, protocolId, expectedVersion, [file]); return attachment; },
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
    },    async listDocuments(ctx: Context, search = '', typeId = '') { await sleep(); const db = loadDb(); requireActor(db, ctx); const q = search.toLocaleLowerCase(); const items = db.documents.filter((d) => { const p = d.protocolId ? db.protocols.find((x) => x.id === d.protocolId) : undefined; return (!p || canView(db, p, ctx) || d.authorUserId === ctx.userId || d.unitId === ctx.activeUnitId) && (!q || d.number.toLowerCase().includes(q) || d.subject.toLowerCase().includes(q)) && (!typeId || d.typeId === typeId); }); return { items, db }; },
    async createDocument(ctx: Context, input: Omit<AppDocument, 'id' | 'number' | 'unitId' | 'authorUserId' | 'createdAt'>) { return mutate((db) => { const author = requireActor(db, ctx); if (!author.active)
        throw new DomainError('FORBIDDEN', 'Usuário inativo não pode criar documentos.'); const type = db.documentTypes.find((t) => t.id === input.typeId && t.active); if (!type || !input.subject.trim() || !input.body.trim())
        throw new DomainError('VALIDATION', 'Preencha tipo, assunto e corpo do documento.'); if (input.recipientPersonId && !db.people.some((person) => person.id === input.recipientPersonId && person.active))
        throw new DomainError('VALIDATION', 'Selecione um destinatário ativo.'); if (input.protocolId) {
        const p = getProtocol(db, input.protocolId);
        if (!isActive(p) || !canAct(db, p, ctx))
            throw new DomainError('FORBIDDEN', 'Documento vinculado exige atuação em protocolo ativo.');
    } const doc: AppDocument = { ...input, id: id(), number: nextNumber(db, 'document'), subject: input.subject.trim(), body: input.body.trim(), unitId: ctx.activeUnitId, authorUserId: author.id, createdAt: new Date().toISOString() }; db.documents.push(doc); if (doc.protocolId)
        event(db, { protocolId: doc.protocolId, kind: 'DOCUMENTO_CRIADO', actorUserId: author.id, actorUnitId: ctx.activeUnitId, relatedDocumentId: doc.id }); return doc; }); },
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
            throw new DomainError('VALIDATION', 'Não é possível inativar unidade com protocolos ativos.');
    } Object.assign(unit, { name, abbreviation, parentId: input.parentId, active: input.active }); return unit; }); },
    async createPerson(ctx: Context, input: PersonInput) { return mutate((db) => { requireActor(db, ctx); validatePerson(input); const person = { ...input, document: input.document?.replace(/\D/g, ''), id: id(), name: input.name.trim() }; db.people.push(person); return person; }); },
    async createPhase(ctx: Context, input: ProtocolPhaseInput) { return mutate((db) => { requireAdmin(db, ctx); validatePhase(db, input); const checklistQuestions = cleanQuestions(input.checklistQuestions, input.checklistItems); const phase: ProtocolPhase = { ...input, id: id(), name: input.name.trim(), code: input.code.trim().toUpperCase(), description: input.description?.trim(), checklistQuestions, checklistItems: checklistQuestions.map((question) => question.text), requiredAttachmentTypes: input.requiredAttachmentTypes.map((item) => item.trim()).filter(Boolean) }; db.phases.push(phase); return phase; }); },
    async updatePhase(ctx: Context, phaseId: string, input: ProtocolPhaseInput) { return mutate((db) => { requireAdmin(db, ctx); const phase = db.phases.find((item) => item.id === phaseId); if (!phase) throw new DomainError('NOT_FOUND', 'Fase não encontrada.'); validatePhase(db, input, phaseId); if (!input.active && db.flowPhases.some((item) => item.phaseId === phaseId && db.flows.some((flow) => flow.id === item.flowId && flow.active))) throw new DomainError('VALIDATION', 'Não é possível inativar fase usada por fluxo ativo.'); const checklistQuestions = cleanQuestions(input.checklistQuestions, input.checklistItems); Object.assign(phase, { ...input, name: input.name.trim(), code: input.code.trim().toUpperCase(), description: input.description?.trim(), checklistQuestions, checklistItems: checklistQuestions.map((question) => question.text), requiredAttachmentTypes: input.requiredAttachmentTypes.map((item) => item.trim()).filter(Boolean) }); return phase; }); },
    async createFlow(ctx: Context, input: ProtocolFlowInput) { return mutate((db) => { requireAdmin(db, ctx); validateFlow(db, input); const flow: ProtocolFlow = { id: id(), name: input.name.trim(), version: input.version, active: input.active, startsAt: input.startsAt, endsAt: input.endsAt }; db.flows.push(flow); stagesFor(input).forEach((stage) => db.flowPhases.push({ id: id(), flowId: flow.id, ...stage })); return flow; }); },
    async updateFlow(ctx: Context, flowId: string, input: ProtocolFlowInput) { return mutate((db) => { requireAdmin(db, ctx); const flow = db.flows.find((item) => item.id === flowId); if (!flow) throw new DomainError('NOT_FOUND', 'Fluxo não encontrado.'); validateFlow(db, input, flowId); if (!input.active && db.protocolTypes.some((type) => type.flowId === flowId && type.active)) throw new DomainError('VALIDATION', 'Não é possível inativar fluxo vinculado a tipo ativo.'); Object.assign(flow, { name: input.name.trim(), version: input.version, active: input.active, startsAt: input.startsAt, endsAt: input.endsAt }); db.flowPhases = db.flowPhases.filter((item) => item.flowId !== flowId); stagesFor(input).forEach((stage) => db.flowPhases.push({ id: id(), flowId, ...stage })); return flow; }); },    async createProtocolType(ctx: Context, input: ProtocolTypeInput) { return mutate((db) => { requireAdmin(db, ctx); validateProtocolType(db, input); if (db.protocolTypes.some((type) => type.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); const type: ProtocolType = { ...input, id: id(), name: input.name.trim(), description: input.description.trim() }; db.protocolTypes.push(type); return type; }); },
    async updateProtocolType(ctx: Context, typeId: string, input: ProtocolTypeInput) { return mutate((db) => { requireAdmin(db, ctx); validateProtocolType(db, input); const type = db.protocolTypes.find((item) => item.id === typeId); if (!type)
        throw new DomainError('NOT_FOUND', 'Tipo de protocolo não encontrado.'); if (db.protocolTypes.some((item) => item.id !== typeId && item.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); Object.assign(type, { ...input, name: input.name.trim(), description: input.description.trim() }); return type; }); },
    async deleteAllProtocolTypes(ctx: Context) { return mutate((db) => { requireAdmin(db, ctx); if (db.protocols.length) throw new DomainError('VALIDATION', 'Não é possível excluir os tipos enquanto existirem protocolos vinculados.'); db.protocolTypes.splice(0, db.protocolTypes.length); return true; }); },    async createDocumentType(ctx: Context, input: Omit<DocumentType, 'id'>) { return mutate((db) => { requireAdmin(db, ctx); const name = input.name.trim(); const description = input.description.trim(); if (!name || !description)
        throw new DomainError('VALIDATION', 'Informe nome e descrição do tipo.'); if (db.documentTypes.some((type) => type.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); const type: DocumentType = { ...input, id: id(), name, description }; db.documentTypes.push(type); return type; }); },
    async updateDocumentType(ctx: Context, typeId: string, input: Omit<DocumentType, 'id'>) { return mutate((db) => { requireAdmin(db, ctx); const type = db.documentTypes.find((item) => item.id === typeId); if (!type)
        throw new DomainError('NOT_FOUND', 'Tipo de documento não encontrado.'); const name = input.name.trim(); const description = input.description.trim(); if (!name || !description)
        throw new DomainError('VALIDATION', 'Informe nome e descrição do tipo.'); if (db.documentTypes.some((item) => item.id !== typeId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw new DomainError('VALIDATION', 'Já existe um tipo com este nome.'); Object.assign(type, { ...input, name, description }); return type; }); },
    async createUser(ctx: Context, input: UserInput) { return mutate((db) => { requireAdmin(db, ctx); validateUser(db, input); const user: AppUser = { ...input, id: id(), name: input.name.trim(), email: input.email.trim().toLocaleLowerCase() }; db.users.push(user); db.memberships.push({ id: id(), userId: user.id, unitId: user.unitId, role: user.role, title: user.role === 'ADMIN' ? 'Administrador geral' : 'Operador', startsAt: new Date().toISOString(), active: user.active }); return user; }); },
    async updateUser(ctx: Context, userId: string, input: UserInput) { return mutate((db) => { requireAdmin(db, ctx); const user = db.users.find((item) => item.id === userId); if (!user)
        throw new DomainError('NOT_FOUND', 'Usuário não encontrado.'); validateUser(db, input, userId); if (!input.active && user.active) {
        if (user.id === ctx.userId)
            throw new DomainError('VALIDATION', 'Não é possível inativar o usuário atual.');
        if (user.role === 'ADMIN' && db.users.filter((item) => item.active && item.role === 'ADMIN').length === 1)
            throw new DomainError('VALIDATION', 'Não é possível inativar o último administrador ativo.');
        if (db.protocols.some((protocol) => isActive(protocol) && protocol.currentAssigneeId === user.id))
            throw new DomainError('VALIDATION', 'Redistribua os protocolos ativos antes de inativar este usuário.');
    } Object.assign(user, { ...input, name: input.name.trim(), email: input.email.trim().toLocaleLowerCase() }); return user; }); },
    async updatePerson(ctx: Context, personId: string, input: PersonInput) { return mutate((db) => { requireAdmin(db, ctx); const person = db.people.find((item) => item.id === personId); if (!person)
        throw new DomainError('NOT_FOUND', 'Pessoa não encontrada.'); validatePerson(input); Object.assign(person, { ...input, document: input.document?.replace(/\D/g, ''), name: input.name.trim() }); return person; }); },
    getBlob
};
export const suggestedDeadline = (days?: number) => days ? isoDaysFromNow(days).slice(0, 16) : '';
