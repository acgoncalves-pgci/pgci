import { expect, test } from '@playwright/test'

test('mantém a navegação e o conteúdo utilizáveis em cada viewport', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Meus Processos' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const mobile = (page.viewportSize()?.width ?? 0) < 1024
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true })

  if (mobile) {
    const mobileSidebar = page.locator('#mobile-navigation aside[aria-label="Navegação principal"]')
    await expect(menu).toBeVisible()
    await menu.click()
    await expect(mobileSidebar).toBeVisible()
    await mobileSidebar.getByRole('link', { name: 'Processos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Processos' })).toBeVisible()
  } else {
    await expect(menu).toBeHidden()
    await expect(page.locator('aside[aria-label="Navegação principal"]').first()).toBeVisible()
  }
})

test('alterna para o tema escuro pelo botão do novo header e volta ao claro', async ({ page }) => {
  await page.goto('/dashboard')
  const themeButton = page.getByRole('button', { name: 'Ativar tema escuro' })
  const logo = page.locator('.pgci-logo').first()
  const lightLogo = await logo.evaluate((element) => ({
    color: getComputedStyle(element).backgroundColor,
    mask: getComputedStyle(element).maskImage || getComputedStyle(element).webkitMaskImage,
  }))
  expect(lightLogo.mask).toContain('pgci-logo.svg')

  await themeButton.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const darkLogoColor = await logo.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(darkLogoColor).not.toBe(lightLogo.color)
  await page.getByRole('button', { name: 'Ativar tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('exibe o SVG de carregamento somente na área de conteúdo durante a navegação', async ({ page }) => {
  await page.goto('/dashboard')
  const mobile = (page.viewportSize()?.width ?? 0) < 1024
  await page.evaluate(() => {
    const root = document.querySelector('[data-route-transition]')
    const state = window as Window & { __routeTransitions?: Array<{ phase: string | null; animation: string }> }
    state.__routeTransitions = []
    if (!root) return
    const record = () =>
      requestAnimationFrame(() =>
        state.__routeTransitions?.push({
          phase: root.getAttribute('data-route-transition'),
          animation: getComputedStyle(root).animationName,
        }),
      )
    new MutationObserver(record).observe(root, { attributes: true, attributeFilter: ['data-route-transition'] })
  })

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fluxo-publico:route-loading')))

  const routeContent = page.locator('[data-route-transition]')
  await expect(routeContent).toHaveAttribute('data-route-transition', 'leaving')

  const loading = page.getByRole('status', { name: 'Carregando tela' })
  await expect(loading).toBeVisible()
  const loadingImage = loading.locator('img')
  await expect(loadingImage).toHaveAttribute('src', '/assets/file-sync.svg')
  await expect(loadingImage).toHaveJSProperty('complete', true)
  expect(await loadingImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)

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

  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
    await page.locator('#mobile-navigation').getByRole('link', { name: 'Processos', exact: true }).click()
  } else {
    await page
      .locator('aside[aria-label="Navegação principal"]')
      .first()
      .getByRole('link', { name: 'Processos', exact: true })
      .click()
  }

  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as Window & { __routeTransitions?: Array<{ phase: string | null }> }).__routeTransitions?.some(
            (item) => item.phase === 'entering',
          ),
        ),
      ),
    )
    .toBe(true)
  const transitions = await page.evaluate(
    () =>
      (window as Window & { __routeTransitions?: Array<{ phase: string | null; animation: string }> })
        .__routeTransitions ?? [],
  )
  expect(transitions).toContainEqual({
    phase: 'leaving',
    animation: mobile ? 'route-mobile-disappear' : 'route-leave-left',
  })
  expect(transitions).toContainEqual({
    phase: 'entering',
    animation: mobile ? 'route-mobile-appear' : 'route-enter-right',
  })
})
test('apresenta a timeline em cartões e permite recolher e expandir cada movimentação', async ({ page }) => {
  await page.goto('/processos/pr-5')
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
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find((item) => new URL(item.href).pathname === '/processos')
    if (!link) throw new Error('Link de processos não encontrado.')
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    requestAnimationFrame(() => resolve({ path: window.location.pathname, loading: Boolean(document.querySelector('[aria-label="Carregando tela"]')) }))
  }))

  expect(stateBeforeRoute).toEqual({ path: '/dashboard', loading: true })
  await expect(page.getByRole('heading', { name: 'Processos' })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Processos' })).toBeVisible()
})
test('centraliza a linha com os marcadores da timeline em desktop', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'A coluna temporal é ocultada em mobile.')
  await page.goto('/processos/pr-5')
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

  await expect(page.getByRole('button', { name: /Aplicar preset/ })).toHaveCount(5)
  await page.getByRole('button', { name: 'Aplicar preset Terracota' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const colors = await page.locator('html').evaluate((root) => ({
    sidebar: root.style.getPropertyValue('--ui-sidebar-bg'),
    header: root.style.getPropertyValue('--ui-header-bg'),
    accent: root.style.getPropertyValue('--ui-accent'),
    background: root.style.getPropertyValue('--ui-page-bg'),
  }))
  expect(colors).toEqual({ sidebar: '#f0e0d6', header: '#f5e9e1', accent: '#9a3412', background: '#fffdfb' })
  await expect(page.locator('.pgci-sidebar').first()).toHaveCSS('background-color', 'rgb(240, 224, 214)')
  await expect(page.locator('.pgci-header')).toHaveCSS('background-color', 'rgb(245, 233, 225)')
  await expect(page.locator('#main-content')).toHaveCSS('background-color', 'rgb(255, 253, 251)')
  await page.getByLabel('Cor de fundo do rodapé', { exact: true }).fill('#1f2937')
  await page.getByLabel('Cor do texto do rodapé', { exact: true }).fill('#f8fafc')
  await expect(page.locator('.pgci-footer')).toHaveCSS('background-color', 'rgb(31, 41, 55)')
  await expect(page.locator('.pgci-footer')).toHaveCSS('color', 'rgb(248, 250, 252)')
  await page.getByLabel('Cor do header — tema claro', { exact: true }).fill('#123456')
  await page.getByLabel('Cor do header — tema escuro', { exact: true }).fill('#654321')
  await expect.poll(() => page.locator('html').evaluate((root) => root.style.getPropertyValue('--ui-header-bg'))).toBe('#123456')

  await page.getByRole('button', { name: 'Selecionar tema escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const darkColors = await page.locator('html').evaluate((root) => ({
    sidebar: root.style.getPropertyValue('--ui-sidebar-bg'),
    header: root.style.getPropertyValue('--ui-header-bg'),
    accent: root.style.getPropertyValue('--ui-accent'),
    background: root.style.getPropertyValue('--ui-page-bg'),
  }))
  expect(darkColors).toEqual({ sidebar: '#321c16', header: '#654321', accent: '#fb923c', background: '#160b07' })
  await expect(page.locator('.pgci-sidebar').first()).toHaveCSS('background-color', 'rgb(50, 28, 22)')
  await expect(page.locator('.pgci-header')).toHaveCSS('background-color', 'rgb(101, 67, 33)')
  await expect(page.locator('#main-content')).toHaveCSS('background-color', 'rgb(22, 11, 7)')

  await page.getByRole('button', { name: 'Selecionar tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(() => page.locator('html').evaluate((root) => root.style.getPropertyValue('--ui-header-bg'))).toBe('#123456')
  const savedAppearance = await page.evaluate(() => JSON.parse(localStorage.getItem('fluxo-publico:appearance') ?? '{}'))
  expect(savedAppearance.darkHeaderColor).toBe('#654321')

  const zoom = page.getByLabel('Zoom da interface')
  await zoom.press('Home')
  for (let index = 0; index < 6; index += 1) await zoom.press('ArrowRight')
  await expect(page.getByText('110%', { exact: true })).toBeVisible()
  await expect.poll(() => page.locator('html').evaluate((root) => root.style.getPropertyValue('--ui-zoom'))).toBe('1.1')

  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.goto('/processos/pr-18')
    const shellGeometry = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>('.pgci-sidebar')
      const footer = document.querySelector<HTMLElement>('.pgci-footer')
      if (!sidebar || !footer) throw new Error('Shell não encontrado.')
      const sidebarBox = sidebar.getBoundingClientRect()
      const footerBox = footer.getBoundingClientRect()
      return { sidebarBottom: sidebarBox.bottom, footerTop: footerBox.top, footerBottom: footerBox.bottom, viewportHeight: window.innerHeight }
    })
    expect(Math.abs(shellGeometry.sidebarBottom - shellGeometry.footerTop)).toBeLessThan(1.5)
    expect(shellGeometry.footerBottom).toBeGreaterThanOrEqual(shellGeometry.viewportHeight - 1.5)
  }
})
