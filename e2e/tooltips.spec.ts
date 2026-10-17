import { expect, test } from '@playwright/test'
import { configureDemoSession } from './helpers/session'

configureDemoSession()

test('tooltip fica próximo do indicador em todos os níveis de zoom, com foco e rolagem', async ({ page }, testInfo) => {
  await page.goto('/processos/pr-1')
  const badge = page.getByLabel(/^Tempo na etapa:/).first()
  const trigger = badge.locator('..')
  const tooltip = page.getByRole('tooltip')
  await expect(badge).toBeVisible()

  for (const zoom of [0.8, 1, 1.2]) {
    await page.evaluate((value) => document.documentElement.style.setProperty('--ui-zoom', String(value)), zoom)
    await expect.poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).zoom))).toBe(zoom)
    await badge.hover()
    await expect(tooltip).toBeVisible()
    await expect.poll(async () => {
      const anchor = (await badge.boundingBox())!
      const box = (await tooltip.boundingBox())!
      return Math.min(Math.abs(anchor.y - box.y - box.height), Math.abs(box.y - anchor.y - anchor.height))
    }).toBeCloseTo(6 * zoom, 0)
    const box = (await tooltip.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(8 * zoom - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width - 8 * zoom + 1)
    if (zoom === 0.8) await page.screenshot({ path: testInfo.outputPath('tooltip-zoom-80.png') })

    await page.mouse.move(0, 0)
    await expect(tooltip).toHaveCount(0)
    await trigger.focus()
    await expect(tooltip).toBeVisible()
    await trigger.press('Escape')
    await expect(tooltip).toHaveCount(0)
    await trigger.evaluate((element) => (element as HTMLElement).blur())
    await badge.hover()
    await expect(tooltip).toBeVisible()
    await page.locator('.pgci-page-scroll').evaluate((element) => element.dispatchEvent(new Event('scroll')))
    await expect(tooltip).toHaveCount(0)
    await page.mouse.move(0, 0)
  }
})
