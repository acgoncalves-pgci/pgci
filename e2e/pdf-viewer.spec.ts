import { demoText } from './helpers/demo'
import { expect, test } from '@playwright/test'
import { readPreview, expectPdfReady } from './helpers/pdf'
import { PDFDocument } from 'pdf-lib'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('visualizador tem controles próprios, zoom, assinatura simulada e download explícito', async ({ page }, testInfo) => {
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  await page.goto('/processos/pr-1')
  await page.getByRole('button', { name: 'Ações', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Imprimir detalhamento', exact: true }).click()
  const modal = page.getByRole('dialog', { name: await demoText(page, 'Detalhamento do processo — 2026.000001') })
  await expectPdfReady(modal)
  expect(downloads).toEqual([])
  await expect(modal.getByRole('button', { name: 'Assinar', exact: true })).toBeEnabled()
  await expect(modal.getByRole('button', { name: 'Imprimir', exact: true })).toBeEnabled()
  await expect(modal.getByText(/^[0-9]+ páginas?$/)).toBeVisible()
  const firstPage = modal.locator('[data-pdf-page="1"]')
  const originalWidth = (await firstPage.boundingBox())!.width
  const header = modal.locator('header').first()
  const headerBefore = await header.boundingBox()
  await modal.getByRole('button', { name: 'Aumentar zoom' }).click()
  await expect(modal.getByRole('button', { name: 'Zoom 125%. Restaurar 100%' })).toBeVisible()
  expect((await firstPage.boundingBox())!.width).toBeCloseTo(originalWidth * 1.25, 0)
  await modal.locator('.pdf-preview-scroll').evaluate((element) => { element.scrollTop = 400 })
  expect((await header.boundingBox())!.y).toBe(headerBefore!.y)
  await modal.getByRole('button', { name: 'Zoom 125%. Restaurar 100%' }).click()
  await modal.locator('.pdf-preview-scroll').evaluate((element) => { element.scrollTop = 0 })
  await expectPdfReady(modal)
  await page.screenshot({ path: testInfo.outputPath('pdf-viewer-light.png') })
  const beforeSigning = await readPreview(page, modal)
  await modal.getByRole('button', { name: 'Assinar', exact: true }).click()
  const signature = page.getByRole('dialog', { name: 'Assinar eletronicamente', exact: true })
  await expect(signature.getByLabel('Assinante')).toHaveValue('Marina Duarte')
  await expect(signature.getByLabel('Assinante')).toHaveAttribute('readonly', '')
  await signature.getByLabel('Cargo / função').fill('Secretária de Administração')
  await signature.getByLabel('Motivo da assinatura').fill('Aprovo o conteúdo do documento')
  await signature.getByRole('button', { name: 'Assinar', exact: true }).click()
  await expect(signature).toBeHidden()
  await expect(modal.getByRole('status')).toContainText('Assinatura simulada por')
  await expect(modal.getByRole('status')).toContainText('Secretária de Administração')
  await expect(modal.getByRole('status')).toContainText('Aprovo o conteúdo do documento')
  expect(await readPreview(page, modal)).toEqual(beforeSigning)
  await modal.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(modal).toBeHidden()
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click()
  await page.getByRole('button', { name: 'Ações', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Imprimir detalhamento', exact: true }).click()
  await expectPdfReady(modal)
  await expect(firstPage).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  // Check the bitmap too: an empty sheet can have the correct page dimensions.
  await expect.poll(() => firstPage.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] && pixels[index] < 200) ink++
    return ink
  })).toBeGreaterThan(100)
  await modal.locator('.dialog-content').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  await page.screenshot({ path: testInfo.outputPath('pdf-viewer-dark.png') })
  expect((await PDFDocument.load(beforeSigning)).getPageCount()).toBeGreaterThan(0)
})

test('imprimir prepara todas as páginas nas dimensões do PDF', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')!
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { ...descriptor, get() {
      const frame = this as HTMLIFrameElement
      const content = descriptor.get!.call(frame) as Window | null
      if (content && frame.title === 'Impressão do PDF') {
        content.print = () => {
          ;(window as Window & { __printedPages?: number; __printSizes?: string[] }).__printedPages = Array.from(frame.contentDocument!.images).filter((image) => image.complete && image.naturalWidth > 0).length
          ;(window as Window & { __printSizes?: string[] }).__printSizes = Array.from(frame.contentDocument!.querySelectorAll('section')).map((section) => `${section.style.width} ${section.style.height}`)
          content.dispatchEvent(new Event('afterprint'))
        }
      }
      return content
    } })
  })
  await page.goto('/relatorios')
  await page.getByRole('button', { name: 'Gerar PDF', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expectPdfReady(modal)
  const pdf = await PDFDocument.load(await readPreview(page, modal))
  const expectedPages = modal.locator('[data-pdf-page]')
  const count = await expectedPages.count()
  await modal.getByRole('button', { name: 'Imprimir', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __printedPages?: number }).__printedPages), { timeout: 20_000 }).toBe(count)
  const sizes = await page.evaluate(() => (window as Window & { __printSizes?: string[] }).__printSizes!)
  for (const [index, size] of sizes.entries()) {
    const [width, height] = size.split(' ').map(parseFloat)
    expect(width).toBeCloseTo(pdf.getPage(index).getWidth() * 25.4 / 72, 2)
    expect(height).toBeCloseTo(pdf.getPage(index).getHeight() * 25.4 / 72, 2)
  }
  await expect(page.locator('iframe[title="Impressão do PDF"]')).toHaveCount(0)
  await expect(modal.getByRole('button', { name: 'Imprimir', exact: true })).toBeEnabled()
})

test('PDF inválido mostra erro e permite fechar o modal', async ({ page }) => {
  await page.goto('/processos/pr-1')
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({ name: 'invalido.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Arquivo inválido para verificar a mensagem de erro') })
  await page.getByRole('button', { name: 'Visualizar anexo invalido.pdf' }).click()
  const modal = page.getByRole('dialog', { name: 'invalido.pdf' })
  await expect(modal.getByRole('alert')).toBeVisible()
  await expect(modal.getByText('PDF indisponível', { exact: true })).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Imprimir', exact: true })).toBeDisabled()
  await expect(modal.getByRole('button', { name: 'Assinar', exact: true })).toBeDisabled()
  await modal.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(modal).toBeHidden()
})
