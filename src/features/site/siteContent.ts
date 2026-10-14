import { BarChart3, ClipboardCheck, FileText, GitBranch, Globe2, UsersRound } from 'lucide-react'
import { configuredMunicipalities } from '../../saas/config'

// Substitua pelo contato comercial oficial quando ele estiver disponível.
export const siteContact = { email: 'comercial@pgci.example', example: true }
export const contactHref = `mailto:${siteContact.email}?subject=${encodeURIComponent('Quero conhecer o PGCI')}`
export const demoHref = `/${configuredMunicipalities[0].slug}/`

export const siteFeatures = [
  { id: 'processes', title: 'Processos e tramitação', icon: GitBranch, eyebrow: 'DA ABERTURA À CONCLUSÃO', headline: 'Saiba onde está. Quem cuida. O que vem depois.', description: 'Reúna os dados do processo e acompanhe cada movimentação entre unidades, com responsáveis, prazos e observações no mesmo lugar.', points: ['Tipos e categorias de processo configuráveis', 'Tramitação, recebimento e ciência por unidade', 'Capa, comprovantes, etiquetas e dossiê em PDF'] },
  { id: 'documents', title: 'Documentos e anexos', icon: FileText, eyebrow: 'INFORMAÇÃO NO LUGAR CERTO', headline: 'O documento acompanha o processo.', description: 'Redija documentos com modelos, vincule anexos às movimentações e consulte tudo em um visualizador com ações claras.', points: ['Editor com formatação, modelos e margens ajustáveis', 'Documentos e anexos com nome e descrição', 'Visualização, impressão e download de PDFs'] },
  { id: 'workflow', title: 'Fluxos e checklists', icon: ClipboardCheck, eyebrow: 'ROTINAS COM DIREÇÃO', headline: 'Cada etapa, com critérios para seguir.', description: 'Defina fases, situações, destinos e requisitos do fluxo. Os checklists orientam o trabalho e mostram o que falta antes de avançar.', points: ['Fluxos livres, sugeridos ou obrigatórios', 'Checklist com anexo, data e observação', 'Prazos, cores e ícones para identificar as etapas'] },
  { id: 'access', title: 'Unidades e permissões', icon: UsersRound, eyebrow: 'RESPONSABILIDADES BEM DEFINIDAS', headline: 'O acesso certo, na unidade certa.', description: 'Organize a estrutura da prefeitura e atribua um perfil a cada vínculo do usuário. Os modelos de acesso permitem ajustes para cada realidade.', points: ['Unidades hierárquicas com organização visual', 'Perfis de acesso usados como modelos editáveis', 'Permissões específicas por usuário e unidade'] },
  { id: 'reports', title: 'Relatórios e auditoria', icon: BarChart3, eyebrow: 'CONTEXTO PARA DECIDIR', headline: 'Transforme o histórico em visão de gestão.', description: 'Consulte processos, produtividade e registros de ações. Acompanhe responsáveis e datas para entender o andamento do trabalho.', points: ['Painel com caixa de entrada e alertas de prazo', 'Relatórios com filtros e exportação em PDF', 'Auditoria com ação, usuário, data e contexto'] },
  { id: 'saas', title: 'Ambiente por prefeitura', icon: Globe2, eyebrow: 'A IDENTIDADE DA SUA INSTITUIÇÃO', headline: 'Um sistema. A sua forma de trabalhar.', description: 'Cada prefeitura acessa seu ambiente por um endereço próprio, com identidade visual, configurações e organização locais.', points: ['Endereço exclusivo com identificador fixo', 'Login com logo e paleta da prefeitura', 'Configurações, acessos e dados separados por ambiente'] },
] as const
export type PreviewMode = typeof siteFeatures[number]['id']

export const siteFaq = [
  ['O que é o PGCI?', 'O Programa de Governança, Compliance e Integridade reúne gestão de processos, documentos, estrutura organizacional e histórico de ações. A proposta é dar clareza às rotinas administrativas e aos responsáveis por cada etapa.'],
  ['É possível adaptar o fluxo à rotina da prefeitura?', 'Sim. Tipos de processo, fases, situações, destinos, prazos e checklists podem ser configurados. O sistema oferece fluxos livres, sugeridos ou obrigatórios, conforme o tipo de processo.'],
  ['Como funcionam os perfis de acesso?', 'O usuário recebe um perfil em cada unidade à qual está vinculado. O perfil funciona como modelo: o administrador pode acrescentar ou retirar permissões naquele vínculo. Perfis administrativos concedem todas as permissões.'],
  ['Cada prefeitura tem uma identidade própria?', 'Sim. O acesso usa um endereço exclusivo, como /saomateusdomaranhao/, e a instituição pode personalizar nome, logo, cores e tela de login. Alterar o nome não muda o identificador do endereço.'],
  ['Posso conhecer o sistema antes de utilizar?', 'Sim. O botão de demonstração leva ao ambiente de exemplo, com acesso demonstrativo disponível no login. Nesta etapa, os dados ficam no navegador; o login e a assinatura são simulações. A integração com backend e assinatura definitiva será feita posteriormente.'],
]
