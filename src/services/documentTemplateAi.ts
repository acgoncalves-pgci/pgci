import { invalidTemplateVariables, templateVariables } from '../lib/documentTemplate'

export async function generateDocumentTemplate(description: string): Promise<string> {
  if (description.trim().length < 20) throw new Error('Descreva o modelo com pelo menos 20 caracteres.')
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim()
  const model = (import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-3.8-flash').trim()
  if (!apiKey) throw new Error('Configure VITE_GEMINI_API_KEY no arquivo .env e reinicie o sistema.')
  const variables = templateVariables.flatMap((group) => group.items.map((item) => `{{${item.key}}}`)).join(', ')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Redija somente o corpo de um modelo de documento administrativo em português do Brasil a partir do pedido abaixo. Use parágrafos em texto simples separados por linhas em branco. Não use Markdown, HTML, negrito automático, dados fictícios, explicações ou cercas de código. Se precisar de dados dinâmicos, use APENAS estas variáveis exatamente como escritas: ${variables}. Pedido: ${description.trim()}` }] }],
      generationConfig: { temperature: 0.3 },
    }),
  })
  const result = await response.json().catch(() => undefined) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | undefined
  if (!response.ok) throw new Error(result?.error?.message ? `Gemini: ${result.error.message}` : 'Não foi possível gerar o modelo.')
  const text = result?.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? '').join('').trim()
  if (!text) throw new Error('A IA não retornou texto. Descreva o modelo com mais detalhes.')
  const invalid = invalidTemplateVariables(text)
  if (invalid.length) throw new Error(`A IA retornou variáveis desconhecidas: ${invalid.join(', ')}. Gere novamente.`)
  const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
  return text.split(/\n\s*\n/).map((paragraph) => `<p>${escape(paragraph.trim()).replace(/\n/g, '<br>')}</p>`).join('')
}
