import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Building2, Clock3, FileSearch, Landmark, LockKeyhole, ScanLine, Search } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Feedback'
import { dateTime } from '../../lib/format'
import { readInstitutionSettings } from '../../lib/institution'
import { consultationNumber, getPublicProtocolSummary } from '../../services/publicConsultation'

export function PublicProtocolPage() {
  const [params, setParams] = useSearchParams()
  const number = params.get('numero') ?? ''
  const [reference, setReference] = useState(number)
  const [inputError, setInputError] = useState('')
  const settings = readInstitutionSettings()
  const enabled = settings.publicConsultation !== false
  const { data: summary, error, isFetching } = useQuery({
    queryKey: ['public-protocol', number], queryFn: () => getPublicProtocolSummary(number), enabled: enabled && Boolean(number), retry: false,
  })
  useEffect(() => { setReference(number); setInputError('') }, [number])
  const organization = settings.organizationName || 'Prefeitura'
  return <main className="flex min-h-dvh flex-col bg-background text-foreground" data-public-consultation>
    <header className="border-b border-border bg-[var(--ui-header-bg)] text-[var(--ui-header-fg)]">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-5 sm:px-8">
        {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt="" className="size-12 shrink-0 object-contain"/> : <Landmark size={30} className="shrink-0"/>}
        <div className="min-w-0"><p className="text-base font-bold leading-snug sm:text-lg">{organization}</p><p className="mt-1 text-xs opacity-75">PGCI · Consulta de protocolos</p></div>
      </div>
    </header>
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[var(--ui-accent-text)]">Acompanhe seu protocolo</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Consulta do protocolo</h1><p className="mt-2 text-sm text-muted-foreground">Confira o resumo e o andamento registrado pela prefeitura.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold"><LockKeyhole size={13}/>Somente leitura</span>
      </div>
      {!enabled ? <section className="panel p-6"><h2 className="font-semibold">Consulta pública indisponível</h2><p className="mt-2 text-sm text-muted-foreground">A consulta pública está desativada para esta prefeitura.</p></section> : <>
        <form className="panel p-5" onSubmit={(event) => {
          event.preventDefault()
          try {
            const value = consultationNumber(reference)
            if (!value || value.length > 80) throw new Error('Informe um número de protocolo válido.')
            setInputError(''); setReference(value); setParams({ numero: value })
          } catch (failure) { setInputError(failure instanceof Error ? failure.message : 'Código inválido.') }
        }}>
          <label htmlFor="consultation-reference" className="label">Número do protocolo</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row"><Input id="consultation-reference" autoFocus={!number} autoComplete="off" maxLength={2048} value={reference} onChange={(event) => { setReference(event.target.value); setInputError('') }} placeholder="Digite o número ou leia o código de barras" className="!mt-0 min-w-0 flex-1"/><button className="btn-primary justify-center" disabled={!reference.trim() || isFetching}><Search size={16}/>Consultar</button></div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ScanLine size={15} className="shrink-0"/>Com um leitor conectado, selecione o campo, leia o código de barras e pressione Enter.</p>
          {inputError && <p role="alert" className="mt-3 text-sm text-destructive">{inputError}</p>}
        </form>
        {isFetching ? <div role="status" aria-label="Consultando protocolo" className="py-10"><Loading/></div> : error ? <section role="alert" className="panel p-6"><h2 className="font-semibold">Não foi possível consultar</h2><p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Tente novamente.'}</p></section> : summary ? <>
          <article className="panel overflow-hidden">
            <header className="border-b border-border bg-muted/40 px-5 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="break-all font-mono text-lg font-semibold text-[var(--ui-accent-text)]">{summary.number}</p><span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold">{summary.situation}</span></div><h2 className="mt-3 break-words text-xl font-bold">{summary.subject}</h2><p className="mt-1 text-sm text-muted-foreground">{summary.type}</p></header>
            <div className="space-y-6 p-5 sm:p-6"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[
              ['Data de abertura', dateTime(summary.createdAt)], ['Última atualização', dateTime(summary.updatedAt)], ['Prazo de atendimento', summary.dueAt ? dateTime(summary.dueAt) : 'Não informado'], ['Unidade atual', summary.unit], ['Fase atual', summary.phase ?? 'Fluxo livre'], ['Situação', summary.situation],
            ].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl><section className="border-t border-border pt-5"><h3 className="text-sm font-semibold">Descrição do protocolo</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{summary.description || 'Não informada.'}</p></section></div>
          </article>
          <section className="panel p-5 sm:p-6"><h2 className="flex items-center gap-2 text-base font-bold"><Clock3 size={18} className="text-[var(--ui-accent-text)]"/>Andamento do protocolo</h2><p className="mt-1 text-xs text-muted-foreground">Movimentações exibidas da mais recente para a mais antiga.</p><ol className="mt-5 space-y-5">{summary.history.map((movement, index) => <li key={`${movement.createdAt}-${index}`} className="flex gap-3"><span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[var(--ui-accent-text)]"><Building2 size={14}/></span><div className="min-w-0"><p className="text-sm font-semibold">{movement.action}</p><p className="mt-1 break-words text-sm text-muted-foreground">{movement.unit}{movement.phase && ` · ${movement.phase}`}</p><time dateTime={movement.createdAt} className="mt-1 block text-xs text-muted-foreground">{dateTime(movement.createdAt)}</time></div></li>)}</ol>{!summary.history.length && <p className="mt-4 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>}</section>
        </> : <section className="panel flex flex-col items-center px-5 py-12 text-center"><FileSearch size={36} className="text-[var(--ui-accent-text)]"/><h2 className="mt-4 font-semibold">Seu protocolo, de forma simples</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Informe o número acima ou use o QR code do comprovante para acessar diretamente o resumo do protocolo.</p></section>}
      </>}
    </div>
    <footer className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">PGCI · Programa de Governança, Compliance e Integridade</footer>
  </main>
}
