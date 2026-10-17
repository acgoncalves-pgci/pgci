import { Archive, ArrowRight, Ban, CheckCheck, ChevronRight, CircleX, ClipboardList, FileText, Paperclip, Pencil, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import type { AppDocument, Attachment, AuditEvent, Database, ProtocolEvent } from '../../domain/model'
import { isMovementEvent } from '../../domain/model'
import { protocolAuditEntries } from '../../domain/protocolAudit'
import { dateTime } from '../../lib/format'

function auditAppearance(action: string) {
  if (action.includes('DELETED')) return { Icon: Trash2, tone: 'text-destructive bg-destructive/10' }
  if (action.includes('REJECT') || action === 'REJEICAO') return { Icon: Ban, tone: 'text-blue-600 bg-blue-500/10 dark:text-blue-400' }
  if (action.includes('CANCEL')) return { Icon: CircleX, tone: 'text-red-600 bg-red-500/10 dark:text-red-400' }
  if (action.includes('REOPEN') || action === 'REABERTURA') return { Icon: RefreshCcw, tone: 'text-teal-600 bg-teal-500/10 dark:text-teal-400' }
  if (action.includes('ATTACHMENT') || action === 'ANEXO_ADICIONADO') return { Icon: Paperclip, tone: 'text-violet-600 bg-violet-500/10 dark:text-violet-400' }
  if (action.includes('DOCUMENT')) return { Icon: FileText, tone: 'text-sky-600 bg-sky-500/10 dark:text-sky-400' }
  if (action.includes('ACKNOWLEDGED') || action === 'RECEBIMENTO' || action.includes('COMPLETED') || action === 'CONCLUSAO') return { Icon: CheckCheck, tone: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400' }
  if (action.includes('ARCHIV') || action === 'ARQUIVAMENTO') return { Icon: Archive, tone: 'text-violet-600 bg-violet-500/10 dark:text-violet-400' }
  if (action.includes('FORWARD') || action === 'TRAMITACAO') return { Icon: ArrowRight, tone: 'text-orange-600 bg-orange-500/10 dark:text-orange-400' }
  if (action.includes('UPDATED')) return { Icon: Pencil, tone: 'text-[var(--ui-accent-text)] bg-muted' }
  return { Icon: ClipboardList, tone: 'text-muted-foreground bg-muted' }
}

export function ProtocolAuditTimeline({ events, auditEvents, db, attachments, documents, canViewFiles, onAttachment, onDocument, onMovement, onFiles }: {
  events: ProtocolEvent[];
  auditEvents: AuditEvent[];
  db: Database;
  attachments: Attachment[];
  documents: AppDocument[];
  canViewFiles: boolean;
  onAttachment: (item: Attachment) => void;
  onDocument: (item: AppDocument) => void;
  onMovement: (eventId: string) => void;
  onFiles: (kind: 'attachments' | 'documents') => void;
}) {
  const movements = events.filter(isMovementEvent).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const entries = protocolAuditEntries(events, auditEvents)
  const dayLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const shortcutClass = 'inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[var(--ui-accent-text)] transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'
  return (
    <section className="panel mt-3 overflow-hidden" aria-label="Histórico de auditoria">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} aria-hidden="true" />Auditoria <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{entries.length}</span></h2>
        <span className="text-[11px] text-muted-foreground">Mais recentes primeiro</span>
      </header>
      {entries.length ? <ol className="px-3 py-2 sm:px-4" aria-label="Eventos de auditoria">
        {entries.map((entry, index) => {
          const attachment = attachments.find((item) => item.id === entry.attachmentId)
          const document = documents.find((item) => item.id === entry.documentId)
          const movementId = entry.movementId ?? attachment?.movementEventId ?? document?.movementEventId ?? movements.find((item) => item.createdAt <= entry.createdAt)?.id
          const { Icon, tone } = auditAppearance(entry.action)
          const fileKind = entry.action.includes('ATTACHMENT') || entry.action === 'ANEXO_ADICIONADO' ? 'attachments' : entry.action.includes('DOCUMENT') ? 'documents' : undefined
          const deleted = entry.action.includes('DELETED')
          return <li key={entry.id}>
            {(index === 0 || dayLabel(entries[index - 1].createdAt) !== dayLabel(entry.createdAt)) && <p className="py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel(entry.createdAt)}</p>}
            <div className="relative flex gap-3 py-1.5">
              {index < entries.length - 1 && <span aria-hidden="true" className="absolute bottom-[-1rem] left-3.5 top-8 w-px bg-slate-200 dark:bg-slate-700" />}
              <span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={13} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="text-xs font-semibold leading-6">{entry.label}</h3>
                    <p className="text-[10px] leading-6 text-muted-foreground">{db.users.find((item) => item.id === entry.actorUserId)?.name ?? 'Usuário'}<span aria-hidden="true" className="mx-1.5">·</span>{db.units.find((item) => item.id === entry.actorUnitId)?.name ?? 'Unidade'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <time dateTime={entry.createdAt} title={dateTime(entry.createdAt)} className="text-[10px] tabular-nums text-muted-foreground">{new Date(entry.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                    {movementId && <button type="button" aria-label="Ver movimentação" title="Ver movimentação" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onMovement(movementId)}><ChevronRight size={14} aria-hidden="true" /></button>}
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                  {entry.details && <p className="min-w-0 flex-1 basis-64 break-words text-xs leading-5 text-muted-foreground">{entry.details}</p>}
                  {canViewFiles && attachment && <button type="button" className={shortcutClass} title={attachment.filename} aria-label={`Abrir anexo ${attachment.filename}`} onClick={() => onAttachment(attachment)}><Paperclip size={12} aria-hidden="true" /><span className="truncate">{attachment.filename}</span></button>}
                  {canViewFiles && document && <button type="button" className={shortcutClass} title={`${document.number} · ${document.subject}`} aria-label={`Abrir documento ${document.number}`} onClick={() => onDocument(document)}><FileText size={12} aria-hidden="true" /><span className="truncate">{document.number}</span></button>}
                  {canViewFiles && fileKind && !attachment && !document && (deleted || entry.attachmentId || entry.documentId ? <span className="px-2 text-[10px] text-muted-foreground">{fileKind === 'attachments' ? 'Anexo indisponível' : 'Documento indisponível'}</span> : <button type="button" className={shortcutClass} onClick={() => onFiles(fileKind)}>{fileKind === 'attachments' ? <Paperclip size={12} aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />}{fileKind === 'attachments' ? 'Ver anexos' : 'Ver documentos'}</button>)}
                </div>
              </div>
            </div>
          </li>
        })}
      </ol> : <p className="p-4 text-sm text-muted-foreground">Nenhum evento de auditoria registrado.</p>}
    </section>
  )
}
