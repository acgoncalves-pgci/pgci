import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { activateTenant, getActiveTenant, listTenants, migrateLegacyStorage, municipalitySlug, registerTenant, resolveTenantRoute, tenantPath, tenantRoutePath, tenantStorage, tenantStorageKey, TENANTS_KEY } from './tenants'
import { loadDb, saveDb } from '../storage/database'
import { requireActor } from '../domain/rules'
import { consultationUrl } from '../features/relatorios/reportData'

const mateus = { id: 'prefeitura-saomateus-ma', name: 'Prefeitura Municipal de São Mateus do Maranhão', city: 'São Mateus do Maranhão', state: 'MA', abbreviation: 'PMSM' }
const axixa = { id: 'prefeitura-axixa-ma', name: 'Prefeitura de Axixá', city: 'Axixá', state: 'MA', abbreviation: 'PMA' }
beforeEach(() => { activateTenant(); localStorage.clear() })
afterEach(() => { activateTenant(); localStorage.clear() })

describe('identidade SaaS da prefeitura', () => {
  it('gera o endereço automaticamente, remove acentos e protege nomes reservados', () => {
    expect(municipalitySlug('Prefeitura Municipal de São Mateus do Maranhão')).toBe('saomateusdomaranhao')
    expect(municipalitySlug('Axixá')).toBe('axixa')
    expect(municipalitySlug('Login')).toBe('prefeituralogin')
    expect(() => municipalitySlug('!!!')).toThrow()
  })
  it('resolve colisões e conserva o slug e ID ao renomear uma prefeitura', () => {
    const first = registerTenant(mateus)
    const second = registerTenant({ ...mateus, id: 'outra-prefeitura' })
    expect(second.slug).toBe('saomateusdomaranhao-2')
    expect(registerTenant({ ...mateus, name: 'Novo nome', city: 'Nova cidade' })).toEqual(first)
    expect(listTenants()).toHaveLength(2)
    expect(Object.isFrozen(first)).toBe(true)
  })
  it('redireciona endereços antigos e mantém o caminho, filtros e fragmento', () => {
    expect(resolveTenantRoute('/')).toEqual({ kind: 'public' })
    expect(resolveTenantRoute('/documentos/doc-1/editar', '?origem=lista', '#conteudo')).toEqual({ kind: 'redirect', to: '/saomateusdomaranhao/documentos/doc-1/editar?origem=lista#conteudo' })
    expect(resolveTenantRoute('/saomateusdomaranhao')).toEqual({ kind: 'redirect', to: '/saomateusdomaranhao/' })
    expect(resolveTenantRoute('/SAOMATEUSDOMARANHAO/login').kind).toBe('redirect')
  })
  it('não cria nem escolhe uma prefeitura ao receber slug desconhecido ou inválido', () => {
    expect(resolveTenantRoute('/desconhecida/login')).toEqual({ kind: 'missing' })
    expect(resolveTenantRoute('/%invalid/login')).toEqual({ kind: 'missing' })
    expect(listTenants()).toHaveLength(1)
    expect(getActiveTenant()).toBeUndefined()
  })
  it('recusa alterar o slug de uma identidade publicada ou carregar endereços duplicados', () => {
    resolveTenantRoute('/saomateusdomaranhao/')
    const records = listTenants()
    localStorage.setItem(TENANTS_KEY, JSON.stringify([{ ...records[0], slug: 'outro-endereco' }]))
    expect(() => resolveTenantRoute('/outro-endereco/')).toThrow('Preserve o slug original')
    localStorage.setItem(TENANTS_KEY, JSON.stringify([records[0], { ...records[0], id: 'outra-prefeitura' }]))
    expect(() => listTenants()).toThrow('cadastro local')
  })
})

describe('separação local por prefeitura', () => {
  it('separa registros, sessão e configurações mesmo com IDs de demonstração iguais', () => {
    const first = registerTenant(mateus)
    const second = registerTenant(axixa)
    activateTenant(first)
    const db = loadDb()
    db.protocols[0].subject = 'Exclusivo de São Mateus'
    saveDb(db)
    tenantStorage.setItem('fluxo-publico:user', 'usr-admin')
    tenantStorage.setItem('fluxo-publico:settings-general', '{"organizationName":"Nome alterado"}')
    activateTenant(second)
    expect(loadDb().organization.id).toBe(second.id)
    expect(loadDb().protocols[0].subject).not.toBe('Exclusivo de São Mateus')
    expect(tenantStorage.getItem('fluxo-publico:user')).toBeNull()
    expect(tenantStorage.getItem('fluxo-publico:settings-general')).toBeNull()
    activateTenant(first)
    expect(loadDb().protocols[0].subject).toBe('Exclusivo de São Mateus')
    expect(tenantStorage.getItem('fluxo-publico:user')).toBe('usr-admin')
    expect(tenantPath('/documentos')).toBe('/saomateusdomaranhao/documentos')
    expect(tenantRoutePath('/saomateusdomaranhao/documentos')).toBe('/documentos')
    expect(tenantRoutePath('/axixa/documentos')).toBeUndefined()
  })
  it('migra dados legados uma única vez para a prefeitura padrão, sem sobrescrever o destino', () => {
    const first = registerTenant(mateus)
    const second = registerTenant(axixa)
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:settings-general', '{"organizationName":"Instituição existente"}')
    migrateLegacyStorage(second)
    expect(localStorage.getItem(tenantStorageKey('fluxo-publico:user', second.id))).toBeNull()
    migrateLegacyStorage(first)
    expect(localStorage.getItem(tenantStorageKey('fluxo-publico:user', first.id))).toBe('usr-admin')
    expect(localStorage.getItem('fluxo-publico:settings-general')).toContain('Instituição existente')
    localStorage.removeItem(tenantStorageKey('fluxo-publico:user', first.id))
    migrateLegacyStorage(first)
    expect(localStorage.getItem(tenantStorageKey('fluxo-publico:user', first.id))).toBeNull()
  })
  it('recusa contexto de outra prefeitura e inclui o slug no QR de consulta', () => {
    const first = registerTenant(mateus)
    activateTenant(first)
    const db = loadDb()
    expect(() => requireActor(db, { tenantId: 'outra', userId: 'usr-admin', activeUnitId: 'u-prot' })).toThrow('outra prefeitura')
    const address = new URL(consultationUrl(db.protocols[0], '', false, 'https://dominio.test'))
    expect(address.pathname).toBe('/saomateusdomaranhao/consulta')
    expect(address.searchParams.get('numero')).toBe(db.protocols[0].number)
  })
})
