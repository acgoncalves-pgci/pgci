import type { Database } from '../domain/model'

// This local demonstration has no authentication server or user passwords.
export const DEMO_PASSWORD = 'Pgci@2026'
export function demoSessionUsers(db: Database) {
  return db.users.filter((user) => user.active &&
    db.units.some((unit) => unit.id === user.unitId && unit.active) &&
    db.memberships.some((membership) => membership.userId === user.id && membership.unitId === user.unitId && membership.active))
}
export function demoLoginUser(db: Database, email: string, password: string) {
  const user = demoSessionUsers(db).find((item) => item.email.toLocaleLowerCase() === email.trim().toLocaleLowerCase())
  if (password !== DEMO_PASSWORD || !user) {
    throw new Error('E-mail ou senha inválidos. Confira os dados e tente novamente.')
  }
  return user
}
