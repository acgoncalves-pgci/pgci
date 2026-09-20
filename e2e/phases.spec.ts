import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('cadastra uma fase e a utiliza em uma etapa de fluxo', async ({ page }) => {
  await page.goto('/fases')

  await expect(page.getByRole('heading', { name: 'Tipos de Fases' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lista de fases' }).locator('article')).toHaveCount(14)

  await page.getByRole('button', { name: 'Novo', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: 'Novo Tipo de Fase' })
  await createDialog.getByLabel('Descrição *').fill('Parecer técnico')
  await createDialog.getByLabel('Cor hexadecimal').fill('#2563EB')
  await createDialog.getByRole('combobox', { name: 'Ícone' }).click()
  await page.getByRole('option', { name: 'FilePenLine', exact: true }).click()
  await createDialog.getByLabel('Observação').fill('Elaboração de manifestação da área técnica.')
  await createDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(createDialog).toBeHidden()
  const phaseCard = page.getByRole('region', { name: 'Lista de fases' }).locator('article').filter({ hasText: 'Parecer técnico' })
  await expect(phaseCard).toBeVisible()

  await phaseCard.getByRole('button', { name: 'Editar Parecer técnico' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Editar Tipo de Fase' })
  await editDialog.getByLabel('Descrição *').fill('Parecer jurídico')
  await editDialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(editDialog).toBeHidden()
  await expect(page.getByText('Parecer jurídico', { exact: true })).toBeVisible()

  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: /Configurar fluxo de Solicitação administrativa/ }).click()
  await page.getByRole('button', { name: 'Nova etapa' }).click()

  const stageDialog = page.getByRole('dialog', { name: 'Nova etapa do fluxo' })
  await stageDialog.getByRole('combobox', { name: 'Fase *' }).click()
  await page.getByRole('option', { name: 'Parecer jurídico', exact: true }).click()
  await stageDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(stageDialog).toBeHidden()
  await expect(page.getByText('Parecer jurídico', { exact: true })).toBeVisible()
})
