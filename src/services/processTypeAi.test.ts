import { describe, expect, it, vi } from 'vitest'
import { generateProtocolTypeProposal } from './processTypeAi'
import type { ProtocolTypeAiCatalog } from './processTypeAi'

const catalog: ProtocolTypeAiCatalog = {
  categories: [{ id: 'category-purchases', code: '03', name: 'Compras e Contratações' }],
  phases: [{ id: 'phase-triage', code: 'TRIAGEM', name: 'Triagem', description: 'Conferência inicial.' }],
  situations: [{ id: 'situation-analysis', name: 'Em análise', category: 'EM_TRAMITACAO' }],
  units: [{ id: 'u-adm', name: 'Administração', path: 'Administração' }],
  icons: [{ value: 'FileText', label: 'Documento' }, { value: 'ClipboardCheck', label: 'Prancheta conferida' }],
}

const validProposal = {
  name: 'Solicitação de compra emergencial',
  description: 'Formaliza e analisa aquisições emergenciais do município.',
  categoryId: 'category-purchases',
  color: '#7C3AED',
  icon: 'FileText',
  defaultDeadlineDays: 5,
  flowMode: 'REQUIRED',
  fields: {
    interested: true, creditor: false, amount: true, responsavel: true, assunto: true, arquivos: true,
    contractNumber: false, biddingNumber: true, legalProcessNumber: false, referenceNumber: true, portal: false,
  },
  stages: [{
    phaseId: 'phase-triage', situationTypeId: 'situation-analysis', destinationUnitId: 'u-adm', required: true,
    requiresChecklist: true, requiresAttachment: false, observation: 'Conferir a documentação inicial.', color: '#2563EB', icon: 'ClipboardCheck',
    checklistQuestions: [{ text: 'A justificativa está completa?', required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true }],
  }],
  rationale: 'O fluxo obrigatório garante conferência prévia da demanda emergencial.',
}

const geminiResponse = (proposal: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(proposal) }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('criação de tipos de processo com Gemini', () => {
  it('solicita saída estruturada e valida uma proposta baseada no catálogo', async () => {
    let requestedUrl = ''
    let requestedInit: RequestInit | undefined
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input)
      requestedInit = init
      return geminiResponse(validProposal)
    })

    const proposal = await generateProtocolTypeProposal('Crie uma solicitação de compra emergencial com conferência inicial e documentos obrigatórios.', catalog, {
      apiKey: 'test-key',
      model: 'gemini-test',
      fetcher,
    })

    expect(proposal).toMatchObject({ name: validProposal.name, categoryId: 'category-purchases', flowMode: 'REQUIRED' })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(requestedUrl).toContain('/models/gemini-test:generateContent')
    const body = JSON.parse(String(requestedInit?.body))
    expect(body.generationConfig.responseFormat.text.mimeType).toBe('application/json')
    expect(body.generationConfig.responseFormat.text.schema.properties.categoryId.enum).toContain('category-purchases')
  })

  it('rejeita referências que não existem no catálogo local', async () => {
    const fetcher = vi.fn(async () => geminiResponse({ ...validProposal, stages: [{ ...validProposal.stages[0], phaseId: 'phase-invented' }] }))

    await expect(generateProtocolTypeProposal('Crie uma solicitação de compra emergencial com conferência inicial e documentos obrigatórios.', catalog, {
      apiKey: 'test-key',
      fetcher: fetcher as unknown as typeof fetch,
    })).rejects.toThrow('fase, situação ou unidade inválida')
  })

  it('informa como configurar o ambiente quando não há chave', async () => {
    await expect(generateProtocolTypeProposal('Crie uma solicitação de compra emergencial com conferência inicial e documentos obrigatórios.', catalog, { apiKey: '' })).rejects.toThrow('VITE_GEMINI_API_KEY')
  })
})