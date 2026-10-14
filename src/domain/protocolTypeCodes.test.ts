import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '../services/api'
import { seedDatabase } from '../mocks/seed'
import { loadDb, saveDb } from '../storage/database'
import { migrateDatabase } from '../storage/migrations'
import { nextProtocolTypeSuffix } from './protocolTypeCodes'

const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
const input = {
  categoryId: 'category-administrative', name: 'Tipo numerado', description: 'Cadastro com código da categoria.',
  color: '#17628b', active: true, fieldsConfig: { interested: { enabled: false }, creditor: { enabled: false }, amount: { enabled: false } },
}

describe('códigos de tipos de processo por categoria', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })

  it('compõe o código com o prefixo da categoria e persiste os três dígitos', async () => {
    const type = await api.createProtocolType(admin, { ...input, code: '999' })
    expect(type.code).toBe('02.999')
    expect(loadDb().protocolTypes.find((item) => item.id === type.id)?.code).toBe('02.999')
    const updated = await api.updateProtocolType(admin, type.id, { ...type, categoryId: 'category-service' })
    expect(updated.code).toBe('01.999')
    expect(updated.id).toBe(type.id)
  })

  it('usa a categoria selecionada mesmo quando o prefixo recebido é diferente', async () => {
    expect((await api.createProtocolType(admin, { ...input, code: '01.999' })).code).toBe('02.999')
  })

  it('recusa duplicação dentro da categoria, mas aceita o sufixo em outra', async () => {
    const type = await api.createProtocolType(admin, { ...input, code: '999' })
    await expect(api.createProtocolType(admin, { ...input, name: 'Outro tipo', code: '999' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await api.createProtocolType(admin, { ...input, name: 'Tipo de serviço', categoryId: 'category-service', code: '999' })).code).toBe('01.999')
    expect((await api.updateProtocolType(admin, type.id, type)).code).toBe('02.999')
    await expect(api.updateProtocolType(admin, type.id, { ...type, categoryId: 'category-service' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it.each(['', '12', '1234', 'abc'])('recusa o sufixo inválido %j', async (code) => {
    await expect(api.createProtocolType(admin, { ...input, code })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('sugere código disponível e mantém a criação por IA compatível', async () => {
    const suffix = nextProtocolTypeSuffix(loadDb().protocolTypes, input.categoryId)
    const { type } = await api.createProtocolTypeWithFlow(admin, { ...input, flowMode: 'NONE' }, [])
    expect(type.code).toBe(`02.${suffix}`)
  })

  it('atribui códigos aos cadastros antigos sem mudar vínculos e é idempotente', () => {
    const legacy = seedDatabase()
    const ids = legacy.protocolTypes.map((type) => type.id)
    legacy.protocolTypes[1].code = '02.999'
    const migrated = migrateDatabase(legacy)
    expect(migrated.protocolTypes.map((type) => type.id)).toEqual(ids)
    expect(migrated.protocols).toEqual(legacy.protocols)
    expect(migrated.protocolTypes[1].code).toMatch(/\.999$/)
    expect(new Set(migrated.protocolTypes.map((type) => type.code)).size).toBe(ids.length)
    expect(migrateDatabase(migrated)).toEqual(migrated)
  })

  it('atualiza somente o prefixo quando o código da categoria muda', async () => {
    const db = loadDb()
    const category = db.processCategories.find((item) => item.id === input.categoryId)!
    const codes = db.protocolTypes.filter((type) => type.categoryId === category.id).map((type) => type.code!.split('.')[1])
    await api.updateProcessCategory(admin, category.id, { ...category, code: '09' })
    expect(loadDb().protocolTypes.filter((type) => type.categoryId === category.id).map((type) => type.code)).toEqual(codes.map((suffix) => `09.${suffix}`))
  })
})
