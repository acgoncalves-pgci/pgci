import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('cria usuário sem pessoa vinculada e o oferece nos papéis do processo', async ({ page }) => {
  await page.goto('/usuarios')
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo usuário' })
  await expect(dialog.getByRole('combobox', { name: 'Pessoa do usuário' })).toHaveCount(0)
  await dialog.getByLabel('Nome do usuário').fill('Carlos Participante')
  await dialog.getByLabel('E-mail do usuário').fill('carlos.participante@example.com')
  await dialog.getByRole('button', { name: 'Salvar' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('region', { name: 'Lista de usuários' }).getByText('Carlos Participante', { exact: true })).toBeVisible()
  await page.goto('/processos/novo')

  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Pedido de informação' }).click()
  await page.getByRole('combobox', { name: 'Interessado *' }).click()
  await expect(page.getByRole('option', { name: 'Carlos Participante' })).toBeVisible()
  await page.getByRole('option', { name: 'Carlos Participante' }).click()
  await page.getByRole('combobox', { name: 'Responsável *' }).click()
  await expect(page.getByRole('option', { name: 'Carlos Participante' })).toBeVisible()
  await page.getByRole('option', { name: 'Carlos Participante' }).click()

  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Pagamento de fornecedor' }).click()
  await page.getByRole('combobox', { name: 'Credor *' }).click()
  await expect(page.getByRole('option', { name: 'Carlos Participante' })).toBeVisible()
})

test('lista usuários e administra unidades e permissões', async ({ page, isMobile }) => {
  await page.goto('/usuarios')

  await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lista de usuários' }).locator('article')).toHaveCount(6)

  const claraRow = page.getByRole('region', { name: 'Lista de usuários' }).locator('article').filter({ hasText: 'Clara Nunes' })
  await expect(claraRow).toContainText('clara.nunes@example.com')
  await expect(claraRow.getByRole('link', { name: 'Gerenciar unidades de Clara Nunes' })).toContainText('1')
  await claraRow.getByRole('link', { name: 'Gerenciar unidades de Clara Nunes' }).click()

  await expect(page.getByRole('heading', { name: 'Unidades / Permissões — Clara Nunes' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Unidades e permissões' }).locator('article')).toHaveCount(1)

  await page.getByRole('button', { name: 'Adicionar unidade' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Adicionar unidade' })
  const addDialogBox = await addDialog.locator('section').first().boundingBox()
  expect(addDialogBox).not.toBeNull()
  expect(addDialogBox!.width).toBeLessThanOrEqual(isMobile ? 420 : 576)
  await addDialog.getByRole('combobox', { name: 'Unidade organizacional' }).click()
  await expect(page.getByRole('option', { name: 'Administração / Financeiro', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'Administração', exact: true }).click()
  await addDialog.getByRole('combobox', { name: 'Permissão nesta unidade' }).click()
  await page.getByRole('option', { name: 'Gestor' }).click()
  await addDialog.getByLabel('Cargo ou função').fill('Coordenadora administrativa')
  await addDialog.getByRole('button', { name: 'Salvar acesso' }).click()

  const accessRegion = page.getByRole('region', { name: 'Unidades e permissões' })
  await expect(accessRegion.locator('article')).toHaveCount(2)
  const administration = accessRegion.locator('article').filter({ hasText: 'Administração' })
  await expect(administration).toContainText('Coordenadora administrativa')
  await expect(administration).toContainText('Gestor')

  await administration.getByRole('button', { name: 'Editar acesso à Administração' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Editar acesso à unidade' })
  await editDialog.getByRole('combobox', { name: 'Permissão nesta unidade' }).click()
  await page.getByRole('option', { name: 'Leitor' }).click()
  await editDialog.getByLabel('Cargo ou função').fill('Consulta administrativa')
  await editDialog.getByRole('button', { name: 'Salvar acesso' }).click()
  await expect(administration).toContainText('Consulta administrativa')
  await expect(administration).toContainText('Leitor')

  await administration.getByRole('button', { name: 'Remover acesso à Administração' }).click()
  const removeDialog = page.getByRole('dialog', { name: 'Remover acesso à unidade?' })
  await removeDialog.getByRole('button', { name: 'Remover acesso' }).click()
  await expect(accessRegion.locator('article')).toHaveCount(1)

  await page.getByRole('link', { name: 'Voltar para usuários' }).click()
  const updatedClara = page.getByRole('region', { name: 'Lista de usuários' }).locator('article').filter({ hasText: 'Clara Nunes' })
  await expect(updatedClara.getByRole('link', { name: 'Gerenciar unidades de Clara Nunes' })).toContainText('1')
})

