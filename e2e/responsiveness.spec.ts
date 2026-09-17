import { expect, test } from '@playwright/test'

test('mantém a navegação e o conteúdo utilizáveis em cada viewport', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Meus Processos' })).toBeVisible()
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

test('alterna para o tema escuro pelo botão do novo header e volta ao claro', async ({ page }) => {
  await page.goto('/dashboard')
  const themeButton = page.getByRole('button', { name: 'Ativar tema escuro' })

  await themeButton.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Ativar tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('exibe o SVG de carregamento somente na área de conteúdo durante a navegação', async ({ page }) => {
  await page.goto('/dashboard')
  const mobile = (page.viewportSize()?.width ?? 0) < 1024

  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.locator('#mobile-navigation').getByRole('link', { name: 'Protocolos', exact: true }).click()
  } else {
    await page.locator('aside[aria-label="Navegação principal"]').first().getByRole('link', { name: 'Protocolos', exact: true }).click()
  }

  const loading = page.getByRole('status', { name: 'Carregando tela' })
  await expect(loading).toBeVisible()
  const loadingImage = loading.locator('img')
  await expect(loadingImage).toHaveAttribute('src', '/assets/file-sync.svg')
  await expect(loadingImage).toHaveJSProperty('complete', true)
  expect(await loadingImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(180)

  const [loadingBox, contentBox, headerBox] = await Promise.all([
    loading.boundingBox(),
    page.locator('#main-content > div.relative').boundingBox(),
    page.locator('#main-content > header').boundingBox(),
  ])

  expect(loadingBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  expect(loadingBox!.x).toBe(contentBox!.x)
  expect(loadingBox!.y).toBe(contentBox!.y)
  expect(loadingBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height)
})
test('apresenta a timeline em cartões e permite recolher e expandir cada movimentação', async ({ page }) => {
  await page.goto('/protocolos/pr-5')
  await expect(page.getByRole('heading', { name: 'Movimentações' })).toBeVisible()

  const firstToggle = page.getByRole('button', { name: /Recolher conteúdo de/ }).first()
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /Expandir conteúdo de/ })).not.toHaveCount(0)
  const contentId = await firstToggle.getAttribute('aria-controls')
  expect(contentId).toBeTruthy()
  const toggle = page.locator(`button[aria-controls="${contentId}"]`)
  await expect(page.locator(`#${contentId}`)).toBeVisible()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator(`#${contentId}`)).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator(`#${contentId}`)).toBeVisible()
})
test('mostra o loading antes de mudar a rota interna', async ({ page }) => {
  await page.goto('/dashboard')

  const stateBeforeRoute = await page.evaluate(async () => new Promise<{ path: string; loading: boolean }>((resolve) => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find((item) => new URL(item.href).pathname === '/protocolos')
    if (!link) throw new Error('Link de protocolos não encontrado.')
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    requestAnimationFrame(() => resolve({ path: window.location.pathname, loading: Boolean(document.querySelector('[aria-label="Carregando tela"]')) }))
  }))

  expect(stateBeforeRoute).toEqual({ path: '/dashboard', loading: true })
  await expect(page.getByRole('heading', { name: 'Protocolos' })).toBeVisible()
})
test('antecipa o loading também em navegações por botão', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Meus Processos' })).toBeVisible()

  const stateBeforeRoute = await page.evaluate(async () => new Promise<{ path: string; loading: boolean }>((resolve) => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.includes('Na minha caixa'))
    if (!button) throw new Error('Atalho de processos não encontrado.')
    button.click()
    requestAnimationFrame(() => resolve({ path: window.location.pathname, loading: Boolean(document.querySelector('[aria-label="Carregando tela"]')) }))
  }))

  expect(stateBeforeRoute).toEqual({ path: '/dashboard', loading: true })
  await expect(page.getByRole('heading', { name: 'Protocolos' })).toBeVisible()
})
test('centraliza a linha com os marcadores da timeline em desktop', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'A coluna temporal é ocultada em mobile.')
  await page.goto('/protocolos/pr-5')
  const [dot, line] = await Promise.all([page.locator('[data-timeline-dot]').first().boundingBox(), page.locator('[data-timeline-line]').first().boundingBox()])
  expect(dot).not.toBeNull()
  expect(line).not.toBeNull()
  expect(Math.abs((dot!.x + dot!.width / 2) - (line!.x + line!.width / 2))).toBeLessThan(0.6)
})

test('oferece e aplica configurações de aparência', async ({ page }) => {
  await page.goto('/configuracoes')
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Geral' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Aparência' }).click()

  await page.getByRole('button', { name: 'Selecionar tema escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Usar cor #9a3412' }).click()
  await expect.poll(() => page.locator('html').evaluate((root) => root.style.getPropertyValue('--ui-accent'))).toBe('#9a3412')

  const zoom = page.getByLabel('Zoom da interface')
  await zoom.press('Home')
  for (let index = 0; index < 6; index += 1) await zoom.press('ArrowRight')
  await expect(page.getByText('110%', { exact: true })).toBeVisible()
  await expect.poll(() => page.locator('html').evaluate((root) => root.style.getPropertyValue('--ui-zoom'))).toBe('1.1')
})