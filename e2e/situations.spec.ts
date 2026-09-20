import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('cadastra uma situação e a usa em uma etapa do fluxo', async ({ page }) => {
  await page.goto('/situacoes')

  await expect(page.getByRole('heading', { name: 'Tipos de Situação' })).toBeVisible()
  await expect(page.locator('article')).toHaveCount(15)
  await expect(page.getByText('Em tramitação', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Novo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo Tipo de Situação' })
  await dialog.getByLabel('Descrição *').fill('Aguardando parecer')
  await dialog.getByRole('combobox', { name: 'Categoria' }).click()
  await page.getByRole('option', { name: 'Em tramitação', exact: true }).click()
  await dialog.getByLabel('Cor hexadecimal').fill('#2563EB')
  await dialog.getByRole('combobox', { name: 'Ícone' }).click()
  await page.getByRole('option', { name: 'Clock3', exact: true }).click()
  await dialog.getByLabel('Observação').fill('Aguardando manifestação da área técnica.')
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(dialog).toBeHidden()
  const customCard = page.locator('article').filter({ hasText: 'Aguardando parecer' })
  await expect(customCard).toBeVisible()
  await expect(customCard).toContainText('Em tramitação')

  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: /Configurar fluxo de Solicitação administrativa/ }).click()
  await page.getByRole('button', { name: 'Editar etapa 1' }).click()

  const stageDialog = page.getByRole('dialog', { name: 'Nova etapa do fluxo' })
  await stageDialog.getByRole('combobox', { name: 'Situação' }).click()
  await page.getByRole('option', { name: 'Aguardando parecer', exact: true }).click()
  await stageDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(stageDialog).toBeHidden()
  await expect(page.getByText('Aguardando parecer', { exact: true })).toBeVisible()
})
