import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { readDocumentMargins } from '../../lib/documentMargins'

const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297

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
  const padding = getComputedStyle(source)
  const toMm = (value: string) => Math.round(parseFloat(value) * 25.4 / 96 * 100) / 100
  const margins = readDocumentMargins({ top: toMm(padding.paddingTop), right: toMm(padding.paddingRight), bottom: toMm(padding.paddingBottom), left: toMm(padding.paddingLeft) })
  const contentWidth = PAGE_WIDTH_MM - margins.left - margins.right
  const contentHeight = PAGE_HEIGHT_MM - margins.top - margins.bottom
  // Capture the same browser layout that the user sees. jsPDF.html re-typesets text
  // and can lose spaces, font weights and line breaks in rich documents.
  const content = source.cloneNode(true) as HTMLElement
  content.removeAttribute('id')
  content.style.cssText = `width:${contentWidth}mm;max-width:none;min-height:0;height:auto;margin:0;padding:0;overflow:visible;box-shadow:none;background:#fff;color:#0f172a;`
  const staging = document.createElement('div')
  staging.style.cssText = `position:fixed;top:0;left:0;z-index:-1;pointer-events:none;width:${contentWidth}mm;background:#fff;`
  staging.append(content)
  // The app applies user zoom to <body>. html2canvas measures text ranges in
  // that zoomed tree but paints glyphs at unzoomed canvas sizes, overlapping
  // words (and apparently removing spaces). Keep the print tree outside it.
  document.documentElement.append(staging)

  try {
    await document.fonts.ready
    const scale = Math.min(2, 16000 / Math.max(content.scrollHeight, 1))
    const starts = lineStarts(content, scale)
    const layoutHeight = Math.ceil(content.getBoundingClientRect().height)
    const canvas = await html2canvas(content, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(window.innerWidth, content.scrollWidth),
      // Canvas font metrics can paint descenders below the last CSS line box.
      height: layoutHeight + Math.ceil(parseFloat(getComputedStyle(content).lineHeight)),
    })
    if (!canvas.width || !canvas.height) throw new Error('Não foi possível renderizar o documento para impressão.')

    let capturedHeight = Math.min(canvas.height, Math.ceil(layoutHeight * scale))
    const captureContext = canvas.getContext('2d')
    if (!captureContext) throw new Error('Não foi possível preparar o documento para impressão.')
    const tailStart = Math.max(0, capturedHeight - 2)
    const tail = captureContext.getImageData(0, tailStart, canvas.width, canvas.height - tailStart)
    // Keep any overflowing glyphs, without adding empty pages from the buffer.
    for (let row = tail.height - 1; row >= 0; row--) {
      const pixels = tail.data.subarray(row * canvas.width * 4, (row + 1) * canvas.width * 4)
      if (pixels.some((value, index) => index % 4 !== 3 && value < 250)) {
        capturedHeight = Math.min(canvas.height, Math.max(capturedHeight, tailStart + row + 3))
        break
      }
    }

    const pageHeight = Math.floor(canvas.width * contentHeight / contentWidth)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title })

    let top = 0
    let page = 0
    while (top < capturedHeight) {
      const limit = Math.min(top + pageHeight, capturedHeight)
      const safeBreak = starts.filter((start) => start > top + pageHeight * .7 && start < limit - 4).at(-1)
      const bottom = limit < capturedHeight && safeBreak ? safeBreak : limit
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = bottom - top
      const context = slice.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar a página para impressão.')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, slice.width, slice.height)
      context.drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, slice.width, slice.height)
      if (page > 0) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margins.left, margins.top, contentWidth, slice.height * contentWidth / canvas.width)
      top = bottom
      page += 1
    }
    return pdf.output('blob')
  } finally {
    staging.remove()
  }
}
