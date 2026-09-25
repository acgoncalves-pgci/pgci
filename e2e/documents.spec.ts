import { expect, test } from '@playwright/test'
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib'
import { writeFile } from 'node:fs/promises'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('prévia de impressão começa na primeira página e contém o documento', async ({ page }) => {
  await page.goto('/documentos/doc-8')
  await page.getByRole('button', { name: 'Prévia de impressão' }).click()
  const modal = page.getByRole('dialog', { name: 'DOC-2026.000008.pdf' })
  const viewer = modal.getByTitle('Pré-visualização de DOC-2026.000008.pdf')
  await expect(viewer).toBeVisible({ timeout: 15_000 })
  const encoded = await viewer.evaluate(async (frame: HTMLIFrameElement) => {
    const bytes = new Uint8Array(await (await fetch(frame.src)).arrayBuffer())
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  })
  const pdf = await PDFDocument.load(Buffer.from(encoded, 'base64'))
  expect(pdf.getPageCount()).toBe(1)
  const [width, height] = [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()]
  expect(width).toBeCloseTo(595.28, 0)
  expect(height).toBeCloseTo(841.89, 0)
  const objectUrl = await viewer.getAttribute('src')
  await modal.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(modal).toBeHidden()
  expect(await page.evaluate(async (url) => {
    try { await fetch(url!); return false } catch { return true }
  }, objectUrl)).toBe(true)
})

