import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, ClipboardList, Clock3, FilePlus2, FileText, Paperclip, Pencil, Plus, Printer, RefreshCcw, Search, Trash2, UserRound } from 'lucide-react';
import type { AppDocument, Attachment, Database, Protocol, ProtocolEvent, ProtocolStatus } from '../../domain/model';
import { eventLabel, isActive, statusLabel } from '../../domain/model';
import { dateOnly, dateTime, money } from '../../lib/format';
import { api, suggestedDeadline, type ProtocolFilters } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { navigateWithLoading } from '../../app/routeLoading';
import { Dialog, PrintPreviewDialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';
import { Name, ProtocolTable, UnitName } from './ProtocolTable';
export function Protocols() {
    const navigate = useNavigate();
    const ctx = useSession();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const filters: ProtocolFilters = { tab: (params.get('tab') as ProtocolFilters['tab']) || 'mine', search: params.get('search') || '', shortcut: (params.get('shortcut') as ProtocolFilters['shortcut']) || '', status: (params.get('status') as ProtocolStatus) || '', typeId: params.get('typeId') || '', unitId: params.get('unitId') || '', assigneeId: params.get('assigneeId') || '', createdFrom: params.get('createdFrom') || '', createdTo: params.get('createdTo') || '', sort: (params.get('sort') as ProtocolFilters['sort']) || 'updated-desc', page: Number(params.get('page') || 1), pageSize: Number(params.get('pageSize') || 10) };
    const { data, isLoading, error } = useQuery({ queryKey: ['protocols', ctx.userId, ctx.activeUnitId, location.search], queryFn: () => api.listProtocols(ctx, filters) });
    const { data: db } = useDb();
    const set = (patch: Record<string, string>) => { const q = new URLSearchParams(location.search); Object.entries(patch).forEach(([key, value]) => value ? q.set(key, value) : q.delete(key)); if (!('page' in patch))
        q.set('page', '1'); navigateWithLoading(navigate, `/protocolos?${q.toString()}`); };
    if (isLoading || !db)
        return <Loading variant="list"/>;
    if (error)
        return <ErrorBox error={error}/>;
    const tabs = [['mine', 'Para mim'], ['unit', 'Minha unidade'], ['created', 'Criados por mim'], ['all', 'Todos']] as const;
    return <><PageTitle title="Protocolos" action={<Link to="/protocolos/novo" className="btn-primary"><Plus size={16}/>Novo protocolo</Link>}/><div className="no-print mb-4 flex gap-2 overflow-x-auto border-b">{tabs.map(([id, label]) => <button key={id} onClick={() => set({ tab: id, shortcut: '' })} className={`border-b-2 px-3 py-2 text-sm font-semibold ${filters.tab === id ? 'border-public-700 text-public-700' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>{label}</button>)}</div><div className="no-print panel mb-4 p-3"><div className="flex flex-col gap-2 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={17}/><Input className="field !mt-0 pl-9" placeholder="Buscar número, assunto ou interessado" value={filters.search} onChange={(event) => set({ search: event.target.value })}/></label><Select className="field !mt-0 lg:w-44" value={filters.status} onChange={(event) => set({ status: event.target.value })}><option value="">Todos os status</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select><Select className="field !mt-0 lg:w-52" value={filters.typeId} onChange={(event) => set({ typeId: event.target.value })}><option value="">Todos os tipos</option>{db.protocolTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></div><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><Select className="field !mt-0" value={filters.unitId} onChange={(event) => set({ unitId: event.target.value })}><option value="">Todas as unidades</option>{db.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select><Select className="field !mt-0" value={filters.assigneeId} onChange={(event) => set({ assigneeId: event.target.value })}><option value="">Todos os responsáveis</option>{db.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select><Input className="field !mt-0" type="date" aria-label="Abertos a partir de" value={filters.createdFrom} onChange={(event) => set({ createdFrom: event.target.value })}/><Input className="field !mt-0" type="date" aria-label="Abertos até" value={filters.createdTo} onChange={(event) => set({ createdTo: event.target.value })}/><Select className="field !mt-0" value={filters.sort} onChange={(event) => set({ sort: event.target.value })}><option value="updated-desc">Atualização mais recente</option><option value="created-desc">Abertura mais recente</option><option value="due-asc">Prazo mais próximo</option><option value="number-asc">Número crescente</option></Select></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2">{[['', 'Todos'], ['unassigned', 'Sem responsável'], ['unacknowledged', 'Sem ciência'], ['overdue', 'Vencidos'], ['soon', 'Vencem em 24h']].map(([id, label]) => <button key={id} onClick={() => set({ shortcut: id })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${filters.shortcut === id ? 'border-public-700 bg-public-50 text-public-800' : 'text-slate-600 dark:text-slate-300'}`}>{label}</button>)}</div><label className="text-sm text-slate-600 dark:text-slate-300">Por página <Select className="ml-1 rounded border px-2 py-1" value={filters.pageSize} onChange={(event) => set({ pageSize: event.target.value })}><option value="10">10</option><option value="20">20</option></Select></label></div></div>{data!.items.length ? <div className="panel overflow-hidden"><ProtocolTable db={db} protocols={data!.items}/><Pagination page={data!.page} total={data!.total} size={data!.pageSize} onPage={(page) => set({ page: String(page) })}/></div> : <Empty title="Nenhum protocolo encontrado" detail="Ajuste os filtros ou abra um novo protocolo." action={<Link className="btn-primary" to="/protocolos/novo">Abrir protocolo</Link>}/>}</>;
}
function Pagination({ page, total, size, onPage }: {
    page: number;
    total: number;
    size: number;
    onPage: (page: number) => void;
}) { const pages = Math.max(1, Math.ceil(total / size)); return <div className="flex items-center justify-between border-t px-3 py-3 text-sm"><span className="text-slate-500 dark:text-slate-400">{total} registro{total === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><span>{page} / {pages}</span><button className="btn-secondary !py-1" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button></div></div>; }
const protocolSchema = z.object({ typeId: z.string().min(1, 'Selecione o tipo.'), subject: z.string().trim().min(1, 'Informe o assunto.').max(160), description: z.string().trim().min(1, 'Informe a descrição.').max(4000), interestedPersonId: z.string().optional(), creditorPersonId: z.string().optional(), amount: z.string().optional(), dueAt: z.string().optional() });
type ProtocolFormData = z.infer<typeof protocolSchema>;
export function NewProtocol() {
    const navigate = useNavigate();
    const ctx = useSession();
    const queryClient = useQueryClient();
    const { data: db, isLoading } = useDb();
    const [personDialog, setPersonDialog] = useState<'interestedPersonId' | 'creditorPersonId' | null>(null);
    const form = useForm<ProtocolFormData>({ resolver: zodResolver(protocolSchema), defaultValues: { typeId: '', subject: '', description: '', amount: '', dueAt: '' } });
    const typeId = form.watch('typeId');
    const type = db?.protocolTypes.find((item) => item.id === typeId);
    const create = useMutation({ mutationFn: (data: ProtocolFormData) => api.createProtocol(ctx, { ...data, amountCents: data.amount ? Math.round(Number(data.amount.replace(',', '.')) * 100) : undefined, dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : undefined }), onSuccess: (protocol) => { invalidateAll(queryClient); navigateWithLoading(navigate, `/protocolos/${protocol.id}`); } });
    useEffect(() => { if (type?.defaultDeadlineDays && !form.getValues('dueAt'))
        form.setValue('dueAt', suggestedDeadline(type.defaultDeadlineDays)); }, [type, form]);
    if (isLoading || !db)
        return <Loading variant="detail"/>;
    const userUnit = db.units.find((unit) => unit.id === ctx.user?.unitId);
    if (ctx.activeUnitId !== ctx.user?.unitId)
        return <><PageTitle title="Abrir protocolo"/><ErrorBox error={new Error('Para abrir protocolo, selecione sua unidade de vínculo.')}/></>;
    const people = db.people.filter((person) => person.active);
    const hasInterested = Boolean(type?.fieldsConfig.interested.enabled);
    const hasCreditor = Boolean(type?.fieldsConfig.creditor.enabled);
    const hasAmount = Boolean(type?.fieldsConfig.amount.enabled);
    const hasInvolved = hasInterested || hasCreditor;
    return <><PageTitle eyebrow="NOVO REGISTRO" title="Abrir protocolo"/><form onSubmit={form.handleSubmit((data) => create.mutate(data))} className="mx-auto max-w-7xl space-y-5"><section className="panel p-5"><h2 className="mb-4 text-xl font-bold">Dados do protocolo</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Tipo de protocolo *" error={form.formState.errors.typeId?.message}><Select className="field" {...form.register('typeId')} value={form.watch('typeId')} onChange={(event) => form.setValue('typeId', event.target.value, { shouldValidate: true })}><option value="">Selecione</option>{db.protocolTypes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Unidade de origem"><Input className="field bg-slate-50" value={`${userUnit?.name} (${userUnit?.abbreviation})`} readOnly/></Field><Field label="Assunto *" error={form.formState.errors.subject?.message}><Input className="field" maxLength={160} {...form.register('subject')}/></Field><Field label="Prazo"><Input type="datetime-local" className="field" {...form.register('dueAt')}/></Field></div><Field label="Descrição *" error={form.formState.errors.description?.message}><textarea className="field min-h-36" maxLength={4000} {...form.register('description')}/></Field></section>{type && (hasInvolved || hasAmount) && <section className="panel p-5"><header className="mb-5"><h2 className="text-xl font-bold">Envolvidos e valor</h2><p className="mt-1 text-pretty text-sm text-slate-500 dark:text-slate-400">Os campos abaixo seguem a configuração de {type.name}.</p></header><div className={`grid gap-4 ${hasInvolved && hasAmount ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.65fr)]' : ''}`}>{hasInvolved && <fieldset className="min-w-0 rounded-md border bg-slate-50/60 p-4 dark:bg-slate-950/30"><legend className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">Envolvidos</legend><div className={hasInterested && hasCreditor ? 'grid gap-4 md:grid-cols-2' : 'max-w-xl'}>{hasInterested && <PersonSelect label={`Interessado${type.fieldsConfig.interested.required ? ' *' : ''}`} field="interestedPersonId" people={people} form={form} onNew={() => setPersonDialog('interestedPersonId')}/>} {hasCreditor && <PersonSelect label={`Credor${type.fieldsConfig.creditor.required ? ' *' : ''}`} field="creditorPersonId" people={people} form={form} onNew={() => setPersonDialog('creditorPersonId')}/>}</div></fieldset>}{hasAmount && <fieldset className="min-w-0 rounded-md border bg-slate-50/60 p-4 dark:bg-slate-950/30"><legend className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">Valor</legend><Field label={`Valor (R$)${type.fieldsConfig.amount.required ? ' *' : ''}`}><Input className="field tabular-nums" inputMode="decimal" placeholder="0,00" {...form.register('amount')}/></Field></fieldset>}</div></section>}{create.error && <ErrorBox error={create.error}/>}<div className="flex justify-end gap-2"><Link className="btn-secondary" to="/protocolos">Cancelar</Link><button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Abrindo…' : 'Abrir protocolo'}</button></div></form>{personDialog && <PersonQuickDialog onClose={() => setPersonDialog(null)} onCreated={(person) => { form.setValue(personDialog, person.id); setPersonDialog(null); }}/>}</>;
}
function PersonSelect({ label, field, people, form, onNew }: {
    label: string;
    field: 'interestedPersonId' | 'creditorPersonId';
    people: Database['people'];
    form: ReturnType<typeof useForm<ProtocolFormData>>;
    onNew: () => void;
}) {
    const role = field === 'interestedPersonId' ? 'INTERESSADO' : 'CREDOR';
    return <Field label={label}><div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><Select className="field min-w-0" {...form.register(field)} value={form.watch(field) ?? ''} onChange={(event) => form.setValue(field, event.target.value, { shouldValidate: true })}><option value="">Selecione</option>{people.filter((person) => person.roles.includes(role)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select><button type="button" className="btn-secondary min-h-10 shrink-0" onClick={onNew}><Plus size={15}/><span>Cadastrar</span></button></div></Field>;
}
function PersonQuickDialog({ onClose, onCreated }: {
    onClose: () => void;
    onCreated: (person: Database['people'][number]) => void;
}) { const ctx = useSession(); const queryClient = useQueryClient(); const [name, setName] = useState(''); const [kind, setKind] = useState<'PF' | 'PJ'>('PF'); const [interested, setInterested] = useState(true); const [creditor, setCreditor] = useState(false); const create = useMutation({ mutationFn: () => api.createPerson(ctx, { name, kind, roles: [interested && 'INTERESSADO', creditor && 'CREDOR'].filter(Boolean) as ('INTERESSADO' | 'CREDOR')[], active: true }), onSuccess: (p) => { invalidateAll(queryClient); onCreated(p); } }); return <Dialog title="Cadastrar pessoa" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4"><Field label="Tipo"><Select className="field" value={kind} onChange={(e) => setKind(e.target.value as 'PF' | 'PJ')}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></Select></Field><Field label={kind === 'PF' ? 'Nome completo *' : 'Razão social *'}><Input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)}/></Field><div className="flex gap-4 text-sm"><label><Checkbox checked={interested} onChange={(e) => setInterested(e.target.checked)}/> Interessado</label><label><Checkbox checked={creditor} onChange={(e) => setCreditor(e.target.checked)}/> Credor</label></div>{create.error && <ErrorBox error={create.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={create.isPending}>Salvar pessoa</button></div></form></Dialog>; }
export function ProtocolDetail() {
    const ctx = useSession();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id = '' } = useParams();
    const [tab, setTab] = useState<'progress' | 'data' | 'documents' | 'attachments' | 'audit'>('progress');
    const [action, setAction] = useState<'forward' | 'assign' | 'complete' | 'archive' | 'reopen' | 'advance-phase' | 'return-phase' | null>(null);
    const [coverError, setCoverError] = useState<unknown>();
    const [generatingCover, setGeneratingCover] = useState(false);
    const [printPreview, setPrintPreview] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
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
    if (error) return <><PageTitle title="Registro não encontrado"/><ErrorBox error={error}/><Link className="btn-secondary mt-4" to="/protocolos">Voltar à listagem</Link></>;
    if (!data) return null;
    const { protocol: p, assignment, db } = data;
    const currentUser = ctx.user;
    const canAct = (currentUser?.role === 'ADMIN' && ctx.activeUnitId === p.currentUnitId) || p.currentAssigneeId === ctx.userId;
    const canManage = currentUser?.role === 'ADMIN' && ctx.activeUnitId === p.currentUnitId;
    const canDelete = canManage && p.status === 'CADASTRADO';
    const phases = p.flowSnapshot?.phases.slice().sort((a, b) => a.position - b.position) ?? [];
    const phase = phases.find((item) => item.phaseId === p.currentPhaseId);
    const phaseIndex = phase ? phases.indexOf(phase) : -1;
    const isLastPhase = phaseIndex >= 0 && phaseIndex === phases.length - 1;
    const unacknowledged = !!p.currentAssigneeId && !assignment.receivedAt;
    let primary: ReactNode = null;
    if (p.status === 'CONCLUIDO') primary = canAct && <button className="btn-primary" onClick={() => setAction('archive')}><Archive size={16}/>Arquivar</button>;
    else if (p.status === 'ARQUIVADO') primary = canManage && <button className="btn-primary" onClick={() => setAction('reopen')}><RefreshCcw size={16}/>Reabrir</button>;
    else if (!p.currentAssigneeId && p.currentUnitId === currentUser?.unitId) primary = <button className="btn-primary" onClick={() => doAssume.mutate()} disabled={doAssume.isPending}><Check size={16}/>Assumir e dar ciência</button>;
    else if (unacknowledged && p.currentAssigneeId === ctx.userId) primary = <button className="btn-primary" onClick={() => doAcknowledge.mutate()} disabled={doAcknowledge.isPending}><Check size={16}/>Dar ciência</button>;
    else if (canAct) primary = <button className="btn-primary" onClick={() => setAction('forward')}><ArrowRight size={16}/>Tramitar</button>;
    const generateCover = async () => {
        setActionsOpen(false); setCoverError(undefined); setGeneratingCover(true);
        try { const { downloadCover } = await import('../relatorios/reportPdf'); await downloadCover(db, p); }
        catch (error) { setCoverError(error); }
        finally { setGeneratingCover(false); }
    };
    const openPrint = () => { setActionsOpen(false); setPrintPreview(true); };
    const tabs: Array<[typeof tab, string, ReactNode]> = [['progress', 'Andamento', <ClipboardList size={15}/>], ['data', 'Resumo', <FileText size={15}/>], ['attachments', 'Anexos', <Paperclip size={15}/>], ['documents', 'Documentos', <FilePlus2 size={15}/>], ['audit', 'Auditoria', <CheckCircle2 size={15}/>]];
    return <><div className="print-shell"><PageTitle eyebrow={`Protocolos / ${p.number}`} title={`Protocolo ${p.number}`} action={<div className="no-print flex flex-wrap items-center justify-end gap-2">{primary}{canAct && isActive(p) && assignment.receivedAt && phase && !isLastPhase && <button className="btn-secondary" onClick={() => setAction('advance-phase')}><ArrowRight size={16}/>Avançar fase</button>}{canAct && isActive(p) && assignment.receivedAt && phaseIndex > 0 && <button className="btn-secondary" onClick={() => setAction('return-phase')}><RefreshCcw size={16}/>Devolver fase</button>}{canAct && isActive(p) && assignment.receivedAt && isLastPhase && <button className="btn-secondary" onClick={() => setAction('complete')}><Check size={16}/>Concluir</button>}<div className="relative" ref={actionsRef}><button type="button" className="btn-secondary" aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((value) => !value)}>Ações<ChevronDown size={16}/></button>{actionsOpen && <div role="menu" className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover py-2 shadow-xl"><p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Gerenciar</p><button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45" disabled={!canManage} title={!canManage ? 'Somente administradores na unidade atual podem editar.' : undefined} onClick={() => { setActionsOpen(false); setEditing(true); }}><Pencil size={16}/>Editar</button><button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45" disabled={!canDelete} title={!canDelete ? 'A exclusão é permitida apenas para protocolos cadastrados, por administrador da unidade atual.' : undefined} onClick={() => { setActionsOpen(false); setDeleting(true); }}><Trash2 size={16}/>Excluir</button><div className="my-2 border-t border-border"/><p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Impressão</p>{['Imprimir capa', 'Imprimir comprovante', 'Imprimir etiqueta', 'Imprimir detalhamento'].map((label) => <button key={label} role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" disabled={generatingCover} onClick={label === 'Imprimir capa' ? () => void generateCover() : openPrint}><Printer size={16}/>{label}</button>)}</div>}</div><button type="button" className="btn-secondary icon-button" aria-label="Voltar à listagem" onClick={() => navigate('/protocolos')}><ArrowLeft size={17}/></button></div>}/>{coverError ? <ErrorBox error={coverError}/> : null}{generatingCover && <p role="status" className="mb-4 text-sm text-muted-foreground">Gerando capa do processo…</p>}<h2 className="sr-only">{p.subject}</h2><p className="-mt-4 mb-4 text-sm text-muted-foreground">{p.subject}</p><div className="mb-4 flex flex-wrap items-center gap-2"><DetailChip label="Tipo" value={db.protocolTypes.find((item) => item.id === p.typeId)?.name}/><DetailChip label="Está com" value={p.currentAssigneeId ? <Name db={db} userId={p.currentAssigneeId}/> : <UnitName db={db} unitId={p.currentUnitId}/>}/>{phase && <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold"><span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">{phase.position + 1}</span>{phase.name}</span>}</div><div className="no-print flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/60 p-1">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'}`}>{Icon}{label}{key === 'progress' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{data.events.length}</span>}{key === 'audit' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{data.events.length}</span>}</button>)}</div>{tab === 'progress' && <section className="timeline-panel panel mt-3 overflow-hidden"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-bold"><ClipboardList size={17}/>Movimentações <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{data.events.length}</span></h2><div className="no-print flex flex-wrap items-center gap-1">{canManage && isActive(p) && <button className="button-secondary !px-2 !py-1.5 text-xs" onClick={() => setAction('assign')}>Designar responsável</button>}</div></header><div className="px-3 py-3 sm:px-5">{data.events.map((event, index) => <TimelineRow key={event.id} event={event} db={db} isLast={index === data.events.length - 1} isLatest={index === 0}/>)}</div></section>}{tab === 'data' && <section className="panel mt-3 p-5"><h2 className="mb-4 text-lg font-bold">Resumo do protocolo</h2><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2"><Data label="Descrição" value={p.description}/><Data label="Interessado" value={db.people.find((item) => item.id === p.interestedPersonId)?.name}/><Data label="Credor" value={db.people.find((item) => item.id === p.creditorPersonId)?.name}/><Data label="Valor" value={money(p.amountCents)}/><Data label="Aberto por" value={<Name db={db} userId={p.createdById}/>}/><Data label="Data de abertura" value={dateTime(p.createdAt)}/></dl></section>}{tab === 'documents' && <DocumentsInProtocol documents={data.documents} protocol={p} canAct={canAct}/>} {tab === 'attachments' && <Attachments attachments={data.attachments} protocol={p} canAct={canAct} onChanged={refresh}/>} {tab === 'audit' && <AuditTimeline events={data.events} db={db}/>}</div>{action === 'forward' && <MoveDialog title="Tramitar protocolo" protocol={p} db={db} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'assign' && <AssignDialog protocol={p} db={db} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'advance-phase' && phase && <PhaseActionDialog protocol={p} phase={phase} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'return-phase' && phase && <PhaseActionDialog protocol={p} phase={phase} ctx={ctx} returnPhase onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'complete' && <CompleteDialog protocol={p} ctx={ctx} onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {action === 'archive' && <ConfirmDialog title="Arquivar protocolo" body="O protocolo concluído deixará as filas de trabalho. Você poderá reabri-lo como administrador." confirm="Arquivar" onClose={() => setAction(null)} onConfirm={async () => { await api.archive(ctx, p.id, p.version); setAction(null); refresh(); }}/>} {action === 'reopen' && <MoveDialog title="Reabrir protocolo" protocol={p} db={db} ctx={ctx} reopen onClose={() => setAction(null)} onSaved={() => { setAction(null); refresh(); }}/>} {editing && <EditProtocolDialog protocol={p} ctx={ctx} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }}/>} {deleting && <ConfirmDialog title="Excluir protocolo" body="Esta ação exclui o protocolo e seus documentos, anexos e movimentações. Ela não pode ser desfeita." confirm="Excluir protocolo" danger onClose={() => setDeleting(false)} onConfirm={async () => { await api.deleteProtocol(ctx, p.id, p.version); navigate('/protocolos'); }}/>} {printPreview && <PrintPreviewDialog title={p.number} onClose={() => setPrintPreview(false)}><ProtocolPrintContent protocol={p} assignment={assignment} db={db}/></PrintPreviewDialog>}</>;
}
function DetailChip({ label, value }: { label: string; value?: ReactNode }) { return <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground"><span>{label}:</span><strong className="truncate text-foreground">{value ?? '—'}</strong></span>; }
function AuditTimeline({ events, db }: { events: ProtocolEvent[]; db: Database }) { return <section className="panel mt-3 divide-y divide-border"><header className="px-4 py-3"><h2 className="text-sm font-bold">Auditoria</h2></header>{events.map((event) => <div key={event.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div><strong>{eventLabel[event.kind]}</strong><p className="mt-0.5 text-xs text-muted-foreground"><Name db={db} userId={event.actorUserId}/></p></div><time className="shrink-0 text-xs text-muted-foreground">{dateTime(event.createdAt)}</time></div>)}</section>; }
function EditProtocolDialog({ protocol, ctx, onClose, onSaved }: { protocol: Protocol; ctx: ReturnType<typeof useSession>; onClose: () => void; onSaved: () => void }) { const [subject, setSubject] = useState(protocol.subject); const [description, setDescription] = useState(protocol.description); const [dueAt, setDueAt] = useState(protocol.dueAt ? protocol.dueAt.slice(0, 16) : ''); const update = useMutation({ mutationFn: () => api.updateProtocol(ctx, protocol.id, protocol.version, { subject, description, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }), onSuccess: onSaved }); return <Dialog title="Editar protocolo" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}><Field label="Assunto *"><Input className="field" maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} /></Field><Field label="Descrição *"><textarea className="field min-h-28" maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} /></Field><Field label="Prazo"><Input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>{update.error && <ErrorBox error={update.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={update.isPending}>Salvar</button></div></form></Dialog>; }
function Summary({ label, value }: {
    label: string;
    value?: ReactNode;
}) { return <div><dt className="label">{label}</dt><dd className="mt-1 text-sm font-semibold">{value ?? '—'}</dd></div>; }
function Data({ label, value }: {
    label: string;
    value?: ReactNode;
}) { return <div><dt className="label">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{value ?? '—'}</dd></div>; }
function ProtocolPrintContent({ protocol, assignment, db }: {
    protocol: Protocol;
    assignment: Database['assignments'][number];
    db: Database;
}) { return <><header className="border-b border-slate-300 pb-5"><p className="font-mono text-sm text-slate-600">{protocol.number}</p><h1 className="mt-2 text-2xl font-bold">{protocol.subject}</h1><p className="mt-2 text-sm text-slate-600">{db.protocolTypes.find((type) => type.id === protocol.typeId)?.name} · {statusLabel[protocol.status]}</p></header><dl className="grid gap-4 py-6 sm:grid-cols-2"><Summary label="Unidade atual" value={<UnitName db={db} unitId={protocol.currentUnitId}/>}/><Summary label="Responsável" value={protocol.currentAssigneeId ? <Name db={db} userId={protocol.currentAssigneeId}/> : 'Sem responsável'}/><Summary label="Prazo" value={dateOnly(protocol.dueAt)}/><Summary label="Ciência" value={assignment.receivedAt ? `Confirmada em ${dateTime(assignment.receivedAt)}` : 'Aguardando ciência'}/></dl><section className="border-t border-slate-300 pt-5"><h2 className="text-sm font-bold uppercase tracking-wide">Descrição</h2><p className="mt-3 whitespace-pre-wrap text-[15px] leading-7">{protocol.description}</p></section><dl className="mt-6 grid gap-4 border-t border-slate-300 pt-5 sm:grid-cols-2"><Data label="Interessado" value={db.people.find((person) => person.id === protocol.interestedPersonId)?.name}/><Data label="Credor" value={db.people.find((person) => person.id === protocol.creditorPersonId)?.name}/><Data label="Valor" value={money(protocol.amountCents)}/><Data label="Aberto em" value={dateTime(protocol.createdAt)}/></dl></>; }
function TimelineDate({ value }: {
    value: string;
}) {
    const date = new Date(value);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return <time dateTime={value} className="hidden w-16 shrink-0 text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:block"><strong className="block font-semibold text-slate-700 dark:text-slate-200">{isToday ? 'Hoje' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</strong><span>{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></time>;
}
function TimelineRow({ event: e, db, isLast, isLatest }: {
    event: ProtocolEvent;
    db: Database;
    isLast: boolean;
    isLatest: boolean;
}) {
    const [collapsed, setCollapsed] = useState(!isLatest);
    const heading = e.kind === 'ABERTURA' ? 'Abertura do protocolo' : eventLabel[e.kind];
    const statusKey = e.nextStatus ?? (e.kind === 'ABERTURA' ? 'CADASTRADO' : e.kind === 'TRAMITACAO' || e.kind === 'REABERTURA' || e.kind === 'FASE_AVANCADA' ? 'EM_ANDAMENTO' : e.kind === 'CONCLUSAO' ? 'CONCLUIDO' : e.kind === 'ARQUIVAMENTO' ? 'ARQUIVADO' : e.kind === 'RECEBIMENTO' ? 'CIENCIA' : 'REGISTRO');
    const status = statusKey in statusLabel ? statusLabel[statusKey as ProtocolStatus] : statusKey === 'CIENCIA' ? 'Ciência registrada' : eventLabel[e.kind];
    const statusTone: Record<string, { badge: string; dot: string }> = {
        CADASTRADO: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200', dot: 'bg-amber-500 ring-amber-100 dark:ring-amber-950' },
        EM_ANDAMENTO: { badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200', dot: 'bg-orange-500 ring-orange-100 dark:ring-orange-950' },
        CONCLUIDO: { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', dot: 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-950' },
        ARQUIVADO: { badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200', dot: 'bg-violet-500 ring-violet-100 dark:ring-violet-950' },
        CIENCIA: { badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', dot: 'bg-sky-500 ring-sky-100 dark:ring-sky-950' },
        REGISTRO: { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', dot: 'bg-slate-500 ring-slate-100 dark:ring-slate-800' },
    };
    const badgeClass = statusTone[statusKey].badge;
    const dotClass = statusTone[statusKey].dot;
    const sourceUserId = e.fromUserId ?? e.actorUserId;
    const destination = e.toUserId ? <Name db={db} userId={e.toUserId}/> : e.toUnitId ? <UnitName db={db} unitId={e.toUnitId}/> : undefined;
    const contentId = `timeline-content-${e.id}`;
    const canShowRoute = Boolean(e.fromUnitId || e.toUnitId || e.toUserId) && e.kind !== 'RECEBIMENTO';
    return <article className="relative flex gap-3 pb-2 last:pb-0 sm:gap-4"><TimelineDate value={e.createdAt}/><div data-timeline-dot className={`relative z-10 mt-3.5 hidden h-3 w-3 shrink-0 rounded-full ring-4 sm:block ${dotClass}`}/>{!isLast && <span data-timeline-line className="absolute left-[5.375rem] top-7 hidden h-[calc(100%-0.5rem)] w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden="true"/>}<section className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"><button type="button" className="flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left" aria-expanded={!collapsed} aria-controls={contentId} aria-label={`${collapsed ? 'Expandir' : 'Recolher'} conteúdo de ${heading}`} onClick={() => setCollapsed((value) => !value)}><span className="flex min-w-0 flex-wrap items-center gap-2"><strong className="text-sm text-slate-800 dark:text-slate-100">{heading}</strong><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>{status}</span></span>{collapsed ? <ChevronDown className="shrink-0 text-slate-500 dark:text-slate-400" size={17}/> : <ChevronUp className="shrink-0 text-slate-500 dark:text-slate-400" size={17}/>}</button>{!collapsed && <div id={contentId} className="border-t border-slate-100 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="flex min-w-0 flex-wrap items-center gap-3 text-sm"><span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-200"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-public-50 text-public-700 dark:bg-slate-800 dark:text-public-300"><UserRound size={15}/></span><span className="truncate"><Name db={db} userId={sourceUserId}/></span></span>{canShowRoute && destination && <><ArrowRight className="shrink-0 text-slate-400" size={16}/><span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-200"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-slate-800 dark:text-emerald-300"><UserRound size={15}/></span><span className="truncate">{destination}</span></span></>}</div><time dateTime={e.createdAt} className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">{dateTime(e.createdAt)}</time></div><div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800"><p className="label">{e.kind === 'ABERTURA' ? 'Aberto por' : e.kind === 'TRAMITACAO' || e.kind === 'REABERTURA' ? 'Despacho' : 'Registro'}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{e.message || (e.kind === 'ABERTURA' ? `Protocolo cadastrado por ${db.users.find((user) => user.id === e.actorUserId)?.name ?? 'usuário responsável'}.` : `Evento registrado por ${db.users.find((user) => user.id === e.actorUserId)?.name ?? 'usuário responsável'}.`)}</p></div>{e.checklist?.length ? <ChecklistTimeline answers={e.checklist}/> : null}<footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400"><span className="inline-flex items-center gap-1.5"><Clock3 size={14}/>Registro em {dateTime(e.createdAt)}</span>{e.relatedDocumentId && <span className="inline-flex items-center gap-1.5"><FileText size={14}/>Documento vinculado</span>}{e.relatedAttachmentId && <span className="inline-flex items-center gap-1.5"><Paperclip size={14}/>Anexo vinculado</span>}</footer></div>}</section></article>;
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
}) { const [unitId, setUnitId] = useState(protocol.currentUnitId); const [assigneeId, setAssigneeId] = useState(''); const [message, setMessage] = useState(''); const [dueAt, setDueAt] = useState(''); const mutation = useMutation({ mutationFn: () => reopen ? api.reopen(ctx, protocol.id, protocol.version, { unitId, assigneeId: assigneeId || undefined, message, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }) : api.forward(ctx, protocol.id, protocol.version, { unitId, assigneeId: assigneeId || undefined, message, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }), onSuccess: onSaved }); const users = db.users.filter((u) => u.active && u.unitId === unitId); return <Dialog title={title} onClose={onClose}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><Field label="Unidade destino *"><Select className="field" value={unitId} onChange={(e) => { setUnitId(e.target.value); setAssigneeId(''); }}>{db.units.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field><Field label="Destinatário"><Select className="field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Enviar para fila sem responsável</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field><Field label={reopen ? 'Motivo da reabertura *' : 'Despacho *'}><textarea className="field min-h-28" maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)}/></Field><Field label="Prazo"><Input className="field" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}/></Field>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>{reopen ? 'Reabrir' : 'Tramitar'}</button></div></form></Dialog>; }
function PhaseActionDialog({ protocol, phase, ctx, returnPhase, onClose, onSaved }: {
    protocol: Protocol;
    phase: NonNullable<Protocol['flowSnapshot']>['phases'][number];
    ctx: ReturnType<typeof useSession>;
    returnPhase?: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const questions = phase.checklistQuestions?.length ? phase.checklistQuestions : phase.checklistItems.map((text, order) => ({ id: `legacy-${order}`, text, order: order + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }));
    const [answers, setAnswers] = useState(() => questions.map((question) => ({ questionId: question.id, text: question.text, checked: false, date: '', observation: '' })));
    const [message, setMessage] = useState('');
    const mutation = useMutation({ mutationFn: () => returnPhase ? api.returnPhase(ctx, protocol.id, protocol.version, message) : api.advancePhase(ctx, protocol.id, protocol.version, answers, message), onSuccess: onSaved });
    const updateAnswer = (questionId: string, patch: Partial<typeof answers[number]>) => setAnswers((current) => current.map((answer) => answer.questionId === questionId ? { ...answer, ...patch } : answer));
    return <Dialog title={returnPhase ? `Devolver fase: ${phase.name}` : `Avançar fase: ${phase.name}`} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>{returnPhase ? <Field label="Motivo da devolução *"><textarea className="field min-h-28" maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} /></Field> : <><p className="text-sm text-slate-600 dark:text-slate-300">Conclua os requisitos da fase antes de avançar.</p>{questions.length > 0 && <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Checklist — {phase.name}</legend><div className="divide-y">{questions.map((question) => { const answer = answers.find((item) => item.questionId === question.id)!; return <div key={question.id} className="py-3"><label className="flex items-start gap-2 text-sm font-medium"><Checkbox aria-label={question.text} checked={answer.checked} onChange={(event) => updateAnswer(question.id, { checked: event.target.checked })}/><span>{question.text}{question.required && <span className="ml-1 text-public-700">*</span>}</span></label>{answer.checked && <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">{question.requiresDate && <Input className="field" type="date" value={answer.date} onChange={(event) => updateAnswer(question.id, { date: event.target.value })}/>} {question.requiresObservation && <Input className="field" placeholder="Observação" value={answer.observation} onChange={(event) => updateAnswer(question.id, { observation: event.target.value })}/>} {question.requiresAttachment && <span className="text-xs text-amber-700 dark:text-amber-300">Inclua o anexo na aba Anexos antes de avançar.</span>}</div>}</div> })}</div></fieldset>}{phase.requiredAttachmentTypes.length > 0 && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Anexos exigidos: {phase.requiredAttachmentTypes.join(', ')}. Inclua-os na aba Anexos antes de avançar.</p>}<Field label="Observação"><textarea className="field min-h-24" maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} /></Field></>}{mutation.error && <ErrorBox error={mutation.error} />}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>{returnPhase ? 'Devolver fase' : 'Avançar fase'}</button></div></form></Dialog>;
}
function CompleteDialog({ protocol, ctx, onClose, onSaved }: {
    protocol: Protocol;
    ctx: ReturnType<typeof useSession>;
    onClose: () => void;
    onSaved: () => void;
}) { const [message, setMessage] = useState(''); const mutation = useMutation({ mutationFn: () => api.complete(ctx, protocol.id, protocol.version, message), onSuccess: onSaved }); return <Dialog title="Concluir protocolo" onClose={onClose}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><Field label="Resultado da conclusão *"><textarea className="field min-h-28" value={message} onChange={(e) => setMessage(e.target.value)}/></Field>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary">Concluir</button></div></form></Dialog>; }
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
}) { return <section className="mt-4"><div className="mb-3 flex justify-end">{canAct && isActive(protocol) && <Link to={`/documentos/novo?protocolId=${protocol.id}`} className="btn-primary"><FilePlus2 size={16}/>Redigir documento</Link>}</div>{documents.length ? <div className="panel divide-y">{documents.map((d) => <Link className="flex items-center justify-between px-5 py-4 hover:bg-slate-50" to={`/documentos/${d.id}`} key={d.id}><span><strong className="block text-sm">{d.subject}</strong><small className="font-mono text-xs text-slate-500 dark:text-slate-400">{d.number}</small></span><ChevronRight size={18}/></Link>)}</div> : <Empty title="Sem documentos vinculados" detail="Nenhum documento foi redigido neste protocolo."/>}</section>; }
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
function Attachments({ attachments, protocol, canAct, onChanged }: {
    attachments: Attachment[];
    protocol: Protocol;
    canAct: boolean;
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
        add.mutate(files); event.currentTarget.value = ''; }}/><button className="btn-primary" disabled={add.isPending} onClick={() => input.current?.click()}><Paperclip size={16}/>{add.isPending ? 'Anexando…' : 'Anexar arquivos'}</button></>}</div>{Boolean(error) && <div className="mb-3"><ErrorBox error={error}/></div>}{attachments.length ? <div className="panel divide-y">{attachments.map((attachment) => <div className="flex items-center justify-between gap-3 px-5 py-4" key={attachment.id}><span className="min-w-0"><strong className="block truncate text-sm">{attachment.filename}</strong><small className="text-slate-500 dark:text-slate-400">{Math.ceil(attachment.sizeBytes / 1024)} KB · {dateTime(attachment.createdAt)}</small></span><span className="flex shrink-0 gap-2"><button className="btn-secondary" onClick={() => setPreview(attachment)}>Visualizar</button><button className="btn-secondary" onClick={() => download(attachment)}>Baixar</button></span></div>)}</div> : <Empty title="Sem anexos" detail="Adicione até cinco arquivos PDF, PNG, JPEG ou TXT de até 5 MB cada."/>}</section>{preview && <AttachmentPreviewDialog attachment={preview} onClose={() => setPreview(undefined)}/>}</>;
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
    const users = db.users.filter((user) => user.active && user.unitId === protocol.currentUnitId);
    return <Dialog title="Designar responsável" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><p className="text-sm text-slate-600 dark:text-slate-300">A designação encerra o ciclo atual e exige nova ciência do responsável escolhido.</p><Field label="Responsável *"><Select className="field" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Selecione</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !assigneeId}>{mutation.isPending ? 'Designando…' : 'Designar'}</button></div></form></Dialog>;
}
