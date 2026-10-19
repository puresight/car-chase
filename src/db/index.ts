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

export const db = new Dexie('ApexChaseDB') as Dexie & {
  runs: EntityTable<RunLog, 'id'>;
  settings: EntityTable<SettingEntry, 'key'>;
};

db.version(1).stores({
  runs: '++id, timestamp, score, distance',
  settings: 'key',
});

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function saveRunLog(run: Omit<RunLog, 'id'>): Promise<number> {
  const id = await db.runs.add(run);
  return id as number;
}
