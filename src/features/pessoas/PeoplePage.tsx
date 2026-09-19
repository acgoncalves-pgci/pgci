import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { Person, PersonRole, ResponsibilityPeriod } from '../../domain/model'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'

const roleLabel: Record<PersonRole, string> = {
  INTERESSADO: 'Interessado',
  CREDOR: 'Credor',
  RESPONSAVEL: 'Responsável',
}

const formatDocument = (value?: string) => {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return value ?? ''
}

const newPeriod = (): ResponsibilityPeriod => ({
  id: crypto.randomUUID(),
  description: '',
  startsAt: new Date().toISOString().slice(0, 10),
})

export function PeoplePage() {
  const ctx = useSession()
  const { data: db, isLoading } = useDb()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [kindFilter, setKindFilter] = useState<'ALL' | Person['kind']>('ALL')
  const [roleFilter, setRoleFilter] = useState<'ALL' | PersonRole>('ALL')
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const admin = ctx.user?.role === 'ADMIN'

  if (isLoading || !db) return <Loading variant="list"/>

  const query = search.trim().toLocaleLowerCase()
  const people = db.people.filter((person) => {
    const matchesSearch = !query || (person.name + ' ' + (person.document ?? '') + ' ' + (person.email ?? '')).toLocaleLowerCase().includes(query)
    const matchesKind = kindFilter === 'ALL' || person.kind === kindFilter
    const matchesRole = roleFilter === 'ALL' || person.roles.includes(roleFilter)
    const matchesActive = activeFilter === 'ALL' || (activeFilter === 'ACTIVE' ? person.active : !person.active)
    return matchesSearch && matchesKind && matchesRole && matchesActive
  })

  return <>
    <PageTitle
      title="Pessoas (Física/Jurídica)"
      action={<div className="flex items-center gap-2"><button type="button" className="button-secondary icon-button" aria-label="Mais ações" onClick={() => setFiltersOpen(true)}><MoreHorizontal size={18}/></button><button type="button" className="button-primary" onClick={() => setEditing('new')}><Plus size={16}/>Nova Pessoa</button></div>}
    />
    <p className="-mt-3 mb-5 text-sm text-muted-foreground">Interessados, credores e responsáveis do município.</p>

    <div className="mb-5 flex flex-wrap items-center gap-2">
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><Input aria-label="Buscar pessoas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, documento ou e-mail..." className="w-72 pl-9"/></label>
      <button type="button" className="button-secondary" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16}/>Mais filtros</button>
    </div>

    <div className="space-y-2" role="region" aria-label="Lista de pessoas">
      {people.map((person) => {
        const PersonIcon = person.kind === 'PF' ? UserRound : Building2
        const color = person.kind === 'PF' ? '#3498DB' : '#8E44AD'
        return <article key={person.id} className="flex min-h-[66px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: color + '20', color }}><PersonIcon size={19}/></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{person.name}</h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{person.kind}</span>
              {person.roles.map((role) => <span key={role} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium">{roleLabel[role]}</span>)}
              {!person.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inativa</span>}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{[formatDocument(person.document), person.email].filter(Boolean).join(' · ') || 'Sem documento ou e-mail informado'}</p>
          </div>
          {admin && <button type="button" className="button-secondary icon-button size-9" aria-label={'Editar ' + person.name} onClick={() => setEditing(person)}><Pencil size={16}/></button>}
        </article>
      })}
      {people.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>}
    </div>

    {editing && <PersonEditor person={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>}
    {filtersOpen && <Dialog title="Filtros de pessoas" onClose={() => setFiltersOpen(false)}><div className="space-y-4">
      <Field label="Tipo"><Select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}><option value="ALL">Pessoa física e jurídica</option><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></Select></Field>
      <Field label="Papel"><Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="ALL">Todos os papéis</option><option value="CREDOR">Credor</option><option value="INTERESSADO">Interessado</option><option value="RESPONSAVEL">Responsável</option></Select></Field>
      <Field label="Situação"><Select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}><option value="ALL">Todas</option><option value="ACTIVE">Ativas</option><option value="INACTIVE">Inativas</option></Select></Field>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setKindFilter('ALL'); setRoleFilter('ALL'); setActiveFilter('ALL') }}>Limpar</button><button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>Aplicar</button></div>
    </div></Dialog>}
  </>
}

