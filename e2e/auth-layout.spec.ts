import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const prefix = 'fluxo-publico:tenant:prefeitura-saomateus-ma:'

async function expectFits(page: Page) {
  expect(await page.evaluate(() => ({ overflow: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight, horizontal: document.documentElement.scrollWidth - window.innerWidth }))).toEqual({ overflow: 0, horizontal: 0 })
  for (const control of [page.getByLabel('E-mail institucional'), page.getByLabel('Senha', { exact: true }), page.getByRole('link', { name: 'Esqueceu sua senha?' }), page.getByRole('button', { name: 'Entrar no sistema' }), page.getByRole('button', { name: 'Preencher acesso de demonstração' })]) {
    await expect(control).toBeVisible()
    const bounds = (await control.boundingBox())!
    const height = await page.evaluate(() => window.innerHeight)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1)
  }
}

test('login usa a paleta predefinida da prefeitura no tema claro e escuro', async ({ page }, testInfo) => {
  await page.addInitScript((key) => {
    localStorage.setItem(`${key}appearance`, JSON.stringify({ accent: '#7c3aed', sidebarColor: '#ece1f6', backgroundColor: '#fff9ef', footerColor: '#46275b', darkAccent: '#a78bfa', darkSidebarColor: '#301b40', darkBackgroundColor: '#1b102d', darkFooterColor: '#120a20' }))
    // Cores padrão salvas pela versão anterior também devem acompanhar a prefeitura.
    localStorage.setItem(`${key}settings-general`, JSON.stringify({ loginAccent: '#17628b', loginPanelColor: '#102e3c' }))
  }, prefix)
  await page.goto('/saomateusdomaranhao/login')
  await expect(page.getByRole('button', { name: 'Entrar no sistema' })).toBeEnabled()
  await expect(page.locator('.auth-page')).toHaveCSS('background-color', 'rgb(255, 249, 239)')
  await expect(page.locator('.auth-story')).toHaveCSS('background-color', 'rgb(236, 225, 246)')
  await expect(page.locator('.auth-submit')).toHaveCSS('background-color', 'rgb(124, 58, 237)')
  await expect(page.getByRole('link', { name: 'Esqueceu sua senha?' })).toHaveCSS('color', 'rgb(124, 58, 237)')
  await page.getByLabel('E-mail institucional').focus()
  await expect(page.getByLabel('E-mail institucional')).toHaveCSS('border-color', 'rgb(124, 58, 237)')
  await page.getByRole('link', { name: 'Esqueceu sua senha?' }).focus()
  await expect(page.getByRole('link', { name: 'Esqueceu sua senha?' })).toHaveCSS('outline-color', 'rgb(124, 58, 237)')
  await expectFits(page)
  await page.screenshot({ path: testInfo.outputPath('login-palette-light.png') })
  await page.evaluate((key) => localStorage.setItem(`${key}theme`, 'dark'), prefix)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Entrar no sistema' })).toBeEnabled()
  await expect(page.locator('.auth-page')).toHaveCSS('background-color', 'rgb(27, 16, 45)')
  await expect(page.locator('.auth-story')).toHaveCSS('background-color', 'rgb(48, 27, 64)')
  await expect(page.locator('.auth-submit')).toHaveCSS('background-color', 'rgb(167, 139, 250)')
  await expect(page.getByRole('link', { name: 'Esqueceu sua senha?' })).toHaveCSS('color', 'rgb(167, 139, 250)')
  await expectFits(page)
  await page.screenshot({ path: testInfo.outputPath('login-palette-dark.png') })
})

test('login se adapta à altura sem rolagem nem controles cortados, incluindo erro e zoom', async ({ page, isMobile }, testInfo) => {
  const sizes = isMobile ? [{ width: 393, height: 851 }, { width: 360, height: 640 }, { width: 375, height: 667 }, { width: 844, height: 390 }, { width: 390, height: 640, large: true }] : [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }, { width: 1366, height: 450 }, { width: 1280, height: 720, large: true }]
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/saomateusdomaranhao/login')
    if (size.large) {
      await page.evaluate((key) => localStorage.setItem(`${key}appearance`, JSON.stringify({ zoom: 120, fontSize: 'extra-large' })), prefix)
      await page.reload()
    }
    await expect(page.getByRole('button', { name: 'Entrar no sistema' })).toBeEnabled()
    await page.evaluate(() => document.fonts.ready)
    await expectFits(page)
    await page.getByLabel('E-mail institucional').fill('servidor@prefeitura.gov.br')
    await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta')
    await page.getByRole('button', { name: 'Entrar no sistema' }).click()
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos')
    await expectFits(page)
    const error = (await page.getByRole('alert').boundingBox())!
    expect(error.y + error.height).toBeLessThanOrEqual(size.height + 1)
    await page.screenshot({ path: testInfo.outputPath(`login-${size.width}-${size.height}${size.large ? '-zoom' : ''}.png`) })
  }
})
