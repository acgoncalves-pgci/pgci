import { test } from '@playwright/test'

export function configureDemoSession() {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user')) localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-clara')
      if (!localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit')) localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit', 'u-prot')
    })
  })
}
