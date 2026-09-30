import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

const pages = [
  ['/estrutura', 'Estrutura Organizacional'],
  ['/usuarios', 'Usuários'],
  ['/processos', 'Processos'],
  ['/documentos', 'Documentos'],
  ['/pessoas', 'Pessoas (Física/Jurídica)'],
  ['/tipos-processo', 'Tipos de processo'],
  ['/categorias-processo', 'Categorias de Processo'],
  ['/situacoes', 'Tipos de Situação'],
  ['/fases', 'Tipos de Fases'],
  ['/tipos-documento', 'Tipos de documento'],
  ['/relatorios', 'Relatórios'],
  ['/configuracoes', 'Configurações'],
] as const

for (const [path, title] of pages) {
  test(`${title}: cabeçalho se ajusta à tela`, async ({ page }, testInfo) => {
    await page.goto(path)
    const header = page.locator('.page-title')
    await expect(header.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const icon = await header.locator('span').first().boundingBox()
    const content = await header.locator('div').nth(1).boundingBox()
    expect(icon).not.toBeNull()
    expect(content).not.toBeNull()
    expect(Math.abs((icon!.y + icon!.height / 2) - (content!.y + content!.height / 2))).toBeLessThanOrEqual(2)
    const action = await header.locator('.page-title-action').count()
      ? await header.locator('.page-title-action').boundingBox()
      : null
    if (action) {
      const heading = await header.boundingBox()
      expect(action.x + action.width).toBeLessThanOrEqual(heading!.x + heading!.width + 1)
      if (action.y < content!.y + content!.height) {
        expect(Math.abs((action.y + action.height / 2) - (content!.y + content!.height / 2))).toBeLessThanOrEqual(2)
      }
    }
    const viewport = page.viewportSize()!
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    if (path === '/estrutura') {
      await header.screenshot({ path: testInfo.outputPath(`estrutura-${testInfo.project.name}.png`) })
    }
  })
}

for (const [path, title] of [
  ['/processos/novo', 'Abrir processo'],
  ['/documentos/novo', 'Novo Documento'],
  ['/usuarios/usr-admin/unidades', 'Unidades / Permissões — Marina Duarte'],
  ['/tipos-documento/dt-oficio/modelos/novo', 'Novo Modelo'],
] as const) {
  test(`${title}: formulário mantém o cabeçalho responsivo`, async ({ page }) => {
    await page.goto(path)
    const header = page.locator('.page-title')
    await expect(header.getByRole('heading', { name: title, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
    const icon = await header.locator('span').first().boundingBox()
    const content = await header.locator('div').nth(1).boundingBox()
    expect(Math.abs((icon!.y + icon!.height / 2) - (content!.y + content!.height / 2))).toBeLessThanOrEqual(2)
  })
}
