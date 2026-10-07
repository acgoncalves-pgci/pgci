import { expect, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

export async function expectPdfReady(modal: Locator) {
  await expect(modal.locator('[data-pdf-page="1"]')).toHaveAttribute('data-rendered', 'true', { timeout: 20_000 })
  await expect(modal.locator('iframe')).toHaveCount(0)
}

export async function downloadPreview(page: Page, modal = page.getByRole('dialog')) {
  await expectPdfReady(modal)
  const pending = page.waitForEvent('download')
  await modal.getByRole('button', { name: 'Baixar', exact: true }).click()
  return pending
}

export async function readPreview(page: Page, modal = page.getByRole('dialog')) {
  const download = await downloadPreview(page, modal)
  return new Uint8Array(await readFile((await download.path())!))
}