test('prévia PDF distribui conteúdo longo em folhas A4', async ({ page }, testInfo) => {
  await page.goto('/documentos/novo')
  await page.getByRole('combobox', { name: 'Tipo de documento *' }).click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await page.getByLabel('Assunto *').fill('Documento de várias páginas')
  await page.getByRole('textbox', { name: 'Corpo do documento * visual' }).evaluate((element) => {
    element.innerHTML = Array.from({ length: 90 }, (_, index) => `<p>Parágrafo ${index + 1}: conteúdo de teste para verificar a paginação do documento em folhas A4.</p>`).join('')
    element.dispatchEvent(new InputEvent('input', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Documento de várias páginas' })).toBeVisible()
  await page.getByRole('button', { name: 'Prévia de impressão' }).click()
  const viewer = page.getByRole('dialog').getByTitle(/Pré-visualização de .*\.pdf/)
  await expect(viewer).toBeVisible()
  const encoded = await viewer.evaluate(async (frame: HTMLIFrameElement) => {
    const bytes = new Uint8Array(await (await fetch(frame.src)).arrayBuffer())
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  })
  const bytes = Buffer.from(encoded, 'base64')
  if (process.env.CAPTURE_PDF_QA === '1') await writeFile(testInfo.outputPath('preview.pdf'), bytes)
  const pdf = await PDFDocument.load(bytes)
  expect(pdf.getPageCount()).toBeGreaterThan(1)
  expect(pdf.getPageCount()).toBeLessThan(8)
  for (const sheet of pdf.getPages()) {
    expect(sheet.getWidth()).toBeCloseTo(595.28, 0)
    expect(sheet.getHeight()).toBeCloseTo(841.89, 0)
  }
})

test('PDF reproduz o corpo redigido sem alterar negrito, espaços ou acrescentar assinatura', async ({ page }, testInfo) => {
  test.setTimeout(45_000)
  await page.goto('/documentos/novo')
  await page.getByRole('combobox', { name: 'Tipo de documento *' }).click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await page.getByLabel('Assunto *').fill('Compra e venda')
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  await editor.evaluate((element) => {
    element.innerHTML = '<p><strong>Pelo</strong> <strong>presente</strong> <strong>instrumento</strong> formalizado <strong>sob</strong> <strong>o</strong> número <strong>DOC-2026.09.24.0009</strong>.</p><ul><li style="text-align: justify; font-family: Inter"><strong>Pelo presente instrumento, formalizado sob o número DOC-2026.09.24.0009 e referente ao protocolo, de um lado Prefeitura de Vila, por meio da Educação, neste ato representada por Marina Duarte, ocupante do cargo de Administrador geral, lotado no setor da Educação, com endereço eletrônico institucional marina.duarte@example.com, doravante denominada compradora, e de outro lado, doravante denominado vendedor, celebram o presente ato relativo a Compra e venda.</strong></li></ul><p style="text-align: justify; font-family: Inter">O presente ajuste tem por finalidade a formalização da aquisição de bens ou produtos discriminados no processo que tem como tema, atendendo às necessidades da administração no exercício de 2026.</p><p style="text-align: justify; font-family: Inter">O vendedor compromete-se a entregar os bens adquiridos em estrita conformidade com as especificações exigidas, livres de quaisquer ônus, defeitos ou impedimentos legais, responsabilizando-se pela integridade do objeto até a sua entrega e aceitação definitiva pela Educação.</p><p>São Mateus do Maranhão, MA, 24 de setembro de 2026.</p><p>Marina Duarte</p><p>Administrador geral</p>'
    element.dispatchEvent(new InputEvent('input', { bubbles: true }))
  })
  expect(await editor.locator('p[style]').first().evaluate((element) => ({
    font: getComputedStyle(element).fontFamily,
    weight: getComputedStyle(element).fontWeight,
  }))).toEqual({ font: 'Inter', weight: '400' })
  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Compra e venda' })).toBeVisible()
  const sheet = page.locator('article.document-page')
  await expect(sheet.locator('li strong')).toContainText('Pelo presente instrumento')
  await expect(sheet.locator('header')).toHaveCount(0)
  await expect(sheet.getByText('Marina Duarte', { exact: true })).toHaveCount(1)
  const capture = async () => {
    await page.evaluate(() => {
      const state = window as Window & { __pdfStageParent?: string; __pdfStageObserver?: MutationObserver }
      state.__pdfStageParent = undefined
      state.__pdfStageObserver?.disconnect()
      state.__pdfStageObserver = new MutationObserver(() => {
        const staging = Array.from(document.querySelectorAll<HTMLElement>('div[style*="pointer-events: none"]')).find((element) => element.querySelector('article.document-page'))
        if (staging) state.__pdfStageParent = staging.parentElement?.tagName
      })
      state.__pdfStageObserver.observe(document.documentElement, { childList: true, subtree: true })
    })
    await page.getByRole('button', { name: 'Prévia de impressão' }).click()
    const modal = page.getByRole('dialog')
    const viewer = modal.getByTitle(/Pré-visualização de .*\.pdf/)
    await expect(viewer).toBeVisible({ timeout: 15_000 })
    const bytes = await viewer.evaluate(async (frame: HTMLIFrameElement) => new Uint8Array(await (await fetch(frame.src)).arrayBuffer()))
    const stageParent = await page.evaluate(() => {
      const state = window as Window & { __pdfStageParent?: string; __pdfStageObserver?: MutationObserver }
      state.__pdfStageObserver?.disconnect()
      return state.__pdfStageParent
    })
    await modal.getByRole('button', { name: 'Fechar diálogo' }).click()
    return { bytes, stageParent }
  }
  const imageSizes = async (bytes: Uint8Array) => {
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
    const images = pdf.getPage(0).node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    expect(images).toBeDefined()
    return images!.values().map((ref) => pdf.context.lookup(ref)).filter((object): object is PDFRawStream => object instanceof PDFRawStream).map((stream) => ({
      width: Number(stream.dict.get(PDFName.of('Width'))?.toString()),
      height: Number(stream.dict.get(PDFName.of('Height'))?.toString()),
    }))
  }
  const normal = await capture()
  expect(normal.stageParent).toBe('HTML')
  const baseline = await imageSizes(normal.bytes)
  for (const zoom of ['0.8', '1.25']) {
    await page.evaluate((value) => { document.body.style.zoom = value }, zoom)
    const preview = await capture()
    expect(preview.stageParent).toBe('HTML')
    if (zoom === '0.8' && process.env.CAPTURE_PDF_QA === '1') await writeFile(testInfo.outputPath('rich-preview.pdf'), preview.bytes)
    const sizes = await imageSizes(preview.bytes)
    expect(sizes).toHaveLength(baseline.length)
    for (const [index, size] of sizes.entries()) {
      expect(size.width).toBe(baseline[index].width)
      expect(Math.abs(size.height - baseline[index].height)).toBeLessThanOrEqual(4)
    }
  }
})

test('não herda negrito após Enter e permite limpar a formatação de modelo padrão', async ({ page }) => {
  await page.goto('/tipos-documento/dt-oficio/modelos/template-dt-oficio-default/editar')
  const editor = page.getByRole('textbox', { name: 'Corpo do modelo visual' })
  await expect(editor.locator('strong')).not.toHaveCount(0)
  await editor.locator('strong').first().evaluate((strong) => {
    const range = document.createRange()
    range.selectNodeContents(strong)
    range.collapse(false)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    ;(strong.closest('[contenteditable]') as HTMLElement).focus()
  })
  await page.keyboard.press('Enter')
  await page.keyboard.type('Linha sem negrito')
  const typed = editor.getByText('Linha sem negrito')
  await expect(typed).toBeVisible()
  expect(await typed.evaluate((element) => getComputedStyle(element).fontWeight)).toBe('400')

  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Limpar formatação' }).click()
  await expect(editor.locator('b, strong, span[style*="font-weight"]')).toHaveCount(0)

  await editor.fill('Trecho em destaque')
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Negrito' }).click()
  await expect(editor.locator('b, strong')).toContainText('Trecho em destaque')
  await editor.locator('b, strong').first().evaluate((strong) => {
    const range = document.createRange()
    range.selectNodeContents(strong)
    range.collapse(false)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    ;(strong.closest('[contenteditable]') as HTMLElement).focus()
  })
  await page.keyboard.press('Enter')
  await page.keyboard.type('Parágrafo normal')
  await expect(editor).toContainText('Parágrafo normal')
  expect(await editor.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !node.textContent?.includes('Parágrafo normal')) node = walker.nextNode()
    return node?.parentElement ? getComputedStyle(node.parentElement).fontWeight : ''
  })).toBe('400')

  await editor.evaluate((element) => {
    element.innerHTML = '<h2>Modelo antigo em negrito</h2><p style="font-weight: 700">Conteúdo antigo</p>'
    element.dispatchEvent(new InputEvent('input', { bubbles: true }))
  })
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Limpar formatação' }).click()
  expect(await editor.locator('h2, p').first().evaluate((element) => getComputedStyle(element).fontWeight)).toBe('400')

  await page.goto('/documentos/novo')
  await page.getByRole('combobox', { name: 'Tipo de documento *' }).click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await page.getByRole('combobox', { name: 'Modelo do documento' }).click()
  await page.getByRole('option', { name: 'Modelo padrão de Ofício' }).click()
  const documentEditor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  await expect(documentEditor.locator('strong')).not.toHaveCount(0)
  await documentEditor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Limpar formatação' }).click()
  await expect(documentEditor.locator('b, strong, h1, h2, h3')).toHaveCount(0)
})

test('comandos do editor aplicam formatação, listas, alinhamento, link e histórico', async ({ page }) => {
  await page.goto('/documentos/novo')
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  const selectText = async () => {
    await editor.evaluate((element) => {
      element.innerHTML = '<p>Texto de prova</p>'
      element.dispatchEvent(new InputEvent('input', { bubbles: true }))
      const range = document.createRange()
      range.selectNodeContents(element.querySelector('p')!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      ;(element as HTMLElement).focus()
    })
  }
  for (const [button, selector] of [
    ['Título 1', 'h1'],
    ['Título 2', 'h2'],
    ['Título 3', 'h3'],
    ['Negrito', 'b, strong'],
    ['Itálico', 'i, em'],
    ['Sublinhado', 'u'],
    ['Tachado', 's, strike'],
    ['Lista com marcadores', 'ul li'],
    ['Lista numerada', 'ol li'],
  ]) {
    await selectText()
    await page.getByRole('button', { name: button, exact: true }).click()
    await expect(editor.locator(selector)).toContainText('Texto de prova')
  }
  for (const [button, expected] of [
    ['Alinhar à esquerda', 'start'],
    ['Centralizar', 'center'],
    ['Alinhar à direita', 'right'],
    ['Justificar', 'justify'],
  ]) {
    await selectText()
    await page.getByRole('button', { name: button }).click()
    expect(await editor.evaluate((element) => getComputedStyle(element.firstElementChild ?? element).textAlign)).toBe(expected)
  }
  await selectText()
  page.once('dialog', (dialog) => dialog.accept('https://example.org'))
  await page.getByRole('button', { name: 'Inserir link' }).click()
  await expect(editor.locator('a[href="https://example.org/"]')).toContainText('Texto de prova')

  await selectText()
  await page.getByRole('button', { name: 'Negrito' }).click()
  await expect(editor.locator('b, strong')).toContainText('Texto de prova')
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(editor.locator('b, strong')).toHaveCount(0)
  await page.getByRole('button', { name: 'Refazer' }).click()
  await expect(editor.locator('b, strong')).toContainText('Texto de prova')
  await page.getByRole('button', { name: 'Limpar formatação' }).click()
  await expect(editor.locator('b, strong')).toHaveCount(0)
})

test('tamanho da fonte aceita presets e px manual e retorna ao padrão', async ({ page }, testInfo) => {
  await page.goto('/documentos/novo')
  if (process.env.CAPTURE_EDITOR_QA === '1') await page.locator('.rich-editor-toolbar').screenshot({ path: testInfo.outputPath('font-toolbar.png') })
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  const size = page.getByRole('textbox', { name: 'Tamanho da fonte (px)' })
  await editor.evaluate((element) => {
    element.innerHTML = '<p>Texto de prova</p>'
    element.dispatchEvent(new InputEvent('input', { bubbles: true }))
  })
  const selectText = async () => {
    await editor.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element.querySelector('p')!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      ;(element as HTMLElement).focus()
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  }
  const computedSize = () => editor.getByText('Texto de prova').evaluate((element) => getComputedStyle(element.firstElementChild ?? element).fontSize)
  await selectText()
  await page.getByRole('button', { name: 'Escolher tamanho da fonte' }).click()
  await page.getByRole('button', { name: 'Tamanho 28 px' }).click()
  expect(await computedSize()).toBe('28px')

  await selectText()
  await size.fill('23')
  await size.press('Enter')
  expect(await computedSize()).toBe('23px')

  await selectText()
  await page.getByRole('button', { name: 'Escolher tamanho da fonte' }).click()
  await page.getByRole('button', { name: 'Padrão (15 px)' }).click()
  expect(await computedSize()).toBe('15px')

  await editor.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element.querySelector('p')!)
    range.collapse(false)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    ;(element as HTMLElement).focus()
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
  await size.fill('19')
  await size.press('Enter')
  await page.keyboard.type(' novo')
  expect(await editor.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !node.textContent?.includes('novo')) node = walker.nextNode()
    return node?.parentElement ? getComputedStyle(node.parentElement).fontSize : ''
  })).toBe('19px')
  await page.getByRole('combobox', { name: 'Tipo de documento *' }).click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await page.getByLabel('Assunto *').fill('Fonte personalizada')
  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fonte personalizada' })).toBeVisible()
  expect(await page.locator('.document-page').evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !node.textContent?.includes('novo')) node = walker.nextNode()
    return node?.parentElement ? getComputedStyle(node.parentElement).fontSize : ''
  })).toBe('19px')
})

