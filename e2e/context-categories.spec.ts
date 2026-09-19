import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
    localStorage.setItem('fluxo-publico:scope-unit', 'ALL')
  })
})

test('troca entre uma estrutura vinculada e o contexto Todos', async ({ page, isMobile }) => {
  test.skip(isMobile, 'O seletor de contexto fica recolhido no cabeçalho móvel.')
  await page.goto('/dashboard')

  await page.getByRole('button', { name: 'Selecionar contexto de estrutura. Atual: Todos' }).click()
  const menu = page.getByRole('dialog', { name: 'Contexto ativo' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Financeiro Administração', exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Administração Administrador geral', exact: true })).toBeVisible()
  const contrast = await menu.evaluate((element) => {
    const title = element.querySelector('strong')!
    return {
      background: getComputedStyle(element).backgroundColor,
      text: getComputedStyle(title).color,
    }
  })
  expect(contrast.text).not.toBe(contrast.background)
  await menu.getByRole('button', { name: 'Financeiro Administração', exact: true }).click()

  await expect.poll(() => page.evaluate(() => ({
    unit: localStorage.getItem('fluxo-publico:unit'),
    scope: localStorage.getItem('fluxo-publico:scope-unit'),
  }))).toEqual({ unit: 'u-fin', scope: 'u-fin' })

  const activeSelector = page.getByRole('button', { name: 'Selecionar contexto de estrutura. Atual: Financeiro' })
  await expect(activeSelector).toContainText('Financeiro')
  await expect(activeSelector).toContainText('Administração')
  await activeSelector.click()
  await page.getByRole('dialog', { name: 'Contexto ativo' }).getByRole('button', { name: /Todos/ }).click()

  await expect.poll(() => page.evaluate(() => ({
    unit: localStorage.getItem('fluxo-publico:unit'),
    scope: localStorage.getItem('fluxo-publico:scope-unit'),
  }))).toEqual({ unit: 'u-fin', scope: 'ALL' })
})

test('cadastra categoria e a vincula a um tipo de processo', async ({ page, isMobile }) => {
  await page.goto('/categorias-processo')
  await expect(page.getByRole('heading', { name: 'Categorias de Processo' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lista de categorias de processo' }).locator('article')).toHaveCount(2)

  await page.getByRole('button', { name: 'Nova', exact: true }).click()
  const categoryDialog = page.getByRole('dialog', { name: 'Nova Categoria de Processo' })
  await categoryDialog.getByLabel('Código *').fill('03')
  await categoryDialog.getByLabel('Nome *').fill('Atendimento ao cidadão')
  await categoryDialog.getByRole('combobox', { name: 'Ícone' }).click()
  await page.getByRole('option', { name: 'Tags', exact: true }).click()
  await categoryDialog.getByLabel('Observação').fill('Demandas de atendimento externo.')
  await categoryDialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(categoryDialog).toBeHidden()

  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: 'Novo', exact: true }).click()
  const typeDialog = page.getByRole('dialog', { name: 'Novo tipo de processo' })
  const dialogBox = await typeDialog.locator('section').first().boundingBox()
  expect(dialogBox).not.toBeNull()
  if (isMobile) expect(dialogBox!.width).toBeLessThanOrEqual(420)
  else expect(dialogBox!.width).toBeGreaterThan(800)
  await typeDialog.getByLabel('Descrição *').fill('Ouvidoria municipal')
  await typeDialog.getByRole('combobox', { name: 'Categoria' }).click()
  await page.getByRole('option', { name: '03 — Atendimento ao cidadão', exact: true }).click()
  await typeDialog.getByLabel('Observação *').fill('Demandas encaminhadas à ouvidoria.')
  if (isMobile) {
    await typeDialog.locator('section').first().evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
  }
  const saveButton = typeDialog.getByRole('button', { name: 'Salvar', exact: true })
  const saveBox = await saveButton.boundingBox()
  expect(saveBox).not.toBeNull()
  await page.mouse.click(saveBox!.x + saveBox!.width / 2, saveBox!.y + saveBox!.height / 2)

  await expect(typeDialog).toBeHidden()
  await expect(page.locator('article').filter({ hasText: 'Ouvidoria municipal' })).toContainText('03 · Atendimento ao cidadão')
})




