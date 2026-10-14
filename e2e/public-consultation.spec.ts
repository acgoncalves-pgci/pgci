import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const base = '/saomateusdomaranhao'
const databaseKey = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'

test.beforeEach(async ({ page }) => {
  await page.goto(`${base}/consulta`)
  await expect(page.getByRole('heading', { name: 'Consulta do protocolo', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), databaseKey)).not.toBeNull()
})

test('QR code abre resumo público responsivo e não altera o protocolo', async ({ page }, testInfo) => {
  await page.goto(`${base}/consulta`)
  await expect(page.getByRole('heading', { name: 'Consulta do protocolo', exact: true })).toBeVisible()
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), databaseKey)
  const protocol = before.protocols[0]
  await page.goto(`${base}/consulta?numero=${encodeURIComponent(protocol.number)}`)
  await expect(page.getByRole('heading', { name: protocol.subject, exact: true })).toBeVisible()
  await expect(page.getByText(protocol.description, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Andamento do protocolo' })).toBeVisible()
  await expect(page.getByText('Somente leitura', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Editar|Excluir|Tramitar|Assinar|Receber|Salvar/ })).toHaveCount(0)
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Senha', exact: true })).toHaveCount(0)
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), databaseKey)).toEqual(before)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('public-summary.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: protocol.subject, exact: true })).toBeVisible()
})

test('leitor conectado aceita número antigo e endereço dos códigos novos', async ({ page }) => {
  await page.goto(`${base}/consulta`)
  await expect(page.getByLabel('Número do protocolo')).toBeVisible()
  const number = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).protocols[0].number, databaseKey)
  const input = page.getByLabel('Número do protocolo')
  await input.fill(number)
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: 'Descrição do protocolo' })).toBeVisible()
  await input.fill(`http://127.0.0.1:4173${base}/consulta?numero=${encodeURIComponent(number)}`)
  await input.press('Enter')
  await expect(input).toHaveValue(number)
  await input.fill('http://127.0.0.1:4173/outra/consulta?numero=1')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toContainText('não corresponde')
  await input.fill('PROTOCOLO-INEXISTENTE')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Protocolo não encontrado')
})

test('consulta pública desligada não mostra resumo e login continua protegendo edição', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:settings-general', JSON.stringify({ publicConsultation: false })))
  await page.goto(`${base}/consulta?numero=2026.10.13.0001`)
  await expect(page.getByRole('heading', { name: 'Consulta pública indisponível' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Descrição do protocolo' })).toHaveCount(0)
  await page.goto(`${base}/processos/pr-1`)
  await expect(page).toHaveURL(new RegExp(`${base}/login$`))
  await expect(page.getByRole('button', { name: 'Entrar no sistema' })).toBeVisible()
})

test('capa, comprovante e etiqueta têm links para a mesma consulta', async ({ page }, testInfo) => {
  await page.goto(`${base}/consulta`)
  await expect(page.getByLabel('Número do protocolo')).toBeVisible()
  const result = await page.evaluate(async (key) => {
    const db = JSON.parse(localStorage.getItem(key)!)
    const protocol = db.protocols[0]
    const path = '/src/features/relatorios/reportPdf.ts'
    const runtimePath = '/src/lib/pdfRuntime.ts'
    const builders = await import(/* @vite-ignore */ path)
    const { loadPdfRuntime, pdfAssetOptions } = await import(/* @vite-ignore */ runtimePath)
    const runtime = await loadPdfRuntime()
    const reports = []
    for (const name of ['createCoverPdf', 'createProtocolReceiptPdf', 'createProcessLabelPdf']) {
      const doc = await builders[name](db, protocol)
      const task = runtime.getDocument({ data: doc.output('arraybuffer'), ...pdfAssetOptions })
      const pdf = await task.promise
      const sheet = await pdf.getPage(1)
      const annotations = await sheet.getAnnotations()
      const viewport = sheet.getViewport({ scale: 1.2 })
      const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height
      await sheet.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
      reports.push({ name, urls: annotations.map((item: { url?: string }) => item.url).filter(Boolean), image: canvas.toDataURL('image/png') })
      await task.destroy()
    }
    return { number: protocol.number, reports }
  }, databaseKey)
  for (const report of result.reports) {
    expect(report.urls.length).toBeGreaterThanOrEqual(2)
    for (const address of report.urls) {
      const url = new URL(address)
      expect(url.pathname).toBe(`${base}/consulta`)
      expect(url.searchParams.get('numero')).toBe(result.number)
    }
    const imagePath = testInfo.outputPath(`${report.name}.png`)
    await writeFile(imagePath, Buffer.from(report.image.split(',')[1], 'base64'))
    await testInfo.attach(report.name, { path: imagePath, contentType: 'image/png' })
  }
  await page.goto(result.reports[0].urls[0])
  await expect(page.getByRole('heading', { name: 'Descrição do protocolo' })).toBeVisible()
})
