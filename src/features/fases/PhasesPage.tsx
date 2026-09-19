import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { ProtocolPhase } from '../../domain/model'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Switch } from '../../components/ui/Switch'
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { IconGlyph, IconSelect } from '../../components/ui/IconSelect'

const codeFor = (name: string) => {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'FASE_' + crypto.randomUUID().slice(0, 8).toLocaleUpperCase()
}

export function PhasesPage() {
  const ctx = useSession()
  const client = useQueryClient()
  const { data: db, isLoading } = useDb()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProtocolPhase | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ProtocolPhase | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeOnly, setActiveOnly] = useState(true)
  const admin = ctx.user?.role === 'ADMIN'
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePhase(ctx, id),
    onSuccess: () => {
      invalidateAll(client)
      setDeleting(null)
    },
  })

  if (isLoading || !db) return <Loading/>

  const query = search.trim().toLocaleLowerCase()
  const visible = db.phases.filter((phase) =>
    (!query || (phase.name + ' ' + phase.code + ' ' + (phase.description ?? '')).toLocaleLowerCase().includes(query)) &&
    (!activeOnly || phase.active),
  )

  return <>
    <PageTitle
      title="Tipos de Fases"
      action={admin ? <div className="flex items-center gap-2"><button type="button" className="button-secondary icon-button" aria-label="Mais ações" onClick={() => setFiltersOpen(true)}><MoreHorizontal size={18}/></button><button type="button" className="button-primary" onClick={() => setEditing('new')}><Plus size={16}/>Novo</button></div> : undefined}
    />
    <p className="-mt-3 mb-5 text-sm text-muted-foreground">Cadastre as fases reutilizadas na montagem dos fluxos de processo.</p>

    <div className="mb-5 flex flex-wrap items-center gap-2">
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><Input aria-label="Buscar fase" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." className="w-72 pl-9"/></label>
      <button type="button" className="button-secondary" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16}/>Mais filtros</button>
    </div>

    <div className="space-y-2" role="region" aria-label="Lista de fases">
      {visible.map((phase) => {
        const color = phase.color ?? '#3498DB'
        return <article key={phase.id} className="flex min-h-[66px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: color + '22', color }}><IconGlyph name={phase.icon}/></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{phase.name}</h2>{!phase.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inativa</span>}</div>
            {phase.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{phase.description}</p>}
          </div>
          {admin && <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="button-secondary icon-button size-9" aria-label={'Editar ' + phase.name} onClick={() => setEditing(phase)}><Pencil size={16}/></button>
            <button type="button" className="button-secondary icon-button size-9 text-destructive" aria-label={'Excluir ' + phase.name} onClick={() => setDeleting(phase)}><Trash2 size={16}/></button>
          </div>}
        </article>
      })}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma fase encontrada.</p>}
    </div>

    {editing && <PhaseEditor phase={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>}
    {filtersOpen && <Dialog title="Filtros de fases" onClose={() => setFiltersOpen(false)}><div className="space-y-4">
      <label className="block text-sm"><Switch checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)}/> Mostrar somente fases ativas</label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setActiveOnly(true)}>Limpar</button><button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>Aplicar</button></div>
    </div></Dialog>}
    {deleting && <Dialog title="Excluir tipo de fase" onClose={() => setDeleting(null)}>
      <p className="text-sm text-muted-foreground">Deseja excluir a fase <strong>{deleting.name}</strong>? Ela só poderá ser removida se não estiver sendo usada em um fluxo.</p>
      {remove.error && <div className="mt-4"><ErrorBox error={remove.error}/></div>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn-primary bg-destructive hover:bg-destructive/90" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{remove.isPending ? 'Excluindo…' : 'Excluir'}</button></div>
    </Dialog>}
  </>
}

function PhaseEditor({ phase, onClose, onSaved }: {
  phase?: ProtocolPhase
  onClose: () => void
  onSaved: () => void
}) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(phase?.name ?? '')
  const [color, setColor] = useState((phase?.color ?? '#3498DB').toLocaleUpperCase())
  const [icon, setIcon] = useState(phase?.icon ?? 'FileText')
  const [observation, setObservation] = useState(phase?.description ?? '')
  const [active, setActive] = useState(phase?.active ?? true)
  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        name,
        code: phase?.code ?? codeFor(name),
        description: observation || undefined,
        eligibleUnitIds: phase?.eligibleUnitIds ?? [],
        defaultDeadlineDays: phase?.defaultDeadlineDays,
        checklistItems: phase?.checklistItems ?? [],
        checklistQuestions: phase?.checklistQuestions ?? [],
        requiredAttachmentTypes: phase?.requiredAttachmentTypes ?? [],
        color,
        icon,
        active,
      }
      return phase ? api.updatePhase(ctx, phase.id, input) : api.createPhase(ctx, input)
    },
    onSuccess: () => {
      invalidateAll(client)
      onSaved()
    },
  })

  return <Dialog title={phase ? 'Editar Tipo de Fase' : 'Novo Tipo de Fase'} onClose={onClose}>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <Field label="Descrição *"><Input autoFocus className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={120}/></Field>
      <Field label="Cor"><div className="flex max-w-52 items-center gap-2 rounded-lg border border-border bg-background p-1.5"><Input aria-label="Selecionar cor" className="!mt-0 size-8 shrink-0 cursor-pointer border-0 p-0" type="color" value={color} onChange={(event) => setColor(event.target.value.toLocaleUpperCase())}/><Input aria-label="Cor hexadecimal" className="!mt-0 border-0 bg-transparent px-1 font-mono text-sm font-semibold shadow-none" value={color} onChange={(event) => setColor(event.target.value.toLocaleUpperCase())} maxLength={7}/></div></Field>
      <Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field>
      <Field label="Observação"><textarea className="field min-h-24" maxLength={500} value={observation} onChange={(event) => setObservation(event.target.value)}/></Field>
      {phase && <label className="block text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Fase ativa</label>}
      {mutation.error && <ErrorBox error={mutation.error}/>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !name.trim()}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</button></div>
    </form>
  </Dialog>
}


