import { useEffect, useRef, useState } from 'react'
import type { AppDocument } from '../../domain/model'
import { documentMarginsStyle } from '../../lib/documentMargins'
import { PdfViewerDialog } from '../../components/ui/PdfViewerDialog'
import { DocumentBody } from './DocumentBody'
import { useDb } from '../../app/queries'
import { dateTime } from '../../lib/format'

export function DocumentPreviewDialog({ document, initialSigning = false, onClose }: { document: AppDocument; initialSigning?: boolean; onClose: () => void }) {
  const { data: db } = useDb()
  const source = useRef<HTMLElement>(null)
  const [blob, setBlob] = useState<Blob>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    if (!source.current) return
    const element = source.current
    let active = true
    const generate = async () => {
      try {
        const { createDocumentPreviewPdf } = await import('./documentPdf')
        const result = await createDocumentPreviewPdf(element, document.number)
        if (active) setBlob(result)
      } catch (failure) {
        if (active) setError(failure)
      }
    }
    void generate()
    return () => { active = false }
  }, [document.id, document.number])
  return <>
    <article ref={source} className="document-page" style={{ ...documentMarginsStyle(document.pageMargins), position: 'fixed', left: -10000, top: 0, width: '210mm', visibility: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      <DocumentBody document={document}/>
    </article>
    <PdfViewerDialog title={`${document.number}.pdf`} subtitle={`${document.subject} · ${db?.users.find((item) => item.id === document.authorUserId)?.name ?? 'Usuário'} · ${dateTime(document.createdAt)}`} signingContext={`${document.subject} — ${document.number}${document.protocolId ? ` · Processo ${db?.protocols.find((item) => item.id === document.protocolId)?.number ?? ''}` : ''}`} initialSigning={initialSigning} blob={blob} error={error} onClose={onClose}/>
  </>
}
