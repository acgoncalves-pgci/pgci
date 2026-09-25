import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, FilePlus2, FileText, ListFilter, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { Dialog } from '../../components/ui/Dialog'
import { PdfViewerDialog } from '../../components/ui/PdfViewerDialog'
import { Input } from '../../components/ui/Input'
import { RichTextEditor } from '../../components/ui/RichTextEditor'
import { Select } from '../../components/ui/Select'
import type { AppDocument, Database } from '../../domain/model'
import { canManageDocument, canOpenProtocolType, canReceiveWorkInUnit } from '../../domain/rules'
import { unitPath } from '../../domain/units'
import { dateOnly } from '../../lib/format'
import { documentText } from '../../lib/richText'
import { documentTemplateValues, replaceTemplateVariables } from '../../lib/documentTemplate'
import { DocumentBody } from './DocumentBody'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { navigateWithLoading } from '../../app/routeLoading'

const documentSchema = z.object({
  typeId: z.string().min(1, 'Selecione o tipo.'),
  subject: z.string().trim().min(1, 'Informe o assunto.'),
  body: z.string().refine((value) => Boolean(documentText(value)), 'Informe o corpo.'),
  recipientPersonId: z.string().optional(),
  unitId: z.string().min(1, 'Selecione a lotação.'),
  signerName: z.string().optional(),
  signerTitle: z.string().optional(),
})
type DocumentForm = z.infer<typeof documentSchema>

