import Dexie, { type EntityTable } from 'dexie';

export type GearTier = 'LOW' | 'HIGH';

export interface RunLog {
  id?: number;
  timestamp: number;
  score: number;
  distance: number;
  civilianCollisions: number;
  enforcersNeutralized: number;
  armoryDocks: number;
  maxGearReached: GearTier;
}

export interface SettingEntry {
  key: string;
  value: unknown;
}

export type StorageEngine = 'IndexedDB (Native)' | 'Storage Fallback';

interface StorageAdapter {
  engine: StorageEngine;
  getSetting<T>(key: string, fallback: T): Promise<T>;
  setSetting(key: string, value: unknown): Promise<void>;
  saveRunLog(run: Omit<RunLog, 'id'>): Promise<number>;
}

const RUNS_LIMIT = 100;
const LS_SETTINGS_PREFIX = 'apexchase:setting:';
const LS_RUNS_KEY = 'apexchase:runs';

class NativeAdapter implements StorageAdapter {
  engine: StorageEngine = 'IndexedDB (Native)';
  private dexie: Dexie & {
    runs: EntityTable<RunLog, 'id'>;
    settings: EntityTable<SettingEntry, 'key'>;
  };

  constructor() {
    this.dexie = new Dexie('ApexChaseDB') as typeof this.dexie;
    this.dexie.version(1).stores({
      runs: '++id, timestamp, score, distance',
      settings: 'key',
    });
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.dexie.settings.get(key);
    return (row?.value as T) ?? fallback;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.dexie.settings.put({ key, value });
  }

  async saveRunLog(run: Omit<RunLog, 'id'>): Promise<number> {
    const id = await this.dexie.runs.add(run);
    return id as number;
  }
}

class FallbackAdapter implements StorageAdapter {
  engine: StorageEngine = 'Storage Fallback';

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = localStorage.getItem(LS_SETTINGS_PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    localStorage.setItem(LS_SETTINGS_PREFIX + key, JSON.stringify(value));
  }

  async saveRunLog(run: Omit<RunLog, 'id'>): Promise<number> {
    let runs: Array<RunLog & { id: number }> = [];
    try {
      runs = JSON.parse(localStorage.getItem(LS_RUNS_KEY) ?? '[]') as Array<RunLog & { id: number }>;
    } catch {
      runs = [];
    }
    const nextId = runs.length > 0 ? Math.max(...runs.map((r) => r.id)) + 1 : 1;
    const entry = { ...run, id: nextId };
    runs.push(entry);
    if (runs.length > RUNS_LIMIT) runs = runs.slice(-RUNS_LIMIT);
    localStorage.setItem(LS_RUNS_KEY, JSON.stringify(runs));
    return nextId;
  }
}

function detectBlockedIndexedDb(): boolean {
  if (!('indexedDB' in window)) return true;
  try {
    // Throws SecurityError in sandboxed iframes where indexedDB access is denied.
    void window.indexedDB;
    if (window.indexedDB === null) return true;
    return false;
  } catch (err) {
    console.warn(
      '[Apex Chase] IndexedDB access blocked (likely iframe sandbox / SecurityError):',
      err,
    );
    return true;
  }
}

let adapter: StorageAdapter | null = null;

export async function initStorage(): Promise<StorageEngine> {
  if (adapter) return adapter.engine;

  if (!detectBlockedIndexedDb()) {
    try {
      const native = new NativeAdapter();
      // Force the schema upgrade / connection now so a blocked DB fails here,
      // not on the first gameplay write.
      await native['dexie'].open();
      adapter = native;
    } catch (err) {
      console.warn(
        '[Apex Chase] IndexedDB failed to open — falling back to localStorage adapter:',
        err,
      );
    }
  }

  if (!adapter) adapter = new FallbackAdapter();

  try {
    // Mount check: verify the store round-trips a setting before declaring ready.
    await adapter.setSetting('first_launch', true);
    const readBack = await adapter.getSetting('first_launch', false);
    if (readBack !== true) throw new Error('Settings store failed read-back verification');
    await adapter.setSetting('first_launch', false);
  } catch (err) {
    console.warn('[Apex Chase] storage mount check failed:', err);
    if (adapter.engine === 'IndexedDB (Native)') {
      adapter = new FallbackAdapter();
      await adapter.setSetting('first_launch', true);
      await adapter.setSetting('first_launch', false);
    }
  }

  console.info(`[Apex Chase] storage engine active: ${adapter.engine}`);
  return adapter.engine;
}

export function getStorageEngine(): StorageEngine {
  if (!adapter) throw new Error('initStorage() must complete before storage access');
  return adapter.engine;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return adapter!.getSetting(key, fallback);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  return adapter!.setSetting(key, value);
}

export async function saveRunLog(run: Omit<RunLog, 'id'>): Promise<number> {
  return adapter!.saveRunLog(run);
}
