import { configuredMunicipalities } from './config'

export interface Municipality {
  readonly id: string
  name: string
  city: string
  state: string
  abbreviation: string
}
export interface Tenant extends Municipality {
  readonly slug: string
}
export const TENANTS_KEY = 'fluxo-publico:saas:tenants:v1'
const legacyRoutes = new Set(['login', 'esqueci-a-senha', 'dashboard', 'relatorios', 'processos', 'protocolos', 'documentos', 'pessoas', 'estrutura', 'tipos-processo', 'categorias-processo', 'situacoes', 'fases', 'tipos-protocolo', 'tipos-documento', 'usuarios', 'perfis', 'configuracoes'])
legacyRoutes.add('consulta')
const reservedSlugs = new Set([...legacyRoutes, 'assets', 'src', 'api', 'admin', 'saas', 'examples', 'pdf-assets'])
let activeTenant: Tenant | undefined

export const getActiveTenant = () => activeTenant
export function activateTenant(tenant?: Tenant) { activeTenant = tenant && Object.freeze({ ...tenant }) }

export function municipalitySlug(name: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/^prefeitura\s+(?:municipal\s+)?(?:de\s+|do\s+|da\s+)?/, '')
    .replace(/[^a-z0-9]/g, '').slice(0, 70)
  if (!slug) throw new Error('Informe o nome da prefeitura para gerar seu endereço.')
  return reservedSlugs.has(slug) ? `prefeitura${slug}` : slug
}

export function listTenants(): Tenant[] {
  const raw = localStorage.getItem(TENANTS_KEY)
  if (!raw) return []
  const saved: unknown = JSON.parse(raw)
  if (!Array.isArray(saved) || saved.some((item) => !item || typeof item.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id) || typeof item.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || reservedSlugs.has(item.slug) || typeof item.name !== 'string' || typeof item.city !== 'string' || typeof item.state !== 'string' || typeof item.abbreviation !== 'string') || new Set(saved.map((item) => item.id)).size !== saved.length || new Set(saved.map((item) => item.slug)).size !== saved.length) {
    throw new Error('O cadastro local de prefeituras está incompatível. Os dados foram preservados; revise o cadastro antes de continuar.')
  }
  return saved.map((tenant) => Object.freeze({ ...tenant }))
}

export function registerTenant(municipality: Municipality): Tenant {
  if (!/^[a-z0-9-]+$/.test(municipality.id)) throw new Error('Informe um ID fixo válido para a prefeitura.')
  const tenants = listTenants()
  const existing = tenants.find((tenant) => tenant.id === municipality.id)
  if (existing) return existing // Renomear a prefeitura não recria o slug ou a identidade.
  const base = municipalitySlug(municipality.city || municipality.name)
  let slug = base
  let suffix = 2
  while (tenants.some((tenant) => tenant.slug === slug)) slug = `${base}-${suffix++}`
  const tenant = Object.freeze({ ...municipality, slug })
  localStorage.setItem(TENANTS_KEY, JSON.stringify([...tenants, tenant]))
  return tenant
}

function registerConfiguredTenant(municipality: Tenant) {
  const tenants = listTenants()
  const existing = tenants.find((item) => item.id === municipality.id)
  if (existing) {
    if (existing.slug !== municipality.slug) throw new Error('O endereço cadastrado da prefeitura foi alterado. Preserve o slug original para continuar.')
    if (existing.name !== municipality.name || existing.city !== municipality.city || existing.state !== municipality.state || existing.abbreviation !== municipality.abbreviation) localStorage.setItem(TENANTS_KEY, JSON.stringify(tenants.map((item) => item.id === municipality.id ? municipality : item)))
    return
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(municipality.slug) || reservedSlugs.has(municipality.slug) || tenants.some((item) => item.slug === municipality.slug)) throw new Error('O endereço da prefeitura já está em uso ou é inválido.')
  localStorage.setItem(TENANTS_KEY, JSON.stringify([...tenants, municipality]))
}

export type TenantRoute = { kind: 'public' } | { kind: 'tenant'; tenant: Tenant } | { kind: 'redirect'; to: string } | { kind: 'missing' }
export function resolveTenantRoute(pathname: string, search = '', hash = ''): TenantRoute {
  if (pathname === '/' || pathname === '') return { kind: 'public' }
  configuredMunicipalities.forEach(registerConfiguredTenant)
  const tenants = listTenants()
  const defaultTenant = tenants.find((tenant) => tenant.id === configuredMunicipalities[0].id)!
  let first: string
  try { first = decodeURIComponent(pathname.split('/')[1] ?? '') } catch { return { kind: 'missing' } }
  if (!first || legacyRoutes.has(first)) {
    return { kind: 'redirect', to: `/${defaultTenant.slug}${first ? pathname : '/'}${search}${hash}` }
  }
  const tenant = tenants.find((item) => item.slug === first.toLowerCase())
  if (!tenant) return { kind: 'missing' }
  if (first !== tenant.slug || pathname.split('/')[1] !== tenant.slug || pathname === `/${tenant.slug}`) {
    return { kind: 'redirect', to: `/${tenant.slug}${pathname.split('/').slice(2).join('/') ? `/${pathname.split('/').slice(2).join('/')}` : '/'}${search}${hash}` }
  }
  return { kind: 'tenant', tenant }
}

export const tenantBasePath = () => activeTenant ? `/${activeTenant.slug}` : ''
export const tenantPath = (path: string) => `${tenantBasePath()}/${path.replace(/^\/+/, '')}`
export function tenantRoutePath(pathname: string): string | undefined {
  const base = tenantBasePath()
  if (!base) return pathname
  if (pathname === base) return '/'
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : undefined
}
export function tenantStorageKey(key: string, tenantId = activeTenant?.id): string {
  return tenantId ? `fluxo-publico:tenant:${tenantId}:${key.replace(/^fluxo-publico:/, '')}` : key
}
export const tenantStorage = {
  getItem: (key: string) => localStorage.getItem(tenantStorageKey(key)),
  setItem: (key: string, value: string) => localStorage.setItem(tenantStorageKey(key), value),
  removeItem: (key: string) => localStorage.removeItem(tenantStorageKey(key)),
}

export function migrateLegacyStorage(tenant: Tenant) {
  if (tenant.id !== configuredMunicipalities[0].id) return
  const marker = tenantStorageKey('fluxo-publico:legacy-migrated:v1', tenant.id)
  if (localStorage.getItem(marker)) return
  for (const key of ['database:v1', 'settings-general', 'appearance', 'theme', 'user', 'unit', 'scope-unit']) {
    const oldKey = `fluxo-publico:${key}`
    const newKey = tenantStorageKey(oldKey, tenant.id)
    const value = localStorage.getItem(oldKey)
    if (value !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value)
  }
  localStorage.setItem(marker, '1')
}
