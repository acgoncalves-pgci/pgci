import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, CircleDot, ClipboardList, GitBranch, ListChecks, MoreHorizontal, Paperclip, Pencil, Plus, Search, SlidersHorizontal, Tags, Trash2 } from 'lucide-react'
import type { Attachment, ChecklistQuestion, FlowMode, ProcessCategory, ProtocolFlow, ProtocolPhase, ProtocolType, SituationType, Unit } from '../../domain/model'
import { sortUnitsByPath, unitPath } from '../../domain/units'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { IconGlyph, IconSelect } from '../../components/ui/IconSelect'
import { CategoryEditor, ProcessCategoriesPage } from '../categorias/ProcessCategoriesPage'
import { SituationEditor, SituationsPage } from '../situacoes/SituationsPage'

type Tab = 'types' | 'phases' | 'categories' | 'situations'

function QuickCreateField({ label, actionLabel, onCreate, children }: { label: string; actionLabel: string; onCreate: () => void; children: ReactNode }) {
  return <div className="relative min-w-0"><span className="label">{label}</span><button type="button" aria-label={actionLabel} className="absolute right-0 top-0 inline-flex items-center gap-1 text-xs font-semibold text-public-700 transition-colors hover:text-public-800 hover:underline" onClick={onCreate}><Plus size={13}/>Nova</button>{children}</div>
}
export function ProtocolTypesPage() {
  const ctx = useSession()
  const { data: db, isLoading } = useDb()
  const [tab, setTab] = useState<Tab>('types')
  const [typeEditing, setTypeEditing] = useState<ProtocolType | 'new' | null>(null)
  const [phaseEditing, setPhaseEditing] = useState<ProtocolPhase | 'new' | null>(null)
  const [typeFilesEditing, setTypeFilesEditing] = useState<ProtocolType | null>(null)
  const [flowManaging, setFlowManaging] = useState<ProtocolType | null>(null)

  if (isLoading || !db) return <Loading />
  const admin = ctx.user?.role === 'ADMIN'

  if (flowManaging) { const currentType = db.protocolTypes.find((type) => type.id === flowManaging.id) ?? flowManaging; return <TypeFlowPage type={currentType} flows={db.flows} flowPhases={db.flowPhases} phases={db.phases} situations={db.situations} units={db.units} editable={admin} onBack={() => setFlowManaging(null)} /> }

  return <>
    <PageTitle title="Tipos de processo" />
    <p className="-mt-3 mb-5 text-sm text-slate-600 dark:text-slate-300">Configure os tipos, suas etapas de fluxo e as fases reutilizáveis.</p>
    <div className="mb-5 flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Configuração de processos">
      {([
        ['types', ClipboardList, 'Tipos'],
        ['phases', ListChecks, 'Fases'],
        ['categories', Tags, 'Categorias'],
        ['situations', CircleDot, 'Situações'],
      ] as const).map(([key, Icon, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-public-700 text-public-700' : 'border-transparent text-slate-500 dark:text-slate-400'}`}><Icon size={16} />{label}</button>)}
    </div>
    {tab === 'types' && <TypesList types={db.protocolTypes} categories={db.processCategories} flowPhases={db.flowPhases} attachments={db.attachments} editable={admin} onEdit={setTypeEditing} onOpenFlow={setFlowManaging} onEditFiles={setTypeFilesEditing} onNew={() => setTypeEditing('new')} />}
    {tab === 'phases' && <PhasesList phases={db.phases} editable={admin} onEdit={setPhaseEditing} onNew={() => setPhaseEditing('new')} />}
    {tab === 'categories' && <ProcessCategoriesPage embedded />}
    {tab === 'situations' && <SituationsPage embedded />}
    {typeEditing && <ProtocolTypeEditor categories={db.processCategories} type={typeEditing === 'new' ? undefined : typeEditing} onClose={() => setTypeEditing(null)} onSaved={() => setTypeEditing(null)} />}
    {phaseEditing && <PhaseEditor phase={phaseEditing === 'new' ? undefined : phaseEditing} onClose={() => setPhaseEditing(null)} onSaved={() => setPhaseEditing(null)} />}
    {typeFilesEditing && <TypeAttachmentsDialog type={typeFilesEditing} attachments={db.attachments.filter((attachment) => attachment.typeId === typeFilesEditing.id)} editable={admin} onClose={() => setTypeFilesEditing(null)} />}
  </>
}
function TypesList({ types, categories, flowPhases, attachments, editable, onEdit, onOpenFlow, onEditFiles, onNew }: { types: ProtocolType[]; categories: ProcessCategory[]; flowPhases: { flowId: string; phaseId: string; position: number }[]; attachments: Attachment[]; editable: boolean; onEdit: (type: ProtocolType) => void; onOpenFlow: (type: ProtocolType) => void; onEditFiles: (type: ProtocolType) => void; onNew: () => void }) {
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [flowFilter, setFlowFilter] = useState<'ALL' | FlowMode>('ALL')
  const [requirementFilter, setRequirementFilter] = useState('')
  const [situationFilter, setSituationFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const ctx = useSession()
  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])
  const client = useQueryClient()
  const markAll = useMutation({
    mutationFn: () => Promise.all(types.map((type) => {
      const { id, ...input } = type
      return api.updateProtocolType(ctx, id, { ...input, flowMode: type.flowMode === 'NONE' || !type.flowMode ? 'SUGGESTED' : type.flowMode, fieldsConfig: { ...type.fieldsConfig, tramitacao: { enabled: true } } })
    })),
    onSuccess: () => { invalidateAll(client); setMenuOpen(false) },
  })
  const deleteAll = useMutation({
    mutationFn: () => api.deleteAllProtocolTypes(ctx),
    onSuccess: () => { invalidateAll(client); setDeleteOpen(false); setMenuOpen(false) },
  })

  const hasRequirement = (type: ProtocolType, requirement: string) => {
    if (!requirement) return true
    if (requirement === 'tramitacao') return Boolean(type.fieldsConfig.tramitacao?.enabled || type.flowId)
    const fieldByIndicator: Record<string, keyof typeof type.fieldsConfig> = { credor: 'creditor', interessado: 'interested', responsavel: 'responsavel', assunto: 'assunto', arquivos: 'arquivos', amount: 'amount', portal: 'portal' }
    const field = fieldByIndicator[requirement]
    return Boolean(field && type.fieldsConfig[field]?.enabled)
  }

  const shown = types.filter((type) => {
    const term = search.toLocaleLowerCase()
    const matchesSearch = type.name.toLocaleLowerCase().includes(term)
    const currentFlowMode = type.flowMode ?? (type.flowId ? 'REQUIRED' : 'NONE')
    const matchesFlow = flowFilter === 'ALL' || currentFlowMode === flowFilter
    const matchesSituation = situationFilter === 'ALL' || (situationFilter === 'ACTIVE' ? type.active : !type.active)
    return matchesSearch && matchesFlow && matchesSituation && hasRequirement(type, requirementFilter)
  })

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input aria-label="Buscar tipo de processo" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." className="w-60 pl-9" /></div>
        <button className="button-secondary" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} />Mais filtros</button>
      </div>
      {editable && <div ref={menuRef} className="relative flex items-center gap-2">
        <button className="button-secondary icon-button" aria-label="Ações em massa" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={18} /></button>
        {menuOpen && <div className="absolute right-12 top-0 z-30 w-64 rounded-xl border border-border bg-popover p-2 text-sm shadow-xl">
          <p className="px-2 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground">MANUTENÇÃO</p>
          <button className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-muted" onClick={() => markAll.mutate()} disabled={markAll.isPending}><span className="flex items-center gap-2"><GitBranch size={15} />Marcar todos com tramitação</span><span className="text-xs text-muted-foreground">{types.length}</span></button>
          <div className="my-1 border-t border-border" />
          <p className="px-2 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground">EXCLUIR REGISTROS</p>
          <button className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-destructive hover:bg-destructive/10" onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}><span className="flex items-center gap-2"><Trash2 size={15} />Excluir todos os Tipos de Processo</span><span className="text-xs">{types.length}</span></button>
        </div>}
        <button className="button-primary" onClick={onNew}><Plus size={16} />Novo</button>
      </div>}
    </div>

    <div className="space-y-1.5">
      {shown.map((type) => {
        const category = categories.find((item) => item.id === type.categoryId)
        const flowMode = type.flowMode ?? (type.flowId ? 'REQUIRED' : 'NONE')
        const flowLabel = flowMode === 'REQUIRED' ? 'FLUXO OBRIGATÓRIO' : flowMode === 'SUGGESTED' ? 'FLUXO SUGERIDO' : 'SEM FLUXO'
        const stageCount = type.flowId ? flowPhases.filter((stage) => stage.flowId === type.flowId).length : 0
        const fileCount = attachments.filter((attachment) => attachment.typeId === type.id).length
        return <article key={type.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 shadow-sm" style={{ backgroundColor: `${type.color}0d`, borderColor: `${type.color}42` }}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${type.color}22`, color: type.color }}><IconGlyph name={type.icon} size={19}/></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">{category ? category.code + ' · ' + category.name + ' · ' : ''}{flowLabel}</p>
            <h3 className="truncate text-sm font-semibold">{type.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              {(['tramitacao', 'credor', 'interessado', 'responsavel', 'assunto', 'arquivos', 'amount', 'portal'] as const).map((item) => {
                const labels: Record<string, string> = { tramitacao: 'Tramitação', credor: 'Credor', interessado: 'Interessado', responsavel: 'Responsável', assunto: 'Assunto', arquivos: 'Arquivos', amount: 'Valor', portal: 'Portal do cidadão' }
                const enabled = hasRequirement(type, item)
                return <span key={item} className={`inline-flex items-center gap-1 ${enabled ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}><i aria-hidden="true" className={`size-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />{labels[item]}</span>
              })}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className={`button-secondary h-8 px-3 ${stageCount ? '' : 'opacity-50'}`} aria-label={`Configurar fluxo de ${type.name}: ${stageCount} etapa(s)`} disabled={!editable} onClick={() => onOpenFlow(type)}><GitBranch size={15} />Fluxo <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-700 dark:bg-slate-800 dark:text-slate-200">{stageCount}</span><ChevronRight size={14} /></button>
            <button type="button" className={`button-secondary h-8 px-3 ${fileCount ? '' : 'opacity-50'}`} aria-label={`${fileCount} arquivo(s) associado(s) a ${type.name}`} onClick={() => onEditFiles(type)} disabled={!editable && !fileCount}><Paperclip size={15} />Arquivos <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-700 dark:bg-slate-800 dark:text-slate-200">{fileCount}</span><ChevronRight size={14} /></button>
            {editable && <>
              <button className="button-secondary icon-button size-8" aria-label={`Editar ${type.name}`} onClick={() => onEdit(type)}><Pencil size={15} /></button>
              <button className="button-secondary icon-button size-8 text-destructive" aria-label={`Excluir ${type.name}`} disabled><Trash2 size={15} /></button>
            </>}
          </div>
        </article>
      })}
      {shown.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhum tipo encontrado. Ajuste a busca ou os filtros aplicados.</p>}
    </div>

    {filtersOpen && <Dialog title="Filtros" onClose={() => setFiltersOpen(false)}>
      <div className="space-y-4">
        <Field label="Fluxo"><Select value={flowFilter} onChange={(event) => setFlowFilter(event.target.value as 'ALL' | FlowMode)}><option value="ALL">Todos os fluxos</option><option value="NONE">Sem fluxo</option><option value="SUGGESTED">Fluxo sugerido</option><option value="REQUIRED">Fluxo obrigatório</option></Select></Field>
        <Field label="Requisitos"><Select value={requirementFilter} onChange={(event) => setRequirementFilter(event.target.value)}><option value="">Selecionar...</option><option value="tramitacao">Tem tramitação</option><option value="credor">Tem credor</option><option value="interessado">Tem interessado</option><option value="responsavel">Tem responsável</option><option value="assunto">Tem assunto</option><option value="arquivos">Tem arquivos</option><option value="amount">Tem valor</option><option value="portal">Tem portal do cidadão</option></Select></Field>
        <Field label="Situação"><Select value={situationFilter} onChange={(event) => setSituationFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}><option value="ALL">Todas as situações</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option></Select></Field>
        <div className="flex justify-end gap-2"><button className="button-secondary" onClick={() => setFiltersOpen(false)}>Cancelar</button><button className="button-primary" onClick={() => setFiltersOpen(false)}>Aplicar</button></div>
      </div>
    </Dialog>}
    {deleteOpen && <Dialog title="Excluir todos os tipos de processo" onClose={() => setDeleteOpen(false)}>
      <div className="space-y-4"><p className="text-sm text-muted-foreground">Esta ação remove todos os tipos de processo. Ela só será permitida se não houver processos vinculados.</p>{deleteAll.error && <ErrorBox error={deleteAll.error} />}<div className="flex justify-end gap-2"><button className="button-secondary" onClick={() => setDeleteOpen(false)}>Cancelar</button><button className="button-primary bg-destructive hover:bg-destructive/90" onClick={() => deleteAll.mutate()} disabled={deleteAll.isPending}>Excluir todos</button></div></div>
    </Dialog>}
  </div>
}
function TypeFlowPage({ type, flows, flowPhases, phases, situations, units, editable, onBack }: {
  type: ProtocolType
  flows: ProtocolFlow[]
  flowPhases: Array<{
    flowId: string
    phaseId: string
    position: number
    required: boolean
    situationTypeId?: string
    destinationUnitId?: string
    requiresChecklist?: boolean
    requiresAttachment?: boolean
    checklistQuestions?: ChecklistQuestion[]
    observation?: string
    color?: string
    icon?: string
  }>
  phases: ProtocolPhase[]
  situations: SituationType[]
  units: Unit[]
  editable: boolean
  onBack: () => void
}) {
  type Stage = {
    phaseId: string
    required: boolean
    situationTypeId?: string
    destinationUnitId?: string
    requiresChecklist?: boolean
    requiresAttachment?: boolean
    checklistQuestions?: ChecklistQuestion[]
    observation?: string
    color?: string
    icon?: string
  }

  const ctx = useSession()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [checklistStage, setChecklistStage] = useState<number | null>(null)
  const flow = type.flowId ? flows.find((item) => item.id === type.flowId) : undefined
  const stages = flow ? flowPhases.filter((stage) => stage.flowId === flow.id).sort((a, b) => a.position - b.position) : []
  const stageInput = ({ phaseId, required, situationTypeId, destinationUnitId, requiresChecklist, requiresAttachment, checklistQuestions, observation, color, icon }: Stage): Stage => ({
    phaseId,
    required,
    situationTypeId,
    destinationUnitId,
    requiresChecklist,
    requiresAttachment,
    checklistQuestions,
    observation,
    color,
    icon,
  })
  const saveStages = useMutation({
    mutationFn: (nextStages: Stage[]) => api.saveProtocolTypeFlow(ctx, type.id, nextStages),
    onSuccess: () => { invalidateAll(client); setEditing(null) },
  })
  const removeStage = useMutation({
    mutationFn: async (position: number) => {
      const nextStages = stages.filter((stage) => stage.position !== position).map(stageInput)
      if (nextStages.length) return saveStages.mutateAsync(nextStages)
      return api.clearProtocolTypeFlow(ctx, type.id)
    },
    onSuccess: () => { invalidateAll(client); setChecklistStage(null) },
  })
  const saveStage = (stage: Stage, position?: number) => {
    if (saveStages.isPending) return
    const nextStages = position === undefined ? [...stages, stage] : stages.map((current) => current.position === position ? { ...current, ...stage } : current)
    saveStages.mutate(nextStages.map(stageInput))
  }
  const visible = stages.filter((stage) => {
    const phase = phases.find((item) => item.id === stage.phaseId)
    const situation = situations.find((item) => item.id === stage.situationTypeId)
    const unit = units.find((item) => item.id === stage.destinationUnitId)
    return ((phase?.name ?? '') + ' ' + (situation?.name ?? '') + ' ' + (unit?.name ?? '')).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  })
  const editingStage = editing === null || editing === 'new' ? undefined : stages.find((stage) => stage.position === editing)
  const checklist = checklistStage === null ? undefined : stages.find((stage) => stage.position === checklistStage)
  const checklistPhase = checklist ? phases.find((phase) => phase.id === checklist.phaseId) : undefined
  const checklistSituation = checklist ? situations.find((situation) => situation.id === checklist.situationTypeId) : undefined
  const defaultSituationId = situations.find((situation) => situation.id === 'situation-processing' && situation.active)?.id ?? situations.find((situation) => situation.active)?.id

  return <>
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="label mb-1">Tipos de processo · {type.name}</p>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><GitBranch size={19} /></span>Fluxo — {type.name}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Configure a sequência de etapas e a situação exibida em cada uma.</p>
      </div>
      <button type="button" className="btn-secondary" onClick={onBack} aria-label="Voltar para tipos de processo"><ChevronRight className="rotate-180" size={17} /></button>
    </div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input aria-label="Buscar etapa" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por fase, situação, unidade..." className="w-72 pl-9" /></div>
      </div>
      {editable && <button type="button" className="button-primary" onClick={() => setEditing('new')}><Plus size={16} />Nova etapa</button>}
    </div>
    <div className="space-y-2">
      {visible.map((stage) => {
        const phase = phases.find((item) => item.id === stage.phaseId)
        const situation = situations.find((item) => item.id === stage.situationTypeId)
        return <article key={stage.phaseId + '-' + stage.position} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{stage.position + 1}</span>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><GitBranch size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{phase?.name ?? 'Fase removida'}</h2>
              {situation && <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: situation.color + '18', borderColor: situation.color + '55', color: situation.color }}><IconGlyph name={situation.icon} size={12}/>{situation.name}</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{stage.destinationUnitId ? units.find((unit) => unit.id === stage.destinationUnitId)?.name ?? 'Unidade removida' : 'Sem destino fixo'} · {stage.requiresChecklist ? (stage.checklistQuestions?.length ?? 0) + ' pergunta(s) no checklist' : 'Sem checklist'}{stage.requiresAttachment ? ' · Exige anexo' : ''}</p>
          </div>
          {editable && <div className="flex shrink-0 gap-2">
            {stage.requiresChecklist && <button type="button" className="button-secondary icon-button size-8" aria-label={'Gerenciar checklist da etapa ' + (stage.position + 1)} onClick={() => setChecklistStage(stage.position)}><ListChecks size={15} /></button>}
            <button type="button" className="button-secondary icon-button size-8" aria-label={'Editar etapa ' + (stage.position + 1)} onClick={() => setEditing(stage.position)}><Pencil size={15} /></button>
            <button type="button" className="button-secondary icon-button size-8 text-destructive" aria-label={'Excluir etapa ' + (stage.position + 1)} disabled={removeStage.isPending} onClick={() => removeStage.mutate(stage.position)}><Trash2 size={15} /></button>
          </div>}
        </article>
      })}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{stages.length ? 'Nenhuma etapa corresponde à busca.' : 'Nenhuma etapa configurada. Crie a primeira etapa deste fluxo.'}</p>}
    </div>
    {saveStages.error && <div className="mt-4"><ErrorBox error={saveStages.error} /></div>}
    {removeStage.error && <div className="mt-4"><ErrorBox error={removeStage.error} /></div>}
    {editing !== null && <StageEditor
      saving={saveStages.isPending}
      draft={editing === 'new' ? { phaseId: '', required: true, situationTypeId: defaultSituationId, requiresChecklist: false, requiresAttachment: false, color: '#3498db', icon: 'ArrowRight' } : editingStage!}
      phases={phases}
      situations={situations}
      units={units}
      order={editing === 'new' ? stages.length + 1 : editing + 1}
      onClose={() => setEditing(null)}
      onSave={(stage) => saveStage(stage, editing === 'new' ? undefined : editing)}
    />}
    {checklist && <ChecklistEditor title={'Checklist — ' + (checklistPhase?.name ?? 'Etapa') + (checklistSituation ? ' · ' + checklistSituation.name : '')} questions={checklist.checklistQuestions ?? []} onChange={(questions) => saveStage({ ...checklist, checklistQuestions: questions }, checklist.position)} onClose={() => setChecklistStage(null)} />}
  </>
}

function TypeAttachmentsDialog({ type, attachments, editable, onClose }: { type: ProtocolType; attachments: Attachment[]; editable: boolean; onClose: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const add = useMutation({ mutationFn: (files: File[]) => api.addProtocolTypeAttachments(ctx, type.id, files), onSuccess: () => invalidateAll(client) })
  const remove = useMutation({ mutationFn: (attachmentId: string) => api.removeProtocolTypeAttachment(ctx, attachmentId), onSuccess: () => invalidateAll(client) })

  return <Dialog title={`Arquivos — ${type.name}`} onClose={onClose}>
    <div className="space-y-4">
      {editable && <div className="flex justify-end"><input ref={inputRef} className="sr-only" type="file" multiple accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) add.mutate(files); event.currentTarget.value = '' }} /><button type="button" className="btn-primary" disabled={add.isPending} onClick={() => inputRef.current?.click()}><Paperclip size={16} />{add.isPending ? 'Anexando…' : 'Anexar arquivos'}</button></div>}
      {add.error && <ErrorBox error={add.error} />}{remove.error && <ErrorBox error={remove.error} />}
      {attachments.length ? <div className="divide-y rounded-lg border">{attachments.map((attachment) => <div className="flex items-center justify-between gap-3 px-3 py-3" key={attachment.id}><div className="min-w-0"><strong className="block truncate text-sm">{attachment.filename}</strong><small className="text-slate-500 dark:text-slate-400">{Math.ceil(attachment.sizeBytes / 1024)} KB · {attachment.mimeType}</small></div>{editable && <button type="button" className="btn-secondary !p-2 text-red-600" aria-label={`Remover ${attachment.filename}`} disabled={remove.isPending} onClick={() => remove.mutate(attachment.id)}><Trash2 size={16} /></button>}</div>)}</div> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum arquivo associado a este tipo.</p>}
      <div className="flex justify-end"><button type="button" className="btn-secondary" onClick={onClose}>Fechar</button></div>
    </div>
  </Dialog>
}
function PhasesList({ phases, editable, onEdit, onNew }: { phases: ProtocolPhase[]; editable: boolean; onEdit: (phase: ProtocolPhase) => void; onNew: () => void }) {
  const [search, setSearch] = useState('')
  const visible = phases.filter((phase) => `${phase.code} ${phase.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input aria-label="Buscar fase" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." className="w-60 pl-9" /></div><button className="button-secondary"><SlidersHorizontal size={16} />Mais filtros</button></div>{editable && <div className="flex items-center gap-2"><button className="button-secondary icon-button" aria-label="Ações em massa"><MoreHorizontal size={18} /></button><button className="button-primary" onClick={onNew}><Plus size={16} />Novo</button></div>}</div>
    <div className="space-y-1.5">{visible.map((phase) => { const color = phase.color ?? '#3498db'; return <article key={phase.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"><span className="grid size-9 place-items-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}><IconGlyph name={phase.icon} size={18}/></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{phase.name}</h2><p className="text-xs text-muted-foreground">{phase.description || phase.code}</p></div>{editable && <div className="flex items-center gap-2"><button className="button-secondary icon-button size-8" aria-label={`Editar ${phase.name}`} onClick={() => onEdit(phase)}><Pencil size={15} /></button><button className="button-secondary icon-button size-8 text-destructive" aria-label={`Excluir ${phase.name}`} disabled><Trash2 size={15} /></button></div>}</article> })}{visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma fase encontrada.</p>}</div>
  </div>
}
function ProtocolTypeEditor({ type, categories, onClose, onSaved }: { type?: ProtocolType; categories: ProcessCategory[]; onClose: () => void; onSaved: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(type?.name ?? '')
  const [observation, setObservation] = useState(type?.description ?? '')
  const [color, setColor] = useState(type?.color ?? '#3498db')
  const [icon, setIcon] = useState(type?.icon ?? 'FileText')
  const [flowMode, setFlowMode] = useState<FlowMode>(type?.flowMode ?? (type?.flowId ? 'REQUIRED' : 'NONE'))
  const [deadline, setDeadline] = useState(type?.defaultDeadlineDays?.toString() ?? '')
  const [active, setActive] = useState(type?.active ?? true)
  const [categoryId, setCategoryId] = useState(type?.categoryId ?? categories.find((category) => category.active)?.id ?? '')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [interested, setInterested] = useState(type?.fieldsConfig.interested ?? { enabled: false, required: false })
  const [creditor, setCreditor] = useState(type?.fieldsConfig.creditor ?? { enabled: false, required: false })
  const [amount, setAmount] = useState(type?.fieldsConfig.amount ?? { enabled: false, required: false })
  const [responsavel, setResponsavel] = useState(type?.fieldsConfig.responsavel?.enabled ?? false)
  const [assunto, setAssunto] = useState(type?.fieldsConfig.assunto?.enabled ?? true)
  const [arquivos, setArquivos] = useState(type?.fieldsConfig.arquivos?.enabled ?? false)
  const [portal, setPortal] = useState(type?.fieldsConfig.portal?.enabled ?? false)
  const mutation = useMutation({
    mutationFn: () => {
      const fieldsConfig = { interested, creditor, amount, tramitacao: { enabled: flowMode !== 'NONE' }, responsavel: { enabled: responsavel }, assunto: { enabled: assunto }, arquivos: { enabled: arquivos }, portal: { enabled: portal } }
      const input = { name, categoryId: categoryId || undefined, description: observation, color, icon, flowId: flowMode === 'NONE' ? undefined : type?.flowId, flowMode, defaultDeadlineDays: deadline ? Number(deadline) : undefined, active, fieldsConfig }
      return type ? api.updateProtocolType(ctx, type.id, input) : api.createProtocolType(ctx, input)
    },
    onSuccess: () => { invalidateAll(client); onSaved() },
  })
  const requirement = (label: string, checked: boolean, set: (checked: boolean) => void) => <label className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span>{label}</span><Switch checked={checked} onChange={(event) => set(event.target.checked)}/></label>

  return <>
    <Dialog title={type ? 'Editar tipo de processo' : 'Novo tipo de processo'} onClose={onClose} wide>
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <div className="space-y-5 lg:grid lg:grid-cols-12 lg:gap-5 lg:space-y-0">
          <section className="rounded-lg border p-4 lg:col-span-12">
            <h3 className="label mb-3">Identidade</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Descrição *"><Input className="field" placeholder="Ex.: Tipos de serviço público" value={name} onChange={(event) => setName(event.target.value)}/></Field>
              <QuickCreateField label="Categoria" actionLabel="Nova categoria" onCreate={() => setCreatingCategory(true)}>
                <Select aria-label="Categoria" className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.filter((category) => category.active || category.id === categoryId).map((category) => <option key={category.id} value={category.id}>{category.code} — {category.name}</option>)}
                </Select>
              </QuickCreateField>
            </div>
          </section>
          <section className="rounded-lg border p-4 lg:col-span-5">
            <h3 className="label mb-3">Fluxo</h3>
            <Field label="Tipo"><Select className="field" value={flowMode} onChange={(event) => setFlowMode(event.target.value as FlowMode)}><option value="NONE">Sem fluxo</option><option value="SUGGESTED">Fluxo sugerido</option><option value="REQUIRED">Fluxo obrigatório</option></Select></Field>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Depois de salvar, use o botão <strong>Fluxo</strong> na lista para criar e ordenar as etapas deste tipo.</p>
          </section>
          <section className="rounded-lg border p-4 lg:col-span-7 lg:row-span-2">
            <h3 className="label mb-2">Requisitos</h3>
            {requirement(flowMode === 'REQUIRED' ? 'Tem tramitação? (obrigatório para este fluxo)' : 'Tem tramitação?', flowMode !== 'NONE', (enabled) => setFlowMode(enabled ? 'SUGGESTED' : 'NONE'))}
            {requirement('Tem credor?', creditor.enabled, (enabled) => setCreditor({ enabled, required: enabled ? creditor.required : false }))}
            {requirement('Tem interessado?', interested.enabled, (enabled) => setInterested({ enabled, required: enabled ? interested.required : false }))}
            {requirement('Tem responsável?', responsavel, setResponsavel)}
            {requirement('Tem assunto?', assunto, setAssunto)}
            {requirement('Tem arquivos?', arquivos, setArquivos)}
            {requirement('Tem valor?', amount.enabled, (enabled) => setAmount({ enabled, required: enabled ? amount.required : false }))}
            {requirement('Tem portal do cidadão?', portal, setPortal)}
          </section>
          <section className="rounded-lg border p-4 lg:col-span-5">
            <h3 className="label mb-3">Outros</h3>
            <Field label="Observação *"><textarea className="field min-h-24" maxLength={4000} value={observation} onChange={(event) => setObservation(event.target.value)}/></Field>
            <Field label="Prazo padrão"><Input className="field mt-3" type="number" min="1" value={deadline} onChange={(event) => setDeadline(event.target.value)}/></Field>
          </section>
          <section className="rounded-lg border p-4 lg:col-span-12">
            <h3 className="label mb-3">Aparência</h3>
            <div className="grid gap-4 sm:grid-cols-[9rem_1fr]"><Field label="Cor"><Input className="field h-10 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)}/></Field><Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field></div>
          </section>
        </div>
        {type && <label className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Tipo ativo</label>}
        {mutation.error && <ErrorBox error={mutation.error}/>}
        <div className="sticky bottom-0 z-[130] flex justify-end gap-2 border-t border-border bg-white py-3 shadow-[0_-8px_16px_-16px_rgba(15,23,42,.6)] dark:bg-slate-900"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>Salvar</button></div>
      </form>
    </Dialog>
    {creatingCategory && <CategoryEditor stacked onClose={() => setCreatingCategory(false)} onSaved={(category) => { setCategoryId(category.id); setCreatingCategory(false) }}/>}
  </>
}

function PhaseEditor({ phase, onClose, onSaved, stacked = false }: { phase?: ProtocolPhase; onClose: () => void; onSaved: (phase: ProtocolPhase) => void; stacked?: boolean }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(phase?.name ?? '')
  const [color, setColor] = useState(phase?.color ?? '#3498db')
  const [icon, setIcon] = useState(phase?.icon ?? 'FileText')
  const [observation, setObservation] = useState(phase?.description ?? '')
  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, code: phase?.code ?? ('FASE-' + crypto.randomUUID().slice(0, 8).toUpperCase()), description: observation || undefined, color, icon, defaultDeadlineDays: undefined, eligibleUnitIds: [], checklistItems: [], checklistQuestions: [], requiredAttachmentTypes: [], active: phase?.active ?? true }
      return phase ? api.updatePhase(ctx, phase.id, input) : api.createPhase(ctx, input)
    },
    onSuccess: async (savedPhase) => { await invalidateAll(client); onSaved(savedPhase) },
  })
  return <Dialog title={phase ? 'Editar tipo de fase' : 'Novo tipo de fase'} onClose={onClose} stacked={stacked}><form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><Field label="Descrição *"><Input autoFocus className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-[9rem_1fr]"><Field label="Cor"><Input className="field h-10 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></Field><Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field></div><Field label="Observação"><textarea className="field min-h-24" maxLength={4000} value={observation} onChange={(event) => setObservation(event.target.value)} /></Field>{mutation.error && <ErrorBox error={mutation.error} />}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending || !name.trim()}>Salvar</button></div></form></Dialog>
}
function ChecklistEditor({ title, questions, onChange, onClose }: { title: string; questions: ChecklistQuestion[]; onChange: (questions: ChecklistQuestion[]) => void; onClose: () => void }) {
  const [editing, setEditing] = useState<ChecklistQuestion | 'new' | null>(null); const ordered = questions.slice().sort((a, b) => a.order - b.order)
  const save = (question: ChecklistQuestion) => { const exists = questions.some((item) => item.id === question.id); onChange((exists ? questions.map((item) => item.id === question.id ? question : item) : [...questions, question]).sort((a, b) => a.order - b.order)); setEditing(null) }
  return <><Dialog title={title} onClose={onClose}><div className="space-y-2"><div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16}/>Nova pergunta</button></div>{ordered.length ? ordered.map((question) => <article key={question.id} className="flex items-center gap-3 rounded-lg border p-3"><span className="grid size-6 shrink-0 place-items-center rounded bg-slate-100 text-xs dark:bg-slate-800">{question.order}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{question.text}</p><p className="mt-1 text-xs text-slate-500">{question.required && 'Obrigatório'}{question.requiresDate && ' · Data'}{question.requiresAttachment && ' · Anexo'}{question.requiresObservation && ' · Observação'}</p></div><button className="btn-secondary !p-2" aria-label="Editar pergunta" onClick={() => setEditing(question)}>Editar</button><button className="btn-secondary !p-2" aria-label="Excluir pergunta" onClick={() => onChange(ordered.filter((item) => item.id !== question.id).map((item, index) => ({ ...item, order: index + 1 })))}>Excluir</button></article>) : <p className="rounded border border-dashed p-5 text-center text-sm text-slate-500">Nenhuma pergunta cadastrada.</p>}<div className="pt-3 text-right"><button className="btn-secondary" onClick={onClose}>Fechar</button></div></div></Dialog>{editing && <QuestionEditor question={editing === 'new' ? { id: crypto.randomUUID(), text: '', order: questions.length + 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false } : editing} onClose={() => setEditing(null)} onSave={save}/>}</>
}
function QuestionEditor({ question, onClose, onSave }: { question: ChecklistQuestion; onClose: () => void; onSave: (question: ChecklistQuestion) => void }) {
  const [draft, setDraft] = useState(question); return <Dialog title="Nova pergunta" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}><Field label="Pergunta *"><Input autoFocus className="field" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })}/></Field><Field label="Ordem"><Input className="field max-w-28" type="number" min="1" value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}/><small className="text-slate-500">Ordens em uso: 1, 2, 3</small></Field><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><Switch checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })}/> Obrigatório</label><label className="flex items-center gap-2 text-sm"><Switch checked={draft.requiresAttachment} onChange={(event) => setDraft({ ...draft, requiresAttachment: event.target.checked })}/> Exige anexo</label><label className="flex items-center gap-2 text-sm"><Switch checked={draft.requiresDate} onChange={(event) => setDraft({ ...draft, requiresDate: event.target.checked })}/> Exige data</label><label className="flex items-center gap-2 text-sm"><Switch checked={draft.requiresObservation} onChange={(event) => setDraft({ ...draft, requiresObservation: event.target.checked })}/> Exige observação</label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!draft.text.trim()}>Salvar</button></div></form></Dialog>
}

function StageEditor({ draft, phases, situations, units, order, saving, onClose, onSave }: {
  draft: {
    phaseId: string
    required: boolean
    situationTypeId?: string
    destinationUnitId?: string
    requiresChecklist?: boolean
    requiresAttachment?: boolean
    checklistQuestions?: ChecklistQuestion[]
    observation?: string
    color?: string
    icon?: string
  }
  phases: ProtocolPhase[]
  situations: SituationType[]
  units: Unit[]
  order: number
  saving: boolean
  onClose: () => void
  onSave: (stage: {
    phaseId: string
    required: boolean
    situationTypeId?: string
    destinationUnitId?: string
    requiresChecklist?: boolean
    requiresAttachment?: boolean
    checklistQuestions?: ChecklistQuestion[]
    observation?: string
    color?: string
    icon?: string
  }) => void
}) {
  const [stage, setStage] = useState(draft)
  const [creatingPhase, setCreatingPhase] = useState(false)
  const [creatingSituation, setCreatingSituation] = useState(false)
  const selectedSituation = situations.find((situation) => situation.id === stage.situationTypeId)

  return <>
    <Dialog title="Nova etapa do fluxo" onClose={onClose}>
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(stage) }}>
        <section className="rounded border p-4">
          <h3 className="label mb-3">Fase e situação</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickCreateField label="Fase *" actionLabel="Nova fase" onCreate={() => setCreatingPhase(true)}>
              <Select aria-label="Fase *" className="field" value={stage.phaseId} onChange={(event) => setStage({ ...stage, phaseId: event.target.value })}><option value="">Selecione...</option>{phases.filter((phase) => phase.active || phase.id === stage.phaseId).map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</Select>
            </QuickCreateField>
            <QuickCreateField label="Situação" actionLabel="Nova situação" onCreate={() => setCreatingSituation(true)}>
              <Select aria-label="Situação" className="field" value={stage.situationTypeId ?? ''} onChange={(event) => setStage({ ...stage, situationTypeId: event.target.value || undefined })}><option value="">Sem situação definida</option>{situations.filter((situation) => situation.active || situation.id === stage.situationTypeId).map((situation) => <option key={situation.id} value={situation.id}>{situation.name}</option>)}</Select>
            </QuickCreateField>
          </div>
          {selectedSituation && <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ backgroundColor: selectedSituation.color + '18', borderColor: selectedSituation.color + '55', color: selectedSituation.color }}><IconGlyph name={selectedSituation.icon} size={14}/>{selectedSituation.name}</div>}
        </section>
        <section className="rounded border p-4"><h3 className="label mb-3">Destino organizacional</h3><Field label="Unidade organizacional de destino"><Select className="field" value={stage.destinationUnitId ?? ''} onChange={(event) => setStage({ ...stage, destinationUnitId: event.target.value || undefined })}><option value="">Selecione a unidade na estrutura...</option>{sortUnitsByPath(units.filter((unit) => unit.active)).map((unit) => <option key={unit.id} value={unit.id}>{unitPath(units, unit.id)}</option>)}</Select></Field></section>
        <section className="rounded border p-4"><h3 className="label mb-3">Comportamento</h3><div className="flex flex-wrap items-center gap-4"><Field label="Ordem"><Input className="field w-20" value={order} disabled/></Field><label className="flex items-center gap-2 text-sm"><Switch checked={stage.requiresChecklist ?? false} onChange={(event) => setStage({ ...stage, requiresChecklist: event.target.checked })}/> Exige checklist</label><label className="flex items-center gap-2 text-sm"><Switch checked={stage.requiresAttachment ?? false} onChange={(event) => setStage({ ...stage, requiresAttachment: event.target.checked })}/> Exige anexo</label></div></section>
        <section className="rounded border p-4"><h3 className="label mb-3">Observação</h3><textarea className="field min-h-20" value={stage.observation ?? ''} onChange={(event) => setStage({ ...stage, observation: event.target.value || undefined })}/></section>
        <section className="rounded border p-4"><h3 className="label mb-3">Aparência da etapa</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Cor"><Input className="field h-10 p-1" type="color" value={stage.color ?? '#3498db'} onChange={(event) => setStage({ ...stage, color: event.target.value })}/></Field><Field label="Ícone"><IconSelect value={stage.icon ?? 'ArrowRight'} onChange={(event) => setStage({ ...stage, icon: event.target.value })}/></Field></div></section>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={saving || !stage.phaseId}>{saving ? 'Salvando…' : 'Salvar'}</button></div>
      </form>
    </Dialog>
    {creatingPhase && <PhaseEditor stacked onClose={() => setCreatingPhase(false)} onSaved={(phase) => { setStage((current) => ({ ...current, phaseId: phase.id })); setCreatingPhase(false) }}/>}
    {creatingSituation && <SituationEditor stacked onClose={() => setCreatingSituation(false)} onSaved={(situation) => { setStage((current) => ({ ...current, situationTypeId: situation.id })); setCreatingSituation(false) }}/>}
  </>
}
