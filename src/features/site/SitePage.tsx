import { useEffect, useId, useState } from 'react'
import { ArrowDown, ArrowRight, Check, CheckCheck, ChevronDown, ClipboardCheck, FileText, GitBranch, Globe2, Landmark, Layers3, LockKeyhole, Mail, Menu, Palette, ShieldCheck, UsersRound, X } from 'lucide-react'
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { configuredMunicipalities } from '../../saas/config'
import { ProductPreview } from './ProductPreview'
import { contactHref, demoHref, siteContact, siteFaq, siteFeatures } from './siteContent'
import './site.css'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function MunicipalityAccess({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const visible = configuredMunicipalities.filter((tenant) => normalize(`${tenant.name} ${tenant.city} ${tenant.state}`).includes(normalize(query)))
  return <Dialog title="Acessar minha prefeitura" titleIcon={<Landmark size={21}/>} titleDescription="Encontre sua instituição para entrar no ambiente correto." onClose={onClose}>
    <DialogBody><label className="block text-sm font-semibold">Buscar prefeitura<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome da prefeitura ou cidade..."/></label><div className="mt-4 space-y-2">{visible.map((tenant) => <a key={tenant.id} href={`/${tenant.slug}/`} className="site-municipality-link"><span><Landmark size={20}/></span><div><strong>{tenant.name}</strong><small>{tenant.city} · {tenant.state}</small></div><ArrowRight size={18}/></a>)}</div>{!visible.length && <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600" role="status">Nenhuma prefeitura encontrada. Confira o endereço informado pelo administrador da sua instituição.</p>}</DialogBody>
    <DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Fechar</button></DialogFooter>
  </Dialog>
}

