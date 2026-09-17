import type { Database } from '../domain/model';
import { seedDatabase } from '../mocks/seed';
import { migrateDatabase } from './migrations';
export const DATABASE_KEY = 'fluxo-publico:database:v1';
const BLOB_DB = 'fluxo-publico-blobs';
const SEED_BLOB_KEY = 'seed-comprovante';
const seedBlob = () => new Blob(['Comprovante fictício disponível para visualização.'], { type: 'text/plain' });
const fallbackBlobs = new Map<string, Blob>();
type StorageFailure = 'QUOTA' | 'UNAVAILABLE' | 'READ' | 'WRITE';
export class StorageError extends Error {
    constructor(public readonly code: StorageFailure, message: string, public readonly cause?: unknown) { super(message); this.name = 'StorageError'; }
}
export const storageErrorMessage = (error: unknown) => {
    const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
    if (name === 'QuotaExceededError')
        return 'Não há espaço de armazenamento suficiente no navegador. Remova dados locais ou tente anexar arquivos menores.';
    if (name === 'InvalidStateError' || name === 'NotSupportedError')
        return 'O armazenamento de arquivos (IndexedDB) não está disponível neste navegador.';
    if (name === 'SecurityError')
        return 'O navegador bloqueou o armazenamento local para este site. Revise as permissões e tente novamente.';
    return 'Não foi possível acessar o armazenamento local de arquivos. Tente novamente.';
};
const storageError = (code: StorageFailure, error: unknown) => error instanceof StorageError ? error : new StorageError(code, storageErrorMessage(error), error);
const isIndexedDbAvailable = () => typeof indexedDB !== 'undefined';
export const loadDb = (): Database => {
    let raw: string | null;
    try {
        raw = localStorage.getItem(DATABASE_KEY);
    }
    catch (error) {
        throw storageError('READ', error);
    }
    if (!raw) {
        const db = seedDatabase();
        saveDb(db);
        ensureSeedBlob();
        return db;
    }
    try {
        const migrated = migrateDatabase(JSON.parse(raw));
        saveDb(migrated);
        return migrated;
    }
    catch {
        throw new StorageError('READ', 'Os dados locais são incompatíveis. Restaure a demonstração para continuar.');
    }
};
export const saveDb = (db: Database) => { try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(db));
}
catch (error) {
    throw storageError('WRITE', error);
} };
const ensureSeedBlob = () => { const blob = seedBlob(); fallbackBlobs.set(SEED_BLOB_KEY, blob); void putBlob(SEED_BLOB_KEY, blob).catch(() => undefined); };
export const resetDb = async () => { try {
    localStorage.removeItem(DATABASE_KEY);
}
catch (error) {
    throw storageError('WRITE', error);
} ; fallbackBlobs.clear(); await clearBlobs().catch(() => undefined); const db = loadDb(); ensureSeedBlob(); window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'success', message: 'Demonstração restaurada com sucesso.' } })); return db; };
const openBlobs = () => new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
        reject(new StorageError('UNAVAILABLE', 'O armazenamento de arquivos (IndexedDB) não está disponível neste navegador.'));
        return;
    }
    let request: IDBOpenDBRequest;
    try {
        request = indexedDB.open(BLOB_DB, 1);
    }
    catch (error) {
        reject(storageError('UNAVAILABLE', error));
        return;
    }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('blobs'))
        request.result.createObjectStore('blobs'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError('UNAVAILABLE', request.error));
});
const transaction = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void) => {
    const db = await openBlobs();
    return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction('blobs', mode);
        let request: IDBRequest<T> | void;
        try {
            request = run(tx.objectStore('blobs'));
        }
        catch (error) {
            db.close();
            reject(storageError(mode === 'readonly' ? 'READ' : 'WRITE', error));
            return;
        }
        tx.oncomplete = () => { db.close(); resolve(request?.result); };
        tx.onerror = () => { db.close(); reject(storageError(mode === 'readonly' ? 'READ' : 'WRITE', tx.error)); };
        tx.onabort = () => { db.close(); reject(storageError(mode === 'readonly' ? 'READ' : 'WRITE', tx.error)); };
    });
};
export const putBlob = async (key: string, blob: Blob) => { try {
    await transaction('readwrite', (store) => store.put(blob, key));
}
catch (error) {
    throw storageError('WRITE', error);
} };
export const getBlob = async (key: string) => { try {
    const blob = await transaction<Blob>('readonly', (store) => store.get(key));
    return blob ?? fallbackBlobs.get(key);
}
catch (error) {
    const fallback = fallbackBlobs.get(key);
    if (fallback)
        return fallback;
    throw storageError('READ', error);
} };
export const deleteBlob = async (key: string) => { fallbackBlobs.delete(key); try {
    await transaction('readwrite', (store) => store.delete(key));
}
catch (error) {
    throw storageError('WRITE', error);
} };
export const clearBlobs = async () => { fallbackBlobs.clear(); try {
    await transaction('readwrite', (store) => store.clear());
}
catch (error) {
    throw storageError('WRITE', error);
} };
export const cleanupOrphanedBlobs = async (liveKeys: Iterable<string>) => {
    const retained = new Set(liveKeys);
    for (const key of fallbackBlobs.keys())
        if (!retained.has(key))
            fallbackBlobs.delete(key);
    try {
        const keys = await transaction<IDBValidKey[]>('readonly', (store) => store.getAllKeys()) ?? [];
        await Promise.all(keys.filter((key) => typeof key === 'string' && !retained.has(key)).map((key) => deleteBlob(String(key))));
    }
    catch (error) {
        throw storageError('READ', error);
    }
};
