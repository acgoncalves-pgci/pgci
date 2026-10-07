import type { Unit } from './model'

export const canReparentUnit = (units: Unit[], unitId: string, parentId?: string) => {
  if (!units.some((unit) => unit.id === unitId)) return false
  if (!parentId) return true
  let parent = units.find((unit) => unit.id === parentId)
  if (!parent?.active) return false
  const visited = new Set<string>([unitId])
  while (parent) {
    if (visited.has(parent.id)) return false
    visited.add(parent.id)
    parent = parent.parentId ? units.find((unit) => unit.id === parent?.parentId) : undefined
  }
  return true
}

export const unitPath = (units: Unit[], unitId: string) => {
  const names: string[] = []
  const visited = new Set<string>()
  let current = units.find((unit) => unit.id === unitId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? units.find((unit) => unit.id === current?.parentId) : undefined
  }

  return names.length ? names.join(' / ') : 'Unidade não encontrada'
}

export const sortUnitsByPath = (units: Unit[]) =>
  units.slice().sort((left, right) =>
    unitPath(units, left.id).localeCompare(unitPath(units, right.id), 'pt-BR'),
  )
