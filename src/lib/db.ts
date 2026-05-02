import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'VoxGeminiStore';
const STORE_NAME = 'segments';
const CACHE_STORE = 'audio_cache';

export interface TtsSegment {
  id: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  audioBlob?: Blob;
  error?: string;
  index: number;
}

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
    },
  });
}

export async function saveSegment(segment: TtsSegment) {
  const db = await initDB();
  return db.put(STORE_NAME, segment);
}

export async function getSegments(): Promise<TtsSegment[]> {
  const db = await initDB();
  const segments = await db.getAll(STORE_NAME);
  return segments.sort((a, b) => a.index - b.index);
}

export async function clearSegments() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const db = await initDB();
  return db.get(CACHE_STORE, key);
}

export async function cacheAudio(key: string, blob: Blob) {
  const db = await initDB();
  return db.put(CACHE_STORE, blob, key);
}
