import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCheck, ClipboardList, Layers, Plus, Printer, RefreshCcw, Search, TriangleAlert } from 'lucide-react'
import type { Context, Database, Protocol, ProtocolBatch, Unit } from '../../domain/model'
import type { BatchMovementInput } from '../../domain/protocolBatches'
import { batchPhaseOptions } from '../../domain/protocolBatches'
import { canReceiveWorkInUnit, canView } from '../../domain/rules'
import { participantName } from '../../domain/participants'
import { unitPath } from '../../domain/units'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog'
import { Checkbox } from '../../components/ui/Checkbox'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { dateTime } from '../../lib/format'
import { PdfViewerDialog } from '../../components/ui/PdfViewerDialog'
import { ListPagination, paginateItems } from '../../components/ui/ListPagination'
import { Tooltip } from '../../components/ui/Tooltip'

type PreviewRow = { protocol: Protocol; issues: string[] }

export function BatchesPage() {
  const ctx = useSession()
  const client = useQueryClient()
  const { data: db, isLoading } = useDb()
  const [creating, setCreating] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<ProtocolBatch>()
  const [receipt, setReceipt] = useState<{ batch: ProtocolBatch; blob: Blob }>()
  const context = `${ctx.userId}:${ctx.activeUnitId}`
  const [paging, setPaging] = useState({ context, page: 1 })
  const changePage = (page: number) => setPaging({ context, page })
  const exportReceipt = useMutation({
    mutationFn: async (batchId: string) => {
      const { db, batch } = await api.getBatchReceipt(ctx, batchId)
      const { createBatchReceiptPdf } = await import('../relatorios/reportPdf')
      const doc = await createBatchReceiptPdf(db, batch)
      return { batch, blob: doc.output('blob') }
    },
    onSuccess: setReceipt,
  })
  const candidates = useQuery({ queryKey: ['batch-candidates', ctx.userId, ctx.activeUnitId, ctx.scopeUnitId], queryFn: () => api.batchCandidates(ctx) })
  const batches = useQuery({ queryKey: ['batches', ctx.userId, ctx.activeUnitId], queryFn: () => api.listBatches(ctx) })
  const history = paginateItems(batches.data ?? [], paging.context === context ? paging.page : 1)
  if (isLoading || !db || candidates.isLoading || batches.isLoading) return <Loading variant="list" />
  if (candidates.error || batches.error) return <ErrorBox error={candidates.error ?? batches.error} />
  if (creating) return <BatchWizard key={`${ctx.userId}:${ctx.activeUnitId}`} db={db} candidates={candidates.data ?? []} ctx={ctx} onCancel={() => setCreating(false)} onSaved={(batch) => { setCreating(false); changePage(1); setSelectedBatch(batch); void invalidateAll(client) }} />
  return <div className="mx-auto max-w-7xl space-y-4">
    <PageTitle title="Lotes" detail="Tramite vários processos em uma única operação." icon={Layers} action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Nova Movimentação</button>} />
    <div className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
      <p className="text-muted-foreground">Processos da sua caixa ou abertos por você. As regras de ciência, checklist e fluxo continuam válidas.</p>
      <span className="shrink-0 font-semibold">{candidates.data?.length ?? 0} processo(s) para consulta</span>
    </div>
    {exportReceipt.error && <ErrorBox error={exportReceipt.error} />}
    {!batches.data?.length ? <Empty title="Nenhuma movimentação em lote" detail="Use Nova Movimentação para selecionar os tipos, informar o destino e escolher os processos." /> : <section className="space-y-2" aria-label="Histórico de lotes">
      {history.items.map((batch) => <article key={batch.id} className="panel grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 px-3 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
        <span className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[var(--ui-accent)]"><Layers size={17} /></span>
        <div className="min-w-0"><div className="flex min-w-0 items-baseline gap-2"><h2 className="shrink-0 text-sm font-semibold leading-5">Lote {batch.number}</h2><Tooltip className="min-w-0 flex-1" tabIndex={0} content={`${batch.protocols.length} processo(s) · ${batch.phaseName} · ${batch.unitName}`}><span className="block truncate text-xs text-muted-foreground">{batch.protocols.length} processo(s) · {batch.phaseName} · {batch.unitName}</span></Tooltip></div><p className="mt-0.5 break-words text-xs leading-4 text-muted-foreground">{dateTime(batch.createdAt)} · {batch.actorName ?? db.users.find((user) => user.id === batch.actorUserId)?.name ?? 'Usuário responsável'}</p></div>
        <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-start-auto"><button className="btn-secondary !px-2.5 !py-1.5 !text-xs" disabled={exportReceipt.isPending} aria-label={`Exportar comprovante do lote ${batch.number}`} onClick={() => exportReceipt.mutate(batch.id)}><Printer size={14} />{exportReceipt.isPending && exportReceipt.variables === batch.id ? 'Gerando…' : 'Comprovante'}</button><button className="btn-secondary !px-2.5 !py-1.5 !text-xs" onClick={() => setSelectedBatch(batch)}>Ver lote</button></div>
      </article>)}
    </section>}
    <ListPagination page={history.page} total={history.total} onPage={changePage} label="lotes" />
    {selectedBatch?.actorUserId === ctx.userId && selectedBatch.actorUnitId === ctx.activeUnitId && <BatchDetails batch={selectedBatch} db={db} ctx={ctx} onClose={() => setSelectedBatch(undefined)} />}
    {receipt?.batch.actorUserId === ctx.userId && receipt.batch.actorUnitId === ctx.activeUnitId && <PdfViewerDialog title={`Comprovante de protocolos em lote — ${receipt.batch.number}`} blob={receipt.blob} downloadFilename={`lote_${receipt.batch.number}.pdf`} onClose={() => setReceipt(undefined)} />}
  </div>
}

