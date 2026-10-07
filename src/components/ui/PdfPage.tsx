import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { ErrorBox } from './Feedback'
import { loadPdfRuntime } from '../../lib/pdfRuntime'

export function PdfPage({ pdf, number, width, zoom, scrollRoot }: { pdf: PDFDocumentProxy; number: number; width: number; zoom: number; scrollRoot: HTMLDivElement | null }) {
  const figure = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [size, setSize] = useState({ width: 595.28, height: 841.89 })
  const [rendered, setRendered] = useState(false)
  const [error, setError] = useState<unknown>()
  const pageWidth = Math.min(width, size.width * 96 / 72) * zoom / 100
  const pageHeight = pageWidth * size.height / size.width
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root: scrollRoot, rootMargin: '500px' })
    if (figure.current) observer.observe(figure.current)
    return () => observer.disconnect()
  }, [scrollRoot])
  useEffect(() => {
    let cancelled = false
    pdf.getPage(number).then((page) => {
      const viewport = page.getViewport({ scale: 1 })
      if (!cancelled) setSize({ width: viewport.width, height: viewport.height })
    }).catch((error) => { if (!cancelled) setError(error) })
    return () => { cancelled = true }
  }, [pdf, number])
  useEffect(() => {
    let cancelled = false
    let task: RenderTask | undefined
    let textLayer: { cancel: () => void } | undefined
    const target = canvas.current!
    const textContainer = text.current!
    setRendered(false)
    if (!visible || !width) { target.width = target.height = 0; textContainer.replaceChildren(); return }
    const render = async () => {
      const [page, runtime] = await Promise.all([pdf.getPage(number), loadPdfRuntime()])
      if (cancelled) return
      const viewport = page.getViewport({ scale: pageWidth / size.width })
      const outputScale = Math.min(window.devicePixelRatio || 1, 2)
      target.width = Math.ceil(viewport.width * outputScale)
      target.height = Math.ceil(viewport.height * outputScale)
      target.style.width = `${viewport.width}px`
      target.style.height = `${viewport.height}px`
      textContainer.replaceChildren()
      textContainer.style.setProperty('--total-scale-factor', String(viewport.scale))
      textContainer.style.setProperty('--scale-factor', String(viewport.scale))
      task = page.render({ canvas: target, viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] })
      await task.promise
      if (cancelled) return
      const layer = new runtime.TextLayer({ textContentSource: page.streamTextContent(), container: textContainer, viewport })
      textLayer = layer
      await layer.render()
      if (!cancelled) { setRendered(true); setError(undefined) }
    }
    void render().catch((error) => { if (!cancelled) setError(error) })
    return () => { cancelled = true; task?.cancel(); textLayer?.cancel() }
  }, [pdf, number, visible, width, pageWidth, size.width])
  return <figure ref={figure} data-pdf-page={number} data-rendered={rendered} aria-label={`Página ${number} de ${pdf.numPages}`} className="pdf-preview-page relative shrink-0 overflow-hidden rounded border bg-white shadow-sm" style={{ width: pageWidth, height: pageHeight }}>
    <canvas ref={canvas} aria-hidden="true" className="block"/>
    <div ref={text} className="textLayer"/>
    {!rendered && visible && !error && <div className="absolute inset-0 grid place-items-center"><span role="status" className="text-sm text-slate-500">Carregando página {number}...</span></div>}
    {Boolean(error) && <div className="absolute inset-x-3 top-3"><ErrorBox error={error}/></div>}
  </figure>
}
