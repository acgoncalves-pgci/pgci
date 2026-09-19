import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, Building2, CalendarClock, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, ClipboardList, Clock3, Eye, FileArchive, FilePlus2, FileText, GitBranch, Grid3X3, ListFilter, LockKeyhole, Paperclip, Pencil, Plus, Printer, RefreshCcw, Search, Trash2, UserRound, UserRoundCog, UsersRound } from 'lucide-react';
import type { AppDocument, Attachment, AuditEvent, Database, Protocol, ProtocolEvent, ProtocolStatus } from '../../domain/model';
import { eventLabel, isActive, isMovementEvent, statusLabel } from '../../domain/model';
import { currentProtocolSituation, legacySituationTypeId } from '../../domain/situations';
import { canAct as canActProtocol, canReceiveWorkInUnit, findActiveMembershipForUnit, roleForContext } from '../../domain/rules';
import { sortUnitsByPath, unitPath } from '../../domain/units';
import { dateOnly, dateTime, money } from '../../lib/format';
import { api, suggestedDeadline, type ProtocolFilters } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { navigateWithLoading } from '../../app/routeLoading';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Switch } from '../../components/ui/Switch';
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';
import { Name, ProtocolTable, UnitName } from './ProtocolTable';
export function Protocols() {
    const navigate = useNavigate();
    const ctx = useSession();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const statuses = (params.get('status') ?? '').split(',').filter((status): status is ProtocolStatus => status in statusLabel);
    const situationIds = (params.get('situation') ?? '').split(',').filter(Boolean);
    const filters: ProtocolFilters = {
        tab: (params.get('tab') as ProtocolFilters['tab']) || 'mine', search: params.get('search') || '', shortcut: (params.get('shortcut') as ProtocolFilters['shortcut']) || '', statuses, situationIds,
        typeId: params.get('typeId') || '', interestedId: params.get('interestedId') || '', creditorId: params.get('creditorId') || '', unitId: params.get('unitId') || '', assigneeId: params.get('assigneeId') || '',
        createdFrom: params.get('createdFrom') || '', createdTo: params.get('createdTo') || '', number: params.get('number') || '', description: params.get('description') || '', attachments: (params.get('attachments') as ProtocolFilters['attachments']) || '',
        sort: (params.get('sort') as ProtocolFilters['sort']) || 'updated-desc', page: Number(params.get('page') || 1), pageSize: Number(params.get('pageSize') || 10),
    };
    const { data, isLoading, error } = useQuery({ queryKey: ['processes', ctx.userId, ctx.activeUnitId, ctx.scopeUnitId, location.search], queryFn: () => api.listProtocols(ctx, filters), placeholderData: (previous) => previous });
    const { data: db } = useDb();
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const set = (patch: Record<string, string>, replace = false) => {
        const q = new URLSearchParams(location.search);
        Object.entries(patch).forEach(([key, value]) => value ? q.set(key, value) : q.delete(key));
        if (!('page' in patch)) q.set('page', '1');
        navigate(`/processos${q.size ? `?${q.toString()}` : ''}`, { replace });
    };
    if (isLoading || !db || !ctx.user) return <Loading variant="list"/>;
    if (error) return <ErrorBox error={error}/>;
    const quickFilters = [
        { id: 'mine', label: 'Para mim', detail: 'Processos endereçados a você.', icon: UserRound },
        { id: 'created', label: 'Gerados por mim', detail: 'Processos abertos por você.', icon: FileText },
        { id: 'unit', label: 'Minha Unidade', detail: data?.unassignedInUnit ? `${data.unassignedInUnit} processo(s) sem destinatário` : 'Processos da sua unidade.', icon: Building2 },
        { id: 'participated', label: 'Já participei', detail: 'Processos em que você participou.', icon: UsersRound },
        { id: 'all', label: 'Todos', detail: 'Processos disponíveis no seu escopo.', icon: Grid3X3 },
    ] as const;
    const shortcuts = [['', 'Todos'], ['unassigned', 'Sem responsável'], ['unacknowledged', 'Sem ciência'], ['overdue', 'Vencidos'], ['soon', 'Vencem em 24h']] as const;
    const advancedCount = [filters.typeId, filters.interestedId, filters.creditorId, filters.unitId, filters.assigneeId, filters.createdFrom, filters.createdTo, filters.number, filters.description, filters.attachments, filters.situationIds?.length || filters.statuses?.length ? 'situation' : ''].filter(Boolean).length;
    return <>
      <PageTitle title="Processos" action={<Link to="/processos/novo" className="btn-primary"><Plus size={16}/>Novo processo</Link>}/>
      <section className="no-print process-search-panel">
        <div className="process-search-row">
          <label className="process-search-input"><Search aria-hidden="true" size={18}/><Input aria-label="Buscar processos" className="!mt-0 !border-0 !bg-transparent !px-0 !shadow-none" placeholder="Buscar por número, assunto ou interessado..." value={filters.search} onChange={(event) => set({ search: event.target.value }, true)}/></label>
          <button type="button" className="btn-secondary process-advanced-button" onClick={() => setAdvancedOpen(true)}><ListFilter size={16}/>Filtro avançado{advancedCount ? <span className="process-filter-count">{advancedCount}</span> : null}</button>
        </div>
        <div className="process-quick-filters" aria-label="Filtros rápidos">{quickFilters.map(({ id, label, detail, icon: Icon }) => <button key={id} type="button" aria-pressed={filters.tab === id} className="process-quick-filter" onClick={() => set({ tab: id, shortcut: '' })}><span className="inline-flex items-center gap-2"><Icon aria-hidden="true" size={15}/><strong>{label}</strong></span><small>{detail}</small></button>)}</div>
        <div className="process-shortcuts"><span className="text-xs font-semibold text-muted-foreground">Filtros rápidos</span>{shortcuts.map(([id, label]) => <button key={id} type="button" aria-pressed={filters.shortcut === id} onClick={() => set({ shortcut: id })} className="process-shortcut">{label}</button>)}</div>
      </section>
      {data!.items.length ? <div className="process-list"><ProtocolTable db={db} protocols={data!.items}/><Pagination page={data!.page} total={data!.total} size={data!.pageSize} onPage={(page) => set({ page: String(page) })}/></div> : <Empty title="Nenhum processo encontrado" detail="Ajuste os filtros ou abra um novo processo." action={<Link className="btn-primary" to="/processos/novo">Abrir processo</Link>}/>}
      {advancedOpen && <AdvancedProcessFilterDialog db={db} filters={filters} onClose={() => setAdvancedOpen(false)} onApply={(values) => { set(values); setAdvancedOpen(false); }}/>}
    </>;
}

