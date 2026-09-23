import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FilePlus2, Printer, Search } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { PrintPreviewDialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { RichTextEditor } from '../../components/ui/RichTextEditor'
import { Select } from '../../components/ui/Select'
import type { AppDocument, Database } from '../../domain/model'
import { dateOnly } from '../../lib/format'
import { documentText, isRichDocument, sanitizeDocumentHtml } from '../../lib/richText'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { navigateWithLoading } from '../../app/routeLoading'

const documentSchema = z.object({
  typeId: z.string().min(1, 'Selecione o tipo.'),
  subject: z.string().trim().min(1, 'Informe o assunto.'),
  body: z.string().refine((value) => Boolean(documentText(value)), 'Informe o corpo.'),
  recipientPersonId: z.string().optional(),
})
type DocumentForm = z.infer<typeof documentSchema>

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
const replaceTokens = (value: string, tokens: Record<string, string>, html: boolean) => Object.entries(tokens).reduce(
  (current, [key, replacement]) => current.split(`{{${key}}}`).join(html ? escapeHtml(replacement) : replacement),
  value,
)

function DocumentBody({ document }: { document: AppDocument }) {
  return isRichDocument(document.body)
    ? <div className="document-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(document.body) }}/>
    : <div className="whitespace-pre-wrap">{document.body}</div>
}

export function Documents() {
  const ctx = useSession()
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const { data, isLoading, error } = useQuery({ queryKey: ['documents', ctx.userId, ctx.activeUnitId, search, typeId], queryFn: () => api.listDocuments(ctx, search, typeId) })
  if (isLoading) return <Loading variant="list"/>
  if (error || !data) return <ErrorBox error={error}/>
  return <>
    <PageTitle title="Documentos" action={<Link className="btn-primary" to="/documentos/novo"><FilePlus2 size={16}/>Redigir documento</Link>}/>
    <div className="panel mb-4 flex flex-col gap-2 p-3 sm:flex-row">
      <label className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={17}/><Input aria-label="Buscar documentos" className="field !mt-0 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número ou assunto"/></label>
      <Select aria-label="Filtrar por tipo de documento" className="field !mt-0 sm:w-52" value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">Todos os tipos</option>{data.db.documentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select>
    </div>
    {data.items.length ? <div className="panel overflow-hidden">
      <div className="space-y-3 p-3 md:hidden">{data.items.map((document) => <DocumentCard key={document.id} document={document} db={data.db}/>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[700px] text-sm"><thead><tr><th className="table-head">Número</th><th className="table-head">Assunto</th><th className="table-head">Tipo</th><th className="table-head">Processo</th><th className="table-head">Data</th><th className="table-head"><span className="sr-only">Ações</span></th></tr></thead><tbody>{data.items.map((document) => <tr className="border-t" key={document.id}><td className="px-3 py-3 font-mono text-xs">{document.number}</td><td className="px-3 py-3 font-medium">{document.subject}</td><td className="px-3 py-3">{data.db.documentTypes.find((type) => type.id === document.typeId)?.name}</td><td className="px-3 py-3">{document.protocolId ? <Link className="text-public-700 underline" to={`/processos/${document.protocolId}`}>{data.db.protocols.find((protocol) => protocol.id === document.protocolId)?.number}</Link> : 'Avulso'}</td><td className="px-3 py-3">{dateOnly(document.createdAt)}</td><td className="px-3 py-3"><Link className="btn-secondary !py-1" to={`/documentos/${document.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>
    </div> : <Empty title="Nenhum documento encontrado" detail="Comece redigindo um documento em formato A4."/>}
  </>
}

function DocumentCard({ document, db }: { document: AppDocument; db: Database }) {
  return <article className="rounded-md border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{document.number}</p><h2 className="mt-1 font-medium">{document.subject}</h2></div><Link className="btn-secondary !py-1" to={`/documentos/${document.id}`}>Abrir</Link></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="label">Tipo</dt><dd className="mt-1">{db.documentTypes.find((type) => type.id === document.typeId)?.name}</dd></div><div><dt className="label">Data</dt><dd className="mt-1">{dateOnly(document.createdAt)}</dd></div><div className="col-span-2"><dt className="label">Processo</dt><dd className="mt-1">{document.protocolId ? <Link className="text-public-700 underline" to={`/processos/${document.protocolId}`}>{db.protocols.find((protocol) => protocol.id === document.protocolId)?.number}</Link> : 'Avulso'}</dd></div></dl></article>
}

export function NewDocument() {
  const navigate = useNavigate()
  const ctx = useSession()
  const queryClient = useQueryClient()
  const { data: db, isLoading } = useDb()
  const params = new URLSearchParams(useLocation().search)
  const protocolId = params.get('protocolId') ?? undefined
  const movementEventId = params.get('movementEventId') ?? undefined
  const [templateId, setTemplateId] = useState('')
  const form = useForm<DocumentForm>({ resolver: zodResolver(documentSchema), defaultValues: { typeId: '', subject: '', body: '', recipientPersonId: '' } })
  const typeId = form.watch('typeId')
  const body = form.watch('body')
  const recipientPersonId = form.watch('recipientPersonId')
  const create = useMutation({ mutationFn: (value: DocumentForm) => api.createDocument(ctx, { ...value, recipientPersonId: value.recipientPersonId || undefined, protocolId, movementEventId }), onSuccess: (document) => { invalidateAll(queryClient); navigateWithLoading(navigate, `/documentos/${document.id}`) } })
  if (isLoading || !db) return <Loading variant="detail"/>
  const protocol = protocolId ? db.protocols.find((item) => item.id === protocolId) : undefined
  if (protocol && !protocol.typeConfigSnapshot.arquivos?.enabled) return <><PageTitle title="Redigir documento"/><ErrorBox error={new Error('O tipo deste processo não permite anexos ou documentos.')}/></>
  const templates = db.documentTemplates.filter((template) => template.typeId === typeId && template.active)
  const applyTemplate = (selectedId: string) => {
    setTemplateId(selectedId)
    const template = db.documentTemplates.find((item) => item.id === selectedId)
    if (!template) return
    const recipient = db.people.find((person) => person.id === recipientPersonId)?.name ?? 'destinatário'
    const tokens = {
      numero_processo: protocol?.number ?? 'documento avulso',
      assunto_processo: protocol?.subject ?? form.getValues('subject') ?? '',
      destinatario: recipient,
      data_atual: new Intl.DateTimeFormat('pt-BR').format(new Date()),
      usuario: ctx.user?.name ?? '',
      unidade: db.units.find((unit) => unit.id === ctx.activeUnitId)?.name ?? '',
    }
    form.setValue('subject', replaceTokens(template.subject, tokens, false), { shouldValidate: true })
    form.setValue('body', replaceTokens(template.body, tokens, true), { shouldValidate: true })
  }
  return <>
    <PageTitle title="Redigir documento"/>
    <form className="mx-auto max-w-7xl space-y-5" onSubmit={form.handleSubmit((value) => create.mutate(value))}>
      <section className="panel p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tipo de documento *" error={form.formState.errors.typeId?.message}><Select className="field" value={typeId} onChange={(event) => { form.setValue('typeId', event.target.value, { shouldValidate: true }); setTemplateId('') }}><option value="">Selecione</option>{db.documentTypes.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></Field>
        <Field label="Modelo"><Select aria-label="Modelo do documento" className="field" value={templateId} disabled={!typeId || templates.length === 0} onChange={(event) => applyTemplate(event.target.value)}><option value="">{typeId && !templates.length ? 'Nenhum modelo disponível' : 'Selecione um modelo'}</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field>
        <Field label="Destinatário"><Select className="field" value={recipientPersonId ?? ''} onChange={(event) => form.setValue('recipientPersonId', event.target.value)}><option value="">Sem destinatário</option>{db.people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
        {protocol && <Field label="Processo vinculado"><Input className="field bg-slate-50" value={`${protocol.number} — ${protocol.subject}`} readOnly/></Field>}
        <Field label="Assunto *" error={form.formState.errors.subject?.message}><Input className="field" {...form.register('subject')}/></Field>
      </div></section>
      <Field label="Corpo do documento *" error={form.formState.errors.body?.message}><RichTextEditor ariaLabel="Corpo do documento *" value={body} onChange={(value) => form.setValue('body', value, { shouldDirty: true, shouldValidate: true })}/></Field>
      {create.error && <ErrorBox error={create.error}/>}<div className="flex justify-end gap-2"><Link className="btn-secondary" to="/documentos">Cancelar</Link><button className="btn-primary" disabled={create.isPending}>Salvar documento</button></div>
    </form>
  </>
}

export function DocumentDetail() {
  const { id = '' } = useParams()
  const ctx = useSession()
  const [printPreview, setPrintPreview] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['documents', ctx.userId, ctx.activeUnitId], queryFn: () => api.listDocuments(ctx) })
  if (isLoading || !data) return <Loading variant="detail"/>
  const document = data.items.find((item) => item.id === id)
  if (!document) return <><PageTitle title="Registro não encontrado"/><Empty title="Documento não encontrado" detail="Ele pode não estar visível no seu contexto."/></>
  const metadata = <p className="mt-2 text-sm text-muted-foreground">{data.db.documentTypes.find((type) => type.id === document.typeId)?.name} · {dateOnly(document.createdAt)}{document.recipientPersonId && <> · Destinatário: {data.db.people.find((person) => person.id === document.recipientPersonId)?.name ?? '—'}</>}</p>
  return <>
    <PageTitle eyebrow={document.number} title={document.subject} action={<button className="btn-secondary no-print" onClick={() => setPrintPreview(true)}><Printer size={16}/>Prévia de impressão</button>}/>
    <article className="a4-page document-page print-shell"><header className="border-b pb-5"><p className="font-mono text-sm text-muted-foreground">{document.number}</p><h2 className="mt-2 text-2xl font-semibold">{document.subject}</h2>{metadata}</header><div className="py-8 text-[15px] leading-8"><DocumentBody document={document}/></div>{document.protocolId && <footer className="border-t pt-4 text-sm"><Link className="text-public-700 underline" to={`/processos/${document.protocolId}`}>Abrir processo vinculado</Link></footer>}</article>
    {printPreview && <PrintPreviewDialog title={document.number} onClose={() => setPrintPreview(false)}><div className="document-page"><header className="border-b border-slate-300 pb-5"><p className="font-mono text-sm text-slate-600">{document.number}</p><h1 className="mt-2 text-2xl font-semibold">{document.subject}</h1>{metadata}</header><div className="py-8 text-[15px] leading-8"><DocumentBody document={document}/></div>{document.protocolId && <footer className="border-t border-slate-300 pt-4 text-sm">Processo vinculado: {data.db.protocols.find((protocol) => protocol.id === document.protocolId)?.number ?? '—'}</footer>}</div></PrintPreviewDialog>}
  </>
}
