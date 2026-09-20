import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('exibe a hierarquia e administra uma unidade subordinada pela própria linha', async ({ page }) => {
  await page.goto('/estrutura')

  await expect(page.getByRole('heading', { name: 'Estrutura Organizacional' })).toBeVisible()
  const tree = page.getByRole('tree')
  await expect(tree).toBeVisible()
  await expect(tree.getByText('Financeiro', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Criar unidade subordinada a Administração' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Nova unidade organizacional' })
  await expect(createDialog.getByRole('combobox', { name: 'Unidade superior' })).toBeDisabled()
  await expect(createDialog.getByRole('combobox', { name: 'Unidade superior' })).toContainText('Administração')
  await createDialog.getByLabel('Nome *').fill('Controle de Contratos')
  await createDialog.getByLabel('Sigla *').fill('CCON')
  await createDialog.getByRole('button', { name: 'Salvar' }).click()

  await expect(tree.getByText('Controle de Contratos', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar Controle de Contratos' })).toBeAttached()
  await page.getByRole('button', { name: 'Excluir Controle de Contratos' }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Excluir unidade organizacional' })
  await deleteDialog.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(tree.getByText('Controle de Contratos', { exact: true })).toHaveCount(0)
})
