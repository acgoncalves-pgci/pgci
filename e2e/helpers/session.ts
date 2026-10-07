import { test } from '@playwright/test'

export function configureDemoSession() {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('fluxo-publico:user')) localStorage.setItem('fluxo-publico:user', 'usr-clara')
      if (!localStorage.getItem('fluxo-publico:unit')) localStorage.setItem('fluxo-publico:unit', 'u-prot')
    })
  })
}
