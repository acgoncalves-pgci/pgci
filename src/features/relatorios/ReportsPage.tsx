import { Children, cloneElement, isValidElement, useId, useState } from 'react';
import type { ReactElement, ReactNode, KeyboardEvent } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { useDb } from '../../app/queries';
import { useSession } from '../../app/session';
import { Loading, ErrorBox, PageTitle } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { statusLabel } from '../../domain/model';
import { emptyFilters, filterProtocols, visibleProtocols } from './reportData';
import type { ReportFilters } from './reportData';

const tabs = [
  ['processes', 'Relatório de Processos'], ['individual', 'Relatório Individual'], ['productivity', 'Relatório de Produtividade'],
] as const;
type Tab = typeof tabs[number][0];
function ReportField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <div className="block min-w-0"><label id={`${id}-label`} htmlFor={id} className="mb-1 block text-xs font-semibold">{label}</label>{Children.map(children, (child) => isValidElement(child) && (child.type === Input || child.type === Select || child.type === 'textarea') ? cloneElement(child as ReactElement<{ id?: string; 'aria-labelledby'?: string }>, { id, 'aria-labelledby': `${id}-label` }) : child)}</div>;
}
export function ReportsPage() {
  const { data: db, isLoading, error } = useDb();
  const ctx = useSession();
  const [tab, setTab] = useState<Tab>('processes');
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [grouping, setGrouping] = useState('');
  const [listTemplate, setListTemplate] = useState('list');
  const [number, setNumber] = useState('');
  const [server, setServer] = useState('');
  const [superior, setSuperior] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [busy, setBusy] = useState(false);
  const [generationError, setGenerationError] = useState<unknown>();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!db || !ctx.user) return null;
  const protocols = visibleProtocols(db, ctx);
  const filtered = filterProtocols(protocols, filters);
  const individual = protocols.find((p) => p.number.toLowerCase() === number.trim().toLowerCase());
  const update = (key: keyof ReportFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const changeTab = (next: Tab) => { setTab(next); setGenerationError(undefined); };
  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault(); changeTab(tabs[next][0]); document.getElementById(`report-tab-${tabs[next][0]}`)?.focus();
  };
  const generate = async () => {
    setGenerationError(undefined);
    const start = tab === 'processes' ? filters.from : from;
    const end = tab === 'processes' ? filters.to : to;
    if (tab !== 'individual' && start && end && start > end) { setGenerationError(new Error('A data final deve ser igual ou posterior à data inicial.')); return; }
    setBusy(true);
    try {
      const pdf = await import('./reportPdf');
      if (tab === 'processes') {
        if (!filtered.length) throw new Error('Nenhum processo encontrado com os filtros informados.');
        await pdf.downloadList(db, filtered, grouping, listTemplate === 'summary', `Período de abertura: ${filters.from || 'Todos'} a ${filters.to || 'Hoje'}`);
      } else if (tab === 'individual') {
        if (!individual) throw new Error('Informe o número completo de um protocolo disponível para seu usuário.');
        await pdf.downloadCover(db, individual);
      } else {
        if (!server) throw new Error('Selecione o servidor.');
        await pdf.downloadProductivity(db, protocols, server, superior, from, to, difficulties, suggestions);
      }
    } catch (cause) { setGenerationError(cause); }
    finally { setBusy(false); }
  };
  return <div className="reports-page">
    <PageTitle title="Relatórios" action={<span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">Escopo: {ctx.user.role === 'ADMIN' ? db.organization.name : db.units.find((u) => u.id === ctx.activeUnitId)?.name}</span>} />
    <p className="-mt-4 mb-7 text-sm text-muted-foreground">Gere relatórios em PDF a partir dos protocolos da entidade.</p>
    <div className="reports-tabs" role="tablist" aria-label="Tipos de relatório">{tabs.map(([id, label], index) => <button key={id} id={`report-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`report-panel-${id}`} tabIndex={tab === id ? 0 : -1} onKeyDown={(event) => navigateTabs(event, index)} onClick={() => changeTab(id)} className="reports-tab">{label}</button>)}</div>
    <section id={`report-panel-${tab}`} role="tabpanel" aria-labelledby={`report-tab-${tab}`} className="reports-panel">
      <form onSubmit={(event) => { event.preventDefault(); void generate(); }}>
        {tab === 'processes' && <div className="grid gap-x-4 gap-y-5 md:grid-cols-3">
          <ReportField label="Tipo"><Select value={filters.typeId} onChange={(e) => update('typeId', e.target.value)}><option value="">Todos</option>{db.protocolTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></ReportField>
          <ReportField label="Situação"><Select value={filters.status} onChange={(e) => update('status', e.target.value)}><option value="">Todas</option>{Object.entries(statusLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></ReportField>
          <ReportField label="Unidade organizacional"><Select value={filters.unitId} onChange={(e) => update('unitId', e.target.value)}><option value="">Todas</option>{db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></ReportField>
          <ReportField label="Interessado"><Select value={filters.interestedId} onChange={(e) => update('interestedId', e.target.value)}><option value="">Todos</option>{db.people.filter((p) => p.roles.includes('INTERESSADO')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></ReportField>
          <ReportField label="Data inicial"><Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update('from', e.target.value)} /></ReportField>
          <ReportField label="Data final"><Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update('to', e.target.value)} /></ReportField>
          <ReportField label="Número contém"><Input placeholder="ex.: 2025" value={filters.number} onChange={(e) => update('number', e.target.value)} /></ReportField>
          <ReportField label="Agrupar por"><Select value={grouping} onChange={(e) => setGrouping(e.target.value)}><option value="">Sem agrupamento</option><option value="type">Tipo</option><option value="status">Situação</option><option value="unit">Unidade organizacional</option></Select></ReportField>
          <ReportField label="Relatório"><Select value={listTemplate} onChange={(e) => setListTemplate(e.target.value)}><option value="list">Listagem de Protocolos</option><option value="summary">Resumo de Processos</option></Select></ReportField>
        </div>}
        {tab === 'individual' && <div className="grid gap-4 md:grid-cols-2">
          <ReportField label="Número do protocolo"><Input placeholder="Informe o número completo" value={number} onChange={(e) => setNumber(e.target.value)} /><small className="mt-2 block text-xs text-muted-foreground">{number.trim() ? individual ? individual.subject : 'Protocolo não encontrado no seu escopo.' : 'Digite o número do protocolo para gerar a capa do processo.'}</small></ReportField>
          <ReportField label="Relatório"><Select value="cover"><option value="cover">Capa do processo — layout padrão do sistema</option></Select></ReportField>
        </div>}
        {tab === 'productivity' && <>
          <p className="mb-5 text-sm text-muted-foreground">Consolida as atividades e resultados registrados pelo servidor nas tramitações do período.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReportField label="Servidor"><Select value={server} onChange={(e) => { setServer(e.target.value); if (superior === e.target.value) setSuperior(''); }}><option value="">Selecione...</option>{db.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></ReportField>
            <ReportField label="Superior imediato"><Select value={superior} onChange={(e) => setSuperior(e.target.value)}><option value="">Não informar</option>{db.users.filter((u) => u.active && u.id !== server).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></ReportField>
            <ReportField label="Data inicial"><Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></ReportField>
            <ReportField label="Data final"><Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></ReportField>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2"><ReportField label="Dificuldades ou impedimentos encontrados"><textarea className="field min-h-28 resize-y" value={difficulties} onChange={(e) => setDifficulties(e.target.value)} /></ReportField><ReportField label="Sugestões para melhoria do desempenho e produtividade setorial"><textarea className="field min-h-28 resize-y" value={suggestions} onChange={(e) => setSuggestions(e.target.value)} /></ReportField></div>
        </>}
        {generationError ? <div className="mt-5"><ErrorBox error={generationError} /></div> : null}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{tab === 'processes' ? `${filtered.length} processo(s) encontrado(s)` : <span className="inline-flex items-center gap-1.5"><BarChart3 size={14} />PDF com o timbre configurado</span>}</span><button type="submit" className="btn-primary" disabled={busy || (tab === 'individual' && !individual) || (tab === 'productivity' && !server)}><Download size={16} />{busy ? 'Gerando PDF…' : 'Gerar PDF'}</button></div>
      </form>
    </section>
  </div>;
}
