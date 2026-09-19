import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { SituationCategory, SituationType } from '../../domain/model'
import { situationCategoryLabel } from '../../domain/situations'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { IconGlyph, IconSelect } from '../../components/ui/IconSelect'

export function SituationsPage({ embedded = false }: { embedded?: boolean }) {
  const ctx = useSession()
  const client = useQueryClient()
  const { data: db, isLoading } = useDb()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SituationType | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SituationType | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [category, setCategory] = useState<SituationCategory | 'ALL'>('ALL')
  const [activeOnly, setActiveOnly] = useState(true)
  const admin = ctx.user?.role === 'ADMIN'
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSituationType(ctx, id),
    onSuccess: () => {
      invalidateAll(client)
      setDeleting(null)
    },
  })

  if (isLoading || !db) return <Loading />

  const query = search.trim().toLocaleLowerCase()
  const visible = db.situations.filter((situation) =>
    (!query || `${situation.name} ${situation.observation ?? ''} ${situation.category ? situationCategoryLabel[situation.category] : ''}`.toLocaleLowerCase().includes(query)) &&
    (category === 'ALL' || situation.category === category) &&
    (!activeOnly || situation.active),
  )

  return <>
    {!embedded && <>
      <PageTitle
        title="Tipos de Situação"
        action={admin ? <div className="flex items-center gap-2"><button type="button" className="button-secondary icon-button" aria-label="Mais ações" onClick={() => setFiltersOpen(true)}><MoreHorizontal size={18}/></button><button type="button" className="button-primary" onClick={() => setEditing('new')}><Plus size={16}/>Novo</button></div> : undefined}
      />
      <p className="-mt-3 mb-5 text-sm text-muted-foreground">Cadastre as situações disponíveis para uso nas etapas dos fluxos de processo.</p>
    </>}

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><Input aria-label="Buscar situação" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." className="w-72 pl-9"/></label>
        <button type="button" className="button-secondary" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16}/>Mais filtros</button>
      </div>
      {embedded && admin && <button type="button" className="button-primary" onClick={() => setEditing('new')}><Plus size={16}/>Nova situação</button>}
    </div>

    <div className="space-y-2">
      {visible.map((situation) => <article key={situation.id} className="flex min-h-[70px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${situation.color}22`, color: situation.color }}><IconGlyph name={situation.icon}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{situation.name}</h2>{situation.system && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Sistema</span>}{!situation.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inativa</span>}</div>
          <span className="mt-1 inline-flex rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{situation.category ? situationCategoryLabel[situation.category] : 'Sem categoria'}</span>
        </div>
        {admin && <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="button-secondary icon-button size-9" aria-label={`Editar ${situation.name}`} onClick={() => setEditing(situation)}><Pencil size={16}/></button>
          <button type="button" className="button-secondary icon-button size-9 text-destructive" aria-label={`Excluir ${situation.name}`} title={situation.system ? 'Situações de sistema não podem ser excluídas' : 'Excluir situação'} disabled={situation.system} onClick={() => setDeleting(situation)}><Trash2 size={16}/></button>
        </div>}
      </article>)}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma situação encontrada.</p>}
    </div>

    {editing && <SituationEditor situation={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>}
    {filtersOpen && <Dialog title="Filtros de situações" onClose={() => setFiltersOpen(false)}><div className="space-y-4">
      <Field label="Categoria"><Select value={category} onChange={(event) => setCategory(event.target.value as SituationCategory | 'ALL')}><option value="ALL">Todas as categorias</option>{Object.entries(situationCategoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <label className="flex items-center gap-2 text-sm"><Switch checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)}/> Mostrar somente situações ativas</label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setCategory('ALL'); setActiveOnly(true) }}>Limpar</button><button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>Aplicar</button></div>
    </div></Dialog>}
    {deleting && <Dialog title="Excluir tipo de situação" onClose={() => setDeleting(null)}><p className="text-sm text-muted-foreground">Deseja excluir a situação <strong>{deleting.name}</strong>? Ela só poderá ser removida se não estiver sendo usada em uma etapa.</p>{remove.error && <div className="mt-4"><ErrorBox error={remove.error}/></div>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn-primary bg-destructive hover:bg-destructive/90" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{remove.isPending ? 'Excluindo…' : 'Excluir'}</button></div></Dialog>}
  </>
}

export function SituationEditor({ situation, onClose, onSaved, stacked = false }: {
  situation?: SituationType
  onClose: () => void
  onSaved: (situation: SituationType) => void
  stacked?: boolean
}) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(situation?.name ?? '')
  const [category, setCategory] = useState<SituationCategory | ''>(situation?.category ?? '')
  const [color, setColor] = useState(situation?.color ?? '#3498DB')
  const [icon, setIcon] = useState(situation?.icon ?? 'CircleDot')
  const [observation, setObservation] = useState(situation?.observation ?? '')
  const [active, setActive] = useState(situation?.active ?? true)
  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, category: category || undefined, color, icon, observation, active }
      return situation ? api.updateSituationType(ctx, situation.id, input) : api.createSituationType(ctx, input)
    },
    onSuccess: async (savedSituation) => {
      await invalidateAll(client)
      onSaved(savedSituation)
    },
  })

  return <Dialog title={situation ? 'Editar Tipo de Situação' : 'Novo Tipo de Situação'} onClose={onClose} stacked={stacked}>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <Field label="Descrição *"><Input autoFocus className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={120}/></Field>
      <Field label="Categoria"><Select className="field" value={category} onChange={(event) => setCategory(event.target.value as SituationCategory | '')}><option value="">— Sem categoria —</option>{Object.entries(situationCategoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="Cor"><div className="flex max-w-52 items-center gap-2 rounded-lg border border-border bg-background p-1.5"><Input aria-label="Selecionar cor" className="!mt-0 size-8 shrink-0 cursor-pointer border-0 p-0" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())}/><Input aria-label="Cor hexadecimal" className="!mt-0 border-0 bg-transparent px-1 font-mono text-sm font-semibold shadow-none" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} maxLength={7}/></div></Field>
      <Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field>
      <Field label="Observação"><textarea className="field min-h-24" maxLength={500} value={observation} onChange={(event) => setObservation(event.target.value)}/></Field>
      {situation && <label className="flex items-center gap-2 text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Situação ativa</label>}
      {mutation.error && <ErrorBox error={mutation.error}/>}
      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-border bg-white py-3 dark:bg-slate-900"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !name.trim()}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</button></div>
    </form>
  </Dialog>
}
