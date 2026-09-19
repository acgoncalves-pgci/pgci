import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { ProcessCategory } from '../../domain/model'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { api } from '../../services/api'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Switch } from '../../components/ui/Switch'
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { IconGlyph, IconSelect } from '../../components/ui/IconSelect'

export function ProcessCategoriesPage() {
  const ctx = useSession()
  const client = useQueryClient()
  const { data: db, isLoading } = useDb()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProcessCategory | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ProcessCategory | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeOnly, setActiveOnly] = useState(true)
  const admin = ctx.user?.role === 'ADMIN'
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteProcessCategory(ctx, id),
    onSuccess: () => { invalidateAll(client); setDeleting(null) },
  })

  if (isLoading || !db) return <Loading/>
  const query = search.trim().toLocaleLowerCase()
  const visible = db.processCategories.filter((category) =>
    (!query || (category.code + ' ' + category.name + ' ' + (category.observation ?? '')).toLocaleLowerCase().includes(query)) &&
    (!activeOnly || category.active),
  ).sort((left, right) => left.code.localeCompare(right.code, 'pt-BR', { numeric: true }))

  return <>
    <PageTitle
      title="Categorias de Processo"
      action={admin ? <div className="flex items-center gap-2"><button type="button" className="button-secondary icon-button" aria-label="Mais ações" onClick={() => setFiltersOpen(true)}><MoreHorizontal size={18}/></button><button type="button" className="button-primary" onClick={() => setEditing('new')}><Plus size={16}/>Nova</button></div> : undefined}
    />
    <p className="-mt-3 mb-5 text-sm text-muted-foreground">Organize os tipos de processo em categorias reutilizáveis.</p>

    <div className="mb-5 flex flex-wrap items-center gap-2">
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><Input aria-label="Buscar categoria" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código ou nome..." className="w-72 pl-9"/></label>
      <button type="button" className="button-secondary" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16}/>Mais filtros</button>
    </div>

    <div className="space-y-2" role="region" aria-label="Lista de categorias de processo">
      {visible.map((category) => <article key={category.id} className="flex min-h-[66px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: category.color + '22', color: category.color }}><IconGlyph name={category.icon}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold"><span className="font-mono">{category.code}</span> — {category.name}</h2>{!category.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inativa</span>}</div>
          {category.observation && <p className="mt-0.5 truncate text-xs text-muted-foreground">{category.observation}</p>}
        </div>
        {admin && <div className="flex shrink-0 items-center gap-2"><button type="button" className="button-secondary icon-button size-9" aria-label={'Editar ' + category.name} onClick={() => setEditing(category)}><Pencil size={16}/></button><button type="button" className="button-secondary icon-button size-9 text-destructive" aria-label={'Excluir ' + category.name} onClick={() => setDeleting(category)}><Trash2 size={16}/></button></div>}
      </article>)}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>}
    </div>

    {editing && <CategoryEditor category={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>} 
    {filtersOpen && <Dialog title="Filtros de categorias" onClose={() => setFiltersOpen(false)}><div className="space-y-4"><label className="block text-sm"><Switch checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)}/> Mostrar somente categorias ativas</label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setActiveOnly(true)}>Limpar</button><button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>Aplicar</button></div></div></Dialog>}
    {deleting && <Dialog title="Excluir categoria de processo" onClose={() => setDeleting(null)}><p className="text-sm text-muted-foreground">Deseja excluir a categoria <strong>{deleting.name}</strong>? Ela só poderá ser removida se não estiver vinculada a um tipo de processo.</p>{remove.error && <div className="mt-4"><ErrorBox error={remove.error}/></div>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn-primary bg-destructive hover:bg-destructive/90" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{remove.isPending ? 'Excluindo…' : 'Excluir'}</button></div></Dialog>}
  </>
}

function CategoryEditor({ category, onClose, onSaved }: { category?: ProcessCategory; onClose: () => void; onSaved: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [code, setCode] = useState(category?.code ?? '')
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState((category?.color ?? '#3498DB').toLocaleUpperCase())
  const [icon, setIcon] = useState(category?.icon ?? 'FileText')
  const [observation, setObservation] = useState(category?.observation ?? '')
  const [active, setActive] = useState(category?.active ?? true)
  const mutation = useMutation({
    mutationFn: () => {
      const input = { code, name, color, icon, observation: observation || undefined, active }
      return category ? api.updateProcessCategory(ctx, category.id, input) : api.createProcessCategory(ctx, input)
    },
    onSuccess: () => { invalidateAll(client); onSaved() },
  })

  return <Dialog title={category ? 'Editar Categoria de Processo' : 'Nova Categoria de Processo'} onClose={onClose}>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]"><Field label="Código *"><Input autoFocus className="field font-mono" value={code} onChange={(event) => setCode(event.target.value)} maxLength={20} placeholder="00"/></Field><Field label="Nome *"><Input className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={120}/></Field></div>
      <Field label="Cor"><div className="flex max-w-52 items-center gap-2 rounded-lg border border-border bg-background p-1.5"><Input aria-label="Selecionar cor" className="!mt-0 size-8 shrink-0 cursor-pointer border-0 p-0" type="color" value={color} onChange={(event) => setColor(event.target.value.toLocaleUpperCase())}/><Input aria-label="Cor hexadecimal" className="!mt-0 border-0 bg-transparent px-1 font-mono text-sm font-semibold shadow-none" value={color} onChange={(event) => setColor(event.target.value.toLocaleUpperCase())} maxLength={7}/></div></Field>
      <Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field>
      <Field label="Observação"><textarea className="field min-h-24" maxLength={500} value={observation} onChange={(event) => setObservation(event.target.value)}/></Field>
      {category && <label className="block text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Categoria ativa</label>}
      {mutation.error && <ErrorBox error={mutation.error}/>} 
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !code.trim() || !name.trim()}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</button></div>
    </form>
  </Dialog>
}
