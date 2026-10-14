import { ArrowRight, Bell, Check, ChevronRight, ClipboardList, FileText, GitBranch, Home, Landmark, MoreHorizontal, Paperclip, Search, ShieldCheck, UsersRound } from 'lucide-react'
import type { PreviewMode } from './siteContent'

const processRows = [
  ['Solicitação de material de expediente', 'Administração', 'Em análise'],
  ['Parecer para contratação de serviço', 'Jurídico', 'Em tramitação'],
  ['Solicitação de informação', 'Protocolo', 'Concluído'],
]

export function ProductPreview({ mode = 'processes', hero = false }: { mode?: PreviewMode; hero?: boolean }) {
  const title = ({ processes: 'Meus processos', documents: 'Documentos do processo', workflow: 'Etapas do fluxo', access: 'Unidades e permissões', reports: 'Visão de gestão', saas: 'Identidade institucional' })[mode]
  return <div className={`site-preview ${hero ? 'site-preview-hero' : ''}`} role="img" aria-label={`Prévia ilustrativa do PGCI: ${title}. Dados de exemplo.`}>
    <div className="site-preview-browser"><span/><span/><span/><p><ShieldCheck size={10}/> ambiente.pgci / prefeitura</p><span className="site-preview-demo">PRÉVIA</span></div>
    <div className="site-preview-top"><span><img src="/assets/pgci-logo.svg" alt="" width="14" height="17"/>PGCI</span><strong>Prefeitura · Ambiente de exemplo</strong><Bell size={13}/><i>MD</i></div>
    <div className="site-preview-layout">
      <aside aria-hidden="true"><small>TRABALHO</small>{[[Home, 'Painel'], [GitBranch, 'Processos'], [FileText, 'Documentos'], [UsersRound, 'Unidades']].map(([Icon, label]) => { const Glyph = Icon as typeof Home; return <span key={String(label)} className={label === 'Processos' ? 'active' : ''}><Glyph size={13}/>{String(label)}</span> })}<small>ADMINISTRAÇÃO</small><span><ShieldCheck size={13}/>Permissões</span></aside>
      <div className="site-preview-body"><div className="site-preview-heading"><div><small>GESTÃO DE PROCESSOS</small><h3>{title}</h3></div><MoreHorizontal size={17}/></div>
        {mode === 'processes' && <><div className="site-preview-metrics"><div><span>Na minha caixa</span><b>12</b></div><div><span>Vencem em 24h</span><b>03</b></div><div><span>Concluídos</span><b>09</b></div></div><div className="site-preview-search"><Search size={12}/>Buscar processo...</div>{processRows.map(([name, unit, status], index) => <div className="site-preview-row" key={name}><span className="site-preview-file"><ClipboardList size={15}/></span><div><small>EXEMPLO · 00{index + 1}</small><strong>{name}</strong><p>{unit} · Responsável definido</p></div><em className={index === 2 ? 'done' : ''}>{status}</em></div>)}</>}
        {mode === 'documents' && <><div className="site-preview-paper"><small>PREFEITURA · EXEMPLO</small><strong>MEMORANDO</strong><p>Assunto: Solicitação de materiais</p><i/><i/><i/><span>Atenciosamente,<br/>Unidade de Administração</span></div><div className="site-preview-row"><FileText size={17}/><div><strong>Memorando.pdf</strong><p>Documento vinculado à movimentação</p></div><span>Visualizar</span></div><div className="site-preview-row"><Paperclip size={17}/><div><strong>Comprovante.pdf</strong><p>Anexo · descrição disponível</p></div><span>Visualizar</span></div></>}
        {mode === 'workflow' && <><div className="site-preview-steps"><span>01 Abertura</span><ChevronRight size={12}/><span className="active">02 Análise</span><ChevronRight size={12}/><span>03 Conclusão</span></div><div className="site-preview-checklist"><small>CHECKLIST DA ETAPA</small><h4>Análise administrativa</h4>{['Conferir dados do interessado', 'Validar documentos anexados', 'Registrar parecer da unidade'].map((item, index) => <p key={item}><i className={index < 2 ? 'checked' : ''}>{index < 2 && <Check size={12}/>}</i>{item}</p>)}<footer>2 de 3 itens concluídos <span>Observação necessária</span></footer></div><div className="site-preview-destination"><Landmark size={19}/><div><small>PRÓXIMA UNIDADE</small><strong>Assessoria Jurídica</strong></div><ArrowRight size={17}/></div></>}
        {mode === 'access' && <><div className="site-preview-org"><p><Landmark size={15}/>Prefeitura</p><p><span/>Administração</p><p className="child"><span/>Financeiro</p><p><span/>Assessoria Jurídica</p></div><div className="site-preview-checklist"><small>PERFIL NA UNIDADE</small><h4>Operador de processos</h4>{['Visualizar processos', 'Redigir documentos', 'Tramitar na unidade'].map((label) => <p key={label}><i className="checked"><Check size={12}/></i>{label}</p>)}</div></>}
        {mode === 'reports' && <><div className="site-preview-chart"><small>PROCESSOS POR UNIDADE · EXEMPLO</small><div>{[58, 85, 42, 70, 95].map((height, index) => <span key={index} style={{ height: `${height}%` }}><i>{['ADM', 'PROT', 'JUR', 'FIN', 'EDU'][index]}</i></span>)}</div></div><div className="site-preview-audit"><strong>Histórico de ações</strong><p><i/>Processo tramitado <span>09:42</span></p><p><i/>Documento vinculado <span>09:31</span></p><p><i/>Ciência registrada <span>09:20</span></p></div></>}
        {mode === 'saas' && <div className="site-preview-tenant"><Landmark size={30}/><h4>Sua prefeitura</h4><p>Seu ambiente. Sua identidade.</p><span>pgci / suaprefeitura /</span><div><i style={{ background: '#17628b' }}/><i style={{ background: '#065f46' }}/><i style={{ background: '#7c3aed' }}/><i style={{ background: '#d97706' }}/></div><strong>Nome, logo e cores personalizados</strong></div>}
        <div className="site-preview-bottom"><span><ShieldCheck size={10}/> Histórico e responsabilidades no mesmo lugar</span><span>PGCI</span></div>
      </div>
    </div>
  </div>
}
