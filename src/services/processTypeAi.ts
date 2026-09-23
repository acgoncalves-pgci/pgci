import { z } from 'zod'
import type { FlowMode } from '../domain/model'

export interface ProtocolTypeAiCatalog {
  categories: Array<{ id: string; code: string; name: string }>
  phases: Array<{ id: string; code: string; name: string; description?: string }>
  situations: Array<{ id: string; name: string; category?: string }>
  units: Array<{ id: string; name: string; path: string }>
  icons: Array<{ value: string; label: string }>
}

export interface ProtocolTypeAiProposal {
  name: string
  description: string
  categoryId: string
  color: string
  icon: string
  defaultDeadlineDays?: number
  flowMode: FlowMode
  fields: {
    interested: boolean
    creditor: boolean
    amount: boolean
    responsavel: boolean
    assunto: boolean
    arquivos: boolean
    contractNumber: boolean
    biddingNumber: boolean
    legalProcessNumber: boolean
    referenceNumber: boolean
    portal: boolean
  }
  stages: Array<{
    phaseId: string
    situationTypeId: string
    destinationUnitId?: string
    required: boolean
    requiresChecklist: boolean
    requiresAttachment: boolean
    observation?: string
    color: string
    icon: string
    checklistQuestions: Array<{
      text: string
      required: boolean
      requiresAttachment: boolean
      requiresDate: boolean
      requiresObservation: boolean
    }>
  }>
  rationale: string
}

type GenerateOptions = { apiKey?: string; model?: string; fetcher?: typeof fetch }

const proposalSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  categoryId: z.string(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  icon: z.string().min(1),
  defaultDeadlineDays: z.number().int().positive().nullable(),
  flowMode: z.enum(['NONE', 'SUGGESTED', 'REQUIRED']),
  fields: z.object({
    interested: z.boolean(), creditor: z.boolean(), amount: z.boolean(), responsavel: z.boolean(), assunto: z.boolean(), arquivos: z.boolean(),
    contractNumber: z.boolean(), biddingNumber: z.boolean(), legalProcessNumber: z.boolean(), referenceNumber: z.boolean(), portal: z.boolean(),
  }),
  stages: z.array(z.object({
    phaseId: z.string().min(1),
    situationTypeId: z.string().min(1),
    destinationUnitId: z.string(),
    required: z.boolean(),
    requiresChecklist: z.boolean(),
    requiresAttachment: z.boolean(),
    observation: z.string().max(2000),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    icon: z.string().min(1),
    checklistQuestions: z.array(z.object({
      text: z.string().trim().min(3).max(500),
      required: z.boolean(), requiresAttachment: z.boolean(), requiresDate: z.boolean(), requiresObservation: z.boolean(),
    })).max(20),
  })).max(20),
  rationale: z.string().trim().min(10).max(2000),
})

const objectSchema = (catalog: ProtocolTypeAiCatalog) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: 'Nome objetivo do tipo de processo.' },
    description: { type: 'string', description: 'Descrição administrativa clara do objetivo e funcionamento.' },
    categoryId: { type: 'string', enum: catalog.categories.map((item) => item.id), description: 'ID obrigatório de uma categoria existente.' },
    color: { type: 'string', description: 'Cor hexadecimal no formato #RRGGBB, escolhida semanticamente.' },
    icon: { type: 'string', enum: catalog.icons.map((item) => item.value), description: 'Ícone existente mais adequado.' },
    defaultDeadlineDays: { type: ['integer', 'null'], minimum: 1, maximum: 365, description: 'Prazo padrão em dias ou null.' },
    flowMode: { type: 'string', enum: ['NONE', 'SUGGESTED', 'REQUIRED'] },
    fields: {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(['interested', 'creditor', 'amount', 'responsavel', 'assunto', 'arquivos', 'contractNumber', 'biddingNumber', 'legalProcessNumber', 'referenceNumber', 'portal'].map((field) => [field, { type: 'boolean' }])),
      required: ['interested', 'creditor', 'amount', 'responsavel', 'assunto', 'arquivos', 'contractNumber', 'biddingNumber', 'legalProcessNumber', 'referenceNumber', 'portal'],
    },
    stages: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          phaseId: { type: 'string', enum: catalog.phases.map((item) => item.id) },
          situationTypeId: { type: 'string', enum: catalog.situations.map((item) => item.id) },
          destinationUnitId: { type: 'string', enum: ['', ...catalog.units.map((item) => item.id)] },
          required: { type: 'boolean' }, requiresChecklist: { type: 'boolean' }, requiresAttachment: { type: 'boolean' },
          observation: { type: 'string' }, color: { type: 'string', description: 'Cor hexadecimal no formato #RRGGBB.' },
          icon: { type: 'string', enum: catalog.icons.map((item) => item.value) },
          checklistQuestions: {
            type: 'array', maxItems: 20,
            items: {
              type: 'object', additionalProperties: false,
              properties: { text: { type: 'string' }, required: { type: 'boolean' }, requiresAttachment: { type: 'boolean' }, requiresDate: { type: 'boolean' }, requiresObservation: { type: 'boolean' } },
              required: ['text', 'required', 'requiresAttachment', 'requiresDate', 'requiresObservation'],
            },
          },
        },
        required: ['phaseId', 'situationTypeId', 'destinationUnitId', 'required', 'requiresChecklist', 'requiresAttachment', 'observation', 'color', 'icon', 'checklistQuestions'],
      },
    },
    rationale: { type: 'string', description: 'Resumo curto, em português, das decisões tomadas.' },
  },
  required: ['name', 'description', 'categoryId', 'color', 'icon', 'defaultDeadlineDays', 'flowMode', 'fields', 'stages', 'rationale'],
})