test('modelo mantém o tamanho em px e permite voltar ao padrão sem perder negrito', async ({ page }) => {
  await page.goto('/tipos-documento/dt-oficio/modelos/template-dt-oficio-default/editar')
  const editor = page.getByRole('textbox', { name: 'Corpo do modelo visual' })
  const firstBold = editor.locator('strong').first()
  await expect(firstBold).toBeVisible()
  const selectBold = async () => {
    await firstBold.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      ;(element.closest('[contenteditable]') as HTMLElement).focus()
      element.closest('[contenteditable]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  }
  const selectedSize = () => firstBold.evaluate((element) => {
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
    return text?.parentElement ? getComputedStyle(text.parentElement).fontSize : ''
  })
  await selectBold()
  const size = page.getByRole('textbox', { name: 'Tamanho da fonte (px)' })
  await size.fill('24')
  await size.press('Enter')
  expect(await selectedSize()).toBe('24px')
  await selectBold()
  await page.getByRole('button', { name: 'Escolher tamanho da fonte' }).click()
  await page.getByRole('button', { name: 'Padrão (15 px)' }).click()
  expect(await selectedSize()).toBe('15px')
  await expect(firstBold).toBeVisible()
})

test('cria um modelo, aplica no editor A4 e salva o documento formatado', async ({ page, isMobile }) => {
  await page.goto('/tipos-documento')
  const officeType = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Ofício', exact: true }) })
  await officeType.getByRole('button', { name: /Modelos/ }).click()

  const modelsDialog = page.getByRole('dialog', { name: 'Modelos — Ofício' })
  await modelsDialog.getByRole('button', { name: 'Novo modelo' }).click()
  await expect(page).toHaveURL(/\/tipos-documento\/.*\/modelos\/novo/)
  await page.getByLabel('Nome do modelo *').fill('Resposta de integração')
  await page.getByLabel('Assunto padrão').fill('Resposta para {{nome_destinatario}}')
  const templateEditor = page.getByRole('textbox', { name: 'Corpo do modelo visual' })
  await templateEditor.fill('Texto com {{variavel_invalida}}.')
  await expect(page.getByText('Variáveis desconhecidas: {{variavel_invalida}}.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar modelo' })).toBeDisabled()
  await templateEditor.fill('Prezado(a) {{nome_destinatario}}, resposta emitida por {{unidade}}.')
  await expect(templateEditor.locator('b, strong')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Modelo padrão deste tipo' }).click()
  await templateEditor.click()
  await expect(templateEditor).toBeFocused()
  await page.getByRole('button', { name: 'Salvar modelo' }).click()
  await expect(page).toHaveURL(/\/tipos-documento\?modelos=/)
  await expect(modelsDialog.getByRole('heading', { name: /Resposta de integração/ })).toBeVisible()
  await modelsDialog.getByRole('button', { name: 'Fechar', exact: true }).click()

  await page.goto('/documentos/novo')
  const type = page.getByRole('combobox', { name: 'Tipo de documento *' })
  await type.click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Modelo do documento' })).toContainText('Resposta de integração')
  await expect(page.getByRole('textbox', { name: 'Corpo do documento * visual' })).toContainText('Prezado(a)')
  const recipient = page.getByRole('combobox', { name: 'Destinatário' })
  await recipient.click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa', exact: true }).click()
  const model = page.getByRole('combobox', { name: 'Modelo do documento' })
  await model.click()
  await page.getByRole('option', { name: 'Resposta de integração', exact: true }).click()

  await expect(page.getByLabel('Assunto *')).toHaveValue('Resposta para Ana Beatriz Costa')
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  await expect(editor).toContainText('Prezado(a) Ana Beatriz Costa, resposta emitida por Gestão de Processos.')
  await editor.click()
  await expect(editor).toBeFocused()
  await editor.evaluate((element) => {
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Prezado'.length)
    element.focus()
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await page.getByRole('button', { name: 'Negrito' }).click()
  await expect(editor.locator('b, strong')).toContainText('Prezado')
  await editor.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let text = walker.nextNode()
    while (text && !text.textContent?.includes('resposta')) text = walker.nextNode()
    if (!text) throw new Error('Texto do modelo não encontrado')
    const range = document.createRange()
    range.setStart(text, text.textContent!.indexOf('resposta'))
    range.collapse(true)
    element.focus()
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await page.keyboard.type('nova ')
  await expect(editor).toContainText('nova resposta')
  await expect(page.getByRole('toolbar', { name: 'Formatação do documento' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Negrito' })).toBeVisible()
  if (!isMobile) {
    const pageBox = await page.locator('.a4-page').boundingBox()
    expect(pageBox).not.toBeNull()
    expect(pageBox!.width).toBeGreaterThan(780)
    expect(pageBox!.width).toBeLessThan(810)
  }

  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page).toHaveURL(/\/documentos\//)
  await expect(page.getByRole('heading', { level: 1, name: 'Resposta para Ana Beatriz Costa' })).toBeVisible()
  await expect(page.locator('.document-page')).toContainText('Prezado(a) Ana Beatriz Costa, nova resposta emitida por Gestão de Processos.')
  await expect(page.locator('.document-rich-content b, .document-rich-content strong')).toContainText('Prezado')
})

test('edita documento avulso e abre processo com o documento vinculado', async ({ page }) => {
  await page.goto('/documentos')
  const number = 'DOC-2026.000008'
  let row = page.locator('article').filter({ hasText: number })
  await expect(row.getByRole('button', { name: `Excluir ${number}` })).toBeEnabled()
  await row.getByRole('link', { name: `Editar ${number}` }).click()
  await page.getByLabel('Assunto *').fill('Circular revisada de responsáveis')
  await page.getByLabel('Cargo do assinante').fill('Coordenador de Protocolo')
  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Circular revisada de responsáveis' })).toBeVisible()
  await expect(page.getByText(/Assinante cadastrado:.*Coordenador de Protocolo/)).toBeVisible()
  await expect(page.locator('.document-page')).not.toContainText('Coordenador de Protocolo')

  await page.goto('/documentos')
  row = page.locator('article').filter({ hasText: number })
  await row.getByRole('link', { name: `Abrir processo a partir de ${number}` }).click()
  await expect(page).toHaveURL(/\/processos\/novo\?documentId=doc-8/)
  await expect(page.getByText(`Documento de origem: ${number}`)).toBeVisible()
  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Solicitação administrativa' }).click()
  await expect(page.getByLabel('Assunto *')).toHaveValue('Circular revisada de responsáveis')
  await page.getByRole('combobox', { name: 'Interessado *' }).click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa' }).click()
  await page.getByRole('button', { name: 'Abrir processo' }).click()
  await expect(page).toHaveURL(/\/processos\/(?!novo(?:\?|$))[^/?]+$/)

  await page.goto('/documentos')
  row = page.locator('article').filter({ hasText: number })
  await expect(row.getByRole('button', { name: `Excluir ${number}` })).toBeDisabled()
  await expect(row.getByRole('link', { name: `Abrir processo a partir de ${number}` })).toHaveCount(0)
})

test('exclui apenas documento sem processo vinculado', async ({ page }) => {
  await page.goto('/documentos')
  const linked = page.locator('article').filter({ hasText: 'DOC-2026.000001' })
  await expect(linked.getByRole('button', { name: 'Excluir DOC-2026.000001' })).toBeDisabled()
  const standalone = page.locator('article').filter({ hasText: 'DOC-2026.000008' })
  await standalone.getByRole('button', { name: 'Excluir DOC-2026.000008' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Excluir documento?' })
  await confirmation.getByRole('button', { name: 'Excluir documento' }).click()
  await expect(confirmation).toBeHidden()
  await expect(page.locator('article').filter({ hasText: 'DOC-2026.000008' })).toHaveCount(0)
})

test('mantém a folha de edição nas dimensões A4 com conteúdo extenso', async ({ page }) => {
  await page.goto('/documentos/novo')
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  await editor.evaluate((element) => {
    element.innerHTML = Array.from({ length: 100 }, (_, index) => `<p>Linha de conteúdo ${index + 1}</p>`).join('')
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  })
  const size = await editor.evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
  expect(size.height / size.width).toBeGreaterThan(1.39)
  expect(size.height / size.width).toBeLessThan(1.44)
})
