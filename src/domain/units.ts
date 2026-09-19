import type { Unit } from './model'

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
