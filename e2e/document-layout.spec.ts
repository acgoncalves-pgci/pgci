import { expect, test } from '@playwright/test'
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib'
import { readPreview } from './helpers/pdf'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('tabelas iniciais usam caixa alta e assinatura e recebimento ficam centralizados', async ({ page }) => {
  await page.goto('/processos/pr-1')
  await expect(page.getByRole('heading', { name: /^Processo / })).toBeVisible()
  const reports = await page.evaluate(async () => {
    const db = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!)
    const protocol = db.protocols.find((item: { id: string }) => item.id === 'pr-1')
    const reportPath = '/src/features/relatorios/reportPdf.ts'
    const runtimePath = '/src/lib/pdfRuntime.ts'
    const builders = await import(/* @vite-ignore */ reportPath)
    const { loadPdfRuntime, pdfAssetOptions } = await import(/* @vite-ignore */ runtimePath)
    const runtime = await loadPdfRuntime()
    const result: Record<string, { str: string; x: number; width: number }[]> = {}
    for (const name of ['createCoverPdf', 'createProtocolReceiptPdf', 'createMovementReceiptPdf', 'createProcessDetailsPdf']) {
      const doc = await builders[name](db, protocol)
      const task = runtime.getDocument({ data: doc.output('arraybuffer'), ...pdfAssetOptions })
      const pdf = await task.promise
      const text = await (await pdf.getPage(1)).getTextContent()
      result[name] = text.items.filter((item: { str?: string }) => item.str).map((item: { str: string; transform: number[]; width: number }) => ({ str: item.str, x: item.transform[4], width: item.width }))
      await task.destroy()
    }
    return result
  })
  for (const items of Object.values(reports)) {
    expect(items.some((item) => item.str === 'COMPRA DE MATERIAL')).toBe(true)
    expect(items.some((item) => item.str === 'CAIO MENDES')).toBe(true)
    expect(items.some((item) => item.str === 'Compra de material')).toBe(false)
    expect(items.some((item) => item.str === 'Caio Mendes')).toBe(false)
  }
  const movement = reports.createMovementReceiptPdf
  const signature = movement.find((item) => item.str === 'RESPONSÁVEL PELA TRAMITAÇÃO')!
  const date = movement.find((item) => item.str.startsWith('RECEBIDO EM'))!
  expect((signature.x + signature.width / 2) * 25.4 / 72).toBeCloseTo(58.5, 1)
  expect((date.x + date.width / 2) * 25.4 / 72).toBeCloseTo(151.5, 1)
})

test('margens do documento preservam o padrão, permitem ajustes e chegam ao PDF', async ({ page }, testInfo) => {
  await page.goto('/documentos/novo')
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  expect(await editor.evaluate((element) => Math.round(parseFloat(getComputedStyle(element).paddingLeft) * 25.4 / 96))).toBe(20)
  await page.getByRole('button', { name: 'Bordas e margens da página', exact: true }).click()
  const margins = page.getByRole('dialog', { name: 'Bordas e margens da página' })
  await margins.getByLabel('Superior (mm)').fill('15')
  await margins.getByLabel('Direita (mm)').fill('10')
  await margins.getByLabel('Inferior (mm)').fill('25')
  await margins.getByLabel('Esquerda (mm)').fill('51')
  await expect(margins.getByRole('button', { name: 'Aplicar', exact: true })).toBeDisabled()
  await margins.getByLabel('Esquerda (mm)').fill('40')
  await margins.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(margins).toBeHidden()
  expect(await editor.evaluate((element) => Math.round(parseFloat(getComputedStyle(element).paddingLeft) * 25.4 / 96))).toBe(40)
  await page.getByRole('combobox', { name: 'Tipo de documento *' }).click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await page.getByLabel('Assunto *').fill('Documento com margens personalizadas')
  await editor.fill('Solicito a conferência dos documentos relacionados à contratação de serviços municipais.')
  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page).toHaveURL(/\/documentos$/)
  await expect(page.getByRole('heading', { name: 'Documento com margens personalizadas', exact: true })).toBeVisible()
  await page.reload()
  const row = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Documento com margens personalizadas', exact: true }) })
  await row.getByRole('button', { name: /^Visualizar / }).click()
  const sheet = page.locator('#main-content article.document-page')
  expect(await sheet.evaluate((element) => Math.round(parseFloat(getComputedStyle(element).paddingTop) * 25.4 / 96))).toBe(15)
  const bytes = await readPreview(page)
  const pdf = await PDFDocument.load(bytes)
  const contents = pdf.getPage(0).node.Contents()!
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => pdf.context.lookup(ref)) : [contents]
  const operations = streams.filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream).map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString()).join('\n')
  const imageMatrix = operations.match(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/)
  expect(imageMatrix).not.toBeNull()
  expect(Number(imageMatrix![1]) * 25.4 / 72).toBeCloseTo(160, 1)
  expect(Number(imageMatrix![3]) * 25.4 / 72).toBeCloseTo(40, 1)
  expect((pdf.getPage(0).getHeight() - Number(imageMatrix![4]) - Number(imageMatrix![2])) * 25.4 / 72).toBeCloseTo(15, 1)
  await page.screenshot({ path: testInfo.outputPath('document-margins-pdf.png') })
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await row.getByRole('link', { name: /^Editar / }).click()
  await page.getByRole('button', { name: 'Bordas e margens da página', exact: true }).click()
  await expect(margins.getByLabel('Esquerda (mm)')).toHaveValue('40')
  await margins.getByRole('button', { name: 'Restaurar padrão', exact: true }).click()
  await expect(margins.getByLabel('Esquerda (mm)')).toHaveValue('20')
})

test('sidebar contém Sair no rodapé e não oferece restauração da demonstração', async ({ page, isMobile }) => {
  await page.goto('/dashboard')
  if (isMobile) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  const sidebar = page.getByRole('complementary', { name: 'Navegação principal' })
  await expect(sidebar.getByRole('button', { name: 'Restaurar demonstração' })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Sair', exact: true })).toBeVisible()
})