type AdvancedFilterDraft = {
    typeId: string; interestedId: string; creditorId: string; unitId: string; assigneeId: string; situationIds: string[];
    createdFrom: string; createdTo: string; number: string; description: string; attachments: '' | 'with' | 'without';
};
function AdvancedProcessFilterDialog({ db, filters, onClose, onApply }: { db: Database; filters: ProtocolFilters; onClose: () => void; onApply: (values: Record<string, string>) => void }) {
    const legacySituationIds = (filters.statuses ?? []).map(legacySituationTypeId).filter((id): id is string => Boolean(id));
    const initial: AdvancedFilterDraft = { typeId: filters.typeId ?? '', interestedId: filters.interestedId ?? '', creditorId: filters.creditorId ?? '', unitId: filters.unitId ?? '', assigneeId: filters.assigneeId ?? '', situationIds: filters.situationIds?.length ? filters.situationIds : legacySituationIds, createdFrom: filters.createdFrom ?? '', createdTo: filters.createdTo ?? '', number: filters.number ?? '', description: filters.description ?? '', attachments: filters.attachments ?? '' };
    const [draft, setDraft] = useState(initial);
    const update = <K extends keyof AdvancedFilterDraft>(key: K, value: AdvancedFilterDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
    const toggleSituation = (situationId: string) => update('situationIds', draft.situationIds.includes(situationId) ? draft.situationIds.filter((item) => item !== situationId) : [...draft.situationIds, situationId]);
    const clear = () => setDraft({ typeId: '', interestedId: '', creditorId: '', unitId: '', assigneeId: '', situationIds: [], createdFrom: '', createdTo: '', number: '', description: '', attachments: '' });
    const apply = () => onApply({ typeId: draft.typeId, interestedId: draft.interestedId, creditorId: draft.creditorId, unitId: draft.unitId, assigneeId: draft.assigneeId, situation: draft.situationIds.join(','), status: '', createdFrom: draft.createdFrom, createdTo: draft.createdTo, number: draft.number, description: draft.description, attachments: draft.attachments });
    return <Dialog title="Pesquisar processos" onClose={onClose} wide><form onSubmit={(event) => { event.preventDefault(); apply(); }} className="process-advanced-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de processo"><Select value={draft.typeId} onChange={(e) => update('typeId', e.target.value)}><option value="">Todos os tipos</option>{db.protocolTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></Field>
        <Field label="Interessado"><Select value={draft.interestedId} onChange={(e) => update('interestedId', e.target.value)}><option value="">Todos</option>{db.people.filter((person) => person.roles.includes('INTERESSADO')).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
        <Field label="Credor"><Select value={draft.creditorId} onChange={(e) => update('creditorId', e.target.value)}><option value="">Todos</option>{db.people.filter((person) => person.roles.includes('CREDOR')).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
        <Field label="Responsável"><Select value={draft.assigneeId} onChange={(e) => update('assigneeId', e.target.value)}><option value="">Todos</option>{db.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>
        <Field label="Unidade organizacional"><Select value={draft.unitId} onChange={(e) => update('unitId', e.target.value)}><option value="">Todas as unidades</option>{sortUnitsByPath(db.units.filter((unit) => unit.active)).map((unit) => <option key={unit.id} value={unit.id}>{unitPath(db.units, unit.id)}</option>)}</Select></Field>
      </div>
      <fieldset><legend className="mb-2 text-xs font-bold">Situação do processo</legend><div className="flex flex-wrap gap-2">{db.situations.filter((situation) => situation.active || draft.situationIds.includes(situation.id)).map((situation) => <button key={situation.id} type="button" aria-pressed={draft.situationIds.includes(situation.id)} className="process-status-filter" onClick={() => toggleSituation(situation.id)}>{draft.situationIds.includes(situation.id) && <Check size={13}/>} {situation.name}</button>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Data inicial"><Input type="date" max={draft.createdTo || undefined} value={draft.createdFrom} onChange={(e) => update('createdFrom', e.target.value)}/></Field><Field label="Data final"><Input type="date" min={draft.createdFrom || undefined} value={draft.createdTo} onChange={(e) => update('createdTo', e.target.value)}/></Field><Field label="Número"><Input placeholder="Pesquisar pelo número..." value={draft.number} onChange={(e) => update('number', e.target.value)}/></Field></div>
      <Field label="Descrição / Assunto"><Input placeholder="Pesquisar pela descrição..." value={draft.description} onChange={(e) => update('description', e.target.value)}/></Field>
      <fieldset><legend className="mb-2 text-xs font-bold">Anexos</legend><div className="flex flex-wrap gap-2">{[['', 'Todos'], ['with', 'Com anexos'], ['without', 'Sem anexos']].map(([value, label]) => <button key={value} type="button" aria-pressed={draft.attachments === value} className="process-attachment-filter" onClick={() => update('attachments', value as AdvancedFilterDraft['attachments'])}>{draft.attachments === value && <Check size={13}/>} {label}</button>)}</div></fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" className="btn-secondary !border-0" onClick={clear}>Limpar</button><button type="button" className="btn-secondary" onClick={onClose}>Fechar</button><button type="submit" className="btn-primary"><Search size={16}/>Buscar</button></div>
    </form></Dialog>;
}

function Pagination({ page, total, size, onPage }: {
    page: number;
    total: number;
    size: number;
    onPage: (page: number) => void;
}) { const pages = Math.max(1, Math.ceil(total / size)); return <div className="flex items-center justify-between border-t px-3 py-3 text-sm"><span className="text-slate-500 dark:text-slate-400">{total} registro{total === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><span>{page} / {pages}</span><button className="btn-secondary !py-1" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button></div></div>; }
const protocolSchema = z.object({
    typeId: z.string().min(1, 'Selecione o tipo.'),
    subject: z.string().trim().max(160, 'O assunto deve ter até 160 caracteres.'),
    description: z.string().trim().min(1, 'Informe a descrição.').max(4000, 'A descrição deve ter até 4.000 caracteres.'),
    observations: z.string().trim().max(4000, 'As observações devem ter até 4.000 caracteres.'),
    interestedPersonId: z.string().optional(),
    creditorPersonId: z.string().optional(),
    assigneeId: z.string().optional(),
    amount: z.string().optional(),
    dueAt: z.string().optional(),
});
type ProtocolFormData = z.infer<typeof protocolSchema>;

export function NewProtocol() {
    const navigate = useNavigate();
    const ctx = useSession();
    const queryClient = useQueryClient();
    const { data: db, isLoading } = useDb();
    const [personDialog, setPersonDialog] = useState<'interestedPersonId' | 'creditorPersonId' | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState('');
    const [useSuggestedFlow, setUseSuggestedFlow] = useState(true);
    const [openedAt] = useState(() => new Date().toISOString());
    const form = useForm<ProtocolFormData>({
        resolver: zodResolver(protocolSchema),
        defaultValues: {
            typeId: '',
            subject: '',
            description: '',
            observations: '',
            interestedPersonId: '',
            creditorPersonId: '',
            assigneeId: '',
            amount: '',
            dueAt: '',
        },
    });
    const typeId = form.watch('typeId');
    const type = db?.protocolTypes.find((item) => item.id === typeId);
    const create = useMutation({
        mutationFn: (data: ProtocolFormData & { subject: string }) => api.createProtocol(ctx, {
            ...data,
            files,
            useSuggestedFlow: flowMode === 'SUGGESTED' ? useSuggestedFlow && flowReady : undefined,
            amountCents: data.amount ? Math.round(Number(data.amount.replace(',', '.')) * 100) : undefined,
            dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : undefined,
        }),
        onSuccess: (protocol) => {
            invalidateAll(queryClient);
            navigateWithLoading(navigate, '/processos/' + protocol.id);
        },
    });

    const selectType = (nextTypeId: string) => {
        form.setValue('typeId', nextTypeId, { shouldValidate: true });
        setUseSuggestedFlow(true);
        const nextType = db?.protocolTypes.find((item) => item.id === nextTypeId);
        if (!nextType) return;
        const nextFields = nextType.fieldsConfig;
        if (!nextFields.interested.enabled) form.setValue('interestedPersonId', '');
        if (!nextFields.creditor.enabled) form.setValue('creditorPersonId', '');
        if (!nextFields.amount.enabled) form.setValue('amount', '');
        if (!nextFields.responsavel?.enabled) form.setValue('assigneeId', '');
        if (nextFields.assunto?.enabled === false) form.setValue('subject', '');
        if (!nextFields.arquivos?.enabled) setFiles((current) => current.length ? [] : current);
        form.setValue('dueAt', nextType.defaultDeadlineDays ? suggestedDeadline(nextType.defaultDeadlineDays) : '');
        form.clearErrors();
        setFileError('');
    };

    if (isLoading || !db || !ctx.user)
        return <Loading variant="detail"/>;
    const activeMembership = findActiveMembershipForUnit(db, ctx.userId, ctx.activeUnitId);
    if (!activeMembership)
        return <><PageTitle title="Abrir processo"/><ErrorBox error={new Error('Para abrir processo, selecione uma unidade com vínculo ativo.')}/></>;
    if (activeMembership.role === 'LEITOR')
        return <><PageTitle title="Abrir processo"/><ErrorBox error={new Error('Seu vínculo com a unidade selecionada permite somente leitura.')}/></>;

    const people = db.people.filter((person) => person.active);
    const fields = type?.fieldsConfig;
    const hasInterested = Boolean(fields?.interested.enabled);
    const hasCreditor = Boolean(fields?.creditor.enabled);
    const hasAmount = Boolean(fields?.amount.enabled);
    const hasResponsible = Boolean(fields?.responsavel?.enabled);
    const hasSubject = type ? fields?.assunto?.enabled !== false : false;
    const hasFiles = Boolean(fields?.arquivos?.enabled);
    const hasPortal = Boolean(fields?.portal?.enabled);
    const showPeople = hasInterested || hasCreditor || hasResponsible;
    const responsibleRequired = Boolean(fields?.responsavel?.enabled && fields.responsavel.required !== false);
    const responsibleUsers = db.users.filter((user) =>
        user.active && canReceiveWorkInUnit(db, user.id, ctx.activeUnitId),
    );
    const flowMode = type?.flowMode ?? (type?.flowId ? 'REQUIRED' : 'NONE');
    const configuredFlow = type?.flowId ? db.flows.find((flow) => flow.id === type.flowId && flow.active) : undefined;
    const configuredStages = configuredFlow
        ? db.flowPhases.filter((stage) => stage.flowId === configuredFlow.id).sort((left, right) => left.position - right.position)
        : [];
    const flowReady = Boolean(configuredFlow && configuredStages.length && configuredStages.every((stage) => db.phases.some((phase) => phase.id === stage.phaseId && phase.active)));
    const requiredFlowReady = flowMode !== 'REQUIRED' || flowReady;

    const submit = (data: ProtocolFormData) => {
        if (!type) return;
        let invalid = false;
        form.clearErrors();
        setFileError('');
        const requireValue = (field: 'interestedPersonId' | 'creditorPersonId' | 'assigneeId' | 'amount', required: boolean, message: string) => {
            if (required && !String(data[field] ?? '').trim()) {
                form.setError(field, { type: 'required', message });
                invalid = true;
            }
        };
        requireValue('interestedPersonId', Boolean(fields?.interested.required), 'Selecione o interessado.');
        requireValue('creditorPersonId', Boolean(fields?.creditor.required), 'Selecione o credor.');
        requireValue('assigneeId', responsibleRequired, 'Selecione o responsável.');
        requireValue('amount', Boolean(fields?.amount.required), 'Informe o valor.');
        if (hasSubject && !data.subject.trim()) {
            form.setError('subject', { type: 'required', message: 'Informe o assunto.' });
            invalid = true;
        }
        if (data.amount && (!Number.isFinite(Number(data.amount.replace(',', '.'))) || Number(data.amount.replace(',', '.')) < 0)) {
            form.setError('amount', { type: 'validate', message: 'Informe um valor válido.' });
            invalid = true;
        }
        if (fields?.arquivos?.required && files.length === 0) {
            setFileError('Anexe ao menos um arquivo.');
            invalid = true;
        }
        if (invalid) return;
        create.mutate({ ...data, subject: hasSubject ? data.subject.trim() : type.name });
    };

    return <>
      <div className="no-print mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Abrir processo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Preencha os dados conforme o tipo selecionado.</p>
        </div>
        <Link className="btn-secondary icon-button" to="/processos" aria-label="Voltar à lista de processos"><ArrowLeft size={17}/></Link>
      </div>
      <form onSubmit={form.handleSubmit(submit)} className="mx-auto max-w-7xl space-y-5">
        <section className="panel p-5">
          <h2 className="label mb-4">IDENTIFICAÇÃO</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo de processo *" error={form.formState.errors.typeId?.message}>
              <Select className="field" {...form.register('typeId')} value={typeId} onChange={(event) => selectType(event.target.value)}>
                <option value="">Selecione o tipo</option>
                {db.protocolTypes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Data/hora">
              <Input className="field bg-muted/40" value={dateTime(openedAt)} readOnly/>
            </Field>
          </div>
          {!type && <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Selecione o tipo de processo para ver os campos disponíveis.</p>}
        </section>

        {type && <>
          {flowMode !== 'NONE' && <section className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="label flex items-center gap-2"><GitBranch size={15}/>FLUXO DO PROCESSO</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {flowMode === 'REQUIRED'
                    ? 'As fases abaixo são obrigatórias e serão seguidas na ordem configurada.'
                    : 'Este tipo possui um fluxo sugerido. Você pode aplicá-lo ou abrir o processo sem fases.'}
                </p>
              </div>
              {flowMode === 'REQUIRED'
                ? <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Obrigatório</span>
                : <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-semibold">
                    <Switch aria-label="Aplicar fluxo sugerido" checked={useSuggestedFlow && flowReady} disabled={!flowReady} onCheckedChange={setUseSuggestedFlow}/>
                    Aplicar fluxo sugerido
                  </label>}
            </div>
            {flowReady
              ? <ol className="mt-4 flex flex-wrap gap-2" aria-label="Fases configuradas">
                  {configuredStages.map((stage, index) => {
                    const configuredPhase = db.phases.find((phase) => phase.id === stage.phaseId);
                    return <li key={stage.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                      <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                      <span className="font-semibold">{configuredPhase?.name}</span>
                      {stage.destinationUnitId && <span className="text-xs text-muted-foreground">→ {db.units.find((unit) => unit.id === stage.destinationUnitId)?.name}</span>}
                    </li>;
                  })}
                </ol>
              : <p className={'mt-4 rounded-lg border px-3 py-3 text-sm ' + (flowMode === 'REQUIRED' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border bg-muted/40 text-muted-foreground')}>
                  {flowMode === 'REQUIRED'
                    ? 'Configure ao menos uma fase ativa neste tipo antes de abrir processos.'
                    : 'Nenhuma fase sugerida está disponível. O processo será aberto sem fluxo.'}
                </p>}
          </section>}
          {showPeople && <section className="panel p-5">
            <h2 className="label mb-4">INTERESSADOS</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {hasInterested && <PersonSelect
                label={'Interessado' + (fields?.interested.required ? ' *' : '')}
                field="interestedPersonId"
                people={people}
                form={form}
                error={form.formState.errors.interestedPersonId?.message}
                onNew={() => setPersonDialog('interestedPersonId')}
              />}
              {hasCreditor && <PersonSelect
                label={'Credor' + (fields?.creditor.required ? ' *' : '')}
                field="creditorPersonId"
                people={people}
                form={form}
                error={form.formState.errors.creditorPersonId?.message}
                onNew={() => setPersonDialog('creditorPersonId')}
              />}
              {hasResponsible && <Field label={'Responsável' + (responsibleRequired ? ' *' : '')} error={form.formState.errors.assigneeId?.message}>
                <Select className="field" {...form.register('assigneeId')} value={form.watch('assigneeId') ?? ''} onChange={(event) => form.setValue('assigneeId', event.target.value, { shouldValidate: true })}>
                  <option value="">Selecione o responsável</option>
                  {responsibleUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </Select>
              </Field>}
            </div>
          </section>}

          <section className="panel p-5">
            <h2 className="label mb-4">DETALHES</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {hasSubject && <Field label="Assunto *" error={form.formState.errors.subject?.message}>
                <Input className="field" maxLength={160} placeholder="Informe um assunto" {...form.register('subject')}/>
              </Field>}
              {hasAmount && <Field label={'Valor (R$)' + (fields?.amount.required ? ' *' : '')} error={form.formState.errors.amount?.message}>
                <Input className="field tabular-nums" inputMode="decimal" placeholder="0,00" {...form.register('amount')}/>
              </Field>}
              {type.defaultDeadlineDays && <Field label="Prazo">
                <Input type="datetime-local" className="field" {...form.register('dueAt')}/>
              </Field>}
            </div>
            <div className="mt-4">
              <Field label="Descrição *" error={form.formState.errors.description?.message}>
                <textarea className="field min-h-28" maxLength={4000} placeholder="Informe uma descrição para este processo" {...form.register('description')}/>
              </Field>
              <p className="mt-1 text-xs text-muted-foreground">Caracteres restantes: {4000 - form.watch('description').length}</p>
            </div>
            <div className="mt-4">
              <Field label="Observações" error={form.formState.errors.observations?.message}>
                <textarea className="field min-h-20" maxLength={4000} {...form.register('observations')}/>
              </Field>
            </div>
            {hasFiles && <div className="mt-4">
              <Field label={'Arquivos' + (fields?.arquivos?.required ? ' *' : '')} error={fileError}>
                <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                  <Paperclip size={16}/>
                  <span>{files.length ? files.map((file) => file.name).join(', ') : 'Selecione até 5 arquivos'}</span>
                  <input className="sr-only" type="file" multiple accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => { setFiles(Array.from(event.currentTarget.files ?? []).slice(0, 5)); setFileError(''); }}/>
                </label>
              </Field>
            </div>}
            {hasPortal && <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Este tipo permite acompanhamento pelo portal do cidadão.</p>}
          </section>
        </>}

        {create.error && <ErrorBox error={create.error}/>}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Link className="btn-secondary" to="/processos">Cancelar</Link>
          <button className="btn-primary" disabled={!type || !requiredFlowReady || create.isPending}>{create.isPending ? 'Abrindo…' : 'Abrir processo'}</button>
        </div>
      </form>
      {personDialog && <PersonQuickDialog onClose={() => setPersonDialog(null)} onCreated={(person) => { form.setValue(personDialog, person.id); setPersonDialog(null); }}/>}
    </>;
}

function PersonSelect({ label, field, people, form, error, onNew }: {
    label: string;
    field: 'interestedPersonId' | 'creditorPersonId';
    people: Database['people'];
    form: ReturnType<typeof useForm<ProtocolFormData>>;
    error?: string;
    onNew: () => void;
}) {
    const role = field === 'interestedPersonId' ? 'INTERESSADO' : 'CREDOR';
    return <Field label={label} error={error}>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Select aria-label={label} className="field min-w-0" {...form.register(field)} value={form.watch(field) ?? ''} onChange={(event) => form.setValue(field, event.target.value, { shouldValidate: true })}>
          <option value="">Selecione</option>
          {people.filter((person) => person.roles.includes(role)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </Select>
        <button type="button" className="btn-secondary min-h-10 shrink-0" onClick={onNew}><Plus size={15}/><span>Cadastrar</span></button>
      </div>
    </Field>;
}
function PersonQuickDialog({ onClose, onCreated }: {
    onClose: () => void;
    onCreated: (person: Database['people'][number]) => void;
}) { const ctx = useSession(); const queryClient = useQueryClient(); const [name, setName] = useState(''); const [kind, setKind] = useState<'PF' | 'PJ'>('PF'); const [interested, setInterested] = useState(true); const [creditor, setCreditor] = useState(false); const create = useMutation({ mutationFn: () => api.createPerson(ctx, { name, kind, roles: [interested && 'INTERESSADO', creditor && 'CREDOR'].filter(Boolean) as ('INTERESSADO' | 'CREDOR')[], active: true }), onSuccess: (p) => { invalidateAll(queryClient); onCreated(p); } }); return <Dialog title="Cadastrar pessoa" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4"><Field label="Tipo"><Select className="field" value={kind} onChange={(e) => setKind(e.target.value as 'PF' | 'PJ')}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></Select></Field><Field label={kind === 'PF' ? 'Nome completo *' : 'Razão social *'}><Input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)}/></Field><div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><Checkbox checked={interested} onChange={(e) => setInterested(e.target.checked)}/> Interessado</label><label className="flex items-center gap-2"><Checkbox checked={creditor} onChange={(e) => setCreditor(e.target.checked)}/> Credor</label></div>{create.error && <ErrorBox error={create.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={create.isPending}>Salvar pessoa</button></div></form></Dialog>; }
export function ProtocolDetail() {
    const ctx = useSession();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id = '' } = useParams();
    const [tab, setTab] = useState<'progress' | 'data' | 'documents' | 'attachments' | 'audit'>('progress');
    const [action, setAction] = useState<'forward' | 'assign' | 'complete' | 'archive' | 'reopen' | 'advance-phase' | 'return-phase' | null>(null);
    const [coverError, setCoverError] = useState<unknown>();
    const [printing, setPrinting] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmAcknowledge, setConfirmAcknowledge] = useState(false);
    const [dossierMovementId, setDossierMovementId] = useState<string>();
    const [pdfBusy, setPdfBusy] = useState(false);
    const [timelineUploading, setTimelineUploading] = useState(false);
    const [timelineMovementId, setTimelineMovementId] = useState<string>();
    const timelineFileInput = useRef<HTMLInputElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const { data, isLoading, error } = useQuery({ queryKey: ['protocol', id, ctx.userId, ctx.activeUnitId], queryFn: () => api.getProtocol(ctx, id) });
    const refresh = () => invalidateAll(queryClient);
    const doAcknowledge = useMutation({ mutationFn: () => api.acknowledge(ctx, id, data!.protocol.version), onSuccess: refresh });
    const doAssume = useMutation({ mutationFn: () => api.assume(ctx, id, data!.protocol.version), onSuccess: refresh });
    useEffect(() => {
        if (!actionsOpen) return;
        const close = (event: MouseEvent) => { if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActionsOpen(false); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
    }, [actionsOpen]);
    if (isLoading) return <Loading variant="detail"/>;
    if (error) return <><PageTitle title="Registro não encontrado"/><ErrorBox error={error}/><Link className="btn-secondary mt-4" to="/processos">Voltar à listagem</Link></>;
    if (!data) return null;
    const { protocol: p, assignment, db } = data;
    const movementEvents = data.events.filter(isMovementEvent);
    const flowPhaseByEventId = mapFlowPhasesToEvents(p, movementEvents);
    const latestMovement = movementEvents[0];
    const attachmentIds = new Set(data.attachments.map((item) => item.id));
    const documentIds = new Set(data.documents.map((item) => item.id));
    const auditEvents = db.auditEvents.filter((item) =>
        (item.targetType === 'PROTOCOL' && item.targetId === p.id) ||
        (item.targetType === 'ATTACHMENT' && attachmentIds.has(item.targetId)) ||
        (item.targetType === 'DOCUMENT' && documentIds.has(item.targetId)),
    );
    const contextRole = roleForContext(db, ctx);
    const canAct = canActProtocol(db, p, ctx);
    const canManage = canAct && contextRole === 'ADMIN';
    const canEdit = canManage && isActive(p);
    const canAssume = p.currentUnitId === ctx.activeUnitId && !p.currentAssigneeId && contextRole !== 'LEITOR';
    const isHistoricalReadOnly = p.currentUnitId !== ctx.activeUnitId;
    const processUnit = db.units.find((unit) => unit.id === p.currentUnitId);
    const processUnitMembership = findActiveMembershipForUnit(db, ctx.userId, p.currentUnitId);
    const canSwitchToProcessUnit = isHistoricalReadOnly && Boolean(processUnit?.active && processUnitMembership && processUnitMembership.role !== 'LEITOR');
    const canDelete = canManage && p.status === 'CADASTRADO';
    const phases = p.flowSnapshot?.phases.slice().sort((a, b) => a.position - b.position) ?? [];
    const phase = phases.find((item) => item.phaseId === p.currentPhaseId);
    const phaseIndex = phase ? phases.indexOf(phase) : -1;
    const isLastPhase = phaseIndex >= 0 && phaseIndex === phases.length - 1;
    const flowMode = p.flowModeSnapshot ?? (p.flowSnapshot ? 'REQUIRED' : 'NONE');
    const flowLabel = flowMode === 'REQUIRED' ? 'Obrigatório' : flowMode === 'SUGGESTED' ? (p.flowSnapshot ? 'Sugerido aplicado' : 'Sugerido não aplicado') : 'Sem fluxo';
    const unacknowledged = !!p.currentAssigneeId && !assignment.receivedAt;
    const switchToProcessUnit = async () => {
        ctx.setActiveUnitId(p.currentUnitId);
        ctx.setScopeUnitId(p.currentUnitId);
        await invalidateAll(queryClient);
    };
    let primary: ReactNode = null;
    if (p.status === 'CONCLUIDO') primary = canAct && <button className="btn-primary" onClick={() => setAction('archive')}><Archive size={16}/>Arquivar</button>;
    else if (p.status === 'ARQUIVADO') primary = canManage && <button className="btn-primary" onClick={() => setAction('reopen')}><RefreshCcw size={16}/>Reabrir</button>;
    else if (canAssume) primary = <button className="btn-primary" onClick={() => doAssume.mutate()} disabled={doAssume.isPending}><Check size={16}/>Assumir e dar ciência</button>;
    else if (canAct && !unacknowledged) primary = <button className="btn-primary" onClick={() => setAction('forward')}><ArrowRight size={16}/>Tramitar</button>;
    const printActions = [
        ['cover', 'Imprimir capa'],
        ['receipt', 'Imprimir comprovante'],
        ['label', 'Imprimir etiqueta'],
        ['details', 'Imprimir detalhamento'],
    ] as const;
    const printProcess = async (printAction: typeof printActions[number][0]) => {
        setActionsOpen(false); setCoverError(undefined); setPrinting(true);
        try {
            const pdf = await import('../relatorios/reportPdf');
            if (printAction === 'cover') await pdf.downloadCover(db, p);
            if (printAction === 'receipt') await pdf.downloadProtocolReceipt(db, p);
            if (printAction === 'label') await pdf.downloadProcessLabel(db, p);
            if (printAction === 'details') await pdf.downloadProcessDetails(db, p);
        }
        catch (error) { setCoverError(error); }
        finally { setPrinting(false); }
    };
    const generateMovementReceipt = async (event: ProtocolEvent) => {
        setCoverError(undefined); setPdfBusy(true);
        try { const { downloadMovementReceipt } = await import('../relatorios/reportPdf'); await downloadMovementReceipt(db, p, event); }
        catch (error) { setCoverError(error); }
        finally { setPdfBusy(false); }
    };
    const generateDossier = async () => {
        setCoverError(undefined); setPdfBusy(true);
        try {
            const pdf = await import('../relatorios/reportPdf');
            const dossier = await pdf.buildDossier(db, p);
            if (isActive(p)) {
                const file = new File([dossier.blob], dossier.filename, { type: 'application/pdf' });
                await api.addAttachments(ctx, p.id, p.version, [file], dossierMovementId ?? latestMovement?.id);
            }
            pdf.savePdfBlob(dossier.blob, dossier.filename);
            setDossierMovementId(undefined);
            if (isActive(p)) refresh();
        } catch (error) { setCoverError(error); }
        finally { setPdfBusy(false); }
    };
    const attachTimelineFiles = async (files: File[]) => {
        if (!files.length) return;
        setCoverError(undefined); setTimelineUploading(true);
        try { await api.addAttachments(ctx, p.id, p.version, files, timelineMovementId ?? latestMovement?.id); refresh(); }
        catch (error) { setCoverError(error); }
        finally { setTimelineUploading(false); setTimelineMovementId(undefined); }
    };
    const tabs: Array<[typeof tab, string, ReactNode]> = [['progress', 'Andamento', <ClipboardList size={15}/>], ['data', 'Resumo', <FileText size={15}/>], ['attachments', 'Anexos', <Paperclip size={15}/>], ['documents', 'Documentos', <FilePlus2 size={15}/>], ['audit', 'Auditoria', <CheckCircle2 size={15}/>]];
    return <>{!isHistoricalReadOnly && <input ref={timelineFileInput} className="hidden" type="file" multiple accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); void attachTimelineFiles(files); event.currentTarget.value = ''; }}/>}<div className="print-shell"><PageTitle eyebrow={`Processos / ${p.number}`} title={`Processo ${p.number}`} action={<div className="no-print flex flex-wrap items-center justify-end gap-2">{primary}{canAct && isActive(p) && assignment.receivedAt && phase && !isLastPhase && <button className="btn-secondary" onClick={() => setAction('advance-phase')}><ArrowRight size={16}/>Avançar fase</button>}{canAct && isActive(p) && assignment.receivedAt && phaseIndex > 0 && <button className="btn-secondary" onClick={() => setAction('return-phase')}><RefreshCcw size={16}/>Devolver fase</button>}{canAct && isActive(p) && assignment.receivedAt && (isLastPhase || phases.length === 0) && <button className="btn-secondary" onClick={() => setAction('complete')}><Check size={16}/>Concluir</button>}{!isHistoricalReadOnly && <div className="relative" ref={actionsRef}><button type="button" className="btn-secondary" aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((value) => !value)}>Ações<ChevronDown size={16}/></button>{actionsOpen && <div role="menu" className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover py-2 shadow-xl"><p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Gerenciar</p><button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45" disabled={!canEdit} title={!isActive(p) ? 'Processos concluídos ou arquivados não podem ser editados.' : !canManage ? 'Somente administradores na unidade atual podem editar.' : undefined} onClick={() => { setActionsOpen(false); setEditing(true); }}><Pencil size={16}/>Editar</button><button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45" disabled={!canDelete} title={!canDelete ? 'A exclusão é permitida apenas para processos cadastrados, por administrador da unidade atual.' : undefined} onClick={() => { setActionsOpen(false); setDeleting(true); }}><Trash2 size={16}/>Excluir</button><div className="my-2 border-t border-border"/><p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Impressão</p>{printActions.map(([printAction, label]) => <button key={printAction} role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" disabled={printing} onClick={() => void printProcess(printAction)}><Printer size={16}/>{label}</button>)}</div>}</div>}<button type="button" className="btn-secondary icon-button" aria-label="Voltar à listagem" onClick={() => navigate('/processos')}><ArrowLeft size={17}/></button></div>}/>{coverError ? <ErrorBox error={coverError}/> : null}{printing && <p role="status" className="mb-4 text-sm text-muted-foreground">Gerando PDF do processo…</p>}{isHistoricalReadOnly && (canSwitchToProcessUnit ? <div role="status" className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Building2 className="mt-0.5 shrink-0 text-primary" size={17}/><div><strong>Troque a unidade para continuar</strong><p className="mt-0.5 text-muted-foreground">Este processo está na unidade <strong className="text-foreground">{processUnit?.name}</strong>. Você possui acesso a ela; altere o contexto para liberar as ações.</p></div></div><button type="button" className="btn-primary w-full shrink-0 justify-center sm:w-auto" onClick={() => void switchToProcessUnit()}>Alterar para {processUnit?.name}<ArrowRight size={16}/></button></div> : <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm"><LockKeyhole className="mt-0.5 shrink-0 text-muted-foreground" size={17}/><div><strong>Somente leitura</strong><p className="mt-0.5 text-muted-foreground">Este processo está em outra unidade. Como você já participou dele, a consulta permanece disponível, sem ações de alteração.</p></div></div>)}<h2 className="sr-only">{p.subject}</h2><p className="-mt-4 mb-4 text-sm text-muted-foreground">{p.subject}</p><div className="mb-4 flex flex-wrap items-center gap-2"><DetailChip label="Tipo" value={db.protocolTypes.find((item) => item.id === p.typeId)?.name}/><DetailChip label="Fluxo" value={flowLabel}/><DetailChip label="Unidade atual" value={processUnit?.name}/><DetailChip label="Está com" value={p.currentAssigneeId ? <Name db={db} userId={p.currentAssigneeId}/> : processUnit?.name}/>{phase && <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold"><span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">{phase.position + 1}</span>{phase.name}</span>}</div><div className="no-print flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/60 p-1">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'}`}>{Icon}{label}{key === 'progress' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{movementEvents.length}</span>}{key === 'attachments' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{data.attachments.length}</span>}{key === 'documents' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{data.documents.length}</span>}{key === 'audit' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{data.events.length + auditEvents.length}</span>}</button>)}</div>{tab === 'progress' && <section className="timeline-panel panel mt-3 overflow-hidden"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-bold"><ClipboardList size={17}/>Movimentações <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{movementEvents.length}</span></h2></header><div className="px-3 py-3 sm:px-5">{movementEvents.map((event, index) => <TimelineRow key={event.id} event={event} flowPhase={flowPhaseByEventId.get(event.id)} db={db} protocol={p} assignment={assignment} attachments={data.attachments.filter((item) => item.movementEventId === event.id)} documents={data.documents.filter((item) => item.movementEventId === event.id)} isLast={index === movementEvents.length - 1} isLatest={index === 0} latestEventId={latestMovement?.id} canAcknowledge={unacknowledged && p.currentAssigneeId === ctx.userId} canAssign={canManage} canEdit={canAct && isActive(p) && !timelineUploading} readOnly={isHistoricalReadOnly} onConfirmAcknowledge={() => setConfirmAcknowledge(true)} onAssign={() => setAction('assign')} onAttachFile={() => { setTimelineMovementId(event.id); timelineFileInput.current?.click(); }} onReceipt={(movement) => void generateMovementReceipt(movement)} onDossier={() => setDossierMovementId(event.id)}/>)}</div></section>}{tab === 'data' && <ProcessSummary protocol={p} db={db} phaseName={phase?.name} latestMovement={latestMovement}/>}{tab === 'documents' && <DocumentsInProtocol documents={data.documents} protocol={p} canAct={canAct}/>} {tab === 'attachments' && <Attachments attachments={data.attachments} protocol={p} canAct={canAct} readOnly={isHistoricalReadOnly} onChanged={refresh}/>} {tab === 'audit' && <AuditTimeline events={data.events} auditEvents={auditEvents} db={db}/>}</div>{action === 'forward' && <MoveDialog title="Tramitar processo" protocol={p} db={db} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'assign' && <AssignDialog protocol={p} db={db} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'advance-phase' && phase && <PhaseActionDialog protocol={p} phase={phase} attachments={data.attachments} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'return-phase' && phase && <PhaseActionDialog protocol={p} phase={phase} attachments={data.attachments} ctx={ctx} returnPhase onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'complete' && <CompleteDialog protocol={p} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'archive' && <ConfirmDialog title="Arquivar processo" body="O processo concluído deixará as filas de trabalho. Você poderá reabri-lo como administrador." confirm="Arquivar" onClose={() => setAction(null)} onConfirm={async () => { await api.archive(ctx, p.id, p.version); setAction(null); refresh(); }}/>} {action === 'reopen' && <MoveDialog title="Reabrir processo" protocol={p} db={db} ctx={ctx} reopen onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {editing && canEdit && <EditProtocolDialog protocol={p} ctx={ctx} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }}/>} {deleting && <ConfirmDialog title="Excluir processo" body="Esta ação exclui o processo e seus documentos, anexos e movimentações. Ela não pode ser desfeita." confirm="Excluir processo" danger onClose={() => setDeleting(false)} onConfirm={async () => { await api.deleteProtocol(ctx, p.id, p.version); navigate('/processos'); }}/>} {confirmAcknowledge && <ConfirmDialog title="Confirmar visualização da tramitação?" body="Ao confirmar, a ciência desta tramitação será registrada em seu nome e o botão ficará inativo." confirm="Confirmar ciência" onClose={() => setConfirmAcknowledge(false)} onConfirm={async () => { await doAcknowledge.mutateAsync(); setConfirmAcknowledge(false); }}/>} {dossierMovementId && <ConfirmDialog title="Gerar dossiê do processo?" body={isActive(p) ? "Será montado um PDF único com o resumo do processo, as movimentações e os anexos em PDF. O documento ficará salvo nos anexos desta movimentação." : `Será montado um PDF único com o resumo do processo, as movimentações e os anexos em PDF. O arquivo será baixado sem alterar o processo ${p.status === 'ARQUIVADO' ? 'arquivado' : 'concluído'}.`} confirm={pdfBusy ? "Gerando…" : "Gerar dossiê"} onClose={() => setDossierMovementId(undefined)} onConfirm={generateDossier}/>} </>;
}
function DetailChip({ label, value }: { label: string; value?: ReactNode }) { return <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground"><span>{label}:</span><strong className="truncate text-foreground">{value ?? '—'}</strong></span>; }
function AuditTimeline({ events, auditEvents, db }: { events: ProtocolEvent[]; auditEvents: AuditEvent[]; db: Database }) {
    const labels: Record<string, string> = { ATTACHMENT_ADDED: 'Arquivo anexado', DOCUMENT_CREATED: 'Documento anexado' };
    const entries = [
        ...events.map((event) => ({ id: event.id, label: eventLabel[event.kind], details: event.message, actorUserId: event.actorUserId, createdAt: event.createdAt })),
        ...auditEvents.map((event) => ({ id: event.id, label: labels[event.action] ?? event.action, details: event.details, actorUserId: event.actorUserId, createdAt: event.createdAt })),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return <section className="panel mt-3 divide-y divide-border"><header className="px-4 py-3"><h2 className="text-sm font-bold">Auditoria</h2></header>{entries.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><div><strong>{entry.label}</strong>{entry.details && <p className="mt-0.5 text-xs text-muted-foreground">{entry.details}</p>}<p className="mt-1 text-xs text-muted-foreground"><Name db={db} userId={entry.actorUserId}/></p></div><time className="shrink-0 text-xs text-muted-foreground">{dateTime(entry.createdAt)}</time></div>)}</section>;
}
function ProcessSummary({ protocol, db, phaseName, latestMovement }: { protocol: Protocol; db: Database; phaseName?: string; latestMovement?: ProtocolEvent }) {
    const elapsedDays = latestMovement ? Math.max(0, Math.floor((Date.now() - new Date(latestMovement.createdAt).getTime()) / 86_400_000)) : undefined;
    const interested = db.people.find((item) => item.id === protocol.interestedPersonId)?.name;
    const creditor = db.people.find((item) => item.id === protocol.creditorPersonId)?.name;
    const type = db.protocolTypes.find((item) => item.id === protocol.typeId)?.name;
    const originUnit = db.units.find((item) => item.id === protocol.originUnitId)?.name;
    const routingOrigin = db.units.find((item) => item.id === (latestMovement?.fromUnitId ?? latestMovement?.actorUnitId))?.name;
    return <section className="panel mt-3 overflow-hidden">
      <SummarySection title="Informações do processo">
        <SummaryField label="Tipo de processo" value={type}/>
        <SummaryField label="Assunto" value={protocol.subject}/>
        <SummaryField label="Responsável" value={protocol.currentAssigneeId ? <Name db={db} userId={protocol.currentAssigneeId}/> : 'Sem responsável'}/>
        <SummaryField label="Credor" value={creditor}/>
        <SummaryField label="Interessado" value={interested}/>
        <SummaryField label="Origem" value={originUnit}/>
        <SummaryField label="Aberto por" value={<Name db={db} userId={protocol.createdById}/>}/>
        <SummaryField label="Data de abertura" value={dateTime(protocol.createdAt)}/>
        {protocol.amountCents !== undefined && <SummaryField label="Valor" value={money(protocol.amountCents)}/>}
        <SummaryField className="sm:col-span-3" label="Descrição" value={protocol.description}/>
        {protocol.observations && <SummaryField className="sm:col-span-3" label="Observações" value={protocol.observations}/>}
      </SummarySection>
      <SummarySection title="Situação atual" divided>
        <SummaryField label="Situação" value={currentProtocolSituation(db, protocol)?.name ?? statusLabel[protocol.status]}/>
        <SummaryField label="Fase" value={phaseName}/>
        <SummaryField label="Unidade organizacional" value={<UnitName db={db} unitId={protocol.currentUnitId}/>}/>
        <SummaryField label="Responsável atual" value={protocol.currentAssigneeId ? <Name db={db} userId={protocol.currentAssigneeId}/> : 'Sem responsável'}/>
        <SummaryField label="Última movimentação" value={dateTime(latestMovement?.createdAt)}/>
        <SummaryField label="Tempo na etapa" value={elapsedDays === undefined ? undefined : `${elapsedDays} dia${elapsedDays === 1 ? '' : 's'}`}/>
        <SummaryField label="Origem da tramitação" value={routingOrigin}/>
        <SummaryField className="sm:col-span-2" label="Descrição da movimentação" value={latestMovement?.message || (latestMovement ? eventLabel[latestMovement.kind] : undefined)}/>
      </SummarySection>
    </section>;
}
function SummarySection({ title, divided, children }: { title: string; divided?: boolean; children: ReactNode }) {
    return <section className={divided ? 'border-t border-border' : ''}><h2 className="border-b border-border px-4 py-3 text-sm font-bold sm:px-5">{title}</h2><dl className="grid gap-x-8 px-4 py-1 sm:grid-cols-3 sm:px-5">{children}</dl></section>;
}
function SummaryField({ label, value, className = '' }: { label: string; value?: ReactNode; className?: string }) {
    return <div className={`min-w-0 border-b border-border/70 py-3 ${className}`}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{value ?? '—'}</dd></div>;
}

function EditProtocolDialog({ protocol, ctx, onClose, onSaved }: { protocol: Protocol; ctx: ReturnType<typeof useSession>; onClose: () => void; onSaved: () => void }) { const [subject, setSubject] = useState(protocol.subject); const [description, setDescription] = useState(protocol.description); const [dueAt, setDueAt] = useState(protocol.dueAt ? protocol.dueAt.slice(0, 16) : ''); const update = useMutation({ mutationFn: () => api.updateProtocol(ctx, protocol.id, protocol.version, { subject, description, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }), onSuccess: onSaved }); return <Dialog title="Editar processo" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}><Field label="Assunto *"><Input className="field" maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} /></Field><Field label="Descrição *"><textarea className="field min-h-28" maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} /></Field><Field label="Prazo"><Input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>{update.error && <ErrorBox error={update.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={update.isPending}>Salvar</button></div></form></Dialog>; }
function TimelineDate({ value }: {
    value: string;
}) {
    const date = new Date(value);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return <time dateTime={value} className="hidden w-16 shrink-0 text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:block"><strong className="block font-semibold text-slate-700 dark:text-slate-200">{isToday ? 'Hoje' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</strong><span>{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></time>;
}
type FlowPhaseSnapshot = NonNullable<Protocol['flowSnapshot']>['phases'][number];

function mapFlowPhasesToEvents(protocol: Protocol, events: ProtocolEvent[]) {
    const phases = protocol.flowSnapshot?.phases.slice().sort((left, right) => left.position - right.position) ?? [];
    const result = new Map<string, FlowPhaseSnapshot>();
    if (!phases.length) return result;

    let phaseIndex = 0;
    const orderedEvents = events.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    orderedEvents.forEach((event) => {
        if (event.kind !== 'ABERTURA' && event.kind !== 'FASE_AVANCADA' && event.kind !== 'FASE_DEVOLVIDA') return;

        const explicitIndex = event.phaseId ? phases.findIndex((phase) => phase.phaseId === event.phaseId) : -1;
        if (explicitIndex >= 0) phaseIndex = explicitIndex;
        else if (event.kind === 'ABERTURA') phaseIndex = 0;
        else if (event.kind === 'FASE_AVANCADA') phaseIndex = Math.min(phaseIndex + 1, phases.length - 1);
        else phaseIndex = Math.max(phaseIndex - 1, 0);

        result.set(event.id, phases[phaseIndex]);
    });
    return result;
}

function TimelineRow({ event: e, flowPhase, db, protocol, assignment, attachments, documents, isLast, isLatest, latestEventId, canAcknowledge, canAssign, canEdit, readOnly, onConfirmAcknowledge, onAssign, onAttachFile, onReceipt, onDossier }: {
    event: ProtocolEvent;
    flowPhase?: FlowPhaseSnapshot;
    db: Database;
    protocol: Protocol;
    assignment: Database['assignments'][number];
    attachments: Attachment[];
    documents: AppDocument[];
    isLast: boolean;
    isLatest: boolean;
    latestEventId?: string;
    canAcknowledge: boolean;
    canAssign: boolean;
    canEdit: boolean;
    readOnly: boolean;
    onConfirmAcknowledge: () => void;
    onAssign: () => void;
    onAttachFile: () => void;
    onReceipt: (event: ProtocolEvent) => void;
    onDossier: () => void;
}) {
    const [collapsed, setCollapsed] = useState(!isLatest);
    useEffect(() => { setCollapsed(!isLatest); }, [isLatest, latestEventId]);
    const heading = flowPhase ? `Fase ${flowPhase.name}` : e.kind === 'ABERTURA' ? 'Abertura do processo' : eventLabel[e.kind];
    const statusKey = flowPhase?.situation ?? e.nextStatus ?? (e.kind === 'ABERTURA' ? 'CADASTRADO' : e.kind === 'TRAMITACAO' || e.kind === 'REABERTURA' || e.kind === 'FASE_AVANCADA' || e.kind === 'FASE_DEVOLVIDA' ? 'EM_ANDAMENTO' : e.kind === 'CONCLUSAO' ? 'CONCLUIDO' : e.kind === 'ARQUIVAMENTO' ? 'ARQUIVADO' : e.kind === 'RECEBIMENTO' ? 'CIENCIA' : 'REGISTRO');
    const status = flowPhase?.situationType?.name ?? (statusKey in statusLabel ? statusLabel[statusKey as ProtocolStatus] : statusKey === 'CIENCIA' ? 'Ciência registrada' : eventLabel[e.kind]);
    const phaseColor = flowPhase?.situationType?.color;
    const statusTone: Record<string, { badge: string; dot: string }> = {
        CADASTRADO: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200', dot: 'bg-amber-500 ring-amber-100 dark:ring-amber-950' },
        EM_ANDAMENTO: { badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200', dot: 'bg-orange-500 ring-orange-100 dark:ring-orange-950' },
        CONCLUIDO: { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', dot: 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-950' },
        ARQUIVADO: { badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200', dot: 'bg-violet-500 ring-violet-100 dark:ring-violet-950' },
        CIENCIA: { badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', dot: 'bg-sky-500 ring-sky-100 dark:ring-sky-950' },
        REGISTRO: { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', dot: 'bg-slate-500 ring-slate-100 dark:ring-slate-800' },
    };
    const badgeClass = phaseColor ? 'border font-semibold' : statusTone[statusKey].badge;
    const dotClass = phaseColor ? '' : statusTone[statusKey].dot;
    const sourceUserId = e.fromUserId ?? e.actorUserId;
    const destinationUnit = e.toUnitId ? db.units.find((unit) => unit.id === e.toUnitId) : undefined;
    const destinationIsUnit = !e.toUserId && Boolean(destinationUnit);
    const destination = e.toUserId ? <Name db={db} userId={e.toUserId}/> : destinationUnit?.name;
    const contentId = `timeline-content-${e.id}`;
    const canShowRoute = Boolean(e.fromUnitId || e.toUnitId || e.toUserId) && e.kind !== 'RECEBIMENTO';
    const acknowledged = Boolean(assignment.receivedAt);
    return <article className="relative flex gap-3 pb-2 last:pb-0 sm:gap-4">
      <TimelineDate value={e.createdAt}/>
      <div data-timeline-dot className={`relative z-10 mt-3.5 hidden h-3 w-3 shrink-0 rounded-full ${phaseColor ? '' : 'ring-4'} sm:block ${dotClass}`} style={phaseColor ? { backgroundColor: phaseColor, boxShadow: `0 0 0 4px ${phaseColor}22` } : undefined}/>
      {!isLast && <span data-timeline-line className="absolute left-[5.375rem] top-7 hidden h-[calc(100%-0.5rem)] w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden="true"/>}
      <section className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={!collapsed} aria-controls={contentId} aria-label={`${collapsed ? 'Expandir' : 'Recolher'} conteúdo de ${heading}`} onClick={() => setCollapsed((value) => !value)}>
            <span className="flex min-w-0 flex-wrap items-center gap-2">{flowPhase ? <><strong className="text-sm text-slate-800 dark:text-slate-100">Fase</strong><ChevronRight aria-hidden="true" className="text-slate-400" size={13}/><strong className="text-sm text-slate-800 dark:text-slate-100">{flowPhase.name}</strong><ChevronRight aria-hidden="true" className="text-slate-400" size={13}/></> : <strong className="text-sm text-slate-800 dark:text-slate-100">{heading}</strong>}<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`} style={phaseColor ? { backgroundColor: `${phaseColor}18`, borderColor: `${phaseColor}55`, color: phaseColor } : undefined}>{status}</span></span>
          </button>
          {!readOnly && isLatest && isActive(protocol) && protocol.currentAssigneeId && <span role="group" aria-label="Ciência e responsável" className="timeline-inline-actions">
            <button type="button" className={`timeline-icon-action ${acknowledged ? 'timeline-icon-action--done' : canAcknowledge ? 'timeline-icon-action--pulse' : ''}`} aria-label={acknowledged ? 'Ciência registrada' : 'Dar ciência da tramitação'} disabled={acknowledged || !canAcknowledge} title={acknowledged ? `Visualizado em ${dateTime(assignment.receivedAt)}` : canAcknowledge ? 'Confirmar visualização e registrar ciência' : 'Aguardando ciência do destinatário'} onClick={onConfirmAcknowledge}><CheckCheck size={15}/></button>
            <button type="button" className="timeline-icon-action" aria-label="Escolher outro responsável" disabled={!canAssign} title={canAssign ? 'Designar outro responsável desta unidade' : 'Somente administradores da unidade podem alterar o responsável'} onClick={onAssign}><UserRoundCog size={15}/></button>
          </span>}
          <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-muted dark:text-slate-400" aria-label={`Alternar conteúdo de ${heading}`} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronDown size={17}/> : <ChevronUp size={17}/>}</button>
        </div>
        {!collapsed && <div id={contentId} className="border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-200"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-public-50 text-public-700 dark:bg-slate-800 dark:text-public-300"><UserRound size={15}/></span><span className="truncate"><Name db={db} userId={sourceUserId}/></span></span>
              {canShowRoute && destination && <><ArrowRight className="shrink-0 text-slate-400" size={16}/><span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-200"><span aria-label={destinationIsUnit ? 'Unidade de destino' : 'Usuário de destino'} className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">{destinationIsUnit ? <Building2 size={15}/> : <UserRound size={15}/>}</span><span className="truncate">{destination}</span></span></>}
            </div>
            <time dateTime={e.createdAt} className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">{dateTime(e.createdAt)}</time>
          </div>
          <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800"><p className="label">{e.kind === 'ABERTURA' ? 'Aberto por' : e.kind === 'TRAMITACAO' || e.kind === 'REABERTURA' ? 'Despacho' : 'Registro'}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{e.message || (e.kind === 'ABERTURA' ? `Processo cadastrado por ${db.users.find((user) => user.id === e.actorUserId)?.name ?? 'usuário responsável'}.` : `Evento registrado por ${db.users.find((user) => user.id === e.actorUserId)?.name ?? 'usuário responsável'}.`)}</p></div>
          {e.checklist?.length ? <ChecklistTimeline answers={e.checklist}/> : null}
          {(attachments.length > 0 || documents.length > 0) && <MovementFiles attachments={attachments} documents={documents} db={db}/>}
          <footer className="timeline-card-footer">
            {!readOnly && <div className="timeline-card-actions">
              {canEdit && isLatest ? <Link className="timeline-action-button" to={`/documentos/novo?protocolId=${protocol.id}&movementEventId=${e.id}`}><FilePlus2 size={14}/>Anexar documento</Link> : <button type="button" className="timeline-action-button" disabled><FilePlus2 size={14}/>Anexar documento</button>}
              <button type="button" className="timeline-action-button" disabled={!canEdit || !isLatest} onClick={onAttachFile}><Paperclip size={14}/>Anexar arquivo</button>
              <button type="button" className="timeline-action-button" onClick={() => onReceipt(e)}><Printer size={14}/>Comprovante</button>
              {isLatest && isActive(protocol) && <button type="button" className="timeline-action-button" onClick={onDossier}><FileArchive size={14}/>Dossiê</button>}
            </div>}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Clock3 size={13}/>Registro em {dateTime(e.createdAt)}</span>
          </footer>
        </div>}
      </section>
    </article>;
}
function MovementFiles({ attachments, documents, db }: { attachments: Attachment[]; documents: AppDocument[]; db: Database }) {
    const [documentPreview, setDocumentPreview] = useState<AppDocument>();
    const [attachmentPreview, setAttachmentPreview] = useState<Attachment>();
    return <><section className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">
      <p className="label flex items-center gap-1.5"><Paperclip size={13}/>Anexos e documentos</p>
      <div className="mt-2 divide-y divide-border/70">
        {documents.map((document) => <button type="button" key={document.id} aria-label={`Visualizar documento ${document.number}`} onClick={() => setDocumentPreview(document)} className="group flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={16}/></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{document.number} — {document.subject}</strong><small className="mt-0.5 block text-xs text-muted-foreground">Criado por <Name db={db} userId={document.authorUserId}/> em {dateTime(document.createdAt)}</small></span>
          <Eye aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground opacity-60 transition group-hover:text-primary group-hover:opacity-100" size={16}/>
        </button>)}
        {attachments.map((attachment) => <button type="button" key={attachment.id} aria-label={`Visualizar anexo ${attachment.filename}`} onClick={() => setAttachmentPreview(attachment)} className="group flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">{attachment.filename.toLowerCase().startsWith('dossie_') ? <FileArchive size={16}/> : <Paperclip size={16}/>}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{attachment.filename}</strong><small className="mt-0.5 block text-xs text-muted-foreground">Anexado por <Name db={db} userId={attachment.uploadedById}/> em {dateTime(attachment.createdAt)} · {Math.ceil(attachment.sizeBytes / 1024)} KB</small></span>
          <Eye aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground opacity-60 transition group-hover:text-primary group-hover:opacity-100" size={16}/>
        </button>)}
      </div>
    </section>{documentPreview && <DocumentPreviewDialog document={documentPreview} db={db} onClose={() => setDocumentPreview(undefined)}/>} {attachmentPreview && <AttachmentPreviewDialog attachment={attachmentPreview} onClose={() => setAttachmentPreview(undefined)}/>}</>;
}

function DocumentPreviewDialog({ document, db, onClose }: {
    document: AppDocument;
    db: Database;
    onClose: () => void;
}) {
    const type = db.documentTypes.find((item) => item.id === document.typeId)?.name;
    const recipient = document.recipientPersonId ? db.people.find((person) => person.id === document.recipientPersonId)?.name : undefined;
    return <Dialog title={`Visualizar documento — ${document.number}`} onClose={onClose} wide>
      <article className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-5 sm:p-7">
        <header className="border-b border-border pb-4">
          <p className="font-mono text-xs text-muted-foreground">{document.number}</p>
          <h3 className="mt-2 text-xl font-bold">{document.subject}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{type} · {dateOnly(document.createdAt)}{recipient && <> · Destinatário: {recipient}</>}</p>
        </header>
        <div className="whitespace-pre-wrap py-6 text-[15px] leading-7">{document.body}</div>
      </article>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>
        <Link className="btn-primary" to={`/documentos/${document.id}`}><FileText size={16}/>Abrir documento</Link>
      </div>
    </Dialog>;
}

function ChecklistTimeline({ answers }: { answers: Array<{ questionId: string; text: string; checked: boolean; date?: string; observation?: string }> }) {
    const completed = answers.filter((answer) => answer.checked).length;
    return <section className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800"><div className="flex items-center justify-between gap-3"><p className="label flex items-center gap-1.5"><ClipboardList size={13}/>Check-list da etapa</p><span className="text-xs font-semibold text-muted-foreground">{completed}/{answers.length}</span></div><div className="mt-2 h-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"><div className="h-full bg-amber-500" style={{ width: `${answers.length ? (completed / answers.length) * 100 : 0}%` }}/></div><ul className="mt-2.5 space-y-1.5">{answers.map((answer) => <li key={answer.questionId} className="flex items-center gap-2 text-xs"><span className={`grid size-4 shrink-0 place-items-center rounded border ${answer.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-amber-500/70 text-amber-600 dark:border-amber-400/70 dark:text-amber-300'}`}>{answer.checked && <Check size={11}/>}</span><span className={answer.checked ? 'font-medium text-slate-700 dark:text-slate-200' : 'font-medium text-slate-600 dark:text-slate-300'}>{answer.text}</span><span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">{answer.date && <><CalendarClock size={12}/><span>{dateOnly(answer.date)}</span></>}{answer.observation && <span className="rounded bg-muted px-1.5 py-0.5">Observação</span>}{answer.checked && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Concluído</span>}</span></li>)}</ul></section>;
}
function MoveDialog({ title, protocol, db, ctx, reopen, onClose, onSaved }: {
    title: string;
    protocol: Protocol;
    db: Database;
    ctx: ReturnType<typeof useSession>;
    reopen?: boolean;
    onClose: () => void;
    onSaved: () => void;
}) { const [unitId, setUnitId] = useState(protocol.currentUnitId); const [assigneeId, setAssigneeId] = useState(''); const [message, setMessage] = useState(''); const [dueAt, setDueAt] = useState(''); const mutation = useMutation({ mutationFn: () => reopen ? api.reopen(ctx, protocol.id, protocol.version, { unitId, assigneeId: assigneeId || undefined, message, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }) : api.forward(ctx, protocol.id, protocol.version, { unitId, assigneeId: assigneeId || undefined, message, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }), onSuccess: onSaved }); const users = db.users.filter((user) => user.active && canReceiveWorkInUnit(db, user.id, unitId)); return <Dialog title={title} onClose={onClose}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><Field label="Unidade destino *"><Select className="field" value={unitId} onChange={(e) => { setUnitId(e.target.value); setAssigneeId(''); }}>{sortUnitsByPath(db.units.filter((unit) => unit.active)).map((unit) => <option key={unit.id} value={unit.id}>{unitPath(db.units, unit.id)}</option>)}</Select></Field><Field label="Destinatário"><Select className="field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Enviar para fila sem responsável</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field><Field label={reopen ? 'Motivo da reabertura *' : 'Despacho *'}><textarea className="field min-h-28" maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)}/></Field><Field label="Prazo"><Input className="field" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}/></Field>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>{reopen ? 'Reabrir' : 'Tramitar'}</button></div></form></Dialog>; }
function PhaseActionDialog({ protocol, phase, attachments, ctx, returnPhase, onClose, onSaved }: {
    protocol: Protocol;
    phase: NonNullable<Protocol['flowSnapshot']>['phases'][number];
    attachments: Attachment[];
    ctx: ReturnType<typeof useSession>;
    returnPhase?: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const questions = phase.checklistQuestions?.length ? phase.checklistQuestions : phase.checklistItems.map((text, order) => ({ id: `legacy-${order}`, text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }));
    const [answers, setAnswers] = useState(() => questions.map((question) => ({ questionId: question.id, text: question.text, checked: false, date: '', observation: '' })));
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState<unknown>();
    const [currentVersion, setCurrentVersion] = useState(protocol.version);
    const input = useRef<HTMLInputElement>(null);
    const hasAttachmentRequirement = Boolean(phase.requiresAttachment || phase.requiredAttachmentTypes.length || questions.some((question) => question.requiresAttachment));
    const attachmentTypeNames: Record<string, string> = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'text/plain': 'TXT' };
    const requiredTypeNames = phase.requiredAttachmentTypes.map((type) => attachmentTypeNames[type] ?? type);
    const acceptedTypes = phase.requiredAttachmentTypes.length ? phase.requiredAttachmentTypes.join(',') : 'application/pdf,image/png,image/jpeg,text/plain';
    const mutation = useMutation({
        mutationFn: async () => {
            if (returnPhase)
                return api.returnPhase(ctx, protocol.id, currentVersion, message);
            let expectedVersion = currentVersion;
            if (files.length) {
                await api.addAttachments(ctx, protocol.id, expectedVersion, files);
                expectedVersion += 1;
                setCurrentVersion(expectedVersion);
                setFiles([]);
            }
            return api.advancePhase(ctx, protocol.id, expectedVersion, answers, message);
        },
        onSuccess: onSaved,
    });
    const updateAnswer = (questionId: string, patch: Partial<typeof answers[number]>) => setAnswers((current) => current.map((answer) => answer.questionId === questionId ? { ...answer, ...patch } : answer));
    const selectFiles = (selected: File[]) => {
        setFileError(undefined);
        if (selected.length > 5) {
            setFileError(new Error('Selecione no máximo 5 arquivos.'));
            return;
        }
        const invalid = selected.find((file) => !['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type) || file.size > 5 * 1024 * 1024);
        if (invalid) {
            setFileError(new Error('Envie PDF, PNG, JPEG ou TXT de até 5 MB.'));
            return;
        }
        if (phase.requiredAttachmentTypes.length && selected.some((file) => !phase.requiredAttachmentTypes.includes(file.type))) {
            setFileError(new Error(`Selecione somente os tipos exigidos: ${requiredTypeNames.join(', ')}.`));
            return;
        }
        setFiles(selected);
    };
    return <Dialog title={returnPhase ? `Devolver fase: ${phase.name}` : `Avançar fase: ${phase.name}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        {returnPhase ? <Field label="Motivo da devolução *"><textarea className="field min-h-28" maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} /></Field> : <>
          <p className="text-sm text-slate-600 dark:text-slate-300">Conclua os requisitos da fase antes de avançar.</p>
          {questions.length > 0 && <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Checklist — {phase.name}</legend><div className="divide-y">{questions.map((question) => { const answer = answers.find((item) => item.questionId === question.id)!; return <div key={question.id} className="py-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox aria-label={question.text} checked={answer.checked} onChange={(event) => updateAnswer(question.id, { checked: event.target.checked })}/><span>{question.text}{question.required && <span className="ml-1 text-public-700">*</span>}</span></label>{answer.checked && <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">{question.requiresDate && <Input className="field" type="date" value={answer.date} onChange={(event) => updateAnswer(question.id, { date: event.target.value })}/>} {question.requiresObservation && <Input className="field" placeholder="Observação" value={answer.observation} onChange={(event) => updateAnswer(question.id, { observation: event.target.value })}/>} {question.requiresAttachment && <span className="text-xs text-amber-700 dark:text-amber-300">Anexe o arquivo obrigatório abaixo.</span>}</div>}</div> })}</div></fieldset>}
          {hasAttachmentRequirement && <fieldset className="rounded-lg border border-dashed border-primary/35 bg-primary/5 p-4"><legend className="px-1 text-sm font-semibold">Anexo obrigatório</legend><input ref={input} className="sr-only" type="file" multiple accept={acceptedTypes} aria-label="Selecionar anexos obrigatórios" disabled={mutation.isPending} onChange={(event) => { selectFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }}/><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Inclua o arquivo sem sair desta etapa.</p><p className="mt-1 text-xs text-muted-foreground">{requiredTypeNames.length ? `Tipos exigidos: ${requiredTypeNames.join(', ')}.` : 'PDF, PNG, JPEG ou TXT.'} Até 5 arquivos de 5 MB cada.</p>{attachments.length > 0 && <p className="mt-1 text-xs text-muted-foreground">O processo já possui {attachments.length} anexo(s).</p>}</div><button type="button" className="btn-secondary shrink-0" disabled={mutation.isPending} onClick={() => input.current?.click()}><Paperclip size={16}/>Selecionar arquivos</button></div>{files.length > 0 && <div className="mt-3 divide-y rounded-lg border bg-card">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 px-3 py-2"><FileText className="shrink-0 text-primary" size={17}/><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{file.name}</strong><small className="text-xs text-muted-foreground">{Math.max(1, Math.ceil(file.size / 1024))} KB</small></span><button type="button" className="btn-secondary !p-2 text-destructive" aria-label={`Remover ${file.name}`} disabled={mutation.isPending} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><Trash2 size={15}/></button></div>)}</div>}<p className="mt-2 text-xs text-muted-foreground">Os arquivos serão anexados ao confirmar o avanço da fase.</p></fieldset>}
          <Field label="Observação"><textarea className="field min-h-24" maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
        </>}
        {Boolean(fileError) && <ErrorBox error={fileError} />}
        {mutation.error && <ErrorBox error={mutation.error} />}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? (files.length ? 'Anexando e avançando…' : 'Aguarde…') : (returnPhase ? 'Devolver fase' : 'Avançar fase')}</button></div>
      </form>
    </Dialog>;
}function CompleteDialog({ protocol, ctx, onClose, onSaved }: {
    protocol: Protocol;
    ctx: ReturnType<typeof useSession>;
    onClose: () => void;
    onSaved: () => void;
}) { const [message, setMessage] = useState(''); const mutation = useMutation({ mutationFn: () => api.complete(ctx, protocol.id, protocol.version, message), onSuccess: onSaved }); return <Dialog title="Concluir processo" onClose={onClose}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><Field label="Resultado da conclusão *"><textarea className="field min-h-28" value={message} onChange={(e) => setMessage(e.target.value)}/></Field>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary">Concluir</button></div></form></Dialog>; }
function ConfirmDialog({ title, body, confirm: label, danger, onClose, onConfirm }: {
    title: string;
    body: string;
    confirm: string;
    danger?: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}) { const [error, setError] = useState<unknown>(); const [pending, setPending] = useState(false); return <Dialog title={title} onClose={onClose}><p className="text-sm text-slate-600 dark:text-slate-300">{body}</p>{Boolean(error) && <div className="mt-3"><ErrorBox error={error}/></div>}<div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className={danger ? "btn-primary bg-destructive hover:bg-destructive/90" : "btn-primary"} disabled={pending} onClick={async () => { setPending(true); try {
    await onConfirm();
}
catch (e) {
    setError(e);
    setPending(false);
} }}>{pending ? 'Aguarde…' : label}</button></div></Dialog>; }
function DocumentsInProtocol({ documents, protocol, canAct }: {
    documents: AppDocument[];
    protocol: Protocol;
    canAct: boolean;
}) { return <section className="mt-4"><div className="mb-3 flex justify-end">{canAct && isActive(protocol) && <Link to={`/documentos/novo?protocolId=${protocol.id}`} className="btn-primary"><FilePlus2 size={16}/>Redigir documento</Link>}</div>{documents.length ? <div className="panel divide-y">{documents.map((d) => <Link className="flex items-center justify-between px-5 py-4 hover:bg-slate-50" to={`/documentos/${d.id}`} key={d.id}><span><strong className="block text-sm">{d.subject}</strong><small className="font-mono text-xs text-slate-500 dark:text-slate-400">{d.number}</small></span><ChevronRight size={18}/></Link>)}</div> : <Empty title="Sem documentos vinculados" detail="Nenhum documento foi redigido neste processo."/>}</section>; }
function AttachmentPreviewDialog({ attachment, onClose }: {
    attachment: Attachment;
    onClose: () => void;
}) {
    const kind = api.attachmentPreviewKind(attachment.mimeType);
    const [url, setUrl] = useState<string>();
    const [text, setText] = useState<string>();
    const [error, setError] = useState<unknown>();
    useEffect(() => {
        let alive = true;
        let temporaryUrl: string | undefined;
        setUrl(undefined);
        setText(undefined);
        setError(undefined);
        void api.getBlob(attachment.blobKey).then(async (blob) => {
            if (!blob)
                throw new Error('Arquivo não encontrado no armazenamento local.');
            if (kind === 'text') {
                const content = await blob.text();
                if (alive)
                    setText(content);
                return;
            }
            if (!kind)
                throw new Error('Este tipo de arquivo não pode ser visualizado.');
            temporaryUrl = URL.createObjectURL(blob);
            if (alive)
                setUrl(temporaryUrl);
        }).catch((reason: unknown) => { if (alive)
            setError(reason); });
        return () => { alive = false; if (temporaryUrl)
            URL.revokeObjectURL(temporaryUrl); };
    }, [attachment.blobKey, kind]);
    return <Dialog title={attachment.filename} onClose={onClose} wide>{error ? <ErrorBox error={error}/> : <>{!url && text === undefined && <Loading />}{kind === 'text' && text !== undefined && <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 font-mono text-sm text-slate-100">{text}</pre>}{kind === 'image' && url && <img className="mx-auto max-h-[65vh] rounded-md object-contain" src={url} alt={`Pré-visualização de ${attachment.filename}`}/>} {kind === 'pdf' && url && <iframe className="h-[65vh] w-full rounded-md border" src={url} title={`Pré-visualização de ${attachment.filename}`}/>}</>}</Dialog>;
}
function Attachments({ attachments, protocol, canAct, readOnly, onChanged }: {
    attachments: Attachment[];
    protocol: Protocol;
    canAct: boolean;
    readOnly: boolean;
    onChanged: () => void;
}) {
    const ctx = useSession();
    const [error, setError] = useState<unknown>();
    const [preview, setPreview] = useState<Attachment>();
    const input = useRef<HTMLInputElement>(null);
    const add = useMutation({ mutationFn: (files: File[]) => api.addAttachments(ctx, protocol.id, protocol.version, files), onSuccess: onChanged, onError: setError });
    const download = async (attachment: Attachment) => {
        const blob = await api.getBlob(attachment.blobKey);
        if (!blob) {
            setError(new Error('Arquivo não encontrado no armazenamento local.'));
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.filename;
        link.click();
        URL.revokeObjectURL(url);
    };
    return <><section className="mt-4"><div className="mb-3 flex justify-end">{canAct && isActive(protocol) && <><Input ref={input} className="hidden" type="file" multiple accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => { const files = Array.from(event.target.files ?? []); setError(undefined); if (files.length > 5)
        setError(new Error('O limite é de 5 arquivos por operação.'));
    else if (files.length)
        add.mutate(files); event.currentTarget.value = ''; }}/><button className="btn-primary" disabled={add.isPending} onClick={() => input.current?.click()}><Paperclip size={16}/>{add.isPending ? 'Anexando…' : 'Anexar arquivos'}</button></>}</div>{Boolean(error) && <div className="mb-3"><ErrorBox error={error}/></div>}{attachments.length ? <div className="panel divide-y">{attachments.map((attachment) => <div className="flex items-center justify-between gap-3 px-5 py-4" key={attachment.id}><span className="min-w-0"><strong className="block truncate text-sm">{attachment.filename}</strong><small className="text-slate-500 dark:text-slate-400">{Math.ceil(attachment.sizeBytes / 1024)} KB · {dateTime(attachment.createdAt)}</small></span><span className="flex shrink-0 gap-2"><button className="btn-secondary" onClick={() => setPreview(attachment)}>Visualizar</button>{!readOnly && <button className="btn-secondary" onClick={() => download(attachment)}>Baixar</button>}</span></div>)}</div> : <Empty title="Sem anexos" detail="Adicione até cinco arquivos PDF, PNG, JPEG ou TXT de até 5 MB cada."/>}</section>{preview && <AttachmentPreviewDialog attachment={preview} onClose={() => setPreview(undefined)}/>}</>;
}
function AssignDialog({ protocol, db, ctx, onClose, onSaved }: {
    protocol: Protocol;
    db: Database;
    ctx: ReturnType<typeof useSession>;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [assigneeId, setAssigneeId] = useState(protocol.currentAssigneeId ?? '');
    const mutation = useMutation({ mutationFn: () => api.assign(ctx, protocol.id, protocol.version, assigneeId), onSuccess: onSaved });
    const users = db.users.filter((user) => user.active && canReceiveWorkInUnit(db, user.id, protocol.currentUnitId));
    return <Dialog title="Designar responsável" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><p className="text-sm text-slate-600 dark:text-slate-300">A designação encerra o ciclo atual e exige nova ciência do responsável escolhido.</p><Field label="Responsável *"><Select className="field" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Selecione</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !assigneeId}>{mutation.isPending ? 'Designando…' : 'Designar'}</button></div></form></Dialog>;
}
