import { openDB, type DBSchema } from "idb";
import type { AppData } from "../types";
import { parseBackup, serializeBackup } from "./backup";

interface FuelDatabase extends DBSchema {
  snapshots: { key: string; value: AppData };
}

let database: ReturnType<typeof openDB<FuelDatabase>> | undefined;

function getDatabase() {
  if (!database) {
    database = openDB<FuelDatabase>("fuel", 1, {
      upgrade(db) {
        db.createObjectStore("snapshots");
      },
      blocking() {
        const current = database;
        database = undefined;
        void current?.then((db) => db.close());
      },
      terminated() {
        database = undefined;
      },
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}

export function emptyData(): AppData {
  return {
    vehicles: [],
    fillups: [],
    trips: [],
    settings: { schemaVersion: 1, calculatorInputs: {} },
  };
}

export async function loadData(): Promise<AppData> {
  const db = await getDatabase();
  const snapshot: unknown = await db.get("snapshots", "current");
  return snapshot === undefined
    ? emptyData()
    : parseBackup(JSON.stringify(snapshot));
}

export async function saveData(data: AppData): Promise<void> {
  // Validate and detach before opening a transaction, so bad input cannot replace a snapshot.
  const snapshot = parseBackup(serializeBackup(data));
  const db = await getDatabase();
  const tx = db.transaction("snapshots", "readwrite");
  await Promise.all([tx.store.put(snapshot, "current"), tx.done]);
}

export async function updateData(
  change: (current: AppData) => AppData,
): Promise<AppData> {
  const db = await getDatabase();
  const tx = db.transaction("snapshots", "readwrite");
  try {
    const stored = await tx.store.get("current");
    const current =
      stored === undefined ? emptyData() : parseBackup(JSON.stringify(stored));
    const next = parseBackup(serializeBackup(change(current)));
    await tx.store.put(next, "current");
    await tx.done;
    return next;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* A failed transaction may already be aborted. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}
