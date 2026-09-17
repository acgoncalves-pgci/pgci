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

    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.units.map((unit) => unit.position)).toEqual([0, 1, 0, 2, 3])
    expect(migrated.memberships).toHaveLength(migrated.users.length + migrated.units.filter((unit) => unit.active).length - 1)
    expect(migrated.memberships.find((membership) => membership.userId === 'usr-admin')).toMatchObject({
      unitId: 'u-prot',
      role: 'ADMIN',
      active: true,
    })
    expect(migrated.auditEvents).toEqual([])
    expect(migrated.flows).toHaveLength(1)
    expect(migrated.phases.map((phase) => phase.code)).toEqual(['TRIAGEM', 'ANALISE', 'CONCLUSAO'])
    expect(migrated.protocolTypes.every((type) => type.flowId === migrated.flows[0].id)).toBe(true)
    expect(migrated.protocols.every((protocol) => protocol.flowSnapshot?.flowId === migrated.flows[0].id)).toBe(true)
  })
})