import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, ChevronRight, ChevronsUpDown, MoreHorizontal, Pencil, Plus, Search } from 'lucide-react';
import type { Database, Unit } from '../../domain/model';
import { api } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { ErrorBox, Field, Loading } from '../../components/ui/Feedback';

const unitSorter = (left: Unit, right: Unit) =>
  (left.position ?? 0) - (right.position ?? 0) || left.name.localeCompare(right.name, 'pt-BR');

export function StructurePage() {
  const ctx = useSession();
  const { data: db, isLoading } = useDb();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [editing, setEditing] = useState<Unit | 'new' | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const childrenByParent = useMemo(() => {
    const result = new Map<string | undefined, Unit[]>();
    for (const unit of db?.units ?? []) {
      const siblings = result.get(unit.parentId) ?? [];
      siblings.push(unit);
      result.set(unit.parentId, siblings);
    }
    result.forEach((units) => units.sort(unitSorter));
    return result;
  }, [db?.units]);

  if (isLoading || !db) return <Loading variant="detail" />;

  const query = search.trim().toLocaleLowerCase();
  const childrenOf = (unit: Unit) => childrenByParent.get(unit.id) ?? [];
  const roots = (childrenByParent.get(undefined) ?? []).filter((unit) => !unit.parentId);
  const parentIds = [...childrenByParent.entries()].filter(([, items]) => items.length > 0).map(([id]) => id).filter((id): id is string => Boolean(id));
  const matches = (unit: Unit) => !query || unit.name.toLocaleLowerCase().includes(query) || unit.abbreviation.toLocaleLowerCase().includes(query);
  const hasMatchingDescendant = (unit: Unit): boolean => matches(unit) || childrenOf(unit).some(hasMatchingDescendant);
  const isOpen = (unit: Unit) => Boolean(query) || expanded === null || expanded.has(unit.id);
  const toggleUnit = (unitId: string) => setExpanded((current) => {
    const next = current === null ? new Set(parentIds) : new Set(current);
    if (next.has(unitId)) next.delete(unitId); else next.add(unitId);
    return next;
  });
  const toggleAll = () => setExpanded((current) => current === null || current.size > 0 ? new Set() : new Set(parentIds));
  const allOpen = expanded === null || expanded.size > 0;

  const renderUnit = (unit: Unit, indexPath: number[] = []): ReactNode => {
    if (query && !hasMatchingDescendant(unit)) return null;
    const children = childrenOf(unit).filter((child) => !query || hasMatchingDescendant(child));
    const hasChildren = children.length > 0;
    const opened = isOpen(unit);
    const number = `${indexPath.join('.')}.`;
    return (
      <li key={unit.id} role="treeitem" aria-expanded={hasChildren ? opened : undefined}>
        <div
          className={`structure-tree-row group ${indexPath.length === 1 ? 'structure-tree-row--root' : ''} ${!unit.active ? 'opacity-60' : ''}`}
          style={{ paddingLeft: `${.75 + Math.max(0, indexPath.length - 1) * 1.65}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="structure-tree-toggle"
              aria-label={opened ? `Recolher ${unit.name}` : `Expandir ${unit.name}`}
              onClick={() => toggleUnit(unit.id)}
            >
              {opened ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : <span className="w-7 shrink-0" aria-hidden="true" />}
          <span className="structure-tree-number">{number}</span>
          <span className="structure-tree-icon"><Building2 size={16} /></span>
          <strong className="min-w-0 truncate text-sm">{unit.name}</strong>
          <small className="hidden shrink-0 text-xs text-slate-500 dark:text-slate-400 sm:inline">· {unit.abbreviation}</small>
          {hasChildren && <span className="structure-tree-count">{children.length}</span>}
          {ctx.user?.role === 'ADMIN' && (
            <button
              type="button"
              className="structure-tree-edit"
              aria-label={`Editar ${unit.name}`}
              onClick={() => setEditing(unit)}
            >
              <Pencil size={15} />
            </button>
          )}
        </div>
        {hasChildren && opened && (
          <ul role="group">{children.map((child, index) => renderUnit(child, [...indexPath, index + 1]))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--ui-accent)_14%,transparent)] text-[var(--ui-accent)]">
            <Building2 size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Estrutura Organizacional</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{db.organization.name}</p>
          </div>
        </div>
        {ctx.user?.role === 'ADMIN' && (
          <div className="flex items-center justify-end gap-2">
            <div className="relative">
              <button type="button" className="btn-secondary !p-2" aria-label="Mais ações" aria-expanded={moreOpen} onClick={() => setMoreOpen((current) => !current)}>
                <MoreHorizontal size={18} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 z-10 mt-2 w-44 rounded-lg border bg-white p-1 shadow-lg dark:bg-slate-900">
                  <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setExpanded(new Set(parentIds)); setMoreOpen(false); }}>
                    <ChevronsUpDown size={15} /> Expandir tudo
                  </button>
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} />Nova unidade organizacional</button>
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:w-[18rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input aria-label="Buscar na estrutura" className="field !mt-0 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na estrutura..." />
        </label>
        <button type="button" className="btn-secondary self-start" onClick={toggleAll}>
          <ChevronsUpDown size={16} />{allOpen ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>

      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Estrutura organizacional hierárquica. Selecione a seta para expandir ou recolher cada unidade.</p>
      <section className="structure-tree-panel" aria-label="Árvore da estrutura organizacional">
        {roots.length ? <ul role="tree">{roots.map((unit, index) => renderUnit(unit, [index + 1]))}</ul> : <p className="p-6 text-sm text-slate-500">Nenhuma unidade cadastrada.</p>}
      </section>
      {editing && <UnitEditor unit={editing === 'new' ? undefined : editing} db={db} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
    </div>
  );
}

function UnitEditor({ unit, db, onClose, onSaved }: { unit?: Unit; db: Database; onClose: () => void; onSaved: () => void }) {
  const ctx = useSession();
  const client = useQueryClient();
  const [name, setName] = useState(unit?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(unit?.abbreviation ?? '');
  const [parentId, setParentId] = useState(unit?.parentId ?? '');
  const [active, setActive] = useState(unit?.active ?? true);
  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, abbreviation, parentId: parentId || undefined, active };
      return unit ? api.updateUnit(ctx, unit.id, input) : api.createUnit(ctx, input);
    },
    onSuccess: () => { invalidateAll(client); onSaved(); },
  });
  return <Dialog title={unit ? 'Editar unidade' : 'Nova unidade organizacional'} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><Field label="Nome *"><Input className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Sigla *"><Input className="field" maxLength={12} value={abbreviation} onChange={(event) => setAbbreviation(event.target.value.toUpperCase())} /></Field><Field label="Unidade superior"><Select className="field" value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Sem unidade superior</option>{db.units.filter((candidate) => candidate.active && candidate.id !== unit?.id).sort(unitSorter).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</Select></Field>{unit && <label className="block text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)} /> Unidade ativa</label>}{mutation.error && <ErrorBox error={mutation.error} />}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>Salvar</button></div></form></Dialog>;
}