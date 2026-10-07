import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { DEMO_PASSWORD, demoLoginUser } from './demoAuth'

describe('acesso demonstrativo', () => {
  beforeEach(() => localStorage.clear())
  it('identifica e-mail sem diferenciar caixa e preserva unidade do usuário', () => {
    const user = demoLoginUser(seedDatabase(), '  BRUNO.LIMA@example.com ', DEMO_PASSWORD)
    expect(user.id).toBe('usr-bruno')
    expect(user.unitId).toBe('u-adm')
  })
  it('recusa senha incorreta e usuário inexistente com a mesma mensagem', () => {
    expect(() => demoLoginUser(seedDatabase(), 'marina.duarte@example.com', 'incorreta')).toThrow('E-mail ou senha inválidos')
    expect(() => demoLoginUser(seedDatabase(), 'inexistente@example.com', DEMO_PASSWORD)).toThrow('E-mail ou senha inválidos')
  })
  it('recusa usuário desativado', () => {
    const db = seedDatabase()
    db.users.find((user) => user.id === 'usr-admin')!.active = false
    expect(() => demoLoginUser(db, 'marina.duarte@example.com', DEMO_PASSWORD)).toThrow('E-mail ou senha inválidos')
  })
  it('recusa unidade ou vínculo desativado', () => {
    for (const target of ['unit', 'membership']) {
      const db = seedDatabase()
      if (target === 'unit') db.units.find((unit) => unit.id === 'u-prot')!.active = false
      else db.memberships.find((membership) => membership.userId === 'usr-admin' && membership.unitId === 'u-prot')!.active = false
      expect(() => demoLoginUser(db, 'marina.duarte@example.com', DEMO_PASSWORD)).toThrow('E-mail ou senha inválidos')
    }
  })
})
