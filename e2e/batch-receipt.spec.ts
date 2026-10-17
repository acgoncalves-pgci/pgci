import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { downloadPreview, expectPdfReady } from './helpers/pdf'

test('exporta lote extenso sem perder descrições ou protocolos e numera todas as páginas', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit', 'u-prot')
  })
  await page.goto('/lotes')
  await expect(page.getByRole('heading', { name: 'Lotes', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
    const db = JSON.parse(localStorage.getItem(key)!)
    db.batches = [{ id: 'long-batch-receipt', number: '2026.009999', actorUserId: 'usr-clara', actorUnitId: 'u-prot', actorName: 'Clara Nunes', createdAt: '2026-09-20T04:16:37.000Z', typeIds: ['pt-buy'], typeNames: ['Processo de aquisição de equipamentos, materiais e serviços para a administração municipal'], phaseId: 'phase-analysis', phaseName: 'Análise', unitId: 'u-accounting', unitName: 'Contabilidade', destinationPath: 'Secretaria Municipal de Administração / Unidade de Gestão Financeira / Setor de Contabilidade e Prestação de Contas', message: 'Observação com justificativa detalhada do encaminhamento para conferência documental, análise técnica e providências administrativas. '.repeat(25) + 'FIM DA OBSERVAÇÃO.', protocols: Array.from({ length: 75 }, (_, index) => ({ protocolId: `large-receipt-${index}`, number: `2026.09.20.${String(index + 1).padStart(4, '0')}`, typeId: 'pt-buy', eventId: `large-event-${index}`, expectedVersion: 1, createdAt: '2026-09-20T04:15:58.000Z', description: `Descrição ${index + 1}: aquisição de equipamentos para atendimento às unidades municipais, incluindo conferência de documentos, verificação dos quantitativos e análise das especificações técnicas.` })) }]
    localStorage.setItem(key, JSON.stringify(db))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Exportar comprovante do lote 2026.009999', exact: true }).click()
  const receipt = page.getByRole('dialog', { name: 'Comprovante de protocolos em lote — 2026.009999', exact: true })
  await expectPdfReady(receipt)
  const download = await downloadPreview(page, receipt)
  await download.saveAs(testInfo.outputPath('batch-receipt-long.pdf'))
  const bytes = await readFile((await download.path())!)
  const pages = await page.evaluate(async (data) => {
    const modulePath = '/src/lib/pdfRuntime.ts'
    const { loadPdfRuntime, pdfAssetOptions } = await import(modulePath)
    const task = (await loadPdfRuntime()).getDocument({ data: Uint8Array.from(data), ...pdfAssetOptions })
    const pdf = await task.promise
    const pages = []
    for (let index = 1; index <= pdf.numPages; index++) {
      const text = await (await pdf.getPage(index)).getTextContent()
      pages.push(text.items.filter((item: { str?: string }) => 'str' in item).map((item: { str: string }) => item.str).join(' '))
    }
    await task.destroy()
    return pages as string[]
  }, Array.from(bytes))
  expect(pages.length).toBeGreaterThan(2)
  const content = pages.join(' ')
  expect(content).toContain('FIM DA OBSERVAÇÃO.')
  expect(content).toContain('Total de protocolos: 75')
  expect(content).toContain('Fila da unidade')
  for (let index = 1; index <= 75; index++) {
    expect(content).toContain(`2026.09.20.${String(index).padStart(4, '0')}`)
    expect(content).toContain(`Descrição ${index}:`)
  }
  pages.forEach((content, index) => {
    expect(content).toContain(`Página ${index + 1} de ${pages.length}`)
    if (index > 0) expect(content).toContain('Nº Protocolo')
  })
})
