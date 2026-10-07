import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Building2, ChevronDown, ChevronRight, ChevronsUpDown, GitBranch, GripVertical, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Database, Unit } from '../../domain/model';
import { hasPermission } from '../../domain/permissions';
import { canReparentUnit, sortUnitsByPath, unitPath } from '../../domain/units';
import { api } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { IconGlyph, IconSelect } from '../../components/ui/IconSelect';
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';

const unitSorter = (left: Unit, right: Unit) =>
  (left.position ?? 0) - (right.position ?? 0) || left.name.localeCompare(right.name, 'pt-BR');

type UnitEditorTarget = { unit?: Unit; parentId?: string };

export function StructurePage() {
  const ctx = useSession();
  const client = useQueryClient();
  const { data: db, isLoading } = useDb();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [editing, setEditing] = useState<UnitEditorTarget | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [subordinating, setSubordinating] = useState<Unit | null>(null);
  const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const canCreate = Boolean(db && hasPermission(db, ctx, 'structure.create'));
  const canEdit = Boolean(db && hasPermission(db, ctx, 'structure.edit'));
  const canDelete = Boolean(db && hasPermission(db, ctx, 'structure.delete'));
  const remove = useMutation({
    mutationFn: (unitId: string) => api.deleteUnit(ctx, unitId),
    onSuccess: () => { invalidateAll(client); setDeleting(null); },
  });
  const move = useMutation({
    mutationFn: ({ unitId, parentId }: { unitId: string; parentId?: string }) => api.reparentUnit(ctx, unitId, parentId),
    onSuccess: async (unit) => {
      await invalidateAll(client);
      setSubordinating(null);
      setExpanded((current) => {
        if (current === null) return current;
        const next = new Set(current);
        let parentId = unit.parentId;
        const visited = new Set<string>();
        while (parentId && !visited.has(parentId)) {
          visited.add(parentId);
          next.add(parentId);
          parentId = db?.units.find((item) => item.id === parentId)?.parentId;
        }
        return next;
      });
    },
  });

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
    const canDrop = Boolean(canEdit && !move.isPending && draggedUnitId &&
      db.units.find((item) => item.id === draggedUnitId)?.parentId !== unit.id &&
      canReparentUnit(db.units, draggedUnitId, unit.id));
    return (
      <li key={unit.id} role="treeitem" aria-label={unit.name} aria-expanded={hasChildren ? opened : undefined}>
        <div
          data-unit-id={unit.id}
          className={`structure-tree-row group ${indexPath.length === 1 ? 'structure-tree-row--root' : ''} ${!unit.active ? 'opacity-60' : ''} ${draggedUnitId === unit.id ? 'structure-tree-row--dragging' : ''} ${dropTargetId === unit.id ? 'structure-tree-row--drop-target' : ''}`}
          style={{ paddingLeft: `min(${.75 + Math.max(0, indexPath.length - 1) * 1.65}rem, 25%)` }}
          onDragOver={(event) => {
            if (!canDrop) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropTargetId(unit.id);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTargetId((current) => current === unit.id ? null : current);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData('application/x-scgi-unit');
            if (canDrop && sourceId === draggedUnitId) move.mutate({ unitId: sourceId, parentId: unit.id });
            setDraggedUnitId(null);
            setDropTargetId(null);
          }}
        >
          {canEdit && <button type="button" draggable={!move.isPending} disabled={move.isPending} className="structure-tree-drag" aria-label={`Arrastar ${unit.name}`} title="Arrastar para subordinar; clique para escolher a unidade superior" onClick={() => { move.reset(); setSubordinating(unit); }} onDragStart={(event) => {
            event.dataTransfer.setData('application/x-scgi-unit', unit.id);
            event.dataTransfer.effectAllowed = 'move';
            setDraggedUnitId(unit.id);
            move.reset();
          }} onDragEnd={() => { setDraggedUnitId(null); setDropTargetId(null); }}><GripVertical size={15}/></button>}
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
          <span className="structure-tree-icon" style={unit.color ? { color: unit.color, backgroundColor: `${unit.color}1F` } : undefined}><IconGlyph name={unit.icon ?? 'Building2'} size={16}/></span>
          <strong className="min-w-0 truncate text-sm">{unit.name}</strong>
          <small className="hidden shrink-0 text-xs text-slate-500 dark:text-slate-400 sm:inline">· {unit.abbreviation}</small>
          {hasChildren && <span className="structure-tree-count">{children.length}</span>}
          {(canCreate || canEdit || canDelete) && (
            <span className="structure-tree-actions">
              {canCreate && <button type="button" className="structure-tree-action" aria-label={`Criar unidade subordinada a ${unit.name}`} title="Criar unidade subordinada" onClick={() => setEditing({ parentId: unit.id })}><Plus size={16} /></button>}
              {canEdit && <button type="button" className="structure-tree-action" aria-label={`Subordinar ${unit.name}`} title="Escolher unidade superior ou remover subordinação" disabled={move.isPending} onClick={() => { move.reset(); setSubordinating(unit); }}><GitBranch size={15}/></button>}
              {canEdit && unit.parentId && <button type="button" className="structure-tree-action" aria-label={`Subir nível de ${unit.name}`} title="Subir um nível" disabled={move.isPending} onClick={() => move.mutate({ unitId: unit.id, parentId: db.units.find((item) => item.id === unit.parentId)?.parentId })}><ArrowUp size={15}/></button>}
              {canEdit && <button type="button" className="structure-tree-action" aria-label={`Editar ${unit.name}`} title="Editar unidade" onClick={() => setEditing({ unit })}><Pencil size={15} /></button>}
              {canDelete && <button type="button" className="structure-tree-action structure-tree-action--danger" aria-label={`Excluir ${unit.name}`} title="Excluir unidade" onClick={() => setDeleting(unit)}><Trash2 size={15} /></button>}
            </span>
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
      <PageTitle title="Estrutura Organizacional" detail={db.organization.name} icon={Building2} action={canCreate && (
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
            <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} />Nova unidade organizacional</button>
          </div>
        )} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:w-[18rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input aria-label="Buscar na estrutura" className="field !mt-0 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na estrutura..." />
        </label>
        <button type="button" className="btn-secondary self-start" onClick={toggleAll}>
          <ChevronsUpDown size={16} />{allOpen ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>

      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Selecione a seta para expandir ou recolher cada unidade.{canEdit ? ' Arraste pelo ícone de pontos e solte sobre outra unidade para subordinar, ou use as ações da linha para escolher a unidade superior e subir um nível.' : ' Use as ações disponíveis na linha para administrar as unidades.'}</p>
      {move.error && !subordinating && <div className="mb-3"><ErrorBox error={move.error}/></div>}
      {move.isPending && <p role="status" className="mb-2 text-xs text-slate-500">Atualizando a hierarquia...</p>}
      <section className="structure-tree-panel" aria-label="Árvore da estrutura organizacional">
        {roots.length ? <ul role="tree">{roots.map((unit, index) => renderUnit(unit, [index + 1]))}</ul> : <p className="p-6 text-sm text-slate-500">Nenhuma unidade cadastrada.</p>}
      </section>
      {editing && <UnitEditor key={`${editing.unit?.id ?? 'new'}:${editing.parentId ?? 'root'}`} unit={editing.unit} initialParentId={editing.parentId} db={db} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
      {subordinating && <UnitParentEditor unit={subordinating} units={db.units} saving={move.isPending} error={move.error} onClose={() => { if (!move.isPending) { setSubordinating(null); move.reset(); } }} onSave={(parentId) => move.mutate({ unitId: subordinating.id, parentId })}/>}
      {deleting && <Dialog title="Excluir unidade organizacional" onClose={() => setDeleting(null)}><DialogBody><p className="text-sm text-muted-foreground">Deseja excluir a unidade <strong>{deleting.name}</strong>? A exclusão só será permitida se ela não possuir unidades subordinadas, usuários, processos ou outros vínculos no sistema.</p>{remove.error && <div className="mt-4"><ErrorBox error={remove.error} /></div>}</DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn-primary bg-destructive hover:bg-destructive/90" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{remove.isPending ? 'Excluindo…' : 'Excluir'}</button></DialogFooter></Dialog>}
    </div>
  );
}

function UnitParentEditor({ unit, units, saving, error, onClose, onSave }: {
  unit: Unit; units: Unit[]; saving: boolean; error: unknown; onClose: () => void; onSave: (parentId?: string) => void;
}) {
  const [parentId, setParentId] = useState(unit.parentId ?? '');
  const candidates = sortUnitsByPath(units.filter((candidate) => canReparentUnit(units, unit.id, candidate.id)));
  return <Dialog title={`Subordinar ${unit.name}`} onClose={onClose}>
    <form className="dialog-form flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(event) => { event.preventDefault(); onSave(parentId || undefined); }}>
      <DialogBody className="space-y-4">
        <p className="text-sm text-slate-500">Escolha a unidade superior. As unidades subordinadas a <strong>{unit.name}</strong> serão mantidas.</p>
        <Field label="Unidade superior"><Select aria-label="Unidade superior" value={parentId} disabled={saving} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Sem unidade superior (nível principal)</option>
          {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{unitPath(units, candidate.id)}</option>)}
        </Select></Field>
        <p className="text-xs text-slate-500">Para remover a subordinação, selecione “Sem unidade superior”. A própria unidade e suas descendentes não podem ser escolhidas.</p>
        {Boolean(error) && <ErrorBox error={error}/>}
      </DialogBody>
      <DialogFooter><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="btn-primary" disabled={saving || parentId === (unit.parentId ?? '')}>{saving ? 'Salvando…' : 'Salvar subordinação'}</button></DialogFooter>
    </form>
  </Dialog>;
}

function UnitEditor({ unit, initialParentId, db, onClose, onSaved }: { unit?: Unit; initialParentId?: string; db: Database; onClose: () => void; onSaved: () => void }) {
  const ctx = useSession();
  const client = useQueryClient();
  const [name, setName] = useState(unit?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(unit?.abbreviation ?? '');
  const [parentId, setParentId] = useState(unit?.parentId ?? initialParentId ?? '');
  const [active, setActive] = useState(unit?.active ?? true);
  const [color, setColor] = useState(unit?.color ?? '#3498DB');
  const [icon, setIcon] = useState(unit?.icon ?? 'Building2');
  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, abbreviation, parentId: parentId || undefined, color, icon, active };
      return unit ? api.updateUnit(ctx, unit.id, input) : api.createUnit(ctx, input);
    },
    onSuccess: () => { invalidateAll(client); onSaved(); },
  });
  const candidates = sortUnitsByPath(db.units.filter((candidate) => unit ? canReparentUnit(db.units, unit.id, candidate.id) : candidate.active));
  return <Dialog title={unit ? 'Editar unidade' : 'Nova unidade organizacional'} onClose={onClose}>
    <form className="dialog-form flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <DialogBody className="space-y-4">
        <Field label="Nome *"><Input autoFocus className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Secretaria de Administração" /></Field>
        <Field label="Sigla *"><Input className="field" maxLength={12} value={abbreviation} onChange={(event) => setAbbreviation(event.target.value.toUpperCase())} placeholder="Ex.: SEMAD" /></Field>
        <Field label="Unidade superior"><Select aria-label="Unidade superior" className="field" value={parentId} disabled={Boolean(initialParentId)} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Sem unidade superior</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{unitPath(db.units, candidate.id)}</option>)}
        </Select>{initialParentId && <p className="mt-1 text-xs text-muted-foreground">A nova unidade será criada diretamente abaixo desta unidade superior.</p>}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cor"><div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5"><Input aria-label="Selecionar cor" className="!mt-0 size-8 shrink-0 cursor-pointer border-0 p-0" type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#3498DB'} onChange={(event) => setColor(event.target.value.toUpperCase())}/><Input aria-label="Cor hexadecimal" className="!mt-0 min-w-0 border-0 bg-transparent px-1 font-mono text-sm font-semibold shadow-none" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} maxLength={7} placeholder="#3498DB"/></div></Field>
          <Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field>
        </div>
        <div className="flex items-center gap-2 text-sm"><span className="structure-tree-icon" style={{ color, backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? `${color}1F` : undefined }}><IconGlyph name={icon} size={16}/></span><span>{name || 'Prévia da unidade'}</span></div>
        {unit && <label className="flex items-center gap-2 text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)} /> Unidade ativa</label>}
        {mutation.error && <ErrorBox error={mutation.error} />}
      </DialogBody>
      <DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !name.trim() || !abbreviation.trim()}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</button></DialogFooter>
    </form>
  </Dialog>;
}
