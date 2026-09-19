import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorageError, cleanupOrphanedBlobs, deleteBlob, getBlob, putBlob } from './database'
import { seedDatabase } from '../mocks/seed'
import { migrateDatabase } from './migrations'

const createIndexedDb = () => {
  const blobs = new Map<string, Blob>()
  let hasStore = false
  const database = {
    objectStoreNames: { contains: () => hasStore },
    createObjectStore: () => { hasStore = true },
    close: vi.fn(),
    transaction: () => {
      const state: { transaction?: IDBTransaction } = {}
      const complete = () => queueMicrotask(() => state.transaction?.oncomplete?.(new Event('complete')))
      const store = {
        put: (blob: Blob, key: IDBValidKey) => { blobs.set(String(key), blob); complete(); return { result: key } as IDBRequest<IDBValidKey> },
        get: (key: IDBValidKey) => { const request = { result: blobs.get(String(key)) } as IDBRequest<Blob | undefined>; complete(); return request },
        delete: (key: IDBValidKey) => { blobs.delete(String(key)); complete(); return { result: undefined } as IDBRequest<undefined> },
        clear: () => { blobs.clear(); complete(); return { result: undefined } as IDBRequest<undefined> },
        getAllKeys: () => { const request = { result: [...blobs.keys()] } as IDBRequest<IDBValidKey[]>; complete(); return request }
      } as unknown as IDBObjectStore
      const transaction = { objectStore: () => store, oncomplete: null, onerror: null, onabort: null, error: null } as unknown as IDBTransaction
      state.transaction = transaction
      return transaction
    }
  } as unknown as IDBDatabase
  const open = vi.fn(() => {
    const request = { result: database } as unknown as IDBOpenDBRequest
    queueMicrotask(() => {
      request.onupgradeneeded?.(new Event('upgradeneeded') as IDBVersionChangeEvent)
      request.onsuccess?.(new Event('success'))
    })
    return request
  })
  return { blobs, database, indexedDb: { open } as unknown as IDBFactory }
}

afterEach(() => vi.unstubAllGlobals())

describe('armazenamento de anexos', () => {
  it('persiste, recupera, remove e limpa arquivos órfãos no IndexedDB', async () => {
    const fake = createIndexedDb(); vi.stubGlobal('indexedDB', fake.indexedDb)
    const retained = new Blob(['manter'], { type: 'text/plain' })
    const orphan = new Blob(['remover'], { type: 'text/plain' })

    await putBlob('attachment-retained', retained)
    await putBlob('attachment-orphan', orphan)
    expect(await getBlob('attachment-retained')).toBe(retained)

    await cleanupOrphanedBlobs(['attachment-retained'])
    expect(await getBlob('attachment-orphan')).toBeUndefined()
    await deleteBlob('attachment-retained')
    expect(await getBlob('attachment-retained')).toBeUndefined()
    expect(fake.database.close).toHaveBeenCalled()
  })

  it('retorna erro de escrita acionável quando o IndexedDB não está disponível', async () => {
    vi.stubGlobal('indexedDB', undefined)

    await expect(putBlob('attachment-unavailable', new Blob(['conteúdo']))).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      name: StorageError.name
    })
  })
})

describe('migração do banco local', () => {
  it('converte a versão 1 em estrutura ordenada e vínculos de unidades', () => {
    const legacy = structuredClone(seedDatabase()) as unknown as {
      schemaVersion: number
      units: Array<{ position?: number }>
      memberships?: unknown
      auditEvents?: unknown
    }
    legacy.schemaVersion = 1
    legacy.units.forEach((unit) => delete unit.position)
    delete legacy.memberships
    delete legacy.auditEvents

    const migrated = migrateDatabase(legacy)

    expect(migrated.schemaVersion).toBe(5)
    expect(migrated.units.map((unit) => unit.position)).toEqual([0, 1, 0, 2, 3])
    expect(migrated.memberships).toHaveLength(migrated.users.length + migrated.units.filter((unit) => unit.active).length - 1)
    expect(migrated.memberships.find((membership) => membership.userId === 'usr-admin')).toMatchObject({
      unitId: 'u-prot',
      role: 'ADMIN',
      active: true,
    })
    expect(migrated.auditEvents).toEqual([])
    expect(migrated.processCategories).toHaveLength(2)
    expect(migrated.protocolTypes.every((type) => type.categoryId)).toBe(true)
    expect(migrated.situations).toHaveLength(7)
    expect(migrated.situations.every((situation) => situation.system)).toBe(true)
    expect(migrated.flows).toHaveLength(1)
    expect(migrated.phases.map((phase) => phase.code)).toEqual(['TRIAGEM', 'ANALISE', 'CONCLUSAO'])
    expect(migrated.protocolTypes.every((type) => type.flowId === migrated.flows[0].id)).toBe(true)
    expect(migrated.protocols.every((protocol) => protocol.flowSnapshot?.flowId === migrated.flows[0].id)).toBe(true)
  })
})
describe('migração de situações da versão 3', () => {
  it('converte a situação fixa da etapa e do snapshot para o novo cadastro', () => {
    const legacy = structuredClone(seedDatabase()) as unknown as {
      schemaVersion: number
      situations?: unknown
      flowPhases: Array<{ situation?: 'EM_ANDAMENTO'; situationTypeId?: string }>
      protocols: Array<{ flowSnapshot?: { phases: Array<{ situation?: 'CADASTRADO'; situationType?: unknown }> } }>
    }
    legacy.schemaVersion = 3
    delete legacy.situations
    legacy.flowPhases[0].situation = 'EM_ANDAMENTO'
    delete legacy.flowPhases[0].situationTypeId
    const firstSnapshotPhase = legacy.protocols[0].flowSnapshot!.phases[0]
    firstSnapshotPhase.situation = 'CADASTRADO'
    delete firstSnapshotPhase.situationType

    const migrated = migrateDatabase(legacy)

    expect(migrated.flowPhases[0].situationTypeId).toBe('situation-processing')
    expect(migrated.protocols[0].flowSnapshot?.phases[0].situationType).toMatchObject({
      id: 'situation-registered',
      name: 'Cadastrado',
    })
  })
})


describe('migração de categorias da versão 4', () => {
  it('cria as categorias iniciais e vincula os tipos existentes', () => {
    const legacy = structuredClone(seedDatabase()) as unknown as {
      schemaVersion: number
      processCategories?: unknown
      protocolTypes: Array<{ id: string; categoryId?: string }>
    }
    legacy.schemaVersion = 4
    delete legacy.processCategories
    legacy.protocolTypes.forEach((type) => delete type.categoryId)

    const migrated = migrateDatabase(legacy)

    expect(migrated.schemaVersion).toBe(5)
    expect(migrated.processCategories.map((category) => category.code)).toEqual(['01', '02'])
    expect(migrated.protocolTypes.every((type) => type.categoryId)).toBe(true)
  })
})
