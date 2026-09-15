import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorageError, cleanupOrphanedBlobs, deleteBlob, getBlob, putBlob } from './database'

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