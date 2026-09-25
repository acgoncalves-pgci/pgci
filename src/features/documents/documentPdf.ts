import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 20
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2

function lineStarts(element: HTMLElement, scale: number): number[] {
  const origin = element.getBoundingClientRect().top
  const starts = new Set<number>()
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const rect of Array.from(range.getClientRects())) {
      starts.add(Math.round((rect.top - origin) * scale))
    }
  }
  return Array.from(starts).sort((a, b) => a - b)
}

export async function createDocumentPreviewPdf(source: HTMLElement, title: string): Promise<Blob> {
  // Capture the same browser layout that the user sees. jsPDF.html re-typesets text
  // and can lose spaces, font weights and line breaks in rich documents.
  const content = source.cloneNode(true) as HTMLElement
  content.removeAttribute('id')
  content.style.cssText = 'width:170mm;max-width:none;min-height:0;height:auto;margin:0;padding:0;overflow:visible;box-shadow:none;background:#fff;color:#0f172a;'
  const staging = document.createElement('div')
  staging.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;pointer-events:none;width:170mm;background:#fff;'
  staging.append(content)
  // The app applies user zoom to <body>. html2canvas measures text ranges in
  // that zoomed tree but paints glyphs at unzoomed canvas sizes, overlapping
  // words (and apparently removing spaces). Keep the print tree outside it.
  document.documentElement.append(staging)

  try {
    await document.fonts.ready
    const scale = Math.min(2, 16000 / Math.max(content.scrollHeight, 1))
    const starts = lineStarts(content, scale)
    const canvas = await html2canvas(content, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(window.innerWidth, content.scrollWidth),
    })
    if (!canvas.width || !canvas.height) throw new Error('Não foi possível renderizar o documento para impressão.')

    const pageHeight = Math.floor(canvas.width * CONTENT_HEIGHT_MM / CONTENT_WIDTH_MM)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title })

    let top = 0
    let page = 0
    while (top < canvas.height) {
      const limit = Math.min(top + pageHeight, canvas.height)
      const safeBreak = starts.filter((start) => start > top + pageHeight * .7 && start < limit - 4).at(-1)
      const bottom = limit < canvas.height && safeBreak ? safeBreak : limit
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = bottom - top
      const context = slice.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar a página para impressão.')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, slice.width, slice.height)
      context.drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, slice.width, slice.height)
      if (page > 0) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, CONTENT_WIDTH_MM, slice.height * CONTENT_WIDTH_MM / canvas.width)
      top = bottom
      page += 1
    }
    return pdf.output('blob')
  } finally {
    staging.remove()
  }
}
