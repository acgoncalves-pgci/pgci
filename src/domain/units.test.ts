import { describe, expect, it } from 'vitest'
import type { Unit } from './model'
import { sortUnitsByPath, unitPath } from './units'

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
})
