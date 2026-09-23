import type { AppDocument, Assignment, Database, FieldsConfig, Protocol, ProtocolEvent, ProtocolStatus } from '../domain/model';
import { isoDaysFromNow } from '../lib/format';
import { systemSituationTypes } from '../domain/situations';
import { defaultProcessCategories } from '../domain/processCategories';
const blank: FieldsConfig = { interested: { enabled: false, required: false }, creditor: { enabled: false, required: false }, amount: { enabled: false, required: false } };
const interested: FieldsConfig = { ...blank, interested: { enabled: true, required: true } };
const interestedWithResponsible: FieldsConfig = { ...interested, responsavel: { enabled: true, required: true }, assunto: { enabled: true, required: true } };
const payment: FieldsConfig = { interested: { enabled: true, required: true }, creditor: { enabled: true, required: true }, amount: { enabled: true, required: true } };
const now = () => new Date().toISOString();
const catalogStartedAt = '2026-01-02T11:00:00.000Z';
const uid = (prefix: string, n: number) => `${prefix}-${n}`;
const pick = <T>(items: readonly T[], index: number) => items[Math.abs(index) % items.length];
export type SeedOptions = { variation?: number };
export function seedDatabase(options: SeedOptions = {}): Database {
    const variation = Math.abs(Math.trunc(options.variation ?? 0));
    const units = [
        { id: 'u-prot', name: 'Gestão de Processos', abbreviation: 'GP', position: 0, active: true },
        { id: 'u-adm', name: 'Administração', abbreviation: 'ADM', position: 1, active: true },
        { id: 'u-fin', name: 'Financeiro', abbreviation: 'FIN', parentId: 'u-adm', position: 0, active: true },
        { id: 'u-jur', name: 'Jurídico', abbreviation: 'JUR', position: 2, active: true },
        { id: 'u-edu', name: 'Educação', abbreviation: 'EDU', position: 3, active: true }
    ];
    const users: Database['users'] = [
        { id: 'usr-admin', name: 'Marina Duarte', email: 'marina.duarte@example.com', role: 'ADMIN' as const, unitId: 'u-prot', active: true },
        { id: 'usr-clara', name: 'Clara Nunes', email: 'clara.nunes@example.com', role: 'OPERADOR' as const, unitId: 'u-prot', active: true },
        { id: 'usr-bruno', name: 'Bruno Lima', email: 'bruno.lima@example.com', role: 'OPERADOR' as const, unitId: 'u-adm', active: true },
        { id: 'usr-rafael', name: 'Rafael Reis', email: 'rafael.reis@example.com', role: 'OPERADOR' as const, unitId: 'u-fin', active: true },
        { id: 'usr-luisa', name: 'Luísa Azevedo', email: 'luisa.azevedo@example.com', role: 'OPERADOR' as const, unitId: 'u-jur', active: true },
        { id: 'usr-joana', name: 'Joana Melo', email: 'joana.melo@example.com', role: 'OPERADOR' as const, unitId: 'u-edu', active: true }
    ];
    const memberships: Database['memberships'] = users.flatMap((user) => {
        const linkedUnits = user.role === 'ADMIN'
            ? units.filter((unit) => unit.active)
            : units.filter((unit) => unit.id === user.unitId);
        return linkedUnits.map((unit) => ({
            id: 'membership-' + user.id + '-' + unit.id,
            userId: user.id,
            unitId: unit.id,
            role: user.role,
            title: user.role === 'ADMIN' ? 'Administrador geral' : 'Operador',
            startsAt: now(),
            active: true,
        }));
    });
    memberships.push({
        id: 'membership-usr-joana-u-adm',
        userId: 'usr-joana',
        unitId: 'u-adm',
        role: 'GESTOR',
        title: 'Apoio à gestão administrativa',
        startsAt: now(),
        active: true,
    });
    const auditEvents: Database['auditEvents'] = [];
    const people: Database['people'] = [
        ['p-1', 'PF', 'Ana Beatriz Costa', ['INTERESSADO', 'RESPONSAVEL']], ['p-2', 'PF', 'Caio Mendes', ['INTERESSADO']], ['p-3', 'PF', 'Fernanda Alves', ['INTERESSADO']], ['p-4', 'PF', 'Igor Rocha', ['INTERESSADO', 'RESPONSAVEL']], ['p-5', 'PF', 'Sofia Martins', ['INTERESSADO']], ['p-6', 'PF', 'Vitor Ramos', ['INTERESSADO']],
        ['p-7', 'PJ', 'Papelaria Horizonte Ltda.', ['CREDOR']], ['p-8', 'PJ', 'Construtora Boa Obra S.A.', ['CREDOR']], ['p-9', 'PJ', 'Água Clara Serviços Ltda.', ['CREDOR']], ['p-10', 'PJ', 'Editora Escola Viva Ltda.', ['CREDOR']], ['p-11', 'PJ', 'Tecnologia Cívica Ltda.', ['CREDOR']], ['p-12', 'PF', 'Helena Duarte', ['INTERESSADO', 'CREDOR']]
    ].map(([id, kind, name, roles]) => ({ id: id as string, kind: kind as 'PF' | 'PJ', name: name as string, roles: roles as ('INTERESSADO' | 'CREDOR' | 'RESPONSAVEL')[], responsibilityPeriods: (roles as string[]).includes('RESPONSAVEL') ? [{ id: 'responsibility-' + id, description: 'Administração municipal', startsAt: '2026-01-01' }] : [], active: true, email: `${String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '.')}@example.com` }));
    const processCategories: Database['processCategories'] = [
        ...defaultProcessCategories(),
        { id: 'category-purchases', code: '03', name: 'Compras e Contratações', color: '#9A6700', icon: 'Store', observation: 'Aquisições, contratações e gestão do fornecimento municipal.', active: true },
        { id: 'category-people', code: '04', name: 'Gestão de Pessoas', color: '#7C4D99', icon: 'Users', observation: 'Demandas funcionais dos servidores municipais.', active: true },
        { id: 'category-finance', code: '05', name: 'Finanças Públicas', color: '#2E7D32', icon: 'CircleDollarSign', observation: 'Liquidação, pagamento, ressarcimento e execução orçamentária.', active: true },
        { id: 'category-legal', code: '06', name: 'Assuntos Jurídicos', color: '#9B3E48', icon: 'Scale', observation: 'Análises, pareceres e decisões jurídicas.', active: true },
    ];
    const phases: Database['phases'] = [
        { id: 'phase-triage', name: 'Triagem', code: 'TRIAGEM', description: 'Conferência inicial, classificação e definição do destino.', eligibleUnitIds: [], defaultDeadlineDays: 1, checklistItems: ['Conferir dados de abertura'], checklistQuestions: [{ id: 'q-triage-data', text: 'Conferir dados de abertura', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }], requiredAttachmentTypes: [], color: '#F59E0B', icon: 'ClipboardCheck', active: true },
        { id: 'phase-analysis', name: 'Análise', code: 'ANALISE', description: 'Tratamento técnico pela unidade responsável.', eligibleUnitIds: [], defaultDeadlineDays: 5, checklistItems: ['Registrar despacho ou resultado'], checklistQuestions: [{ id: 'q-analysis-result', text: 'Registrar despacho ou resultado', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false }], requiredAttachmentTypes: [], color: '#2563EB', icon: 'FileSearch', active: true },
        { id: 'phase-completion', name: 'Conclusão', code: 'CONCLUSAO', description: 'Registro do resultado, comunicação e encerramento.', eligibleUnitIds: [], defaultDeadlineDays: 2, checklistItems: ['Registrar resultado final'], checklistQuestions: [{ id: 'q-completion-result', text: 'Registrar resultado final', order: 1, required: true, requiresAttachment: false, requiresDate: true, requiresObservation: true }], requiredAttachmentTypes: [], color: '#16A66A', icon: 'CircleCheck', active: true },
        { id: 'phase-demand-formalization', name: 'Formalização da demanda', code: 'FORMALIZACAO-DEMANDA', description: 'Definição do objeto, quantidade, justificativa e responsável pela solicitação.', eligibleUnitIds: ['u-adm', 'u-edu'], defaultDeadlineDays: 2, checklistItems: ['Confirmar justificativa da compra', 'Validar quantitativos', 'Anexar termo de referência'], checklistQuestions: [
            { id: 'q-purchase-justification', text: 'Confirmar justificativa e interesse público da compra', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true },
            { id: 'q-purchase-quantity', text: 'Validar especificações e quantitativos solicitados', order: 2, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false },
            { id: 'q-purchase-reference', text: 'Anexar termo de referência ou descrição técnica', order: 3, required: true, requiresAttachment: true, requiresDate: false, requiresObservation: false },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#9A6700', icon: 'ClipboardPen', active: true },
        { id: 'phase-budget-availability', name: 'Disponibilidade orçamentária', code: 'DOTACAO-ORCAMENTARIA', description: 'Verificação de saldo, classificação da despesa e reserva orçamentária.', eligibleUnitIds: ['u-fin'], defaultDeadlineDays: 3, checklistItems: ['Conferir dotação', 'Registrar saldo disponível'], checklistQuestions: [
            { id: 'q-budget-classification', text: 'Conferir classificação e dotação orçamentária', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true },
            { id: 'q-budget-balance', text: 'Registrar disponibilidade de saldo', order: 2, required: true, requiresAttachment: true, requiresDate: true, requiresObservation: true },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#2E7D32', icon: 'CircleDollarSign', active: true },
        { id: 'phase-purchase-instruction', name: 'Instrução da compra', code: 'INSTRUCAO-COMPRA', description: 'Pesquisa de preços, conferência documental e definição do procedimento.', eligibleUnitIds: ['u-adm'], defaultDeadlineDays: 5, checklistItems: ['Realizar pesquisa de preços', 'Conferir propostas'], checklistQuestions: [
            { id: 'q-purchase-quotes', text: 'Registrar pesquisa de preços compatível com o objeto', order: 1, required: true, requiresAttachment: true, requiresDate: true, requiresObservation: true },
            { id: 'q-purchase-supplier', text: 'Conferir proposta e regularidade do fornecedor indicado', order: 2, required: true, requiresAttachment: true, requiresDate: false, requiresObservation: true },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#0F766E', icon: 'ScanSearch', active: true },
        { id: 'phase-purchase-authorization', name: 'Autorização da compra', code: 'AUTORIZACAO-COMPRA', description: 'Decisão da autoridade competente sobre a aquisição.', eligibleUnitIds: ['u-adm'], defaultDeadlineDays: 2, checklistItems: ['Registrar decisão'], checklistQuestions: [{ id: 'q-purchase-authorization', text: 'Registrar autorização e condições da compra', order: 1, required: true, requiresAttachment: false, requiresDate: true, requiresObservation: true }], requiredAttachmentTypes: [], color: '#7C3AED', icon: 'Gavel', active: true },
        { id: 'phase-delivery-verification', name: 'Recebimento e conferência', code: 'RECEBIMENTO-COMPRA', description: 'Conferência do material ou serviço e registro do aceite.', eligibleUnitIds: ['u-prot', 'u-adm', 'u-edu'], defaultDeadlineDays: 5, checklistItems: ['Conferir entrega', 'Registrar aceite'], checklistQuestions: [
            { id: 'q-delivery-received', text: 'Conferir item, quantidade e condição de entrega', order: 1, required: true, requiresAttachment: false, requiresDate: true, requiresObservation: true },
            { id: 'q-delivery-invoice', text: 'Anexar nota fiscal e atesto de recebimento', order: 2, required: true, requiresAttachment: true, requiresDate: false, requiresObservation: false },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#0369A1', icon: 'FileCheck2', active: true },
        { id: 'phase-citizen-screening', name: 'Admissibilidade', code: 'ADMISSIBILIDADE', description: 'Validação da identificação, competência e documentos apresentados.', eligibleUnitIds: ['u-prot'], defaultDeadlineDays: 2, checklistItems: ['Validar identificação', 'Confirmar competência'], checklistQuestions: [
            { id: 'q-citizen-identification', text: 'Validar identificação e meios de contato do interessado', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: false },
            { id: 'q-citizen-jurisdiction', text: 'Confirmar competência da unidade de destino', order: 2, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true },
        ], requiredAttachmentTypes: [], color: '#0284C7', icon: 'Contact', active: true },
        { id: 'phase-sector-response', name: 'Resposta da unidade', code: 'RESPOSTA-UNIDADE', description: 'Apuração das informações e elaboração da resposta ao interessado.', eligibleUnitIds: ['u-adm', 'u-jur', 'u-edu'], defaultDeadlineDays: 10, checklistItems: ['Apurar demanda', 'Elaborar resposta'], checklistQuestions: [
            { id: 'q-sector-investigation', text: 'Registrar providências e fontes consultadas', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true },
            { id: 'q-sector-response', text: 'Anexar minuta da resposta ao interessado', order: 2, required: true, requiresAttachment: true, requiresDate: false, requiresObservation: true },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#2563EB', icon: 'MessageSquare', active: true },
        { id: 'phase-payment-review', name: 'Conferência para pagamento', code: 'CONFERENCIA-PAGAMENTO', description: 'Validação do documento fiscal, atesto, contrato e dados do credor.', eligibleUnitIds: ['u-fin'], defaultDeadlineDays: 3, checklistItems: ['Conferir nota fiscal', 'Validar atesto'], checklistQuestions: [
            { id: 'q-payment-invoice', text: 'Conferir nota fiscal e dados bancários do credor', order: 1, required: true, requiresAttachment: true, requiresDate: false, requiresObservation: true },
            { id: 'q-payment-certification', text: 'Validar atesto do fiscal ou responsável pelo recebimento', order: 2, required: true, requiresAttachment: true, requiresDate: true, requiresObservation: false },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#15803D', icon: 'WalletCards', active: true },
        { id: 'phase-payment-settlement', name: 'Liquidação e pagamento', code: 'LIQUIDACAO-PAGAMENTO', description: 'Liquidação da despesa e registro da ordem de pagamento.', eligibleUnitIds: ['u-fin'], defaultDeadlineDays: 3, checklistItems: ['Liquidar despesa', 'Registrar pagamento'], checklistQuestions: [
            { id: 'q-payment-settlement', text: 'Registrar liquidação da despesa', order: 1, required: true, requiresAttachment: true, requiresDate: true, requiresObservation: true },
            { id: 'q-payment-order', text: 'Registrar ordem e data do pagamento', order: 2, required: true, requiresAttachment: true, requiresDate: true, requiresObservation: false },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#166534', icon: 'CircleDollarSign', active: true },
        { id: 'phase-legal-opinion', name: 'Análise jurídica e parecer', code: 'PARECER-JURIDICO', description: 'Análise jurídica e emissão de parecer fundamentado.', eligibleUnitIds: ['u-jur'], defaultDeadlineDays: 8, checklistItems: ['Analisar documentos', 'Emitir parecer'], checklistQuestions: [
            { id: 'q-legal-documents', text: 'Conferir integridade dos documentos e fundamentos', order: 1, required: true, requiresAttachment: false, requiresDate: false, requiresObservation: true },
            { id: 'q-legal-opinion', text: 'Anexar parecer jurídico conclusivo', order: 2, required: true, requiresAttachment: true, requiresDate: true, requiresObservation: true },
        ], requiredAttachmentTypes: ['application/pdf'], color: '#9B3E48', icon: 'Scale', active: true },
        { id: 'phase-management-decision', name: 'Decisão administrativa', code: 'DECISAO-ADMINISTRATIVA', description: 'Registro da decisão da autoridade competente e providências decorrentes.', eligibleUnitIds: ['u-adm'], defaultDeadlineDays: 3, checklistItems: ['Registrar decisão', 'Definir providências'], checklistQuestions: [
            { id: 'q-management-decision', text: 'Registrar decisão da autoridade competente', order: 1, required: true, requiresAttachment: false, requiresDate: true, requiresObservation: true },
            { id: 'q-management-action', text: 'Definir providências, responsáveis e prazo', order: 2, required: true, requiresAttachment: false, requiresDate: true, requiresObservation: true },
        ], requiredAttachmentTypes: [], color: '#7C3AED', icon: 'Gavel', active: true },
    ];
    const flows: Database['flows'] = [
        { id: 'flow-standard-v1', name: 'Fluxo padrão de processos', version: 1, active: true, startsAt: catalogStartedAt },
        { id: 'flow-purchase-v1', name: 'Fluxo de solicitação de compra', version: 1, active: true, startsAt: catalogStartedAt },
        { id: 'flow-citizen-service-v1', name: 'Fluxo de atendimento ao cidadão', version: 1, active: true, startsAt: catalogStartedAt },
        { id: 'flow-payment-v1', name: 'Fluxo de liquidação e pagamento', version: 1, active: true, startsAt: catalogStartedAt },
        { id: 'flow-legal-v1', name: 'Fluxo de análise jurídica', version: 1, active: true, startsAt: catalogStartedAt },
    ];
    const situations: Database['situations'] = [
        ...systemSituationTypes(),
        { id: 'situation-awaiting-documents', name: 'Aguardando documentação', category: 'EM_TRAMITACAO', color: '#D97706', icon: 'Paperclip', observation: 'Pendente de documentos ou informações complementares.', system: false, active: true },
        { id: 'situation-awaiting-budget', name: 'Aguardando dotação', category: 'EM_TRAMITACAO', color: '#2E7D32', icon: 'CircleDollarSign', observation: 'Em verificação de disponibilidade orçamentária.', system: false, active: true },
        { id: 'situation-technical-analysis', name: 'Em análise técnica', category: 'EM_TRAMITACAO', color: '#2563EB', icon: 'FileSearch', observation: 'Em instrução ou análise técnica pela unidade competente.', system: false, active: true },
        { id: 'situation-legal-analysis', name: 'Em análise jurídica', category: 'EM_TRAMITACAO', color: '#9B3E48', icon: 'Scale', observation: 'Em elaboração de manifestação ou parecer jurídico.', system: false, active: true },
        { id: 'situation-awaiting-authorization', name: 'Aguardando autorização', category: 'EM_TRAMITACAO', color: '#7C3AED', icon: 'Gavel', observation: 'Aguardando decisão da autoridade competente.', system: false, active: true },
        { id: 'situation-awaiting-delivery', name: 'Aguardando entrega', category: 'EM_TRAMITACAO', color: '#0369A1', icon: 'Store', observation: 'Aquisição autorizada e aguardando fornecimento.', system: false, active: true },
        { id: 'situation-awaiting-response', name: 'Aguardando resposta da unidade', category: 'EM_TRAMITACAO', color: '#0284C7', icon: 'MessageSquare', observation: 'Demanda encaminhada para apuração e resposta.', system: false, active: true },
        { id: 'situation-awaiting-payment', name: 'Aguardando pagamento', category: 'EM_TRAMITACAO', color: '#15803D', icon: 'WalletCards', observation: 'Despesa conferida e em processamento financeiro.', system: false, active: true },
    ];
    const stageQuestions = (phaseId: string) => structuredClone(phases.find((phase) => phase.id === phaseId)?.checklistQuestions ?? []);
    const flowPhases: Database['flowPhases'] = [
        { id: 'flow-phase-standard-1', flowId: 'flow-standard-v1', phaseId: 'phase-triage', position: 0, required: true, situationTypeId: 'situation-registered', requiresChecklist: true, checklistQuestions: stageQuestions('phase-triage'), color: '#F59E0B', icon: 'ClipboardCheck' },
        { id: 'flow-phase-standard-2', flowId: 'flow-standard-v1', phaseId: 'phase-analysis', position: 1, required: true, situationTypeId: 'situation-processing', requiresChecklist: true, checklistQuestions: stageQuestions('phase-analysis'), color: '#2563EB', icon: 'FileSearch' },
        { id: 'flow-phase-standard-3', flowId: 'flow-standard-v1', phaseId: 'phase-completion', position: 2, required: true, situationTypeId: 'situation-completed', requiresChecklist: true, checklistQuestions: stageQuestions('phase-completion'), color: '#16A66A', icon: 'CircleCheck' },
        { id: 'flow-phase-purchase-1', flowId: 'flow-purchase-v1', phaseId: 'phase-demand-formalization', position: 0, required: true, situationTypeId: 'situation-registered', destinationUnitId: 'u-adm', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-demand-formalization'), observation: 'Formalize a necessidade antes de encaminhar ao orçamento.', color: '#9A6700', icon: 'ClipboardPen' },
        { id: 'flow-phase-purchase-2', flowId: 'flow-purchase-v1', phaseId: 'phase-budget-availability', position: 1, required: true, situationTypeId: 'situation-awaiting-budget', destinationUnitId: 'u-fin', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-budget-availability'), color: '#2E7D32', icon: 'CircleDollarSign' },
        { id: 'flow-phase-purchase-3', flowId: 'flow-purchase-v1', phaseId: 'phase-purchase-instruction', position: 2, required: true, situationTypeId: 'situation-technical-analysis', destinationUnitId: 'u-adm', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-purchase-instruction'), color: '#0F766E', icon: 'ScanSearch' },
        { id: 'flow-phase-purchase-4', flowId: 'flow-purchase-v1', phaseId: 'phase-purchase-authorization', position: 3, required: true, situationTypeId: 'situation-awaiting-authorization', destinationUnitId: 'u-adm', requiresChecklist: true, checklistQuestions: stageQuestions('phase-purchase-authorization'), color: '#7C3AED', icon: 'Gavel' },
        { id: 'flow-phase-purchase-5', flowId: 'flow-purchase-v1', phaseId: 'phase-delivery-verification', position: 4, required: true, situationTypeId: 'situation-awaiting-delivery', destinationUnitId: 'u-prot', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-delivery-verification'), color: '#0369A1', icon: 'FileCheck2' },
        { id: 'flow-phase-purchase-6', flowId: 'flow-purchase-v1', phaseId: 'phase-completion', position: 5, required: true, situationTypeId: 'situation-completed', destinationUnitId: 'u-prot', requiresChecklist: true, checklistQuestions: stageQuestions('phase-completion'), color: '#16A66A', icon: 'CircleCheck' },
        { id: 'flow-phase-citizen-1', flowId: 'flow-citizen-service-v1', phaseId: 'phase-citizen-screening', position: 0, required: true, situationTypeId: 'situation-registered', destinationUnitId: 'u-prot', requiresChecklist: true, checklistQuestions: stageQuestions('phase-citizen-screening'), color: '#0284C7', icon: 'Contact' },
        { id: 'flow-phase-citizen-2', flowId: 'flow-citizen-service-v1', phaseId: 'phase-sector-response', position: 1, required: true, situationTypeId: 'situation-awaiting-response', destinationUnitId: 'u-adm', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-sector-response'), color: '#2563EB', icon: 'MessageSquare' },
        { id: 'flow-phase-citizen-3', flowId: 'flow-citizen-service-v1', phaseId: 'phase-completion', position: 2, required: true, situationTypeId: 'situation-completed', destinationUnitId: 'u-prot', requiresChecklist: true, checklistQuestions: stageQuestions('phase-completion'), color: '#16A66A', icon: 'CircleCheck' },
        { id: 'flow-phase-payment-1', flowId: 'flow-payment-v1', phaseId: 'phase-payment-review', position: 0, required: true, situationTypeId: 'situation-technical-analysis', destinationUnitId: 'u-fin', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-payment-review'), color: '#15803D', icon: 'WalletCards' },
        { id: 'flow-phase-payment-2', flowId: 'flow-payment-v1', phaseId: 'phase-payment-settlement', position: 1, required: true, situationTypeId: 'situation-awaiting-payment', destinationUnitId: 'u-fin', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-payment-settlement'), color: '#166534', icon: 'CircleDollarSign' },
        { id: 'flow-phase-payment-3', flowId: 'flow-payment-v1', phaseId: 'phase-completion', position: 2, required: true, situationTypeId: 'situation-completed', destinationUnitId: 'u-prot', requiresChecklist: true, checklistQuestions: stageQuestions('phase-completion'), color: '#16A66A', icon: 'CircleCheck' },
        { id: 'flow-phase-legal-1', flowId: 'flow-legal-v1', phaseId: 'phase-analysis', position: 0, required: true, situationTypeId: 'situation-technical-analysis', destinationUnitId: 'u-adm', requiresChecklist: true, checklistQuestions: stageQuestions('phase-analysis'), color: '#2563EB', icon: 'FileSearch' },
        { id: 'flow-phase-legal-2', flowId: 'flow-legal-v1', phaseId: 'phase-legal-opinion', position: 1, required: true, situationTypeId: 'situation-legal-analysis', destinationUnitId: 'u-jur', requiresChecklist: true, requiresAttachment: true, checklistQuestions: stageQuestions('phase-legal-opinion'), color: '#9B3E48', icon: 'Scale' },
        { id: 'flow-phase-legal-3', flowId: 'flow-legal-v1', phaseId: 'phase-management-decision', position: 2, required: true, situationTypeId: 'situation-awaiting-authorization', destinationUnitId: 'u-adm', requiresChecklist: true, checklistQuestions: stageQuestions('phase-management-decision'), color: '#7C3AED', icon: 'Gavel' },
        { id: 'flow-phase-legal-4', flowId: 'flow-legal-v1', phaseId: 'phase-completion', position: 3, required: true, situationTypeId: 'situation-completed', destinationUnitId: 'u-prot', requiresChecklist: true, checklistQuestions: stageQuestions('phase-completion'), color: '#16A66A', icon: 'CircleCheck' },
    ];
    const protocolTypes: Database['protocolTypes'] = [
        { id: 'pt-admin', categoryId: 'category-administrative', name: 'Solicitação administrativa', description: 'Demandas internas gerais que exigem triagem, análise e conclusão.', color: '#17628B', icon: 'FileText', defaultDeadlineDays: 7, fieldsConfig: { ...interested, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true } }, flowId: 'flow-standard-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-buy', categoryId: 'category-administrative', name: 'Compra de material', description: 'Tipo legado para aquisições simples já abertas na demonstração.', color: '#8B5A17', icon: 'Store', defaultDeadlineDays: 10, fieldsConfig: { ...interested, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true }, biddingNumber: { enabled: true } }, flowId: 'flow-standard-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-info', categoryId: 'category-service', name: 'Pedido de informação', description: 'Solicitações de acesso a informações e documentos públicos.', color: '#3D6F54', icon: 'BadgeInfo', defaultDeadlineDays: 20, fieldsConfig: { ...interestedWithResponsible, tramitacao: { enabled: true }, arquivos: { enabled: true }, portal: { enabled: true } }, flowId: 'flow-standard-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-serv', categoryId: 'category-people', name: 'Requerimento de servidor', description: 'Férias, licenças, certidões e demais requerimentos funcionais.', color: '#7C4D99', icon: 'BriefcaseBusiness', defaultDeadlineDays: 15, fieldsConfig: { ...interested, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true } }, flowId: 'flow-standard-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-contract', categoryId: 'category-legal', name: 'Análise de contrato', description: 'Análise administrativa e jurídica de contratos, aditivos e convênios.', color: '#9B3E48', icon: 'Scale', defaultDeadlineDays: 10, fieldsConfig: { ...interested, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true }, contractNumber: { enabled: true, required: true }, biddingNumber: { enabled: true }, legalProcessNumber: { enabled: true } }, flowId: 'flow-standard-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-pay', categoryId: 'category-finance', name: 'Pagamento de fornecedor', description: 'Conferência e liquidação de obrigações com fornecedores.', color: '#7A6618', icon: 'WalletCards', defaultDeadlineDays: 5, fieldsConfig: { ...payment, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true }, contractNumber: { enabled: true }, biddingNumber: { enabled: true }, referenceNumber: { enabled: true } }, flowId: 'flow-standard-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-purchase-request', categoryId: 'category-purchases', name: 'Solicitação de compra', description: 'Formalização completa de aquisição, da necessidade ao recebimento.', color: '#9A6700', icon: 'Store', defaultDeadlineDays: 20, fieldsConfig: { interested: { enabled: true, required: true }, creditor: { enabled: true, required: false }, amount: { enabled: true, required: false }, tramitacao: { enabled: true, required: true }, responsavel: { enabled: true, required: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true, required: true }, contractNumber: { enabled: true }, biddingNumber: { enabled: true }, portal: { enabled: false } }, flowId: 'flow-purchase-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-citizen-service', categoryId: 'category-service', name: 'Solicitação de serviço ao cidadão', description: 'Pedidos de manutenção urbana, iluminação, limpeza e serviços municipais.', color: '#0284C7', icon: 'HeartHandshake', defaultDeadlineDays: 15, fieldsConfig: { ...interestedWithResponsible, tramitacao: { enabled: true }, arquivos: { enabled: true }, portal: { enabled: true } }, flowId: 'flow-citizen-service-v1', flowMode: 'SUGGESTED', active: true },
        { id: 'pt-expense-reimbursement', categoryId: 'category-finance', name: 'Ressarcimento de despesa', description: 'Análise de comprovantes, liquidação e pagamento de ressarcimentos.', color: '#15803D', icon: 'CircleDollarSign', defaultDeadlineDays: 10, fieldsConfig: { ...payment, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true, required: true }, referenceNumber: { enabled: true } }, flowId: 'flow-payment-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-legal-opinion', categoryId: 'category-legal', name: 'Consulta e parecer jurídico', description: 'Consulta formal com análise técnica, parecer e decisão administrativa.', color: '#9B3E48', icon: 'Scale', defaultDeadlineDays: 15, fieldsConfig: { ...interestedWithResponsible, tramitacao: { enabled: true }, arquivos: { enabled: true, required: true }, legalProcessNumber: { enabled: true, required: true } }, flowId: 'flow-legal-v1', flowMode: 'REQUIRED', active: true },
        { id: 'pt-general-correspondence', categoryId: 'category-administrative', name: 'Correspondência administrativa', description: 'Expedientes avulsos sem roteiro obrigatório, com fase e destino definidos na tramitação.', color: '#64748B', icon: 'Mail', defaultDeadlineDays: 7, fieldsConfig: { ...interested, tramitacao: { enabled: true }, assunto: { enabled: true, required: true }, arquivos: { enabled: true }, referenceNumber: { enabled: true } }, flowMode: 'NONE', active: true },
    ];
    const documentTypes: Database['documentTypes'] = [
        { id: 'dt-oficio', name: 'Ofício', description: 'Comunicação oficial externa.', color: '#17628B', active: true },
        { id: 'dt-memo', name: 'Memorando', description: 'Comunicação interna entre unidades.', color: '#3D6F54', active: true },
        { id: 'dt-parecer', name: 'Parecer', description: 'Manifestação técnica conclusiva.', color: '#7C4D99', active: true },
        { id: 'dt-despacho', name: 'Despacho', description: 'Registro de decisão ou encaminhamento.', color: '#8B5A17', active: true },
        { id: 'dt-purchase-request', name: 'Requisição de compra', description: 'Formalização da necessidade de aquisição.', color: '#9A6700', active: true },
        { id: 'dt-reference-term', name: 'Termo de referência', description: 'Especificação do objeto, requisitos e condições.', color: '#0F766E', active: true },
        { id: 'dt-price-map', name: 'Mapa comparativo de preços', description: 'Consolidação da pesquisa de preços.', color: '#0369A1', active: true },
        { id: 'dt-budget-reservation', name: 'Reserva orçamentária', description: 'Comprovação da disponibilidade de dotação.', color: '#2E7D32', active: true },
        { id: 'dt-invoice', name: 'Nota fiscal', description: 'Documento fiscal apresentado pelo fornecedor.', color: '#15803D', active: true },
        { id: 'dt-payment-order', name: 'Ordem de pagamento', description: 'Registro da autorização financeira do pagamento.', color: '#166534', active: true },
        { id: 'dt-legal-opinion', name: 'Parecer jurídico', description: 'Manifestação jurídica fundamentada.', color: '#9B3E48', active: true },
        { id: 'dt-official-letter', name: 'Resposta oficial', description: 'Resposta formal encaminhada ao interessado.', color: '#0284C7', active: true },
    ];
    const documentTemplates: Database['documentTemplates'] = documentTypes.map((type) => ({
        id: `template-${type.id}-default`,
        typeId: type.id,
        name: `Modelo padrão de ${type.name}`,
        subject: type.name,
        body: `<p>À(ao) {{destinatario}},</p><p>Em referência ao processo <strong>{{numero_processo}}</strong>, apresentamos o documento sobre <strong>{{assunto_processo}}</strong>.</p><p><br></p><p>Atenciosamente,</p><p>{{usuario}}</p>`,
        active: true,
        createdAt: catalogStartedAt,
        updatedAt: catalogStartedAt,
    }));
    const flowSnapshotFor = (type: Database['protocolTypes'][number]) => {
        if (!type.flowId || type.flowMode === 'NONE') return undefined;
        const flow = flows.find((item) => item.id === type.flowId)!;
        return {
            flowId: flow.id,
            flowName: flow.name,
            version: flow.version,
            phases: flowPhases.filter((stage) => stage.flowId === flow.id).sort((left, right) => left.position - right.position).map((stage) => {
                const phase = phases.find((item) => item.id === stage.phaseId)!;
                const situation = situations.find((item) => item.id === stage.situationTypeId);
                const checklistQuestions = structuredClone(stage.checklistQuestions?.length ? stage.checklistQuestions : phase.checklistQuestions ?? []);
                return { phaseId: phase.id, name: phase.name, code: phase.code, position: stage.position, required: stage.required, eligibleUnitIds: phase.eligibleUnitIds, checklistItems: checklistQuestions.map((question) => question.text), checklistQuestions, requiredAttachmentTypes: phase.requiredAttachmentTypes, situationType: situation ? { id: situation.id, name: situation.name, category: situation.category, color: situation.color, icon: situation.icon } : undefined, destinationUnitId: stage.destinationUnitId, requiresChecklist: stage.requiresChecklist, requiresAttachment: stage.requiresAttachment, observation: stage.observation, color: stage.color, icon: stage.icon };
            }),
        };
    };    const protocols: Protocol[] = [];
    const assignments: Assignment[] = [];
    const events: ProtocolEvent[] = [];
    type DemoProcessInput = { n: number; subject: string; typeId: string; unitId: string; assigneeId?: string; status: ProtocolStatus; dueDays?: number; creator?: string; stagePosition?: number; description?: string };
    const descriptionFor = (typeId: string, subject: string) => {
        const descriptions: Record<string, string> = {
            'pt-admin': `Solicitação administrativa referente a ${subject.toLowerCase()}, com registro das providências e da unidade responsável.`,
            'pt-buy': `Demanda de aquisição simplificada para ${subject.toLowerCase()}, contendo justificativa e necessidade da unidade solicitante.`,
            'pt-info': `Pedido formal de informação sobre ${subject.toLowerCase()}, com identificação do interessado e controle do prazo de resposta.`,
            'pt-serv': `Requerimento funcional referente a ${subject.toLowerCase()}, apresentado para análise da administração municipal.`,
            'pt-contract': `Processo de análise de ${subject.toLowerCase()}, instruído para conferência administrativa e jurídica.`,
            'pt-pay': `Processo de pagamento relativo a ${subject.toLowerCase()}, com conferência do credor, do valor e do documento fiscal.`,
            'pt-purchase-request': `Solicitação de compra para ${subject.toLowerCase()}, desde a formalização da necessidade até a conferência do recebimento.`,
            'pt-citizen-service': `Solicitação apresentada por cidadão sobre ${subject.toLowerCase()}, encaminhada à unidade competente para vistoria e resposta.`,
            'pt-expense-reimbursement': `Pedido de ressarcimento referente a ${subject.toLowerCase()}, acompanhado de comprovantes para liquidação.`,
            'pt-legal-opinion': `Consulta jurídica sobre ${subject.toLowerCase()}, destinada à emissão de parecer e posterior decisão administrativa.`,
            'pt-general-correspondence': `Expediente administrativo sobre ${subject.toLowerCase()}, com fase e destino definidos durante a tramitação.`,
        };
        return descriptions[typeId] ?? `Processo administrativo referente a ${subject.toLowerCase()}.`;
    };
    const add = ({ n, subject, typeId, unitId, assigneeId, status, dueDays, creator = 'usr-clara', stagePosition, description }: DemoProcessInput) => {
        const id = uid('pr', n);
        const assignmentId = uid('as', n);
        const originUnitId = 'u-prot';
        const ageDays = Math.max(n + 1, 3);
        const createdAt = isoDaysFromNow(-ageDays);
        const type = protocolTypes.find((item) => item.id === typeId)!;
        const snapshot = flowSnapshotFor(type);
        const orderedStages = snapshot?.phases ?? [];
        const inferredPosition = status === 'CADASTRADO' ? 0 : status === 'EM_ANDAMENTO' ? 1 : Math.max(orderedStages.length - 1, 0);
        const currentPhaseIndex = orderedStages.length ? Math.min(stagePosition ?? inferredPosition, orderedStages.length - 1) : -1;
        const currentStage = currentPhaseIndex >= 0 ? orderedStages[currentPhaseIndex] : undefined;
        const transferred = unitId !== originUnitId;
        const currentAssignmentStartedAt = isoDaysFromNow(-Math.max(ageDays * 0.22, 0.25));
        const openingAssignmentId = transferred ? `${assignmentId}-origin` : assignmentId;
        const completed = status === 'CONCLUIDO' || status === 'ARQUIVADO';
        const checklistFor = (stage: NonNullable<typeof currentStage>) => {
            if (!stage.requiresChecklist || !stage.checklistQuestions.length) return undefined;
            return stage.checklistQuestions.map((question, index) => {
                const checked = completed || Boolean(assigneeId && n % 2 === 0 && index === 0);
                return {
                    questionId: question.id,
                    text: question.text,
                    checked,
                    date: checked && question.requiresDate ? isoDaysFromNow(-1).slice(0, 10) : undefined,
                    observation: checked && question.requiresObservation ? 'Item conferido pela unidade responsável.' : undefined,
                    attachmentProvided: checked && question.requiresAttachment ? true : undefined,
                };
            });
        };
        protocols.push({
            id,
            number: `2026.${String(n).padStart(6, '0')}`,
            typeId,
            typeConfigSnapshot: structuredClone(type.fieldsConfig),
            flowModeSnapshot: type.flowMode ?? (type.flowId ? 'REQUIRED' : 'NONE'),
            flowSnapshot: snapshot ? structuredClone(snapshot) : undefined,
            currentPhaseId: currentStage?.phaseId,
            subject,
            description: description ?? descriptionFor(typeId, subject),
            interestedPersonId: type.fieldsConfig.interested.enabled ? `p-${(n % 6) + 1}` : undefined,
            creditorPersonId: type.fieldsConfig.creditor.enabled ? `p-${7 + (n % 5)}` : undefined,
            amountCents: type.fieldsConfig.amount.enabled ? pick([248_750, 489_900, 1_275_000, 3_842_500, 7_960_000], variation + n) : undefined,
            contractNumber: type.fieldsConfig.contractNumber?.enabled ? `${String(40 + n).padStart(3, '0')}/2026` : undefined,
            biddingNumber: type.fieldsConfig.biddingNumber?.enabled ? `PE ${String(10 + n).padStart(3, '0')}/2026` : undefined,
            legalProcessNumber: type.fieldsConfig.legalProcessNumber?.enabled ? `PAJ 2026/${String(1000 + n).padStart(5, '0')}` : undefined,
            referenceNumber: type.fieldsConfig.referenceNumber?.enabled ? `REF-${String(n).padStart(4, '0')}/2026` : undefined,
            status,
            originUnitId,
            currentUnitId: unitId,
            currentAssigneeId: assigneeId,
            currentAssignmentId: assignmentId,
            dueAt: dueDays === undefined ? undefined : isoDaysFromNow(dueDays),
            createdById: creator,
            createdAt,
            updatedAt: now(),
            completedAt: completed ? isoDaysFromNow(-2) : undefined,
            archivedAt: status === 'ARQUIVADO' ? isoDaysFromNow(-1) : undefined,
            version: 1,
        });
        if (transferred) {
            assignments.push({
                id: openingAssignmentId,
                protocolId: id,
                unitId: originUnitId,
                assigneeId: creator,
                startedAt: createdAt,
                receivedAt: createdAt,
                receivedById: creator,
                endedAt: currentAssignmentStartedAt,
            });
        }
        assignments.push({
            id: assignmentId,
            protocolId: id,
            unitId,
            assigneeId,
            startedAt: currentAssignmentStartedAt,
            receivedAt: assigneeId ? currentAssignmentStartedAt : undefined,
            receivedById: assigneeId ? assigneeId : undefined,
        });
        events.push({
            id: `ev-open-${n}`,
            protocolId: id,
            kind: 'ABERTURA',
            actorUserId: creator,
            actorUnitId: originUnitId,
            toUnitId: originUnitId,
            toUserId: transferred ? creator : assigneeId,
            assignmentId: openingAssignmentId,
            phaseId: orderedStages[0]?.phaseId,
            nextStatus: 'CADASTRADO',
            createdAt,
        });
        for (let index = 1; index <= currentPhaseIndex; index += 1) {
            const previousStage = orderedStages[index - 1];
            const stage = orderedStages[index];
            const isLast = index === orderedStages.length - 1;
            events.push({
                id: index === 1 ? `ev-phase-analysis-${n}` : isLast ? `ev-phase-completion-${n}` : `ev-phase-${index + 1}-${n}`,
                protocolId: id,
                kind: 'FASE_AVANCADA',
                actorUserId: index === currentPhaseIndex ? assigneeId ?? creator : creator,
                actorUnitId: index === currentPhaseIndex ? unitId : originUnitId,
                assignmentId: index === currentPhaseIndex ? assignmentId : openingAssignmentId,
                phaseId: stage.phaseId,
                message: `${previousStage.name} concluída; processo encaminhado para ${stage.name.toLowerCase()}.`,
                previousStatus: index === 1 ? 'CADASTRADO' : 'EM_ANDAMENTO',
                nextStatus: 'EM_ANDAMENTO',
                createdAt: isoDaysFromNow(-Math.max(ageDays * (0.78 - index * 0.08), 0.5)),
            });
        }
        if (transferred) {
            events.push({
                id: `ev-move-${n}`,
                protocolId: id,
                kind: 'TRAMITACAO',
                actorUserId: creator,
                actorUnitId: originUnitId,
                fromUnitId: originUnitId,
                toUnitId: unitId,
                fromUserId: creator,
                toUserId: assigneeId,
                assignmentId,
                phaseId: currentStage?.phaseId,
                message: `Encaminhado para ${units.find((item) => item.id === unitId)?.name ?? 'a unidade responsável'}${currentStage ? ` — ${currentStage.name}` : ''}.`,
                previousStatus: 'CADASTRADO',
                nextStatus: 'EM_ANDAMENTO',
                checklist: currentStage ? checklistFor(currentStage) : undefined,
                createdAt: currentAssignmentStartedAt,
            });
        }
        if (assigneeId) {
            events.push({
                id: `ev-ack-${n}`,
                protocolId: id,
                kind: 'RECEBIMENTO',
                actorUserId: assigneeId,
                actorUnitId: unitId,
                assignmentId,
                createdAt: currentAssignmentStartedAt,
            });
        }
        if (completed) {
            events.push({
                id: `ev-done-${n}`,
                protocolId: id,
                kind: 'CONCLUSAO',
                actorUserId: assigneeId ?? creator,
                actorUnitId: unitId,
                assignmentId,
                phaseId: currentStage?.phaseId,
                message: 'Demanda analisada, resposta registrada e processo concluído.',
                previousStatus: 'EM_ANDAMENTO',
                nextStatus: 'CONCLUIDO',
                createdAt: isoDaysFromNow(-2),
            });
        }
        if (status === 'ARQUIVADO') {
            events.push({
                id: `ev-arc-${n}`,
                protocolId: id,
                kind: 'ARQUIVAMENTO',
                actorUserId: assigneeId ?? creator,
                actorUnitId: unitId,
                assignmentId,
                previousStatus: 'CONCLUIDO',
                nextStatus: 'ARQUIVADO',
                createdAt: isoDaysFromNow(-1),
            });
        }
    };
    const scenario = (choices: Array<Omit<DemoProcessInput, 'n' | 'unitId' | 'assigneeId' | 'status' | 'dueDays'>>, slot: number) => pick(choices, variation + slot);
    add({ n: 1, subject: 'Reposição de materiais de expediente', typeId: 'pt-buy', unitId: 'u-prot', assigneeId: 'usr-clara', status: 'CADASTRADO', dueDays: 2 });
    add({ n: 2, subject: 'Pagamento de fornecimento de água', typeId: 'pt-pay', unitId: 'u-fin', status: 'EM_ANDAMENTO', dueDays: -2 });
    add({ n: 3, subject: pick(['Informações sobre transporte escolar', 'Informações sobre merenda escolar', 'Dados sobre manutenção das escolas', 'Relatório de vagas na educação infantil'], variation + 3), typeId: 'pt-info', unitId: 'u-jur', assigneeId: 'usr-luisa', status: 'EM_ANDAMENTO', dueDays: 1 });
    add({ n: 4, subject: 'Pedido de acesso a processo administrativo', typeId: 'pt-info', unitId: 'u-prot', status: 'CADASTRADO', dueDays: 0.5 });
    add({ n: 5, subject: 'Análise de aditivo contratual', typeId: 'pt-contract', unitId: 'u-jur', assigneeId: 'usr-luisa', status: 'EM_ANDAMENTO', dueDays: 4 });
    add({ n: 6, subject: 'Requerimento de férias', typeId: 'pt-serv', unitId: 'u-adm', assigneeId: 'usr-bruno', status: 'EM_ANDAMENTO' });
    add({ n: 7, ...scenario([
        { subject: 'Vistoria de iluminação na Praça Central', typeId: 'pt-citizen-service' },
        { subject: 'Reparo emergencial no telhado da escola municipal', typeId: 'pt-citizen-service' },
        { subject: 'Manutenção preventiva dos aparelhos de climatização', typeId: 'pt-admin' },
        { subject: 'Correção de infiltração na unidade de saúde', typeId: 'pt-citizen-service' },
    ], 7), unitId: 'u-edu', assigneeId: 'usr-joana', status: 'EM_ANDAMENTO', dueDays: -1 });
    add({ n: 8, ...scenario([
        { subject: 'Pagamento de material didático entregue', typeId: 'pt-pay' },
        { subject: 'Ressarcimento de despesas com deslocamento técnico', typeId: 'pt-expense-reimbursement' },
        { subject: 'Pagamento do serviço de transporte escolar', typeId: 'pt-pay' },
        { subject: 'Ressarcimento de pequena despesa de manutenção', typeId: 'pt-expense-reimbursement' },
    ], 8), unitId: 'u-fin', assigneeId: 'usr-rafael', status: 'EM_ANDAMENTO', dueDays: 3 });
    add({ n: 9, ...scenario([
        { subject: 'Aquisição de equipamentos de rede para o paço municipal', typeId: 'pt-purchase-request' },
        { subject: 'Compra de kits de higiene para unidades escolares', typeId: 'pt-purchase-request' },
        { subject: 'Aquisição de mobiliário para atendimento ao cidadão', typeId: 'pt-purchase-request' },
        { subject: 'Compra de ferramentas para manutenção urbana', typeId: 'pt-purchase-request' },
    ], 9), unitId: 'u-adm', status: 'EM_ANDAMENTO', dueDays: 7, stagePosition: 2 });
    add({ n: 10, subject: 'Informação sobre licitação', typeId: 'pt-info', unitId: 'u-prot', assigneeId: 'usr-clara', status: 'CONCLUIDO' });
    add({ n: 11, subject: 'Análise de contrato de locação', typeId: 'pt-contract', unitId: 'u-jur', assigneeId: 'usr-luisa', status: 'ARQUIVADO' });
    add({ n: 12, ...scenario([
        { subject: 'Solicitação de mobiliário para salas de aula', typeId: 'pt-purchase-request' },
        { subject: 'Aquisição de projetores para formação pedagógica', typeId: 'pt-purchase-request' },
        { subject: 'Compra de utensílios para cozinhas escolares', typeId: 'pt-purchase-request' },
        { subject: 'Aquisição de livros para bibliotecas escolares', typeId: 'pt-purchase-request' },
    ], 12), unitId: 'u-edu', assigneeId: 'usr-joana', status: 'EM_ANDAMENTO', dueDays: 2 });
    add({ n: 13, subject: 'Requerimento de licença', typeId: 'pt-serv', unitId: 'u-adm', assigneeId: 'usr-bruno', status: 'CONCLUIDO' });
    add({ n: 14, ...scenario([
        { subject: 'Pagamento de serviços de tecnologia', typeId: 'pt-pay' },
        { subject: 'Ressarcimento de despesas de capacitação', typeId: 'pt-expense-reimbursement' },
        { subject: 'Pagamento da manutenção do sistema tributário', typeId: 'pt-pay' },
        { subject: 'Ressarcimento de combustível em viagem oficial', typeId: 'pt-expense-reimbursement' },
    ], 14), unitId: 'u-fin', assigneeId: 'usr-rafael', status: 'EM_ANDAMENTO', dueDays: 9 });
    add({ n: 15, ...scenario([
        { subject: 'Pedido de cópia de alvará e documentos de fiscalização', typeId: 'pt-info' },
        { subject: 'Solicitação de histórico de atendimento municipal', typeId: 'pt-info' },
        { subject: 'Consulta sobre cronograma de coleta de resíduos', typeId: 'pt-citizen-service' },
        { subject: 'Pedido de informações sobre obras em execução', typeId: 'pt-info' },
    ], 15), unitId: 'u-prot', assigneeId: 'usr-clara', status: 'EM_ANDAMENTO', dueDays: 5 });
    add({ n: 16, ...scenario([
        { subject: 'Solicitação de capacitação em gestão de contratos', typeId: 'pt-admin' },
        { subject: 'Aquisição de materiais para arquivo central', typeId: 'pt-purchase-request' },
        { subject: 'Organização do inventário de bens permanentes', typeId: 'pt-admin' },
        { subject: 'Contratação de treinamento em atendimento ao cidadão', typeId: 'pt-purchase-request' },
    ], 16), unitId: 'u-adm', assigneeId: 'usr-bruno', status: 'EM_ANDAMENTO', stagePosition: 2 });
    add({ n: 17, ...scenario([
        { subject: 'Parecer sobre convênio de transporte escolar', typeId: 'pt-legal-opinion' },
        { subject: 'Consulta sobre cessão de imóvel público', typeId: 'pt-legal-opinion' },
        { subject: 'Análise jurídica de termo de cooperação', typeId: 'pt-legal-opinion' },
        { subject: 'Parecer sobre aplicação de penalidade contratual', typeId: 'pt-legal-opinion' },
    ], 17), unitId: 'u-jur', status: 'EM_ANDAMENTO', dueDays: 14 });
    add({ n: 18, subject: 'Compra de toners', typeId: 'pt-buy', unitId: 'u-fin', status: 'EM_ANDAMENTO', dueDays: 1, creator: 'usr-admin' });
    add({ n: 19, subject: 'Atualização cadastral pendente de ciência', typeId: 'pt-admin', unitId: 'u-adm', assigneeId: 'usr-bruno', status: 'EM_ANDAMENTO', dueDays: 6 });
    add({ n: 20, ...scenario([
        { subject: 'Organização de arquivo físico da secretaria', typeId: 'pt-admin' },
        { subject: 'Solicitação de poda preventiva em área escolar', typeId: 'pt-citizen-service' },
        { subject: 'Levantamento de bens ociosos para remanejamento', typeId: 'pt-admin' },
        { subject: 'Manutenção dos bebedouros das unidades escolares', typeId: 'pt-citizen-service' },
    ], 20), unitId: 'u-edu', assigneeId: 'usr-joana', status: 'EM_ANDAMENTO' });    const pendingAcknowledgement = assignments.find((assignment) => assignment.id === 'as-19')!;
    pendingAcknowledgement.receivedAt = undefined;
    pendingAcknowledgement.receivedById = undefined;
    const pendingChecklistMovement = events.find((event) => event.id === 'ev-move-19')!;
    pendingChecklistMovement.phaseId = phases[1].id;
    pendingChecklistMovement.checklist = [{ questionId: 'q-analysis-result', text: 'Registrar despacho ou resultado', checked: false }];
    const acknowledgementEvent = events.findIndex((event) => event.id === 'ev-ack-19');
    if (acknowledgementEvent >= 0)
        events.splice(acknowledgementEvent, 1);
    // Fila sem responsável: demonstra troca de unidade, fases completas e destino estrutural.
    const queueDemo = protocols.find((protocol) => protocol.id === 'pr-18')!;
    const queueAssignment = assignments.find((assignment) => assignment.id === queueDemo.currentAssignmentId)!;
    const queueOriginAssignment = assignments.find((assignment) => assignment.id === 'as-18-origin')!;
    const queueMovement = events.find((event) => event.id === 'ev-move-18')!;
    queueDemo.currentPhaseId = phases[2].id;
    queueAssignment.startedAt = isoDaysFromNow(-0.02);
    queueOriginAssignment.endedAt = queueAssignment.startedAt;
    queueMovement.createdAt = queueAssignment.startedAt;
    queueMovement.phaseId = phases[2].id;
    queueMovement.checklist = [{ questionId: 'q-completion-result', text: 'Registrar resultado final', checked: false }];
    queueMovement.message = 'Encaminhado para análise final da unidade financeira.';
    // A entrada em Conclusão é representada pela própria tramitação, sem duplicar a fase no andamento.

    // Histórico com passagens por três unidades para demonstrar consulta após tramitação.
    const trail = protocols.find((protocol) => protocol.id === 'pr-5')!;
    const trailCurrent = assignments.find((assignment) => assignment.id === trail.currentAssignmentId)!;
    const trailOrigin = assignments.find((assignment) => assignment.id === 'as-5-origin')!;
    trail.createdAt = isoDaysFromNow(-12);
    trailCurrent.startedAt = isoDaysFromNow(-1);
    trailCurrent.receivedAt = isoDaysFromNow(-1);
    trailCurrent.receivedById = 'usr-luisa';
    trailOrigin.startedAt = trail.createdAt;
    trailOrigin.receivedAt = trail.createdAt;
    trailOrigin.receivedById = 'usr-clara';
    trailOrigin.endedAt = isoDaysFromNow(-9);
    const trailOpening = events.find((event) => event.id === 'ev-open-5')!;
    trailOpening.createdAt = trail.createdAt;
    const trailAnalysis = events.find((event) => event.id === 'ev-phase-analysis-5')!;
    trailAnalysis.createdAt = isoDaysFromNow(-10);
    for (const eventId of ['ev-move-5', 'ev-ack-5']) {
        const index = events.findIndex((event) => event.id === eventId);
        if (index >= 0) events.splice(index, 1);
    }
    assignments.push({
        id: 'as-5b',
        protocolId: trail.id,
        unitId: 'u-adm',
        assigneeId: 'usr-bruno',
        startedAt: isoDaysFromNow(-9),
        receivedAt: isoDaysFromNow(-8),
        receivedById: 'usr-bruno',
        endedAt: isoDaysFromNow(-1),
    });
    events.push({
        id: 'ev-5a',
        protocolId: trail.id,
        kind: 'TRAMITACAO',
        actorUserId: 'usr-clara',
        actorUnitId: 'u-prot',
        fromUnitId: 'u-prot',
        toUnitId: 'u-adm',
        fromUserId: 'usr-clara',
        toUserId: 'usr-bruno',
        assignmentId: 'as-5b',
        phaseId: 'phase-analysis',
        checklist: [{ questionId: 'q-analysis-result', text: 'Registrar despacho ou resultado', checked: true, observation: 'Conferência administrativa concluída.' }],
        message: 'Encaminho para providências administrativas.',
        createdAt: isoDaysFromNow(-9),
    }, {
        id: 'ev-5b',
        protocolId: trail.id,
        kind: 'TRAMITACAO',
        actorUserId: 'usr-bruno',
        actorUnitId: 'u-adm',
        fromUnitId: 'u-adm',
        toUnitId: 'u-jur',
        fromUserId: 'usr-bruno',
        toUserId: 'usr-luisa',
        assignmentId: trailCurrent.id,
        phaseId: 'phase-analysis',
        message: 'Solicito análise jurídica.',
        createdAt: isoDaysFromNow(-1),
    });
    const documentSpecs: Array<{ typeId: string; protocolId?: string; movementEventId?: string; subject: string; body: string }> = [
        { typeId: 'dt-memo', protocolId: 'pr-1', movementEventId: 'ev-open-1', subject: 'Justificativa para reposição do estoque', body: 'Documento de demonstração do Fluxo Público.\n\nA unidade solicitante informa que o estoque de papel, canetas e pastas atingiu o nível mínimo e solicita reposição para manter o atendimento regular.' },
        { typeId: 'dt-despacho', protocolId: 'pr-2', movementEventId: 'ev-move-2', subject: 'Conferência preliminar da fatura de água', body: 'Conferidos o período de consumo, a unidade atendida e os dados do credor. O processo segue para regularização da pendência documental e liquidação.' },
        { typeId: 'dt-parecer', protocolId: 'pr-5', movementEventId: 'ev-5b', subject: 'Manifestação sobre o aditivo contratual', body: 'Após análise da justificativa, da vigência e dos limites contratuais, recomenda-se o prosseguimento condicionado à atualização da certidão indicada nos autos.' },
        { typeId: 'dt-purchase-request', protocolId: 'pr-9', movementEventId: 'ev-move-9', subject: 'Requisição da unidade demandante', body: 'A aquisição é necessária para garantir continuidade dos serviços internos. As especificações evitam indicação de marca e registram quantitativos compatíveis com o consumo estimado.' },
        { typeId: 'dt-reference-term', protocolId: 'pr-12', movementEventId: 'ev-move-12', subject: 'Termo de referência da aquisição escolar', body: 'Documento com descrição do objeto, critérios de aceitação, prazo de entrega, locais de fornecimento e responsabilidades da contratada.' },
        { typeId: 'dt-invoice', protocolId: 'pr-14', movementEventId: 'ev-move-14', subject: 'Documento fiscal para conferência', body: 'Documento fiscal recebido e vinculado ao processo para conferência do objeto, período de competência, valor e atesto do responsável.' },
        { typeId: 'dt-legal-opinion', protocolId: 'pr-17', movementEventId: 'ev-move-17', subject: 'Minuta de parecer jurídico', body: 'Análise preliminar dos fundamentos legais, da competência administrativa e das condições necessárias à formalização da decisão.' },
        { typeId: 'dt-oficio', subject: 'Circular sobre atualização dos responsáveis setoriais', body: 'Solicita-se às unidades administrativas a confirmação dos servidores responsáveis pelo recebimento e tramitação de processos eletrônicos.' },
    ];
    const documents: AppDocument[] = documentSpecs.map((spec, index) => {
        const protocol = spec.protocolId ? protocols.find((item) => item.id === spec.protocolId) : undefined;
        return { id: `doc-${index + 1}`, number: `DOC-2026.${String(index + 1).padStart(6, '0')}`, typeId: spec.typeId, protocolId: spec.protocolId, movementEventId: spec.movementEventId, subject: spec.subject, body: spec.body, unitId: protocol?.currentUnitId ?? 'u-prot', authorUserId: protocol?.currentAssigneeId ?? protocol?.createdById ?? 'usr-clara', createdAt: isoDaysFromNow(-index - 1) };
    });    documents.filter((d) => d.protocolId).forEach((d) => events.push({ id: `ev-doc-${d.id}`, protocolId: d.protocolId!, kind: 'DOCUMENTO_CRIADO', actorUserId: d.authorUserId, actorUnitId: d.unitId, relatedDocumentId: d.id, createdAt: d.createdAt }));
    return { schemaVersion: 7, initializedAt: now(), organization: { id: 'org-1', name: 'Prefeitura de Vila Exemplo', abbreviation: 'PVE' }, counters: { 'protocol-2026': 20, 'document-2026': 8 }, units, users, memberships, auditEvents, people, processCategories, protocolTypes, phases, flows, flowPhases, situations, documentTypes, documentTemplates, protocols, assignments, events, documents, attachments: [{ id: 'att-seed', protocolId: 'pr-1', movementEventId: 'ev-open-1', filename: 'comprovante-demo.txt', mimeType: 'text/plain', sizeBytes: 52, blobKey: 'seed-comprovante', uploadedById: 'usr-clara', createdAt: isoDaysFromNow(-1) }] };
}
