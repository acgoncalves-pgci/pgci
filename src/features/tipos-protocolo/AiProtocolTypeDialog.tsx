import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Check, GitBranch, ListChecks, LoaderCircle, Sparkles, WandSparkles } from 'lucide-react'
import type { ProcessCategory, ProtocolPhase, SituationType, Unit } from '../../domain/model'
import { unitPath } from '../../domain/units'
import { useSession } from '../../app/session'
import { invalidateAll } from '../../app/queries'
import { api } from '../../services/api'
import { generateProtocolTypeProposal } from '../../services/processTypeAi'
import type { ProtocolTypeAiProposal } from '../../services/processTypeAi'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorBox, Field } from '../../components/ui/Feedback'
import { IconGlyph, iconOptions } from '../../components/ui/IconSelect'

const flowLabels = { NONE: 'Fluxo livre', SUGGESTED: 'Fluxo sugerido', REQUIRED: 'Fluxo obrigatório' } as const
const requirementLabels: Array<[keyof ProtocolTypeAiProposal['fields'], string]> = [
  ['interested', 'Interessado'], ['creditor', 'Credor'], ['responsavel', 'Responsável'], ['assunto', 'Assunto'], ['arquivos', 'Arquivos'],
  ['amount', 'Valor'], ['contractNumber', 'Nº de contrato'], ['biddingNumber', 'Nº de licitação'], ['legalProcessNumber', 'Processo jurídico'],
  ['referenceNumber', 'Número de referência'], ['portal', 'Portal do cidadão'],
]

