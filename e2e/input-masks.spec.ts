import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('pessoa alterna CPF e CNPJ e formata telefone fixo e celular', async ({ page }) => {
  await page.goto('/pessoas')
  await page.getByRole('button', { name: 'Nova Pessoa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova Pessoa' })
  await dialog.getByLabel('CPF', { exact: true }).fill('52998224725')
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
  await dialog.getByLabel('Telefone').fill('7932221000')
  await expect(dialog.getByLabel('Telefone')).toHaveValue('(79) 3222-1000')
  await dialog.getByLabel('Telefone').fill('79999999999')
  await expect(dialog.getByLabel('Telefone')).toHaveValue('(79) 99999-9999')

  await dialog.getByRole('radio', { name: 'Pessoa Jurídica' }).check()
  await expect(dialog.getByLabel('CNPJ', { exact: true })).toHaveValue('')
  await dialog.getByLabel('CNPJ', { exact: true }).fill('11222333000181')
  await expect(dialog.getByLabel('CNPJ', { exact: true })).toHaveValue('11.222.333/0001-81')

  await dialog.getByRole('radio', { name: 'Pessoa Física' }).check()
  await dialog.getByLabel('CPF', { exact: true }).fill('52998224725')
  await dialog.getByLabel('Nome completo *').fill('Pessoa Mascarada')
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('textbox', { name: 'Buscar pessoas' }).fill('Pessoa Mascarada')
  await page.getByRole('button', { name: 'Editar Pessoa Mascarada' }).click()
  const edit = page.getByRole('dialog', { name: 'Editar Pessoa' })
  await expect(edit.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
  await expect(edit.getByLabel('Telefone')).toHaveValue('(79) 99999-9999')
})

test('configurações formatam CNPJ, telefone e UF e preservam os valores', async ({ page }) => {
  await page.goto('/configuracoes')
  await page.getByLabel('CNPJ', { exact: true }).fill('11222333000181')
  await expect(page.getByLabel('CNPJ', { exact: true })).toHaveValue('11.222.333/0001-81')
  await expect(page.getByLabel('Linha 2 do timbre')).toHaveValue('11.222.333/0001-81')
  await page.getByLabel('Telefone', { exact: true }).fill('79999999999')
  await expect(page.getByLabel('Telefone', { exact: true })).toHaveValue('(79) 99999-9999')
  await page.getByLabel('UF', { exact: true }).fill('s3e')
  await expect(page.getByLabel('UF', { exact: true })).toHaveValue('SE')
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await page.reload()
  await expect(page.getByLabel('CNPJ', { exact: true })).toHaveValue('11.222.333/0001-81')
  await expect(page.getByLabel('Telefone', { exact: true })).toHaveValue('(79) 99999-9999')
  await expect(page.getByLabel('UF', { exact: true })).toHaveValue('SE')
})
