import type { AccessProfile, Database, ProcessFileType } from '../domain/model'
import { defaultPermissions, defaultProfiles } from '../domain/permissions'

export function seedAccessProfiles(): AccessProfile[] {
  return [
    ...defaultProfiles(),
    { id: 'profile-reception', name: 'Atendimento e protocolo', description: 'Recebe demandas e redige documentos. Não permite excluir registros.', isAdmin: false, permissions: defaultPermissions('OPERADOR').filter((permission) => !['documents.delete', 'attachments.delete', 'audit.view'].includes(permission)) },
    { id: 'profile-financial', name: 'Gestão financeira', description: 'Movimentação, documentos e relatórios financeiros na unidade vinculada.', isAdmin: false, permissions: [...defaultPermissions('GESTOR'), 'processes.edit', 'audit.view'] },
    { id: 'profile-control', name: 'Controle e transparência', description: 'Consulta de processos, exportação de relatórios e auditoria, sem movimentação.', isAdmin: false, permissions: [...defaultPermissions('LEITOR'), 'reports.export', 'reports.productivity', 'audit.view'] },
  ]
}

const fileDefinition = (typeId: string, key: string, name: string, extensions: string[], retentionYears: ProcessFileType['retentionYears'], observation: string, color: string, icon: string): ProcessFileType => ({ id: `file-${typeId}-${key}`, name, extensions, retentionYears, observation, color, icon })

export function seedFileTypes(typeId: string): ProcessFileType[] {
  const make = (key: string, name: string, extensions: string[], retention: ProcessFileType['retentionYears'], observation: string, color = '#17628B', icon = 'Paperclip') => fileDefinition(typeId, key, name, extensions, retention, observation, color, icon)
  const base = make('support', 'Documentação de apoio', ['pdf', 'png', 'jpg', 'jpeg', 'txt'], null, 'Documentos de instrução e evidências da demanda. Retenção ilustrativa, sem eliminação automática.')
  if (['pt-pay', 'pt-expense-reimbursement'].includes(typeId)) return [
    make('invoice', 'Nota fiscal e comprovantes', ['pdf'], 4, 'Comprovante fiscal, atesto e comprovante do pagamento.', '#15803D', 'Receipt'),
    make('spreadsheet', 'Memória de cálculo', ['xls', 'xlsx'], 4, 'Planilhas para conferência do valor e da liquidação.', '#2E7D32', 'Sheet'),
  ]
  if (['pt-contract', 'pt-legal-opinion'].includes(typeId)) return [
    make('legal', 'Contrato, certidões e parecer', ['pdf'], null, 'Instrumentos e manifestações que integram os autos.', '#9B3E48', 'Scale'),
    make('draft', 'Minuta editável', ['doc', 'docx'], 3, 'Minuta de trabalho; a versão final deverá ser anexada em PDF.', '#7C4D99', 'FilePenLine'),
  ]
  if (typeId === 'pt-purchase-request') return [
    make('purchase', 'Requisição, propostas e termo de referência', ['pdf', 'doc', 'docx'], null, 'Documentos da formalização e instrução da compra.', '#9A6700', 'ClipboardPen'),
    make('prices', 'Pesquisa de preços', ['xls', 'xlsx', 'pdf'], 4, 'Mapa comparativo das propostas consultadas.', '#0F766E', 'Sheet'),
  ]
  if (typeId === 'pt-general-correspondence') return [base, make('bundle', 'Documentos consolidados', ['zip', 'rar'], 2, 'Conjunto de documentos recebido de outra unidade.')]
  return [base]
}

export function seedTemplates(documentTypes: Database['documentTypes'], createdAt: string): Database['documentTemplates'] {
  const sections: Record<string, string> = {
    'dt-oficio': '<p>À(ao) {{nome_destinatario}},</p><p>Encaminhamos as informações referentes ao processo {{numero_protocolo}}, sobre {{assunto_protocolo}}, para conhecimento e providências.</p>',
    'dt-memo': '<p>À unidade responsável,</p><p>Solicitamos as providências relativas a {{assunto_protocolo}}, conforme a necessidade registrada no processo {{numero_protocolo}}.</p>',
    'dt-parecer': '<h2>Relatório</h2><p>Demanda: {{assunto_protocolo}}.</p><h2>Análise técnica</h2><p>Registre os documentos conferidos e os critérios utilizados.</p><h2>Conclusão</h2><p>Registre o resultado e as providências recomendadas.</p>',
    'dt-despacho': '<p>Considerando a instrução do processo {{numero_protocolo}}, encaminhe-se à unidade competente para análise e manifestação sobre {{assunto_protocolo}}.</p>',
    'dt-purchase-request': '<h2>Justificativa</h2><p>Necessidade: {{assunto_protocolo}}.</p><h2>Objeto e quantitativos</h2><p>Descreva os itens, as quantidades e a unidade de fornecimento.</p><h2>Prazo e local de entrega</h2><p>Informe as condições de atendimento da demanda.</p>',
    'dt-reference-term': '<h2>Objeto</h2><p>{{assunto_protocolo}}</p><h2>Especificações e aceitação</h2><p>Informe os requisitos técnicos, a quantidade e os critérios de recebimento.</p><h2>Execução</h2><p>Informe o prazo, o local e as responsabilidades de acompanhamento.</p>',
    'dt-price-map': '<h2>Pesquisa de preços</h2><p>Processo {{numero_protocolo}} — {{assunto_protocolo}}.</p><p>Registre as fontes, datas, valores unitários e o critério de comparação das propostas.</p>',
    'dt-budget-reservation': '<h2>Disponibilidade orçamentária</h2><p>Processo {{numero_protocolo}}.</p><p>Registre a dotação, a fonte de recursos, o saldo disponível e o valor reservado.</p>',
    'dt-invoice': '<h2>Conferência de documento fiscal</h2><p>Processo {{numero_protocolo}} — {{assunto_protocolo}}.</p><p>Registre o fornecedor, a nota fiscal, a competência, o valor e o atesto do recebimento.</p>',
    'dt-payment-order': '<h2>Ordem de pagamento</h2><p>Processo {{numero_protocolo}}.</p><p>Registre o credor, o empenho, o valor autorizado e a data prevista para pagamento.</p>',
    'dt-legal-opinion': '<h2>Relatório</h2><p>Consulta: {{assunto_protocolo}}.</p><h2>Fundamentação</h2><p>Registre os fundamentos e a análise dos documentos dos autos.</p><h2>Conclusão</h2><p>Registre a orientação e as condições necessárias ao prosseguimento.</p>',
    'dt-official-letter': '<p>À(ao) {{nome_destinatario}},</p><p>Em resposta ao processo {{numero_protocolo}}, referente a {{assunto_protocolo}}, informamos as providências adotadas pela unidade responsável.</p>',
  }
  return documentTypes.map((type) => ({
    id: `template-${type.id}-default`, typeId: type.id, name: `Modelo padrão de ${type.name}`, subject: type.name,
    description: `Modelo de ${type.name.toLocaleLowerCase('pt-BR')} com dados automáticos da entidade, autor e processo.`,
    body: `<h1 style="text-align:center">{{tipo_documento}} Nº {{numero_documento}}</h1><p><strong>Assunto:</strong> {{assunto_documento}}</p>${sections[type.id]}<p>{{nome_entidade}}, {{data_extenso}}.</p><p style="text-align:center">{{nome_autor}}<br>{{cargo_autor}}</p>`,
    isDefault: true, active: true, createdAt, updatedAt: createdAt,
  }))
}
