import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { expectPdfReady, readPreview } from './helpers/pdf'

test('seed demonstra fluxo sugerido com desvio e anexo PDF legível após recarga', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit', 'u-edu')
  })
  await page.goto('/saomateusdomaranhao/processos/pr-21')
  await expect(page.getByRole('heading', { name: /Processo \d/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Etapa recomendada: Resposta da unidade/)).toBeVisible()
  const attachment = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
    return db.attachments.find((item: { protocolId: string }) => item.protocolId === 'pr-21') as { filename: string; sizeBytes: number }
  })
  await page.getByRole('button', { name: `Visualizar anexo ${attachment.filename}`, exact: true }).click()
  const modal = page.getByRole('dialog', { name: attachment.filename, exact: true })
  await expectPdfReady(modal)
  const bytes = await readPreview(page, modal)
  expect(bytes.byteLength).toBe(attachment.sizeBytes)
  const pdf = await PDFDocument.load(bytes)
  expect(pdf.getPageCount()).toBe(1)
  expect(pdf.getTitle()).toBe(attachment.filename)
  await modal.screenshot({ path: testInfo.outputPath('seed-attachment.png') })
  await modal.getByRole('button', { name: 'Fechar diálogo', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: `Visualizar anexo ${attachment.filename}`, exact: true }).click()
  await expectPdfReady(modal)
  expect(await readPreview(page, modal)).toEqual(bytes)
})
