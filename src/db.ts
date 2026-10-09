// Minimal IndexedDB wrapper for specimens, ecosystem snapshots and habitat presets.
export type StoreName = 'specimens' | 'snapshots' | 'presets';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open('sonogenesis', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['specimens', 'snapshots', 'presets']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbp;
}

export async function dbPut<T extends { id: string }>(store: StoreName, obj: T): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function dbAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res(req.result as T[]);
    req.onerror = () => rej(req.error);
  });
}

export async function dbDel(store: StoreName, id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export interface Specimen {
  id: string;
  name: string;
  genome: number[];
  motif: number[];
  speciesName: string;
  generation: number;
  saved: number;
  lineage?: { id: number; gen: number; genome: number[]; speciesId: number }[];
}

export interface SnapshotRec {
  id: string;
  name: string;
  saved: number;
  pop: number;
  species: number;
  time: number;
  seed: number;
  data: unknown;
}

export interface PresetRec {
  id: string;
  name: string;
  params: unknown;
}