export function SitePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [selected, setSelected] = useState(0)
  const feature = siteFeatures[selected]
  const tabsId = useId()
  const openAccess = () => { setMenuOpen(false); setAccessOpen(true) }
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'PGCI | Governança, Compliance e Integridade na gestão pública'
    const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const meta = existing ?? document.createElement('meta')
    const previousDescription = meta.content
    meta.name = 'description'
    meta.content = 'Conheça o PGCI: processos, documentos, fluxos, permissões por unidade, relatórios e auditoria em um ambiente próprio para cada prefeitura.'
    if (!existing) document.head.append(meta)
    return () => { document.title = previousTitle; if (existing) meta.content = previousDescription; else meta.remove() }
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])
  return <div className="pgci-site">
    <a className="site-skip" href="#site-main">Pular para o conteúdo</a>
    <header className="site-header"><div className="site-container site-header-inner">
      <a href="#inicio" className="site-brand" aria-label="PGCI — Início"><img src="/assets/pgci-logo.svg" alt="" width="29" height="35"/><span><strong>PGCI</strong><small>GESTÃO PÚBLICA COM INTEGRIDADE</small></span></a>
      <nav id="site-navigation" className="site-nav" data-open={menuOpen} aria-label="Navegação do site">{[['#solucao', 'A solução'], ['#recursos', 'Recursos'], ['#como-funciona', 'Como funciona'], ['#prefeituras', 'Para prefeituras']].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
      <div className="site-header-actions"><button className="site-client-button" onClick={openAccess} aria-label="Acessar minha prefeitura"><LockKeyhole size={14}/><span>Acessar</span></button><a className="site-button site-button-small" href={contactHref}>Fale com a equipe<ArrowRight size={14}/></a><button className="site-menu-toggle" aria-label={menuOpen ? 'Fechar menu do site' : 'Abrir menu do site'} aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button></div>
    </div></header>
    <main id="site-main">
      <section className="site-hero" id="inicio"><div className="site-container site-hero-grid">
        <div className="site-hero-visual"><div className="site-hero-orbit" aria-hidden="true"/><div className="site-hero-preview"><ProductPreview hero/></div><div className="site-hero-note"><span><CheckCheck size={19}/></span><div><strong>O trabalho avança.</strong><small>O histórico acompanha.</small></div></div><p className="site-preview-caption">Exemplo de interface · dados ilustrativos</p></div>
        <div className="site-hero-copy"><span className="site-eyebrow"><i/>TECNOLOGIA PARA A GESTÃO PÚBLICA</span><h1>Menos papel.<br/>Mais clareza.<br/><em>Gestão em movimento.</em></h1><p>Processos, documentos e pessoas conectados. Do primeiro registro à decisão final, dê direção ao trabalho e visibilidade a cada etapa.</p><div className="site-hero-actions"><a className="site-button" href={demoHref}>Explorar demonstração<ArrowRight size={17}/></a><a className="site-text-link" href="#recursos">Conhecer os recursos<ArrowDown size={15}/></a></div><div className="site-hero-signature"><ShieldCheck size={18}/><span>Programa de Governança,<br/>Compliance e Integridade</span></div></div>
      </div></section>
      <div className="site-trust-strip"><div className="site-container">{[[GitBranch, 'Fluxos configuráveis'], [UsersRound, 'Acesso por unidade'], [ShieldCheck, 'Histórico auditável'], [Palette, 'Identidade da prefeitura']].map(([Icon, label]) => { const Glyph = Icon as typeof GitBranch; return <span key={String(label)}><Glyph size={20}/>{String(label)}</span> })}</div></div>
      <section className="site-section site-container" id="solucao"><div className="site-section-heading"><div><span className="site-eyebrow">MAIS QUE TRAMITAR</span><h2>Organização que se transforma<br/>em <em>gestão.</em></h2></div><p>Uma rotina pública bem conduzida precisa de informação acessível, responsabilidades claras e critérios para seguir. O PGCI reúne essas peças.</p></div>
        <div className="site-pillars">{[{ icon: Layers3, title: 'Governança', headline: 'Cada etapa tem uma direção.', text: 'Estruture unidades, defina responsáveis e acompanhe o caminho dos processos entre os setores.' }, { icon: ClipboardCheck, title: 'Compliance', headline: 'Rotinas com critérios claros.', text: 'Padronize fluxos, documentos e checklists para orientar a execução conforme as regras definidas pela instituição.' }, { icon: ShieldCheck, title: 'Integridade', headline: 'O contexto fica no histórico.', text: 'Consulte ações, observações, documentos e movimentações para entender o que aconteceu e quem participou.' }].map(({ icon: Icon, title, headline, text }, index) => <article key={title}><div className="site-pillar-top"><Icon size={27}/><span>0{index + 1}</span></div><h3>{title}</h3><strong>{headline}</strong><p>{text}</p></article>)}</div>
      </section>
      <section className="site-features-section" id="recursos"><div className="site-container"><div className="site-section-heading"><div><span className="site-eyebrow">RECURSOS DO PGCI</span><h2>As peças da sua rotina.<br/><em>Em um só sistema.</em></h2></div><p>Explore as ferramentas que acompanham o trabalho de quem abre, analisa, encaminha e decide.</p></div>
        <div className="site-features-grid"><div className="site-feature-tabs" role="tablist" aria-label="Recursos do sistema" aria-orientation="vertical">{siteFeatures.map((item, index) => <button key={item.id} id={`${tabsId}-${item.id}`} role="tab" aria-selected={selected === index} aria-controls={`${tabsId}-panel`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? siteFeatures.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + siteFeatures.length) % siteFeatures.length
          setSelected(next)
          document.getElementById(`${tabsId}-${siteFeatures[next].id}`)?.focus()
        }}><item.icon size={21}/><span>{item.title}</span><ChevronDown size={15}/></button>)}</div>
          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${feature.id}`} className="site-feature-panel"><div className="site-feature-copy" key={feature.id}><span className="site-eyebrow">{feature.eyebrow}</span><h3>{feature.headline}</h3><p>{feature.description}</p><ul>{feature.points.map((point) => <li key={point}><Check size={16}/>{point}</li>)}</ul></div><ProductPreview mode={feature.id}/></div>
        </div>
      </div></section>
      <section className="site-section site-container" id="como-funciona"><div className="site-section-heading"><div><span className="site-eyebrow">DA DEMANDA AO RESULTADO</span><h2>Um caminho claro<br/>para <em>cada processo.</em></h2></div><p>O fluxo acompanha a realidade da prefeitura. As etapas orientam a equipe e o histórico dá continuidade ao trabalho.</p></div><ol className="site-workflow">{[{ title: 'Registre', text: 'Identifique o interessado, escolha o tipo de processo e reúna os dados da demanda.', icon: FileText }, { title: 'Encaminhe', text: 'Direcione à unidade e ao responsável, com prazo e contexto para a próxima etapa.', icon: GitBranch }, { title: 'Acompanhe', text: 'Registre ciência, preencha checklists e vincule documentos às movimentações.', icon: ClipboardCheck }, { title: 'Conclua', text: 'Formalize o resultado, consulte o histórico e gere o dossiê do processo.', icon: CheckCheck }].map(({ title, text, icon: Icon }, index) => <li key={title}><div><span>0{index + 1}</span><Icon size={24}/></div><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
      <section className="site-tenant-section" id="prefeituras"><div className="site-container site-tenant-grid"><div><span className="site-eyebrow">A SUA PREFEITURA, DO SEU JEITO</span><h2>Um ambiente próprio.<br/><em>Uma identidade sua.</em></h2><p>O mesmo conceito de organização, adaptado às unidades, aos usuários e à rotina de cada instituição.</p><ul className="site-tenant-list"><li><Globe2 size={20}/><span><strong>Seu endereço de acesso</strong><small>Um identificador exclusivo e fixo para a prefeitura.</small></span></li><li><Palette size={20}/><span><strong>Sua identidade institucional</strong><small>Logo, nome e paleta de cores no sistema e no login.</small></span></li><li><UsersRound size={20}/><span><strong>Seus perfis e suas unidades</strong><small>Estrutura hierárquica e permissões em cada vínculo.</small></span></li></ul><button className="site-text-link" onClick={openAccess}>Entrar no ambiente da minha prefeitura<ArrowRight size={17}/></button></div><div className="site-tenant-visual"><div className="site-tenant-platform"><img src="/assets/pgci-logo.svg" width="25" height="30" alt=""/><strong>PGCI</strong><span>Governança · Compliance · Integridade</span></div><div className="site-tenant-connector" aria-hidden="true"/><div className="site-tenant-card"><span className="site-tenant-icon"><Landmark size={30}/></span><small>AMBIENTE DA PREFEITURA</small><h3>{configuredMunicipalities[0].city}</h3><code>/{configuredMunicipalities[0].slug}/</code><div className="site-tenant-swatches" aria-hidden="true"><i/><i/><i/><i/></div><div className="site-tenant-card-footer"><span><UsersRound size={15}/>Unidades e perfis</span><span><ShieldCheck size={15}/>Histórico de ações</span></div></div><p>Configurações, acessos e dados por ambiente.</p></div></div></section>
      <section className="site-section site-container site-faq" id="duvidas"><div><span className="site-eyebrow">PERGUNTAS FREQUENTES</span><h2>Antes de começar,<br/><em>vale saber.</em></h2><p>Conheça o funcionamento e o ambiente de demonstração do PGCI.</p></div><div>{siteFaq.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18}/></summary><p>{answer}</p></details>)}</div></section>
      <section className="site-contact-section site-container" id="contato"><div className="site-contact-card"><div><span className="site-eyebrow">COMECE PELO PRÓXIMO PASSO</span><h2>Conheça uma forma mais clara<br/>de conduzir a gestão pública.</h2><p>Explore o ambiente de demonstração ou converse sobre a rotina da sua prefeitura.</p><div className="site-contact-actions"><a className="site-button" href={demoHref}>Explorar demonstração<ArrowRight size={17}/></a><a className="site-button site-button-outline" href={contactHref}><Mail size={16}/>Fale com a equipe</a></div></div><div className="site-contact-aside"><Mail size={28}/><strong>Vamos conversar?</strong><a href={contactHref}>{siteContact.email}</a>{siteContact.example && <small>Contato de exemplo</small>}</div></div></section>
    </main>
    <footer className="site-footer site-container"><div className="site-footer-top"><a href="#inicio" className="site-brand" aria-label="PGCI — Voltar ao início"><img src="/assets/pgci-logo.svg" alt="" width="29" height="35"/><span><strong>PGCI</strong><small>GOVERNANÇA · COMPLIANCE · INTEGRIDADE</small></span></a><p>Informação organizada.<br/>Responsabilidade em cada etapa.</p><button className="site-client-button" onClick={openAccess}><LockKeyhole size={14}/>Acesso às prefeituras</button></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} PGCI. Gestão pública com integridade.</span><div><a href="#recursos">Recursos</a><a href="#duvidas">Perguntas frequentes</a><a href={contactHref}>Contato</a></div></div></footer>
    {accessOpen && <MunicipalityAccess onClose={() => setAccessOpen(false)}/>}
  </div>
}
