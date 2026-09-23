import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('cadastra pessoa responsável e exibe os períodos somente para esse papel', async ({ page }) => {
  await page.goto('/pessoas')

  await expect(page.getByRole('heading', { name: 'Pessoas (Física/Jurídica)' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lista de pessoas' }).locator('article')).toHaveCount(18)

  await page.getByRole('button', { name: 'Nova Pessoa' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Nova Pessoa' })
  await createDialog.getByLabel('Nome completo *').fill('Responsável de integração')
  await createDialog.getByLabel('E-mail').fill('responsavel.integracao@example.com')
  await createDialog.getByRole('switch', { name: 'É responsável?' }).click()

  await expect(createDialog.getByText('Períodos de responsabilidade')).toBeVisible()
  await createDialog.getByLabel('Setor / Descrição 1').fill('Secretaria de Administração')
  await createDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(createDialog).toBeHidden()
  const personCard = page.getByRole('region', { name: 'Lista de pessoas' }).locator('article').filter({ hasText: 'Responsável de integração' })
  await expect(personCard).toContainText('Responsável')

  await personCard.getByRole('button', { name: 'Editar Responsável de integração' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Editar Pessoa' })
  await expect(editDialog.getByLabel('Setor / Descrição 1')).toHaveValue('Secretaria de Administração')
  await editDialog.getByRole('switch', { name: 'É responsável?' }).click()
  await expect(editDialog.getByText('Períodos de responsabilidade')).toHaveCount(0)
  await editDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(editDialog).toBeHidden()
  await expect(personCard.getByText('Responsável', { exact: true })).toHaveCount(0)
})
