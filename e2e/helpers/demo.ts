import type { Page } from '@playwright/test'

const numbers = new WeakMap<Page, Map<string, string>>()
// Assertions address stable demo records, regardless of the configured number format.
export async function demoText(page: Page, text: string): Promise<string> {
  let mapping = numbers.get(page)
  if (!mapping) {
    await page.waitForFunction(() => Boolean(localStorage.getItem('fluxo-publico:database:v1')))
    const entries = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!)
      return [...db.protocols, ...db.documents].flatMap((record: { id: string; number: string }) => {
        const match = record.id.match(/^(pr|doc)-(\d+)$/)
        return match ? [[`${match[1] === 'doc' ? 'DOC-' : ''}2026.${match[2].padStart(6, '0')}`, record.number]] : []
      }) as [string, string][]
    })
    mapping = new Map(entries)
    numbers.set(page, mapping)
  }
  return text.replace(/(?:DOC-)?2026\.\d{6}/g, (value) => mapping!.get(value) ?? value)
}