function PersonEditor({ person, onClose, onSaved }: {
  person?: Person
  onClose: () => void
  onSaved: () => void
}) {
  const ctx = useSession()
  const client = useQueryClient()
  const [kind, setKind] = useState<Person['kind']>(person?.kind ?? 'PF')
  const [name, setName] = useState(person?.name ?? '')
  const [document, setDocument] = useState(formatDocument(person?.document))
  const [email, setEmail] = useState(person?.email ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [creditor, setCreditor] = useState(person?.roles.includes('CREDOR') ?? false)
  const [interested, setInterested] = useState(person?.roles.includes('INTERESSADO') ?? true)
  const [responsible, setResponsible] = useState(person?.roles.includes('RESPONSAVEL') ?? false)
  const [periods, setPeriods] = useState<ResponsibilityPeriod[]>(person?.roles.includes('RESPONSAVEL') ? (person.responsibilityPeriods?.length ? person.responsibilityPeriods : [newPeriod()]) : [])
  const [active, setActive] = useState(person?.active ?? true)
  const mutation = useMutation({
    mutationFn: () => {
      const roles = [creditor && 'CREDOR', interested && 'INTERESSADO', responsible && 'RESPONSAVEL'].filter(Boolean) as PersonRole[]
      const input = {
        kind,
        name,
        document: document || undefined,
        email: email || undefined,
        phone: phone || undefined,
        roles,
        responsibilityPeriods: responsible ? periods : [],
        active,
      }
      return person ? api.updatePerson(ctx, person.id, input) : api.createPerson(ctx, input)
    },
    onSuccess: () => {
      invalidateAll(client)
      onSaved()
    },
  })
  const toggleResponsible = (checked: boolean) => {
    setResponsible(checked)
    if (checked && periods.length === 0) setPeriods([newPeriod()])
  }
  const updatePeriod = (periodId: string, changes: Partial<ResponsibilityPeriod>) => {
    setPeriods((current) => current.map((period) => period.id === periodId ? { ...period, ...changes } : period))
  }

  return <Dialog title={person ? 'Editar Pessoa' : 'Nova Pessoa'} onClose={onClose} wide>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="label mb-4">Tipo e identificação</h3>
        <fieldset>
          <legend className="label mb-2">Tipo</legend>
          <div className="mb-4 flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="person-kind" value="PF" checked={kind === 'PF'} onChange={() => setKind('PF')}/>Pessoa Física</label>
            <label className="flex items-center gap-2"><input type="radio" name="person-kind" value="PJ" checked={kind === 'PJ'} onChange={() => setKind('PJ')}/>Pessoa Jurídica</label>
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={kind === 'PF' ? 'CPF' : 'CNPJ'}><Input className="field" value={document} onChange={(event) => setDocument(event.target.value)} maxLength={kind === 'PF' ? 14 : 18}/></Field>
          <Field label={kind === 'PF' ? 'Nome completo *' : 'Razão social *'}><Input className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={160}/></Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="label mb-4">Contato</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail"><Input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)}/></Field>
          <Field label="Telefone"><Input className="field" value={phone} onChange={(event) => setPhone(event.target.value)}/></Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="label mb-3">Papéis</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 text-sm font-semibold"><span>É credor?</span><Switch aria-label="É credor?" checked={creditor} onCheckedChange={setCreditor}/></label>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold"><span>É interessado?</span><Switch aria-label="É interessado?" checked={interested} onCheckedChange={setInterested}/></label>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold"><span>É responsável?</span><Switch aria-label="É responsável?" checked={responsible} onCheckedChange={toggleResponsible}/></label>
        </div>
      </section>

      {responsible && <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="label">Períodos de responsabilidade</h3><button type="button" className="button-secondary" onClick={() => setPeriods((current) => [...current, newPeriod()])}><Plus size={16}/>Adicionar</button></div>
        <div className="space-y-3">
          {periods.map((period, index) => <div key={period.id} className="grid items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]">
            <Field label="Setor / Descrição"><Input className="field" aria-label={'Setor / Descrição ' + (index + 1)} value={period.description} onChange={(event) => updatePeriod(period.id, { description: event.target.value })} placeholder="Ex.: Secretaria de Saúde"/></Field>
            <Field label="Início"><Input className="field" aria-label={'Início ' + (index + 1)} type="date" value={period.startsAt} onChange={(event) => updatePeriod(period.id, { startsAt: event.target.value })}/></Field>
            <Field label="Fim"><Input className="field" aria-label={'Fim ' + (index + 1)} type="date" value={period.endsAt ?? ''} min={period.startsAt} onChange={(event) => updatePeriod(period.id, { endsAt: event.target.value || undefined })}/></Field>
            <button type="button" className="button-secondary icon-button size-10 text-destructive" aria-label={'Remover período ' + (index + 1)} onClick={() => setPeriods((current) => current.filter((item) => item.id !== period.id))}><Trash2 size={16}/></button>
          </div>)}
          {periods.length === 0 && <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Nenhum período informado. Use “Adicionar” para registrar um período.</p>}
        </div>
      </section>}

      {person && <label className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm font-semibold"><span>Pessoa ativa</span><Switch checked={active} onCheckedChange={setActive}/></label>}
      {mutation.error && <ErrorBox error={mutation.error}/>}
      <div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !name.trim()}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</button></div>
    </form>
  </Dialog>
}
