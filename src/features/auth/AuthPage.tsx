import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleHelp, Eye, EyeOff, FileCheck2, Landmark, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../app/session'
import { useDb } from '../../app/queries'
import { Input } from '../../components/ui/Input'
import { Tooltip } from '../../components/ui/Tooltip'
import { DEMO_PASSWORD } from '../../lib/demoAuth'

function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <section className="auth-story" aria-label="Sobre o PGCI">
      <div className="auth-brand"><img src="/assets/pgci-logo.svg" alt="" width="35" height="43"/><div><strong>PGCI</strong><span>GOVERNANÇA · COMPLIANCE · INTEGRIDADE</span></div></div>
      <div className="auth-story-content">
        <p className="auth-eyebrow"><span/> Gestão pública, de ponta a ponta</p>
        <h2>Mais clareza.<br/>Mais controle.<br/><em>Mais integridade.</em></h2>
        <p className="auth-story-description">Processos, documentos e pessoas conectados em um só lugar. Para uma gestão que avança com organização e responsabilidade.</p>
        <div className="auth-workflow" aria-hidden="true">
          <div className="auth-workflow-caption"><FileCheck2 size={17}/><span>CADA ETAPA, UM AVANÇO.</span></div>
          <div className="auth-workflow-line"><span><i><FileCheck2 size={19}/></i>Abertura</span><b/><span><i><ArrowRight size={19}/></i>Tramitação</span><b/><span><i><Check size={19}/></i>Conclusão</span></div>
          <div className="auth-workflow-note"><ShieldCheck size={15}/> Informação organizada. Histórico preservado.</div>
        </div>
      </div>
      <p className="auth-story-footer">Programa de Governança, Compliance e Integridade</p>
    </section>
    <section className="auth-access">
      <div className="auth-mobile-brand"><img src="/assets/pgci-logo.svg" alt="" width="26" height="32"/><strong>PGCI</strong><span>Gestão pública com integridade</span></div>
      <div className="auth-form-wrap">{children}</div>
      <footer className="auth-footer"><span>PGCI · Gestão pública com integridade</span><span>© {new Date().getFullYear()} PGCI</span></footer>
    </section>
  </main>
}

export function LoginPage() {
  const ctx = useSession()
  const { data: db } = useDb()
  const navigate = useNavigate()
  const location = useLocation()
  const id = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const demoUser = ctx.users.find((user) => user.id === 'usr-admin') ?? ctx.users[0]
  let organizationName = db?.organization.name ?? 'Acesso institucional'
  try { organizationName = JSON.parse(localStorage.getItem('fluxo-publico:settings-general') ?? '{}').organizationName || organizationName } catch { /* Use the organization registered in the database. */ }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await ctx.signIn(email, password)
      const from = (location.state as { from?: unknown } | null)?.from
      navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') && !from.startsWith('/esqueci-a-senha') ? from : '/dashboard', { replace: true })
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível entrar. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <AuthLayout>
    <div className="auth-organization"><span><Landmark size={18}/></span><p>{organizationName}<small>Portal de acesso institucional</small></p></div>
    <header className="auth-form-heading"><p className="auth-section-label">BEM-VINDO AO PGCI</p><h1>Acesse sua conta</h1><p>Entre para acompanhar seus processos e continuar seu trabalho.</p></header>
    <form className="auth-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
      <div className="auth-field"><label htmlFor={`${id}-email`}>E-mail institucional</label><div className="auth-input-wrap"><Mail size={18} aria-hidden="true"/><Input id={`${id}-email`} type="email" autoComplete="username" placeholder="seu.email@instituicao.gov.br" value={email} required disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setEmail(event.target.value); setError('') }}/></div></div>
      <div className="auth-field"><div className="auth-label-row"><label htmlFor={`${id}-password`}>Senha</label><Link to="/esqueci-a-senha">Esqueceu sua senha?</Link></div><div className="auth-input-wrap"><LockKeyhole size={18} aria-hidden="true"/><Input id={`${id}-password`} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" value={password} required disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setPassword(event.target.value); setError('') }}/><Tooltip content={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="auth-password-toggle"><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></Tooltip></div></div>
      {error && <p id={`${id}-error`} className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="auth-submit" disabled={busy || ctx.sessionLoading}>{busy ? <><LoaderCircle size={18} className="animate-spin"/>Entrando…</> : <>Entrar no sistema<ArrowRight size={18}/></>}</button>
    </form>
    <div className="auth-demo"><div><span className="auth-demo-dot"/><strong>Ambiente de demonstração</strong></div><p>Explore o sistema com uma conta de exemplo.</p><button type="button" disabled={!demoUser || busy} onClick={() => { if (demoUser) { setEmail(demoUser.email); setPassword(DEMO_PASSWORD); setError('') } }}>Preencher acesso de demonstração<ArrowRight size={14}/></button></div>
    <p className="auth-help"><CircleHelp size={15}/><span>Precisa de acesso? Procure o administrador da sua unidade.</span></p>
  </AuthLayout>
}

export function ForgotPasswordPage() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  return <AuthLayout>
    <Link className="auth-back" to="/login"><ArrowLeft size={16}/>Voltar para o login</Link>
    <span className="auth-recovery-icon"><LockKeyhole size={27}/></span>
    <header className="auth-form-heading"><p className="auth-section-label">RECUPERAÇÃO DE ACESSO</p><h1>{submitted ? 'Vamos recuperar seu acesso' : 'Esqueceu sua senha?'}</h1><p>{submitted ? 'Seu acesso é importante. Veja como continuar.' : 'Informe seu e-mail institucional para iniciar a recuperação do acesso.'}</p></header>
    {submitted ? <div className="auth-recovery-result" role="status"><h2>Fale com o administrador da sua unidade</h2><p>Solicite a redefinição da senha para <strong>{email}</strong>.</p><p>Neste ambiente de demonstração, nenhum e-mail de recuperação é enviado.</p><Link className="auth-submit" to="/login">Voltar para o login<ArrowRight size={18}/></Link><button type="button" className="auth-text-button" onClick={() => setSubmitted(false)}>Informar outro e-mail</button></div> : <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }}>
      <div className="auth-field"><label htmlFor={`${id}-recovery-email`}>E-mail institucional</label><div className="auth-input-wrap"><Mail size={18} aria-hidden="true"/><Input id={`${id}-recovery-email`} type="email" autoComplete="email" placeholder="seu.email@instituicao.gov.br" value={email} required onChange={(event) => setEmail(event.target.value)}/></div></div>
      <button type="submit" className="auth-submit">Recuperar acesso<ArrowRight size={18}/></button>
      <p className="auth-demo-notice">Demonstração: o envio de e-mails de recuperação ainda não está habilitado.</p>
    </form>}
  </AuthLayout>
}