export function AiProtocolTypeDialog({ categories, phases, situations, units, onClose, onCreated }: {
  categories: ProcessCategory[]
  phases: ProtocolPhase[]
  situations: SituationType[]
  units: Unit[]
  onClose: () => void
  onCreated: () => void
}) {
  const ctx = useSession()
  const client = useQueryClient()
  const [description, setDescription] = useState('')
  const [proposal, setProposal] = useState<ProtocolTypeAiProposal | null>(null)
  const activeCategories = useMemo(() => categories.filter((item) => item.active), [categories])
  const activePhases = useMemo(() => phases.filter((item) => item.active), [phases])
  const activeSituations = useMemo(() => situations.filter((item) => item.active), [situations])
  const activeUnits = useMemo(() => units.filter((item) => item.active), [units])
  const catalog = useMemo(() => ({
    categories: activeCategories.map(({ id, code, name }) => ({ id, code, name })),
    phases: activePhases.map(({ id, code, name, description }) => ({ id, code, name, description })),
    situations: activeSituations.map(({ id, name, category }) => ({ id, name, category })),
    units: activeUnits.map(({ id, name }) => ({ id, name, path: unitPath(units, id) })),
    icons: iconOptions.map(({ value, label }) => ({ value, label })),
  }), [activeCategories, activePhases, activeSituations, activeUnits, units])

  const generate = useMutation({
    mutationFn: () => generateProtocolTypeProposal(description, catalog),
    onSuccess: setProposal,
  })
  const create = useMutation({
    mutationFn: () => {
      if (!proposal) throw new Error('Gere uma proposta antes de confirmar.')
      const fieldsConfig = {
        interested: { enabled: proposal.fields.interested },
        creditor: { enabled: proposal.fields.creditor },
        amount: { enabled: proposal.fields.amount },
        tramitacao: { enabled: proposal.flowMode !== 'NONE' },
        responsavel: { enabled: proposal.fields.responsavel },
        assunto: { enabled: proposal.fields.assunto },
        arquivos: { enabled: proposal.fields.arquivos },
        contractNumber: { enabled: proposal.fields.contractNumber },
        biddingNumber: { enabled: proposal.fields.biddingNumber },
        legalProcessNumber: { enabled: proposal.fields.legalProcessNumber },
        referenceNumber: { enabled: proposal.fields.referenceNumber },
        portal: { enabled: proposal.fields.portal },
      }
      const stages = proposal.stages.map((stage) => ({
        ...stage,
        checklistQuestions: stage.checklistQuestions.map((question, index) => ({ ...question, id: crypto.randomUUID(), order: index + 1 })),
      }))
      return api.createProtocolTypeWithFlow(ctx, {
        name: proposal.name,
        description: proposal.description,
        categoryId: proposal.categoryId,
        color: proposal.color,
        icon: proposal.icon,
        defaultDeadlineDays: proposal.defaultDeadlineDays,
        flowMode: proposal.flowMode,
        authorizedUserIds: [],
        authorizedUnitIds: [],
        active: true,
        fieldsConfig,
      }, stages)
    },
    onSuccess: async () => { await invalidateAll(client); onCreated() },
  })

  const category = activeCategories.find((item) => item.id === proposal?.categoryId)
  const enabledRequirements = proposal ? requirementLabels.filter(([key]) => proposal.fields[key]) : []

  return <Dialog title="Criar tipo de processo com IA" onClose={onClose} wide>
    {!proposal ? <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); generate.mutate() }}>
      <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-600 text-white"><WandSparkles size={20}/></span>
          <div><h3 className="font-semibold text-slate-900 dark:text-slate-100">Descreva o processo em linguagem natural</h3><p className="mt-1 text-sm text-muted-foreground">O Gemini combinará somente categorias, fases, situações e unidades já cadastradas. A criação ocorrerá apenas depois da sua confirmação.</p></div>
        </div>
      </section>
      <Field label="Como este processo deve funcionar? *">
        <textarea autoFocus className="field min-h-52 resize-y" maxLength={6000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Crie uma solicitação de compra obrigatória. Primeiro a unidade solicitante confere a justificativa e os itens; depois Compras faz a cotação; em seguida o Financeiro verifica a dotação e, por último, a autoridade competente decide. Exigir anexo da pesquisa de preços e checklist nas etapas de conferência." />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <span>Inclua responsáveis, sequência, documentos, aprovações e unidades de destino para obter uma proposta melhor.</span>
        <span>{description.trim().length}/6000 caracteres</span>
      </div>
      {generate.error && <ErrorBox error={generate.error}/>} 
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary bg-violet-600 hover:bg-violet-700" disabled={generate.isPending || description.trim().length < 30}>{generate.isPending ? <><LoaderCircle className="animate-spin" size={16}/>Analisando processo…</> : <><Sparkles size={16}/>Gerar proposta</>}</button></div>
    </form> : <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${proposal.color}20`, color: proposal.color }}><IconGlyph name={proposal.icon} size={24}/></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{proposal.name}</h3><span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: `${proposal.color}55`, color: proposal.color, backgroundColor: `${proposal.color}10` }}>{flowLabels[proposal.flowMode]}</span></div><p className="mt-1 text-sm text-muted-foreground">{proposal.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-muted px-2.5 py-1 font-medium">{category ? `${category.code} — ${category.name}` : 'Sem categoria'}</span>{proposal.defaultDeadlineDays && <span className="rounded-full bg-muted px-2.5 py-1 font-medium">Prazo: {proposal.defaultDeadlineDays} dia(s)</span>}</div></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.75fr)]">
        <section className="rounded-xl border p-4">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="label !mb-0">Fluxo proposto</h3><p className="mt-1 text-xs text-muted-foreground">{proposal.stages.length} etapa(s) na ordem de execução</p></div><GitBranch size={18} className="text-violet-600"/></div>
          {proposal.stages.length ? <ol className="space-y-3">{proposal.stages.map((stage, index) => {
            const phase = activePhases.find((item) => item.id === stage.phaseId)
            const situation = activeSituations.find((item) => item.id === stage.situationTypeId)
            const unit = activeUnits.find((item) => item.id === stage.destinationUnitId)
            return <li key={`${stage.phaseId}-${index}`} className="rounded-lg border p-3"><div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: stage.color }}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{phase?.name}</strong><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${stage.color}18`, color: stage.color }}>{situation?.name}</span></div>{unit && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 size={13}/>{unitPath(units, unit.id)}</p>}{stage.observation && <p className="mt-2 text-xs text-muted-foreground">{stage.observation}</p>}<div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground">{stage.requiresChecklist && <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1"><ListChecks size={12}/>{stage.checklistQuestions.length} item(ns)</span>}{stage.requiresAttachment && <span className="rounded bg-muted px-2 py-1">Anexo obrigatório</span>}{stage.required && <span className="rounded bg-muted px-2 py-1">Etapa obrigatória</span>}</div>{stage.checklistQuestions.length > 0 && <ul className="mt-2 space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">{stage.checklistQuestions.map((question) => <li key={question.text}>{question.text}{question.required ? ' *' : ''}</li>)}</ul>}</div></div></li>
          })}</ol> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">A IA definiu que este tipo não precisa de fluxo.</p>}
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border p-4"><h3 className="label mb-3">Campos habilitados</h3><div className="flex flex-wrap gap-2">{enabledRequirements.map(([, label]) => <span key={label} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><Check size={12}/>{label}</span>)}{!enabledRequirements.length && <span className="text-sm text-muted-foreground">Nenhum campo adicional.</span>}</div></section>
          <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20"><h3 className="label mb-2 text-violet-700 dark:text-violet-300">Por que esta configuração?</h3><p className="text-sm text-muted-foreground">{proposal.rationale}</p></section>
          <section className="rounded-xl border p-4"><h3 className="label mb-2">Antes de criar</h3><p className="text-sm text-muted-foreground">Revise a categoria, os campos e cada destino. Ao confirmar, o tipo e o fluxo serão criados juntos e ficarão ativos.</p></section>
        </div>
      </div>
      {create.error && <ErrorBox error={create.error}/>} 
      <div className="sticky bottom-0 z-[130] flex flex-wrap justify-end gap-2 border-t border-border bg-white py-3 shadow-[0_-8px_16px_-16px_rgba(15,23,42,.6)] dark:bg-slate-900"><button type="button" className="btn-secondary" onClick={() => { setProposal(null); generate.reset(); create.reset() }} disabled={create.isPending}><ArrowLeft size={16}/>Voltar e ajustar</button><button type="button" className="btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <><LoaderCircle className="animate-spin" size={16}/>Criando…</> : <><Check size={16}/>Confirmar e criar</>}</button></div>
    </div>}
  </Dialog>
}
