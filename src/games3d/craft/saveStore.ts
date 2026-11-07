import {
  SAVE_SLOTS,
  decodeSave,
  encodeSave,
  type SaveRecord,
  type SaveSlot,
} from './save';

export const SAVE_DB_NAME = 'neonrift-craft';
export const SAVE_STORE_NAME = 'worlds';
export const SAVE_DB_VERSION = 1;

interface StoredWorld {
  slot: number;
  payload: string;
}

export type SlotLoad =
  | { status: 'empty' }
  | { status: 'ok'; record: SaveRecord }
  | { status: 'unreadable'; detail: string };

export type SlotSummary =
  | { slot: SaveSlot; status: 'empty' }
  | { slot: SaveSlot; status: 'ok'; record: SaveRecord }
  | { slot: SaveSlot; status: 'unreadable'; detail: string };

export interface SaveStore {
  list(): Promise<SlotSummary[]>;
  load(slot: SaveSlot): Promise<SlotLoad>;
  /** Replacing an unreadable slot is only allowed after an explicit remove(). */
  write(record: SaveRecord): Promise<void>;
  remove(slot: SaveSlot): Promise<void>;
}

export class SaveCorruptError extends Error {
  constructor(
    readonly slot: SaveSlot,
    readonly detail: string,
  ) {
    super(`Slot ${slot} is unreadable: ${detail}`);
    this.name = 'SaveCorruptError';
  }
}

export function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SAVE_DB_NAME, SAVE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SAVE_STORE_NAME)) {
        database.createObjectStore(SAVE_STORE_NAME, { keyPath: 'slot' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open save database'));
  });
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Save request failed'));
  });
}

function writeTransaction(
  database: IDBDatabase,
  run: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SAVE_STORE_NAME, 'readwrite');
    run(transaction.objectStore(SAVE_STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Save write failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Save write aborted'));
  });
}

function decodeStored(raw: unknown): SlotLoad {
  if (raw === undefined) return { status: 'empty' };
  if (typeof raw !== 'object' || raw === null) {
    return { status: 'unreadable', detail: 'stored record is malformed' };
  }
  const payload = (raw as { payload?: unknown }).payload;
  if (typeof payload !== 'string') {
    return { status: 'unreadable', detail: 'stored record has no payload' };
  }
  const decoded = decodeSave(payload);
  if (!decoded.ok) return { status: 'unreadable', detail: decoded.detail };
  return { status: 'ok', record: decoded.record };
}

export function createSaveStore(factory: IDBFactory): SaveStore {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = (): Promise<IDBDatabase> => {
    if (databasePromise === null) databasePromise = openDatabase(factory);
    return databasePromise;
  };

  const load = async (slot: SaveSlot): Promise<SlotLoad> => {
    const db = await database();
    const store = db.transaction(SAVE_STORE_NAME, 'readonly').objectStore(SAVE_STORE_NAME);
    return decodeStored(await readRequest<unknown>(store.get(slot)));
  };

  return {
    load,

    async list() {
      return Promise.all(
        SAVE_SLOTS.map(async (slot) => ({ slot, ...(await load(slot)) })),
      );
    },

    async write(record) {
      const existing = await load(record.slot);
      if (existing.status === 'unreadable') {
        throw new SaveCorruptError(record.slot, existing.detail);
      }
      const db = await database();
      const stored: StoredWorld = { slot: record.slot, payload: encodeSave(record) };
      await writeTransaction(db, (store) => store.put(stored));
    },

    async remove(slot) {
      const db = await database();
      await writeTransaction(db, (store) => store.delete(slot));
    },
  };
}