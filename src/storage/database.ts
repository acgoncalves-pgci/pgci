import { normalizeDemoNumbers } from '../mocks/normalizeDemoNumbers';
import type { Database } from '../domain/model';
import { seedDatabase } from '../mocks/seed';
import { seedAttachmentBlob } from '../mocks/seedFiles';
import { migrateDatabase } from './migrations';
import { getActiveTenant, tenantStorage, tenantStorageKey } from '../saas/tenants';
import { configuredMunicipalities } from '../saas/config';
export const DATABASE_KEY = 'fluxo-publico:database:v1';
const BLOB_DB = 'fluxo-publico-blobs';
const tenantFallbackBlobs = new Map<string, Map<string, Blob>>();
const fallbackBlobs = () => {
    const scope = getActiveTenant()?.id ?? 'legacy';
    if (!tenantFallbackBlobs.has(scope)) tenantFallbackBlobs.set(scope, new Map());
    return tenantFallbackBlobs.get(scope)!;
};
const blobDatabaseName = () => getActiveTenant() ? `${BLOB_DB}-${getActiveTenant()!.id}` : BLOB_DB;
const newDatabase = (options?: Parameters<typeof seedDatabase>[0]) => {
    const tenant = getActiveTenant();
    return migrateDatabase(seedDatabase({ ...options, organization: tenant ? { id: tenant.id, name: tenant.name, abbreviation: tenant.abbreviation } : options?.organization }));
};
let demoResetSequence = 0;
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
        raw = tenantStorage.getItem(DATABASE_KEY);
    }
    catch (error) {
        throw storageError('READ', error);
    }
    if (!raw) {
        const db = newDatabase();
        saveDb(db);
        ensureSeedBlobs(db);
        return db;
    }
    try {
        const migrated = normalizeDemoNumbers(migrateDatabase(JSON.parse(raw)));
        if (getActiveTenant()) migrated.organization.id = getActiveTenant()!.id;
        saveDb(migrated);
        return migrated;
    }
    catch {
        throw new StorageError('READ', 'Os dados locais são incompatíveis. Restaure a demonstração para continuar.');
    }
};
export const saveDb = (db: Database) => { try {
    tenantStorage.setItem(DATABASE_KEY, JSON.stringify(db));
}
catch (error) {
    throw storageError('WRITE', error);
} };
const ensureSeedBlobs = (db: Database) => {
    const fallback = fallbackBlobs();
    const name = blobDatabaseName();
    const files = db.attachments.flatMap((attachment) => {
        const blob = seedAttachmentBlob(attachment, db);
        if (!blob) return [];
        fallback.set(attachment.blobKey, blob);
        return [{ key: attachment.blobKey, blob }];
    });
    // Capture the tenant before the asynchronous IndexedDB operation.
    void transaction('readwrite', (store) => { files.forEach(({ key, blob }) => store.put(blob, key)); }, name).catch(() => undefined);
};
export const resetDb = async () => { try {
    tenantStorage.removeItem(DATABASE_KEY);
}
catch (error) {
    throw storageError('WRITE', error);
} ; fallbackBlobs().clear(); await clearBlobs().catch(() => undefined); const db = newDatabase({ variation: Date.now() + ++demoResetSequence }); saveDb(db); ensureSeedBlobs(db); window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'success', message: 'Demonstração restaurada com sucesso.' } })); return db; };
const openBlobs = (name = blobDatabaseName()) => new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
        reject(new StorageError('UNAVAILABLE', 'O armazenamento de arquivos (IndexedDB) não está disponível neste navegador.'));
        return;
    }
    let request: IDBOpenDBRequest;
    try {
        request = indexedDB.open(name, 1);
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
const transaction = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void, name = blobDatabaseName()) => {
    const db = await openBlobs(name);
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
export const getBlob = async (key: string) => {
    const fallback = fallbackBlobs();
    if (!fallback.has(key) && (key === 'seed-comprovante' || key.startsWith('seed-v2:'))) {
        const db = loadDb();
        const attachment = db.attachments.find((item) => item.blobKey === key);
        const blob = attachment && seedAttachmentBlob(attachment, db);
        if (blob) fallback.set(key, blob);
    }
    const name = blobDatabaseName();
    try {
    const blob = await transaction<Blob>('readonly', (store) => store.get(key), name);
    return blob ?? fallback.get(key);
}
catch (error) {
    const blob = fallback.get(key);
    if (blob)
        return blob;
    throw storageError('READ', error);
} };
export const deleteBlob = async (key: string) => { fallbackBlobs().delete(key); try {
    await transaction('readwrite', (store) => store.delete(key));
}
catch (error) {
    throw storageError('WRITE', error);
} };
export const clearBlobs = async () => { fallbackBlobs().clear(); try {
    await transaction('readwrite', (store) => store.clear());
}
catch (error) {
    throw storageError('WRITE', error);
} };
export const cleanupOrphanedBlobs = async (liveKeys: Iterable<string>) => {
    const retained = new Set(liveKeys);
    for (const key of fallbackBlobs().keys())
        if (!retained.has(key))
            fallbackBlobs().delete(key);
    try {
        const keys = await transaction<IDBValidKey[]>('readonly', (store) => store.getAllKeys()) ?? [];
        await Promise.all(keys.filter((key) => typeof key === 'string' && !retained.has(key)).map((key) => deleteBlob(String(key))));
    }
    catch (error) {
        throw storageError('READ', error);
    }
};
const legacyBlobMigrations = new Map<string, Promise<void>>();
export function migrateLegacyBlobs(tenantId: string): Promise<void> {
    const marker = tenantStorageKey('fluxo-publico:legacy-blobs-migrated:v1', tenantId);
    if (tenantId !== configuredMunicipalities[0].id || localStorage.getItem(marker) || !localStorage.getItem(DATABASE_KEY) || !isIndexedDbAvailable()) return Promise.resolve();
    const pending = legacyBlobMigrations.get(tenantId);
    if (pending) return pending;
    const migration = (async () => {
        const destination = `${BLOB_DB}-${tenantId}`;
        const keys = await transaction<IDBValidKey[]>('readonly', (store) => store.getAllKeys(), BLOB_DB) ?? [];
        for (const key of keys) {
            const existing = await transaction<Blob>('readonly', (store) => store.get(key), destination);
            if (existing) continue;
            const blob = await transaction<Blob>('readonly', (store) => store.get(key), BLOB_DB);
            if (blob) await transaction('readwrite', (store) => store.put(blob, key), destination);
        }
        localStorage.setItem(marker, '1');
    })().finally(() => legacyBlobMigrations.delete(tenantId));
    legacyBlobMigrations.set(tenantId, migration);
    return migration;
}