function BatchWizard({ db, candidates, ctx, onCancel, onSaved }: { db: Database; candidates: Protocol[]; ctx: Context; onCancel: () => void; onSaved: (batch: ProtocolBatch) => void }) {
  const [typeIds, setTypeIds] = useState<string[]>([])
  const [typesOpen, setTypesOpen] = useState(true)
  const [step, setStep] = useState<2 | 3>(2)
  const [phaseId, setPhaseId] = useState('')
  const [secretariatId, setSecretariatId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [message, setMessage] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [formError, setFormError] = useState<unknown>()
  const [requestId] = useState(() => crypto.randomUUID())
  const activeUnits = db.units.filter((unit) => unit.active)
  const roots = activeUnits.filter((unit) => !unit.parentId || !activeUnits.some((parent) => parent.id === unit.parentId))
  const children = activeUnits.filter((unit) => unit.parentId === secretariatId)
  const sectors = unitId ? activeUnits.filter((unit) => unit.id !== unitId && unitChain(activeUnits, unit.id).some((ancestor) => ancestor.id === unitId)) : []
  const destinationId = sectorId || unitId || secretariatId
  const scope = candidates.filter((protocol) => typeIds.includes(protocol.typeId))
  const phaseOptions = batchPhaseOptions(db, scope)
  const users = db.users.filter((user) => user.active && canReceiveWorkInUnit(db, user.id, destinationId)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const eligible = preview.filter((row) => !row.issues.length)
  const chosen = preview.filter((row) => selected.has(row.protocol.id) && !row.issues.length)
  const movement = (): BatchMovementInput => ({ phaseId, unitId: destinationId, assigneeId: assigneeId || undefined, message: message.trim(), dueAt: dueAt ? new Date(dueAt).toISOString() : undefined })
  const refreshPreview = useMutation({
    mutationFn: () => {
      if (!typeIds.length) throw new Error('Selecione pelo menos um tipo de processo.')
      if (!message.trim()) throw new Error('Observação é obrigatória.')
      if (!phaseId || !destinationId) throw new Error('Selecione a fase e a secretaria de destino.')
      if (dueAt && (!Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= Date.now())) throw new Error('O prazo deve estar no futuro.')
      return api.previewBatch(ctx, typeIds, movement())
    },
    onSuccess: (rows) => { setPreview(rows); setSelected((current) => new Set(rows.filter((row) => !row.issues.length && current.has(row.protocol.id)).map((row) => row.protocol.id))); setStep(3); setFormError(undefined) },
  })
  const submit = useMutation({
    mutationFn: () => api.forwardBatch(ctx, { requestId, typeIds, movement: movement(), processes: chosen.map((row) => ({ protocolId: row.protocol.id, expectedVersion: row.protocol.version })) }),
    onSuccess: onSaved,
  })
  const chooseDestination = (id?: string) => {
    const chain = id ? unitChain(activeUnits, id) : []
    setSecretariatId(chain[0]?.id ?? '')
    setUnitId(chain[1]?.id ?? '')
    setSectorId(chain.length > 2 ? chain.at(-1)!.id : '')
    setAssigneeId('')
  }
  const choosePhase = (id: string, protocols = scope) => {
    setPhaseId(id)
    const fixedDestinations = new Set(protocols.flatMap((protocol) => {
      if (protocol.flowModeSnapshot === 'SUGGESTED') return []
      const phase = protocol.flowSnapshot?.phases.find((item) => item.phaseId === id)
      return phase?.destinationUnitId ? [phase.destinationUnitId] : []
    }))
    if (fixedDestinations.size === 1) chooseDestination([...fixedDestinations][0])
  }
  const changeTypes = (ids: string[]) => {
    setTypeIds(ids); setTypesOpen(false); setStep(2); setPreview([]); setSelected(new Set()); submit.reset(); refreshPreview.reset()
    const matching = candidates.filter((protocol) => ids.includes(protocol.typeId))
    const options = batchPhaseOptions(db, matching)
    choosePhase(options.length === 1 ? options[0].id : '', matching)
  }
  return <div className="mx-auto max-w-7xl space-y-5">
    <PageTitle title="Nova movimentação em lote" detail="Selecione tipos, informe a movimentação e escolha os processos." icon={Layers} action={<button className="btn-secondary" disabled={submit.isPending} onClick={onCancel}><ArrowLeft size={16} />Voltar aos lotes</button>} />
    <ol className="flex flex-wrap gap-3 text-sm" aria-label="Etapas da movimentação em lote">
      {['Tipos de processo', 'Dados da movimentação', 'Selecionar processos'].map((label, index) => <li key={label} aria-current={(!typeIds.length ? index === 0 : index === step - 1) ? 'step' : undefined} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${(!typeIds.length ? index === 0 : index === step - 1) ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'text-muted-foreground'}`}><span className="font-semibold">{index + 1}</span>{label}</li>)}
    </ol>
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0"><h2 className="label">Tipos selecionados</h2><p className="mt-2 text-sm">{typeIds.length ? typeIds.map((id) => { const type = db.protocolTypes.find((item) => item.id === id); return `${type?.code ? `${type.code} · ` : ''}${type?.name ?? 'Tipo não encontrado'}` }).join(' • ') : 'Selecione os tipos de processo para continuar.'}</p><p className="mt-1 text-xs text-muted-foreground">{scope.length} processo(s) da sua caixa ou abertos por você.</p></div>
      <button className="btn-secondary shrink-0" disabled={submit.isPending} onClick={() => setTypesOpen(true)}><Layers size={16} />{typeIds.length ? 'Alterar seleção' : 'Selecionar tipos de processo'}</button>
    </div>
    {step === 2 && <form className="panel space-y-5 p-5" onSubmit={(event) => { event.preventDefault(); setFormError(undefined); refreshPreview.mutate() }}>
      <h2 className="font-semibold">Dados da movimentação</h2>
      <p className="text-sm text-muted-foreground">Os dados serão aplicados aos processos que você selecionar. Fluxos obrigatórios mantêm sua fase e seu destino configurados.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fase *"><Select aria-label="Fase" required value={phaseId} onChange={(event) => choosePhase(event.target.value)}><option value="">Selecione a fase</option>{phaseOptions.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</Select></Field>
        <Field label="Prazo"><Input aria-label="Prazo" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>
        <Field label="Secretaria *"><Select aria-label="Secretaria" required value={secretariatId} onChange={(event) => { setSecretariatId(event.target.value); setUnitId(''); setSectorId(''); setAssigneeId('') }}><option value="">Selecione a secretaria</option>{roots.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></Field>
        <Field label="Unidade"><Select aria-label="Unidade" value={unitId} disabled={!secretariatId || !children.length} onChange={(event) => { setUnitId(event.target.value); setSectorId(''); setAssigneeId('') }}><option value="">Tramitar para a secretaria</option>{children.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></Field>
        <Field label="Setor"><Select aria-label="Setor" value={sectorId} disabled={!unitId || !sectors.length} onChange={(event) => { setSectorId(event.target.value); setAssigneeId('') }}><option value="">Tramitar para a unidade</option>{sectors.map((unit) => <option key={unit.id} value={unit.id}>{unitPath(activeUnits, unit.id)}</option>)}</Select></Field>
        <Field label="Responsável"><Select aria-label="Responsável" value={assigneeId} disabled={!destinationId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Enviar para a unidade (sem responsável)</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>
      </div>
      {destinationId && <p className="text-xs text-muted-foreground">Destino: <strong>{unitPath(db.units, destinationId)}</strong></p>}
      <Field label="Observação *"><textarea aria-label="Observação" className="field min-h-28" required maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Descreva o encaminhamento dos processos..." /></Field>
      {(formError || refreshPreview.error) && <ErrorBox error={formError ?? refreshPreview.error} />}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button><button className="btn-primary" disabled={refreshPreview.isPending || !typeIds.length || !phaseId || !destinationId || !message.trim()}>{refreshPreview.isPending ? 'Validando processos…' : 'Selecionar processos'}<ArrowRight size={16} /></button></div>
    </form>}
    {step === 3 && <section className="panel space-y-4 p-5" aria-label="Selecionar processos do lote">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Selecionar processos</h2><p className="mt-1 text-sm text-muted-foreground">{chosen.length} selecionado(s) · {eligible.length} disponível(is) · {preview.length - eligible.length} com pendências</p></div><button className="btn-secondary" disabled={submit.isPending || refreshPreview.isPending} onClick={() => { submit.reset(); refreshPreview.mutate() }}><RefreshCcw size={15} />Atualizar disponibilidade</button></div>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm"><p><strong>{phaseOptions.find((phase) => phase.id === phaseId)?.name}</strong> · {unitPath(db.units, destinationId)} · {users.find((user) => user.id === assigneeId)?.name ?? 'Fila da unidade'}</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{message}</p>{dueAt && <p className="mt-1 text-xs">Prazo: {dateTime(new Date(dueAt).toISOString())}</p>}</div>
      <label className="inline-flex items-center gap-2 text-sm font-medium"><Checkbox aria-label="Selecionar todos os processos disponíveis" checked={eligible.length > 0 && chosen.length === eligible.length} ref={(element) => { if (element) element.indeterminate = chosen.length > 0 && chosen.length < eligible.length }} disabled={!eligible.length || submit.isPending} onChange={(event) => setSelected(new Set(event.target.checked ? eligible.map((row) => row.protocol.id) : []))} />Selecionar todos os processos disponíveis</label>
      {!preview.length && <Empty title="Nenhum processo disponível para os tipos selecionados" detail="Volte aos dados e altere os tipos de processo." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {preview.map(({ protocol, issues }) => <article key={protocol.id} className={`rounded-lg border p-4 ${selected.has(protocol.id) ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_5%,transparent)]' : 'border-border'}`}>
          <div className="flex items-start gap-2"><Checkbox aria-label={`Selecionar processo ${protocol.number}`} checked={selected.has(protocol.id)} disabled={Boolean(issues.length) || submit.isPending} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(protocol.id); else next.delete(protocol.id); return next })} /><div className="min-w-0 flex-1"><Link to={`/processos/${protocol.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--ui-accent)] underline-offset-2 hover:underline">{protocol.number}</Link><p className="mt-1 text-xs text-muted-foreground">{dateTime(protocol.createdAt)}</p></div></div>
          <p className="mt-3 break-words text-sm font-medium">{protocol.subject}</p><p className="mt-1 text-xs text-muted-foreground"><strong>Tipo:</strong> {db.protocolTypes.find((type) => type.id === protocol.typeId)?.name ?? 'Tipo não encontrado'}</p>
          {protocol.creditorPersonId && <p className="mt-1 text-xs text-muted-foreground"><strong>Credor:</strong> {participantName(db, protocol.creditorPersonId)}</p>}
          <p className="mt-1 text-xs text-muted-foreground"><strong>Está com:</strong> {db.users.find((user) => user.id === protocol.currentAssigneeId)?.name ?? db.units.find((unit) => unit.id === protocol.currentUnitId)?.name}</p>
          {issues.length > 0 && <p className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{issues.join(' ')}</p>}
        </article>)}
      </div>
      {((!confirming && submit.error) || refreshPreview.error) && <ErrorBox error={submit.error ?? refreshPreview.error} />}
      <div className="flex flex-wrap justify-between gap-3"><button className="btn-secondary" disabled={submit.isPending} onClick={() => { setStep(2); setSelected(new Set()); submit.reset(); refreshPreview.reset() }}><ArrowLeft size={16} />Voltar aos dados</button><button className="btn-primary" disabled={!chosen.length || submit.isPending || refreshPreview.isPending || !message.trim()} onClick={() => setConfirming(true)}><ArrowRight size={16} />Movimentar em Lote ({chosen.length})</button></div>
    </section>}
    {typesOpen && <TypeSelection db={db} candidates={candidates} value={typeIds} onConfirm={changeTypes} onClose={() => typeIds.length ? setTypesOpen(false) : onCancel()} />}
    {confirming && <Dialog title="Confirmar movimentação em lote" onClose={submit.isPending ? () => undefined : () => setConfirming(false)}>
      <DialogBody className="space-y-3"><p className="text-sm">Confirma a tramitação de <strong>{chosen.length} processo(s)</strong> para <strong>{unitPath(db.units, destinationId)}</strong>?</p><p className="text-sm text-muted-foreground">Todos os processos serão validados novamente. Se algum estiver indisponível, nenhum será movimentado.</p><p className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-3 text-sm">{message}</p>{submit.error && <ErrorBox error={submit.error} />}</DialogBody>
      <DialogFooter><button className="btn-secondary" disabled={submit.isPending} onClick={() => setConfirming(false)}>Voltar</button><button className="btn-primary" disabled={submit.isPending || !chosen.length || !message.trim()} onClick={() => submit.mutate()}><Check size={16} />{submit.isPending ? 'Movimentando…' : 'Confirmar movimentação'}</button></DialogFooter>
    </Dialog>}
  </div>
}

function TypeSelection({ db, candidates, value, onConfirm, onClose }: { db: Database; candidates: Protocol[]; value: string[]; onConfirm: (ids: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState(new Set(value))
  const [search, setSearch] = useState('')
  const types = db.protocolTypes.filter((type) => candidates.some((protocol) => protocol.typeId === type.id))
  const visible = types.filter((type) => `${type.code ?? ''} ${type.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()))
  return <Dialog title="Movimentação em Lote" titleIcon={<Layers size={20} />} titleDescription="Selecione um ou mais tipos de processo da sua caixa ou abertos por você." onClose={onClose} size="large">
    <DialogBody className="space-y-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar tipos de processo" className="field !mt-0 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código ou nome..." /></div>
      <label className="inline-flex items-center gap-2 text-sm font-medium"><Checkbox aria-label="Selecionar todos os tipos de processo" checked={types.length > 0 && selected.size === types.length} ref={(element) => { if (element) element.indeterminate = selected.size > 0 && selected.size < types.length }} disabled={!types.length} onChange={(event) => setSelected(new Set(event.target.checked ? types.map((type) => type.id) : []))} /><CheckCheck size={16} />Marcar todos os tipos</label>
      {!types.length ? <Empty title="Nenhum processo na sua caixa ou aberto por você" detail="O lote utiliza somente processos ativos aos quais você tem acesso." /> : !visible.length ? <p className="text-sm text-muted-foreground">Nenhum tipo encontrado.</p> : <div className="divide-y divide-border rounded-lg border border-border">{visible.map((type) => <label key={type.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm"><Checkbox aria-label={`Selecionar tipo ${type.name}`} checked={selected.has(type.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(type.id); else next.delete(type.id); return next })} /><span className="min-w-0 flex-1 break-words">{type.code && <span className="mr-2 font-mono text-xs text-muted-foreground">{type.code}</span>}{type.name}</span><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{candidates.filter((protocol) => protocol.typeId === type.id).length}</span></label>)}</div>}
    </DialogBody><DialogFooter><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!selected.size} onClick={() => onConfirm([...selected])}><Check size={16} />Confirmar seleção</button></DialogFooter>
  </Dialog>
}

function BatchDetails({ batch, db, ctx, onClose }: { batch: ProtocolBatch; db: Database; ctx: Context; onClose: () => void }) {
  return <Dialog title={`Lote ${batch.number}`} titleIcon={<Layers size={20} />} onClose={onClose} size="large"><DialogBody className="space-y-4">
    <div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="label">Fase</p><p className="mt-1">{batch.phaseName}</p></div><div><p className="label">Destino</p><p className="mt-1">{batch.unitName}</p></div><div><p className="label">Responsável</p><p className="mt-1">{batch.assigneeName ?? 'Fila da unidade'}</p></div><div><p className="label">Registro</p><p className="mt-1">{dateTime(batch.createdAt)}</p></div>{batch.dueAt && <div><p className="label">Prazo</p><p className="mt-1">{dateTime(batch.dueAt)}</p></div>}</div>
    <div><p className="label">Observação</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{batch.message}</p></div>
    <div><h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><ClipboardList size={16} />{batch.protocols.length} processo(s) movimentado(s)</h3><ul className="divide-y divide-border rounded-lg border border-border">{batch.protocols.map((item) => {
      const protocol = db.protocols.find((candidate) => candidate.id === item.protocolId)
      return <li key={item.protocolId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{item.number}</span>{protocol && canView(db, protocol, ctx) ? <Link className="font-semibold text-[var(--ui-accent)] hover:underline" to={`/processos/${item.protocolId}`}>Ver processo<ArrowRight size={13} className="ml-1 inline" /></Link> : <span className="text-xs text-muted-foreground">Processo indisponível para consulta</span>}</li>
    })}</ul></div>
  </DialogBody></Dialog>
}

function unitChain(units: Unit[], id: string): Unit[] {
  const chain: Unit[] = []
  const visited = new Set<string>()
  let current = units.find((unit) => unit.id === id)
  while (current && !visited.has(current.id)) {
    visited.add(current.id); chain.unshift(current)
    current = units.find((unit) => unit.id === current!.parentId)
  }
  return chain
}