function buildPrompt(description: string, catalog: ProtocolTypeAiCatalog) {
  return `Você é especialista em gestão de processos administrativos municipais. Proponha um tipo de processo completo a partir da descrição do usuário.

REGRAS OBRIGATÓRIAS:
- Use somente IDs presentes nos catálogos abaixo. Nunca invente categoria, fase, situação, unidade ou ícone.
- Escolha fases sem repetição e em ordem operacional realista.
- Para fluxo NONE, retorne stages vazio. Para SUGGESTED ou REQUIRED, retorne ao menos uma etapa.
- O campo fields.arquivos controla se o processo aceita documentos e anexos.
- Se requiresChecklist for true, crie perguntas objetivas; caso contrário, checklistQuestions deve ser vazio.
- Se requiresAttachment for true, fields.arquivos também deve ser true.
- Mantenha fields.assunto habilitado quando houver fluxo.
- Prefira fluxo REQUIRED quando a sequência não puder ser livre e SUGGESTED quando servir apenas como orientação.
- Textos devem estar em português do Brasil e usar linguagem administrativa clara.

DESCRIÇÃO DO USUÁRIO:
${description.trim()}

CATÁLOGOS ATIVOS:
Categorias: ${JSON.stringify(catalog.categories)}
Fases: ${JSON.stringify(catalog.phases)}
Situações: ${JSON.stringify(catalog.situations)}
Unidades: ${JSON.stringify(catalog.units)}
Ícones: ${JSON.stringify(catalog.icons)}`
}

function validateReferences(proposal: z.infer<typeof proposalSchema>, catalog: ProtocolTypeAiCatalog): ProtocolTypeAiProposal {
  const categoryIds = new Set(catalog.categories.map((item) => item.id))
  const phaseIds = new Set(catalog.phases.map((item) => item.id))
  const situationIds = new Set(catalog.situations.map((item) => item.id))
  const unitIds = new Set(catalog.units.map((item) => item.id))
  const icons = new Set(catalog.icons.map((item) => item.value))
  if (!proposal.categoryId || !categoryIds.has(proposal.categoryId)) throw new Error('A IA precisa retornar uma categoria ativa existente. Gere a proposta novamente.')
  if (!icons.has(proposal.icon) || proposal.stages.some((stage) => !icons.has(stage.icon))) throw new Error('A IA retornou um ícone não disponível. Gere a proposta novamente.')
  if (proposal.stages.some((stage) => !phaseIds.has(stage.phaseId) || !situationIds.has(stage.situationTypeId) || (stage.destinationUnitId && !unitIds.has(stage.destinationUnitId)))) throw new Error('A IA retornou uma fase, situação ou unidade inválida. Gere a proposta novamente.')
  if (new Set(proposal.stages.map((stage) => stage.phaseId)).size !== proposal.stages.length) throw new Error('A IA repetiu uma fase no fluxo. Gere a proposta novamente.')
  if (proposal.flowMode === 'NONE' && proposal.stages.length) throw new Error('A proposta de fluxo livre retornou etapas. Gere a proposta novamente.')
  if (proposal.flowMode !== 'NONE' && !proposal.stages.length) throw new Error('A proposta de fluxo não retornou etapas. Gere a proposta novamente.')
  if (proposal.flowMode !== 'NONE' && !proposal.fields.assunto) throw new Error('A proposta de fluxo precisa manter o campo assunto habilitado.')
  if (proposal.stages.some((stage) => stage.requiresChecklist && !stage.checklistQuestions.length)) throw new Error('Uma etapa exige checklist, mas não possui perguntas.')
  if (proposal.stages.some((stage) => stage.requiresAttachment) && !proposal.fields.arquivos) throw new Error('Uma etapa exige anexo, mas o tipo não habilitou arquivos.')

  return {
    ...proposal,
    categoryId: proposal.categoryId,
    defaultDeadlineDays: proposal.defaultDeadlineDays ?? undefined,
    stages: proposal.stages.map((stage) => ({ ...stage, destinationUnitId: stage.destinationUnitId || undefined, observation: stage.observation.trim() || undefined })),
  }
}

export async function generateProtocolTypeProposal(description: string, catalog: ProtocolTypeAiCatalog, options: GenerateOptions = {}): Promise<ProtocolTypeAiProposal> {
  if (description.trim().length < 30) throw new Error('Descreva o processo com pelo menos 30 caracteres para gerar uma proposta útil.')
  if (!catalog.categories.length || !catalog.phases.length || !catalog.situations.length || !catalog.icons.length) throw new Error('Cadastre categorias, fases e situações ativas antes de usar a criação com IA.')

  const apiKey = (options.apiKey ?? import.meta.env.VITE_GEMINI_API_KEY ?? '').trim()
  const model = (options.model ?? import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-3.8-flash').trim()
  if (!apiKey) throw new Error('Configure VITE_GEMINI_API_KEY no arquivo .env e reinicie o sistema.')

  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(description, catalog) }] }],
      generationConfig: { temperature: 0.2, responseFormat: { text: { mimeType: 'application/json', schema: objectSchema(catalog) } } },
    }),
  })

  const body = await response.json().catch(() => undefined) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | undefined
  if (!response.ok) throw new Error(body?.error?.message ? `Gemini: ${body.error.message}` : 'Não foi possível gerar a proposta com o Gemini.')
  const text = body?.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? '').join('').trim()
  if (!text) throw new Error('O Gemini não retornou uma proposta. Tente detalhar melhor o processo.')

  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('O Gemini retornou uma resposta inválida. Gere a proposta novamente.') }
  const parsed = proposalSchema.safeParse(json)
  if (!parsed.success) throw new Error('A proposta do Gemini não atende ao formato esperado. Gere novamente.')
  return validateReferences(parsed.data, catalog)
}