export function Documents() {
  const ctx = useSession()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [deleting, setDeleting] = useState<AppDocument | null>(null)
  const remove = useMutation({ mutationFn: (documentId: string) => api.deleteDocument(ctx, documentId), onSuccess: () => { setDeleting(null); invalidateAll(queryClient) } })
  const { data, isLoading, error } = useQuery({ queryKey: ['documents', ctx.userId, ctx.activeUnitId, search, typeId], queryFn: () => api.listDocuments(ctx, search, typeId) })
  if (isLoading) return <Loading variant="list"/>
  if (error || !data) return <ErrorBox error={error}/>
  return <>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3"><span className="rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] p-2 text-[var(--ui-accent)]"><FileText size={18}/></span><div><h1 className="text-2xl font-bold tracking-tight">Documentos</h1><p className="text-sm text-muted-foreground">Ofícios, memorandos e demais documentos da entidade.</p></div></div>
      <Link className="btn-primary" to="/documentos/novo"><Plus size={16}/>Novo</Link>
    </div>
    <div className="mb-5 flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-2.5 text-slate-400" size={17}/><Input aria-label="Buscar documentos" className="field !mt-0 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por número ou assunto..."/></label>
      <button type="button" className="btn-secondary" aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}><ListFilter size={16}/>Mais filtros</button>
      {showFilters && <Select aria-label="Filtrar por tipo de documento" className="field !mt-0 w-full sm:w-52" value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">Todos os tipos</option>{data.db.documentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select>}
    </div>
    {data.items.length ? <div className="space-y-2">{data.items.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((document) => <DocumentRow key={document.id} document={document} db={data.db} ctx={ctx} onDelete={() => setDeleting(document)}/>)}</div> : <Empty title="Nenhum documento encontrado" detail="Comece redigindo um documento em formato A4."/>}
    {deleting && <Dialog title="Excluir documento?" onClose={() => setDeleting(null)}><div className="space-y-4 p-5"><p className="text-sm">O documento <strong>{deleting.number}</strong> será excluído. Esta ação não pode ser desfeita.</p>{remove.error && <ErrorBox error={remove.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn-primary" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{remove.isPending ? 'Excluindo…' : 'Excluir documento'}</button></div></div></Dialog>}
  </>
}

function DocumentRow({ document, db, ctx, onDelete }: { document: AppDocument; db: Database; ctx: ReturnType<typeof useSession>; onDelete: () => void }) {
  const type = db.documentTypes.find((item) => item.id === document.typeId)
  const editable = canManageDocument(db, document, ctx)
  const canStartProtocol = !document.protocolId && type?.active && editable && canReceiveWorkInUnit(db, ctx.userId, ctx.activeUnitId) && db.protocolTypes.some((protocolType) => protocolType.active && protocolType.fieldsConfig.arquivos?.enabled && canOpenProtocolType(db, protocolType, ctx))
  const recipient = db.people.find((person) => person.id === document.recipientPersonId)?.name
  const protocol = db.protocols.find((item) => item.id === document.protocolId)
  return <article className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900 sm:flex-nowrap">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: type?.color || 'var(--ui-accent)', backgroundColor: `color-mix(in srgb, ${type?.color || 'var(--ui-accent)'} 12%, transparent)` }}><FileText size={17}/></span>
    <div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground"><span className="font-semibold" style={{ color: type?.color || 'var(--ui-accent)' }}>{type?.name ?? 'Documento'}</span> · {document.number} · {recipient ? `Para: ${recipient}` : 'Sem destinatário'}{protocol && <> · <Link className="text-public-700 hover:underline" to={`/processos/${protocol.id}`}>Processo {protocol.number}</Link></>}</p><h2 className="mt-0.5 truncate text-sm font-semibold" title={document.subject}>{document.subject}</h2></div>
    <div className="ml-auto flex shrink-0 gap-2">
      <Link className="btn-secondary icon-button" to={`/documentos/${document.id}`} aria-label={`Visualizar ${document.number}`} title="Visualizar"><Eye size={16}/></Link>
      {canStartProtocol && <Link className="btn-secondary icon-button" to={`/processos/novo?documentId=${document.id}`} aria-label={`Abrir processo a partir de ${document.number}`} title="Abrir processo a partir"><FilePlus2 size={16}/></Link>}
      {editable ? <Link className="btn-secondary icon-button" to={`/documentos/${document.id}/editar`} aria-label={`Editar ${document.number}`} title="Editar"><Pencil size={16}/></Link> : <button type="button" className="btn-secondary icon-button" disabled aria-label={`Editar ${document.number}`} title="Sem permissão para editar"><Pencil size={16}/></button>}
      <button type="button" className="btn-secondary icon-button" disabled={Boolean(document.protocolId) || !editable} onClick={onDelete} aria-label={`Excluir ${document.number}`} title={document.protocolId ? 'Documento anexado a um processo' : 'Excluir'}><Trash2 size={16}/></button>
    </div>
  </article>
}

export function NewDocument({ editing = false }: { editing?: boolean }) {
  const navigate = useNavigate()
  const { id: documentId } = useParams()
  const ctx = useSession()
  const queryClient = useQueryClient()
  const { data: db, isLoading } = useDb()
  const params = new URLSearchParams(useLocation().search)
  const protocolId = params.get('protocolId') ?? undefined
  const movementEventId = params.get('movementEventId') ?? undefined
  const [templateId, setTemplateId] = useState('')
  const initializedDocument = useRef('')
  const form = useForm<DocumentForm>({ resolver: zodResolver(documentSchema), defaultValues: { typeId: '', subject: '', body: '', recipientPersonId: '', unitId: ctx.activeUnitId, signerName: ctx.user?.name ?? '', signerTitle: '' } })
  const document = editing ? db?.documents.find((item) => item.id === documentId) : undefined
  useEffect(() => {
    if (!editing || !document || initializedDocument.current === document.id) return
    form.reset({ typeId: document.typeId, subject: document.subject, body: document.body, recipientPersonId: document.recipientPersonId ?? '', unitId: document.unitId, signerName: document.signerName ?? db?.users.find((user) => user.id === document.authorUserId)?.name ?? '', signerTitle: document.signerTitle ?? '' })
    initializedDocument.current = document.id
  }, [db, document, editing, form])
  const typeId = form.watch('typeId')
  const body = form.watch('body')
  const recipientPersonId = form.watch('recipientPersonId')
  const unitId = form.watch('unitId')
  const create = useMutation({ mutationFn: (value: DocumentForm) => editing && documentId
    ? api.updateDocument(ctx, documentId, { ...value, recipientPersonId: value.recipientPersonId || undefined })
    : api.createDocument(ctx, { ...value, recipientPersonId: value.recipientPersonId || undefined, protocolId, movementEventId }), onSuccess: (saved) => { invalidateAll(queryClient); navigateWithLoading(navigate, `/documentos/${saved.id}`) } })
  if (isLoading || !db) return <Loading variant="detail"/>
  if (editing && !document) return <><PageTitle title="Documento não encontrado"/><Empty title="Documento não encontrado" detail="Ele pode ter sido excluído ou não estar disponível."/></>
  const protocol = protocolId ? db.protocols.find((item) => item.id === protocolId) : undefined
  if (protocol && !protocol.typeConfigSnapshot.arquivos?.enabled) return <><PageTitle title="Redigir documento"/><ErrorBox error={new Error('O tipo deste processo não permite anexos ou documentos.')}/></>
  const templates = db.documentTemplates.filter((template) => template.typeId === typeId && template.active)
  const applyTemplate = (selectedId: string, selectedTypeId = typeId) => {
    setTemplateId(selectedId)
    const template = db.documentTemplates.find((item) => item.id === selectedId)
    if (!template) return
    const draft = { ...form.getValues(), typeId: selectedTypeId, protocolId: protocolId ?? document?.protocolId }
    const values = documentTemplateValues(db, ctx, draft, document?.number)
    const preserved = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || `{{${key}}}`]))
    const nextSubject = replaceTemplateVariables(template.subject, preserved)
    form.setValue('subject', nextSubject, { shouldValidate: true })
    form.setValue('body', replaceTemplateVariables(template.body, { ...preserved, assunto_documento: nextSubject || '{{assunto_documento}}' }, true), { shouldValidate: true })
  }
  const resolveAvailableTokens = (changes: Partial<DocumentForm>) => {
    if (!templateId) return
    const draft = { ...form.getValues(), ...changes, protocolId: protocolId ?? document?.protocolId }
    const values = documentTemplateValues(db, ctx, draft, document?.number)
    const available = Object.fromEntries(Object.entries(values).filter(([, value]) => value && !value.startsWith('{{')))
    form.setValue('subject', replaceTemplateVariables(draft.subject, available), { shouldValidate: true })
    form.setValue('body', replaceTemplateVariables(draft.body, available, true), { shouldValidate: true })
  }
  return <>
    <div className="mb-5 flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">{editing ? 'Editar Documento' : 'Novo Documento'}</h1><p className="text-sm text-muted-foreground">{editing ? `Atualizar ${document?.number}` : 'Redigir novo documento'}</p></div><Link className="btn-secondary icon-button" aria-label="Voltar aos documentos" to={editing ? `/documentos/${documentId}` : '/documentos'}><ArrowLeft size={17}/></Link></div>
    <form className="mx-auto max-w-7xl space-y-5" onSubmit={form.handleSubmit((value) => create.mutate(value))}>
      <section className="panel p-5"><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de documento *" error={form.formState.errors.typeId?.message}><Select className="field" value={typeId} onChange={(event) => { const nextTypeId = event.target.value; form.setValue('typeId', nextTypeId, { shouldValidate: true }); const defaultTemplate = !editing && db.documentTemplates.find((template) => template.typeId === nextTypeId && template.active && template.isDefault); if (defaultTemplate) applyTemplate(defaultTemplate.id, nextTypeId); else setTemplateId('') }}><option value="">Selecione</option>{db.documentTypes.filter((type) => type.active || type.id === document?.typeId).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></Field>
        {typeId && <Field label="Modelo"><Select aria-label="Modelo do documento" className="field" value={templateId} disabled={templates.length === 0} onChange={(event) => applyTemplate(event.target.value)}><option value="">{!templates.length ? 'Nenhum modelo disponível' : 'Selecione um modelo (opcional)'}</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select><span className="mt-1 block text-xs text-muted-foreground">O modelo preenche o corpo do documento; o texto continua editável.</span></Field>}
        <div className="sm:col-span-2"><Field label="Lotação" error={form.formState.errors.unitId?.message}><Select aria-label="Lotação" searchable searchPlaceholder="Buscar na estrutura..." className="field" value={unitId} disabled={Boolean(protocol || document?.protocolId)} onChange={(event) => { form.setValue('unitId', event.target.value, { shouldValidate: true }); resolveAvailableTokens({ unitId: event.target.value }) }}><option value="">Selecione na estrutura...</option>{db.units.filter((unit) => unit.active && db.memberships.some((membership) => membership.userId === ctx.userId && membership.unitId === unit.id && membership.active && membership.role !== 'LEITOR')).sort((left, right) => unitPath(db.units, left.id).localeCompare(unitPath(db.units, right.id), 'pt-BR')).map((unit) => <option key={unit.id} value={unit.id}>{unitPath(db.units, unit.id)}</option>)}</Select></Field></div>
        <Field label="Destinatário"><Select className="field" value={recipientPersonId ?? ''} onChange={(event) => { form.setValue('recipientPersonId', event.target.value); resolveAvailableTokens({ recipientPersonId: event.target.value }) }}><option value="">Sem destinatário</option>{db.people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
        <Field label="Assunto *" error={form.formState.errors.subject?.message}><Input className="field" {...form.register('subject')}/></Field>
        {(protocol || document?.protocolId) && <div className="sm:col-span-2"><Field label="Processo vinculado"><Input className="field bg-slate-50" value={protocol ? `${protocol.number} — ${protocol.subject}` : db.protocols.find((item) => item.id === document?.protocolId)?.number ?? ''} readOnly/></Field></div>}
      </div></section>
      <div><span className="label mb-1 block">Corpo do documento *</span><RichTextEditor ariaLabel="Corpo do documento *" value={body} onChange={(value) => form.setValue('body', value, { shouldDirty: true, shouldValidate: true })}/>{form.formState.errors.body?.message && <span role="alert" className="mt-1 block text-xs font-semibold text-red-700 dark:text-red-300">{form.formState.errors.body.message}</span>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Assinante"><Input className="field" {...form.register('signerName')}/></Field><Field label="Cargo do assinante"><Input className="field" {...form.register('signerTitle')}/></Field></div>
      {create.error && <ErrorBox error={create.error}/>}<div className="flex justify-end gap-2 border-t pt-4"><Link className="btn-secondary" to={editing ? `/documentos/${documentId}` : '/documentos'}>Cancelar</Link><button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Salvando…' : 'Salvar documento'}</button></div>
    </form>
  </>
}

export function EditDocument() {
  return <NewDocument editing/>
}

export function DocumentDetail() {
  const { id = '' } = useParams()
  const ctx = useSession()
  const printSource = useRef<HTMLElement>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob>()
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<unknown>()
  const { data, isLoading } = useQuery({ queryKey: ['documents', ctx.userId, ctx.activeUnitId], queryFn: () => api.listDocuments(ctx) })
  if (isLoading || !data) return <Loading variant="detail"/>
  const document = data.items.find((item) => item.id === id)
  if (!document) return <><PageTitle title="Registro não encontrado"/><Empty title="Documento não encontrado" detail="Ele pode não estar visível no seu contexto."/></>
  const metadata = <p className="mt-2 text-sm text-muted-foreground">{data.db.documentTypes.find((type) => type.id === document.typeId)?.name} · {dateOnly(document.createdAt)}{document.recipientPersonId && <> · Destinatário: {data.db.people.find((person) => person.id === document.recipientPersonId)?.name ?? '—'}</>}</p>
  const openPreview = async () => {
    if (!printSource.current || generatingPreview) return
    setPreviewError(undefined)
    setGeneratingPreview(true)
    try {
      const { createDocumentPreviewPdf } = await import('./documentPdf')
      setPreviewBlob(await createDocumentPreviewPdf(printSource.current, document.number))
    } catch (error) {
      setPreviewError(error)
    } finally {
      setGeneratingPreview(false)
    }
  }
  return <>
    <PageTitle eyebrow={document.number} title={document.subject} action={<div className="flex gap-2">{canManageDocument(data.db, document, ctx) && <Link className="btn-secondary no-print" to={`/documentos/${document.id}/editar`}><Pencil size={16}/>Editar</Link>}<button className="btn-secondary no-print" disabled={generatingPreview} onClick={() => void openPreview()}><Printer size={16}/>{generatingPreview ? 'Gerando prévia…' : 'Prévia de impressão'}</button></div>}/>
    {previewError && <ErrorBox error={previewError}/>}
    <div className="mb-4 text-sm text-muted-foreground">{metadata}</div>
    {document.signerName && <p className="mb-4 text-sm text-muted-foreground">Assinante cadastrado: {document.signerName}{document.signerTitle && ` · ${document.signerTitle}`}</p>}
    <article ref={printSource} className="a4-page document-page print-shell"><DocumentBody document={document}/></article>
    {document.protocolId && <div className="mt-4 no-print"><Link className="text-public-700 underline" to={`/processos/${document.protocolId}`}>Abrir processo vinculado</Link></div>}
    {previewBlob && <PdfViewerDialog title={`${document.number}.pdf`} blob={previewBlob} onClose={() => setPreviewBlob(undefined)}/>}
  </>
}
