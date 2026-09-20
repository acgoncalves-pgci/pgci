import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('gerencia fases, categorias e situações pelas abas de tipos de processo', async ({ page }) => {
  await page.goto('/tipos-processo')

  const tabs = page.getByRole('tablist', { name: 'Configuração de processos' })
  await expect(tabs.getByRole('tab', { name: 'Tipos' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Fases' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Categorias' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Situações' })).toBeVisible()

  await tabs.getByRole('tab', { name: 'Categorias' }).click()
  await expect(page.getByRole('button', { name: 'Nova categoria' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lista de categorias de processo' }).locator('article')).toHaveCount(6)

  await tabs.getByRole('tab', { name: 'Situações' }).click()
  await expect(page.getByRole('button', { name: 'Nova situação' })).toBeVisible()
  await expect(page.locator('article')).toHaveCount(15)
})

test('cria e seleciona uma categoria sem fechar o cadastro do tipo', async ({ page, isMobile }) => {
  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: 'Novo', exact: true }).click()

  const typeDialog = page.getByRole('dialog', { name: 'Novo tipo de processo' })
  const descriptionInput = typeDialog.getByLabel('Descrição *')
  const categorySelect = typeDialog.getByRole('combobox', { name: 'Categoria' })
  await descriptionInput.fill('Tipo preservado durante o cadastro rápido')
  const descriptionBox = await descriptionInput.boundingBox()
  const categoryBox = await categorySelect.boundingBox()
  expect(descriptionBox).not.toBeNull()
  expect(categoryBox).not.toBeNull()
  if (!isMobile) expect(Math.abs(descriptionBox!.y - categoryBox!.y)).toBeLessThan(1)
  expect(Math.abs(descriptionBox!.height - categoryBox!.height)).toBeLessThan(1)
  const quickCategoryButton = typeDialog.getByRole('button', { name: 'Nova categoria' })
  await expect(quickCategoryButton).toHaveText('Nova')
  await expect(quickCategoryButton).toHaveClass(/text-xs/)
  await expect(quickCategoryButton).not.toHaveClass(/button-secondary/)
  await quickCategoryButton.click()

  const categoryDialog = page.getByRole('dialog', { name: 'Nova Categoria de Processo' })
  await categoryDialog.getByLabel('Código *').fill('91')
  await categoryDialog.getByLabel('Nome *').fill('Categoria rápida')
  await categoryDialog.getByRole('button', { name: 'Salvar', exact: true }).click({ force: true })

  await expect(categoryDialog).toBeHidden()
  await expect(typeDialog).toBeVisible()
  await expect(typeDialog.getByLabel('Descrição *')).toHaveValue('Tipo preservado durante o cadastro rápido')
  await expect(typeDialog.getByRole('combobox', { name: 'Categoria' })).toHaveText('91 — Categoria rápida')
})

test('configura campos complementares e autorizações no cadastro do tipo', async ({ page }) => {
  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: 'Novo', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Novo tipo de processo' })
  await expect(dialog.getByRole('switch', { name: 'Tem número de contrato?' })).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Tem número de licitação?' })).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Tem número de processo jurídico?' })).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Tem número?' })).toBeVisible()
  await expect(dialog.getByText('Liberado para todos', { exact: true })).toBeVisible()

  await dialog.getByRole('switch', { name: 'Tem número de contrato?' }).click()
  await dialog.getByRole('checkbox', { name: /Clara Nunes/ }).check()
  await dialog.getByRole('checkbox', { name: /Jurídico/ }).check()
  await expect(dialog.getByText('1 usuário(s) · 1 unidade(s)')).toBeVisible()
})
test('cria e seleciona fase e situação sem fechar o cadastro da etapa', async ({ page }) => {
  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: /Configurar fluxo de Solicitação administrativa/ }).click()
  await page.getByRole('button', { name: 'Nova etapa' }).click()

  const stageDialog = page.getByRole('dialog', { name: 'Nova etapa do fluxo' })
  const checklistLabel = stageDialog.locator('label').filter({ hasText: 'Exige checklist' })
  const attachmentLabel = stageDialog.locator('label').filter({ hasText: 'Exige anexo' })
  await expect(checklistLabel).toHaveClass(/flex/)
  await expect(checklistLabel).toHaveClass(/items-center/)
  await expect(attachmentLabel).toHaveClass(/flex/)
  await expect(attachmentLabel).toHaveClass(/items-center/)
  const quickPhaseButton = stageDialog.getByRole('button', { name: 'Nova fase' })
  await expect(quickPhaseButton).toHaveText('Nova')
  await expect(quickPhaseButton).toHaveClass(/text-xs/)
  await expect(quickPhaseButton).not.toHaveClass(/button-secondary/)
  await quickPhaseButton.click()

  const phaseDialog = page.getByRole('dialog', { name: 'Novo tipo de fase' })
  await phaseDialog.getByLabel('Descrição *').fill('Fase rápida')
  await phaseDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(phaseDialog).toBeHidden()
  await expect(stageDialog).toBeVisible()
  await expect(stageDialog.getByRole('combobox', { name: 'Fase *' })).toHaveText('Fase rápida')

  const quickSituationButton = stageDialog.getByRole('button', { name: 'Nova situação' })
  await expect(quickSituationButton).toHaveText('Nova')
  await expect(quickSituationButton).toHaveClass(/text-xs/)
  await expect(quickSituationButton).not.toHaveClass(/button-secondary/)
  await quickSituationButton.click()
  const situationDialog = page.getByRole('dialog', { name: 'Novo Tipo de Situação' })
  await situationDialog.getByRole('combobox', { name: 'Categoria' }).click()
  await page.getByRole('option', { name: 'Em tramitação' }).click()
  await expect(situationDialog.getByRole('combobox', { name: 'Categoria' })).toHaveText('Em tramitação')
  await situationDialog.getByLabel('Descrição *').fill('Situação rápida')
  await situationDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(situationDialog).toBeHidden()
  await expect(stageDialog).toBeVisible()
  await expect(stageDialog.getByRole('combobox', { name: 'Situação' })).toHaveText('Situação rápida')
  await checklistLabel.getByRole('switch').click()
  await expect(stageDialog.getByText('Checklist da etapa')).toBeVisible()
  await expect(stageDialog.getByText('0 pergunta(s)')).toBeVisible()
  await stageDialog.getByRole('button', { name: 'Nova pergunta' }).click()
  const questionDialog = page.getByRole('dialog', { name: 'Nova pergunta' })
  await questionDialog.getByLabel('Pergunta *').fill('Validar dados da solicitação')
  await questionDialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(questionDialog).toBeHidden()
  await expect(stageDialog.getByText('Validar dados da solicitação')).toBeVisible()
  await expect(stageDialog.getByText('1 pergunta(s)')).toBeVisible()
  await stageDialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(stageDialog).toBeHidden()
  await expect(page.getByText('1 pergunta(s) no checklist').last()).toBeVisible()
})

test('abre o assistente de IA e exige uma descrição suficiente', async ({ page }) => {
  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: 'Criar com IA' }).click()

  const dialog = page.getByRole('dialog', { name: 'Criar tipo de processo com IA' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Descreva o processo em linguagem natural')).toBeVisible()
  const description = dialog.getByLabel('Como este processo deve funcionar? *')
  const generate = dialog.getByRole('button', { name: 'Gerar proposta' })
  await expect(generate).toBeDisabled()
  await description.fill('Solicitação de compra com análise administrativa, conferência financeira e autorização final.')
  await expect(generate).toBeEnabled()
})