import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from '../app/session'
import { ToastProvider } from '../components/ui/ToastProvider'
import { Loading } from '../components/ui/Feedback'
import { DATABASE_KEY, migrateLegacyBlobs } from '../storage/database'
import { activateTenant, migrateLegacyStorage, resolveTenantRoute, tenantStorageKey } from './tenants'
import type { TenantRoute } from './tenants'
import { SitePage } from '../features/site/SitePage'
const TenantApp = lazy(() => import('../app/App').then((module) => ({ default: module.App })))

function startup(): TenantRoute | { kind: 'error'; message: string } {
  try {
    const route = resolveTenantRoute(window.location.pathname, window.location.search, window.location.hash)
    if (route.kind === 'tenant') {
      activateTenant(route.tenant)
      migrateLegacyStorage(route.tenant)
    } else activateTenant()
    return route
  } catch (error) { return { kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível carregar a prefeitura.' } }
}

export function SaasApp() {
  const [route] = useState(startup)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } }))
  useEffect(() => {
    if (route.kind === 'redirect') { window.location.replace(route.to); return }
    if (route.kind !== 'tenant') return
    let mounted = true
    void migrateLegacyBlobs(route.tenant.id).then(() => { if (mounted) setReady(true) }).catch((failure) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Não foi possível preservar os anexos existentes.') })
    const refresh = (event: StorageEvent) => { if (event.key === tenantStorageKey(DATABASE_KEY, route.tenant.id)) void client.invalidateQueries() }
    window.addEventListener('storage', refresh)
    return () => { mounted = false; window.removeEventListener('storage', refresh) }
  }, [route, client])
  if (route.kind === 'public') return <SitePage/>
  if (route.kind === 'missing' || route.kind === 'error' || error) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900"><section className="w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm"><h1 className="text-xl font-bold">{route.kind === 'missing' ? 'Prefeitura não encontrada' : 'Não foi possível iniciar o sistema'}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{route.kind === 'error' ? route.message : error || 'Confira o endereço de acesso fornecido pela sua prefeitura.'}</p><a className="btn-primary mt-6 inline-flex" href="/">Voltar ao início</a></section></main>
  if (route.kind !== 'tenant' || !ready) return <main className="grid min-h-screen place-items-center"><Loading/></main>
  return <Suspense fallback={<main className="p-8"><Loading/></main>}><QueryClientProvider client={client}><ToastProvider><SessionProvider><TenantApp basename={`/${route.tenant.slug}`}/></SessionProvider></ToastProvider></QueryClientProvider></Suspense>
}
