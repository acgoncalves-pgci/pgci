import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

export async function printPdf(pdf: PDFDocumentProxy, signal: AbortSignal) {
  const frame = document.createElement('iframe')
  frame.title = 'Impressão do PDF'
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;bottom:0;right:0;'
  let renderTask: RenderTask | undefined
  let timer: number | undefined
  const cleanup = () => {
    renderTask?.cancel()
    if (timer) window.clearTimeout(timer)
    frame.remove()
    signal.removeEventListener('abort', cleanup)
  }
  signal.addEventListener('abort', cleanup, { once: true })
  try {
    signal.throwIfAborted()
    document.body.append(frame)
    const content = frame.contentDocument!
    content.open()
    content.write('<!doctype html><html><head><title>Impressão do PDF</title></head><body></body></html>')
    content.close()
    const style = content.createElement('style')
    style.textContent = 'html,body{margin:0;padding:0}section{break-after:page;overflow:hidden}section:last-child{break-after:auto}img{display:block;width:100%;height:100%}'
    content.head.append(style)
    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted()
      const page = await pdf.getPage(number)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      renderTask = page.render({ canvas, viewport })
      await renderTask.promise
      signal.throwIfAborted()
      const original = page.getViewport({ scale: 1 })
      const width = original.width * 25.4 / 72
      const height = original.height * 25.4 / 72
      style.textContent += `@page pdf${number}{size:${width}mm ${height}mm;margin:0}`
      const section = content.createElement('section')
      section.style.cssText = `page:pdf${number};width:${width}mm;height:${height}mm;`
      const image = content.createElement('img')
      image.alt = `Página ${number}`
      image.src = canvas.toDataURL('image/png')
      canvas.width = canvas.height = 0
      section.append(image)
      content.body.append(section)
      await image.decode()
    }
    signal.throwIfAborted()
    frame.contentWindow!.addEventListener('afterprint', cleanup, { once: true })
    timer = window.setTimeout(cleanup, 120_000)
    frame.contentWindow!.focus()
    frame.contentWindow!.print()
  } catch (error) { cleanup(); throw error }
}
