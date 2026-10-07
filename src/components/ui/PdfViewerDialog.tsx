import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { Download, FileText, Printer, ShieldCheck, Signature, ZoomIn, ZoomOut } from 'lucide-react'
import 'pdfjs-dist/web/pdf_viewer.css'
import { Dialog, DialogBody } from './Dialog'
import { PdfSignatureDialog } from './PdfSignatureDialog'
import { ErrorBox, Loading } from './Feedback'
import { PdfPage } from './PdfPage'
import { useSession } from '../../app/session'
import { loadPdfRuntime, pdfAssetOptions } from '../../lib/pdfRuntime'
import { printPdf } from '../../lib/printPdf'

export function PdfViewerDialog({ title, subtitle, signingContext, initialSigning = false, url, blob, downloadFilename, downloadLabel = 'Baixar', error, onClose }: { title: string; subtitle?: string; signingContext?: string; initialSigning?: boolean; url?: string; blob?: Blob; downloadFilename?: string; downloadLabel?: string; error?: unknown; onClose: () => void }) {
  const ctx = useSession()
  const [temporaryUrl, setTemporaryUrl] = useState<string>()
  const [loaded, setLoaded] = useState<{ source: string; pdf?: PDFDocumentProxy; error?: unknown }>()
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [printing, setPrinting] = useState(false)
  const [actionError, setActionError] = useState<unknown>()
  const [signing, setSigning] = useState(initialSigning)
  const [signature, setSignature] = useState<string>()
  const printController = useRef<AbortController>()
  useEffect(() => {
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    setTemporaryUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  const source = url ?? temporaryUrl
  const current = loaded?.source === source ? loaded : undefined
  const pdf = current?.pdf
  const viewerError = error ?? current?.error
  const filename = downloadFilename ?? (title.toLowerCase().endsWith('.pdf') ? title : `${title}.pdf`)
  useEffect(() => {
    if (!source || error) return
    let cancelled = false
    let task: PDFDocumentLoadingTask | undefined
    void loadPdfRuntime().then((runtime) => {
      if (cancelled) return
      task = runtime.getDocument({ url: source, ...pdfAssetOptions })
      return task.promise.then((pdf) => { if (!cancelled) setLoaded({ source, pdf }) })
    }).catch((error) => { if (!cancelled) setLoaded({ source, error }) })
    return () => { cancelled = true; void task?.destroy() }
  }, [source, error])
  useEffect(() => {
    if (!scrollRoot) return
    const measure = () => setWidth(Math.max(1, scrollRoot.clientWidth - 32))
    const observer = new ResizeObserver(measure)
    observer.observe(scrollRoot)
    measure()
    return () => observer.disconnect()
  }, [scrollRoot])
  useEffect(() => () => printController.current?.abort(), [])
  const print = async () => {
    if (!pdf || printing) return
    printController.current?.abort()
    const controller = new AbortController()
    printController.current = controller
    setPrinting(true)
    setActionError(undefined)
    try { await printPdf(pdf, controller.signal) }
    catch (error) { if (!controller.signal.aborted) setActionError(error) }
    finally { if (!controller.signal.aborted) setPrinting(false) }
  }
  return <>
    <Dialog title={title} titleDescription={subtitle} titleIcon={<FileText size={16} className="shrink-0 text-slate-500"/>} onClose={onClose} wide showDefaultFooter={false} headerActions={<>
      {signature && <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200"><ShieldCheck size={13}/>1 assinatura simulada</span>}
      <button type="button" className="btn bg-violet-600 text-white hover:bg-violet-700" disabled={!pdf || !ctx.user || printing || Boolean(signature)} onClick={() => setSigning(true)}><Signature size={16}/>Assinar</button>
      <button type="button" className="btn-secondary" disabled={!pdf || printing} onClick={() => void print()}><Printer size={16}/>{printing ? 'Preparando…' : 'Imprimir'}</button>
      <button type="button" className="btn-secondary" disabled={!source || Boolean(error)} onClick={() => {
        const link = document.createElement('a'); link.href = source!; link.download = filename; link.click()
      }}><Download size={16}/>{downloadLabel}</button>
    </>}>
      <DialogBody className="flex h-[75dvh] flex-col !overflow-hidden !p-0">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-2">
          <span aria-live="polite" className="text-xs text-slate-500">{viewerError ? 'PDF indisponível' : pdf ? `${pdf.numPages} ${pdf.numPages === 1 ? 'página' : 'páginas'}` : 'Carregando PDF...'}</span>
          <div className="flex items-center gap-2 rounded-lg border px-2 py-1"><button type="button" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Diminuir zoom" disabled={!pdf || zoom <= 50} onClick={() => setZoom((value) => value - 25)}><ZoomOut size={16}/></button><button type="button" className="min-w-12 rounded px-1 text-xs" aria-label={`Zoom ${zoom}%. Restaurar 100%`} disabled={!pdf} onClick={() => setZoom(100)}>{zoom}%</button><button type="button" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Aumentar zoom" disabled={!pdf || zoom >= 200} onClick={() => setZoom((value) => value + 25)}><ZoomIn size={16}/></button></div>
        </div>
        {signature && <p role="status" className="shrink-0 border-b bg-violet-50 px-5 py-2 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-200">{signature}</p>}
        {Boolean(actionError) && <div className="shrink-0 px-5 py-2"><ErrorBox error={actionError}/></div>}
        <div ref={setScrollRoot} className="pdf-preview-scroll min-h-0 flex-1 overflow-auto bg-stone-100 p-4 dark:bg-slate-950" aria-label="Páginas do PDF">
          {viewerError ? <ErrorBox error={viewerError}/> : pdf ? <div className="flex w-max min-w-full flex-col items-center gap-4">{Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={`${source}:${index}`} pdf={pdf} number={index + 1} width={width} zoom={zoom} scrollRoot={scrollRoot}/>)}</div> : <Loading/>}
        </div>
      </DialogBody>
    </Dialog>
    {signing && <PdfSignatureDialog documentTitle={signingContext ?? title} ready={Boolean(pdf)} onClose={() => setSigning(false)} onSign={({ signer, title, reason }) => { setSignature(`Assinatura simulada por ${signer}${title ? ` · ${title}` : ''} em ${new Date().toLocaleString('pt-BR')}.${reason ? ` Motivo: ${reason}.` : ''} O arquivo PDF permanece sem assinatura.`); setSigning(false) }}/>}
  </>
}
