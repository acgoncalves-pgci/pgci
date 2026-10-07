import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Eye, FileArchive, FileText, Image, MessageSquareText, Paperclip, Pencil, Signature, Trash2 } from 'lucide-react'
import type { AppDocument, Attachment } from '../../domain/model'
import { canAct, canManageDocument } from '../../domain/rules'
import { hasPermission } from '../../domain/permissions'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { dateTime } from '../../lib/format'
import { api } from '../../services/api'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog'
import { ErrorBox, Field } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Input'
import { PdfSignatureDialog } from '../../components/ui/PdfSignatureDialog'

type FileItem = { kind: 'document'; item: AppDocument } | { kind: 'attachment'; item: Attachment }
export function ProcessFileRow({ file, readOnly = false, onPreview, onDelete }: { file: FileItem; readOnly?: boolean; onPreview: () => void; onDelete?: () => void }) {
  const ctx = useSession()
  const { data: db } = useDb()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [observing, setObserving] = useState(false)
  const [signing, setSigning] = useState(false)
  const document = file.kind === 'document' ? file.item : undefined
  const attachment = file.kind === 'attachment' ? file.item : undefined
  const name = document?.subject ?? attachment!.filename
  const identifier = document?.number ?? name
  const [draftName, setDraftName] = useState(name)
  const [description, setDescription] = useState(file.item.description ?? '')
  const protocol = db?.protocols.find((item) => item.id === file.item.protocolId)
  const editable = Boolean(db && !readOnly && (document ? hasPermission(db, ctx, 'documents.edit') && canManageDocument(db, document, ctx) : protocol && hasPermission(db, ctx, 'attachments.edit') && canAct(db, protocol, ctx) && ['CADASTRADO', 'EM_ANDAMENTO'].includes(protocol.status)))
  const isPdf = Boolean(document || attachment?.mimeType === 'application/pdf')
  const actor = db?.users.find((user) => user.id === (document?.authorUserId ?? attachment?.uploadedById))?.name ?? 'Usuário'
  const Icon = document ? FileText : attachment?.filename.toLowerCase().startsWith('dossie_') ? FileArchive : attachment?.mimeType.startsWith('image/') ? Image : Paperclip
  const type = db?.documentTypes.find((item) => item.id === document?.typeId)
  const color = type?.color || 'var(--ui-accent)'
  const update = useMutation<AppDocument | Attachment, Error, void>({ mutationFn: () => document ? api.updateDocumentMetadata(ctx, document.id, { subject: draftName, description }) : api.updateAttachment(ctx, attachment!.id, { filename: draftName, description }), onSuccess: () => { setEditing(false); invalidateAll(queryClient) } })
  const items = [
    ...(isPdf && ctx.user ? [{ label: 'Assinar', icon: <Signature size={15}/>, action: () => setSigning(true) }] : []),
    { label: 'Ver observação', icon: <MessageSquareText size={15}/>, action: () => setObserving(true) },
    ...(editable ? [{ label: 'Editar', icon: <Pencil size={15}/>, action: () => { setDraftName(name); setDescription(file.item.description ?? ''); update.reset(); setEditing(true) } }] : []),
    ...(onDelete && !readOnly ? [{ label: 'Excluir', icon: <Trash2 size={15}/>, action: onDelete, danger: true }] : []),
  ]
  return <>
    <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap" data-process-file={file.kind}>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}><Icon size={20}/></span>
      <div className="min-w-0 flex-1"><strong className="block truncate text-sm" title={name}>{name}</strong><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{document && <span className="font-mono">{document.number}</span>}<span>{document ? 'Criado' : 'Anexado'} por {actor} · {dateTime(file.item.createdAt)}</span>{attachment && <span className="rounded bg-muted px-1.5 py-0.5">{Math.max(1, Math.ceil(attachment.sizeBytes / 1024))} KB</span>}</p>{file.item.description && <p className="mt-1 truncate text-xs text-muted-foreground" title={file.item.description}>{file.item.description}</p>}</div>
      <div className="ml-auto flex shrink-0 items-center gap-1"><button type="button" className="inline-flex min-h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`Visualizar ${document ? 'documento' : 'anexo'} ${identifier}`} onClick={() => onPreview()}><Eye size={16}/><span>Visualizar</span></button><ActionMenu label={`Ações ${document ? 'do documento' : 'do anexo'} ${identifier}`} items={items}/></div>
    </div>
    {signing && <PdfSignatureDialog documentTitle={`${document ? `Documento ${document.number} — ${name}` : `Anexo ${name}`}${protocol ? ` — Processo ${protocol.number}` : ''}`} ready onClose={() => setSigning(false)} onSign={() => {
      setSigning(false)
      window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'success', message: `Assinatura simulada de “${name}” concluída. O arquivo original foi preservado.` } }))
    }}/>}
    {observing && <Dialog title="Observação" onClose={() => setObserving(false)}><DialogBody><p className="mb-3 break-words text-sm font-semibold">{name}</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{file.item.description || 'Nenhuma descrição informada.'}</p></DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={() => setObserving(false)}>Fechar</button></DialogFooter></Dialog>}
    {editing && <Dialog title={document ? 'Editar documento' : 'Editar anexo'} onClose={() => { if (!update.isPending) setEditing(false) }}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); if (!update.isPending) update.mutate() }}>
        <DialogBody className="space-y-4"><Field label={document ? 'Nome do documento *' : 'Nome do anexo *'}><Input required maxLength={255} value={draftName} onChange={(event) => setDraftName(event.target.value)} disabled={update.isPending}/></Field><Field label="Descrição"><textarea className="field min-h-24" rows={4} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={update.isPending} placeholder="Adicione uma descrição ou observação..."/></Field>{document && <Link className="inline-flex items-center gap-2 text-sm text-primary hover:underline" to={`/documentos/${document.id}/editar`}><Pencil size={14}/>Editar conteúdo do documento</Link>}{update.error && <ErrorBox error={update.error}/>}</DialogBody>
        <DialogFooter><button type="button" className="btn-secondary" disabled={update.isPending} onClick={() => setEditing(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={update.isPending || !draftName.trim()}>{update.isPending ? 'Salvando…' : 'Salvar alterações'}</button></DialogFooter>
      </form>
    </Dialog>}
  </>
}
