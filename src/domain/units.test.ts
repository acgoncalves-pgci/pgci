import { describe, expect, it } from 'vitest'
import type { Unit } from './model'
import { canReparentUnit, sortUnitsByPath, unitPath } from './units'

const units: Unit[] = [
  { id: 'root', name: 'Prefeitura', abbreviation: 'PM', active: true },
  { id: 'admin', name: 'Administração', abbreviation: 'ADM', parentId: 'root', active: true },
  { id: 'finance', name: 'Financeiro', abbreviation: 'FIN', parentId: 'admin', active: true },
  { id: 'legal', name: 'Jurídico', abbreviation: 'JUR', parentId: 'root', active: true },
]

describe('caminhos de unidades organizacionais', () => {
  it('distingue unidades filhas usando toda a hierarquia', () => {
    expect(unitPath(units, 'finance')).toBe('Prefeitura / Administração / Financeiro')
    expect(unitPath(units, 'legal')).toBe('Prefeitura / Jurídico')
  })

  it('ordena pais e descendentes pelo caminho exibido', () => {
    expect(sortUnitsByPath([units[2], units[3], units[0], units[1]]).map((unit) => unit.id)).toEqual([
      'root',
      'admin',
      'finance',
      'legal',
    ])
  })

  it('permite outro pai ou o nível principal e impede ciclos em qualquer profundidade', () => {
    expect(canReparentUnit(units, 'finance', 'legal')).toBe(true)
    expect(canReparentUnit(units, 'finance')).toBe(true)
    expect(canReparentUnit(units, 'admin', 'admin')).toBe(false)
    expect(canReparentUnit(units, 'root', 'finance')).toBe(false)
    expect(canReparentUnit(units, 'admin', 'finance')).toBe(false)
    expect(canReparentUnit(units, 'finance', 'missing')).toBe(false)
    expect(canReparentUnit(units, 'finance', 'root')).toBe(true)
    expect(canReparentUnit(units.map((unit) => unit.id === 'legal' ? { ...unit, active: false } : unit), 'finance', 'legal')).toBe(false)
  })

  it('termina e rejeita um pai com ciclo pré-existente', () => {
    const cyclic = units.map((unit) => unit.id === 'root' ? { ...unit, parentId: 'admin' } : unit)
    expect(canReparentUnit(cyclic, 'legal', 'finance')).toBe(false)
  })
})
