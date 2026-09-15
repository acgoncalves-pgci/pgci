import { expect, test } from '@playwright/test'

test('mantém a navegação e o conteúdo utilizáveis em cada viewport', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const mobile = (page.viewportSize()?.width ?? 0) < 1024
  const menu = page.getByRole('button', { name: 'Abrir menu' })

  if (mobile) {
    const mobileSidebar = page.locator('#mobile-navigation aside[aria-label="Navegação principal"]')
    await expect(menu).toBeVisible()
    await menu.click()
    await expect(mobileSidebar).toBeVisible()
    await mobileSidebar.getByRole('link', { name: 'Protocolos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Protocolos' })).toBeVisible()
  } else {
    await expect(menu).toBeHidden()
    await expect(page.locator('aside[aria-label="Navegação principal"]').first()).toBeVisible()
  }
})
test('alterna para o tema escuro por meio do Switch e volta ao claro', async ({ page }) => {
  await page.goto('/dashboard')
  const themeSwitch = page.getByRole('switch', { name: 'Alternar tema' })

  await expect(themeSwitch).not.toBeChecked()
  await themeSwitch.check()
  await expect(themeSwitch).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await themeSwitch.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})