import type { Database, ProtocolType } from './model'

export const protocolTypeSuffix = (code?: string) => code?.split('.').at(-1) ?? ''

export const nextProtocolTypeSuffix = (types: ProtocolType[], categoryId: string) => {
  const used = new Set(types.filter((type) => type.categoryId === categoryId).map((type) => protocolTypeSuffix(type.code)))
  for (let number = 1; number <= 999; number++) {
    const suffix = String(number).padStart(3, '0')
    if (!used.has(suffix)) return suffix
  }
  return ''
}

// Add codes to older local records without changing IDs or process links.
export const normalizeProtocolTypeCodes = (db: Database): Database => {
  const assigned: ProtocolType[] = []
  // Reserve existing suffixes before assigning codes to records without one.
  const reserved = db.protocolTypes.filter((type) => /^\d{3}$/.test(protocolTypeSuffix(type.code)))
  const protocolTypes = db.protocolTypes.map((type) => {
    const category = db.processCategories.find((item) => item.id === type.categoryId)
    if (!category) return type
    let suffix = protocolTypeSuffix(type.code)
    if (!/^\d{3}$/.test(suffix) || assigned.some((item) => item.categoryId === type.categoryId && protocolTypeSuffix(item.code) === suffix)) {
      suffix = nextProtocolTypeSuffix([...reserved, ...assigned], type.categoryId)
    }
    if (!suffix) throw new Error('Não há códigos disponíveis nesta categoria.')
    const coded = { ...type, code: `${category.code}.${suffix}` }
    assigned.push(coded)
    return coded
  })
  return { ...db, protocolTypes }
}
