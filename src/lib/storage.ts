import { openDB } from "idb";
import { median } from "./math";
import type { PatternStats, SessionLog } from "./types";

type PatternStatsRecord = PatternStats & {
  elapsedSamples: number[];
  errorAttempts: number;
};

type MetaRecord = {
  key: string;
  value: string;
};

type AppDb = {
  sessions: {
    key: string;
    value: SessionLog;
  };
  patternStats: {
    key: string;
    value: PatternStatsRecord;
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
};

const DB_NAME = "math-training-db";
const DB_VERSION = 3;
const MIGRATION_NOTICE_KEY = "migration_notice_v3";

const dbPromise = openDB<AppDb>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    const rawDb = db as unknown as {
      objectStoreNames: DOMStringList;
      deleteObjectStore: (name: string) => void;
      createObjectStore: (name: string, options?: IDBObjectStoreParameters) => IDBObjectStore;
    };

    if (db.objectStoreNames.contains("sessions")) {
      db.deleteObjectStore("sessions");
    }
    if (rawDb.objectStoreNames.contains("templateStats")) {
      rawDb.deleteObjectStore("templateStats");
    }
    if (db.objectStoreNames.contains("patternStats")) {
      db.deleteObjectStore("patternStats");
    }
    if (db.objectStoreNames.contains("meta")) {
      db.deleteObjectStore("meta");
    }

    db.createObjectStore("sessions", { keyPath: "id" });
    db.createObjectStore("patternStats", { keyPath: "patternId" });
    const metaStore = db.createObjectStore("meta", { keyPath: "key" });
    if (oldVersion > 0) {
      metaStore.put({
        key: MIGRATION_NOTICE_KEY,
        value: "出題方式更新に伴い履歴を初期化しました。"
      });
    }
  }
});

export async function consumeMigrationNotice(): Promise<string | null> {
  const db = await dbPromise;
  const tx = db.transaction("meta", "readwrite");
  const store = tx.objectStore("meta");
  const record = await store.get(MIGRATION_NOTICE_KEY);
  if (!record) {
    await tx.done;
    return null;
  }
  await store.delete(MIGRATION_NOTICE_KEY);
  await tx.done;
  return record.value;
}

export async function getSessions(): Promise<SessionLog[]> {
  const db = await dbPromise;
  const sessions = await db.getAll("sessions");
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getPatternStats(): Promise<PatternStats[]> {
  const db = await dbPromise;
  const records = await db.getAll("patternStats");
  return records
    .map((record) => ({
      patternId: record.patternId,
      attempts: record.attempts,
      medianMs: record.medianMs,
      errorRate: record.errorRate,
      lastPlayedAt: record.lastPlayedAt
    }))
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}

export async function saveSession(session: SessionLog): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(["sessions", "patternStats"], "readwrite");

  await tx.objectStore("sessions").put(session);

  const statsStore = tx.objectStore("patternStats");

  for (const attempt of session.attempts) {
    const current = await statsStore.get(attempt.patternId);
    const record: PatternStatsRecord = current ?? {
      patternId: attempt.patternId,
      attempts: 0,
      medianMs: 0,
      errorRate: 0,
      lastPlayedAt: attempt.solvedAt,
      elapsedSamples: [],
      errorAttempts: 0
    };

    record.attempts += 1;
    record.lastPlayedAt = attempt.solvedAt;
    record.elapsedSamples.push(attempt.elapsedMs);
    if (attempt.wrongCount > 0) {
      record.errorAttempts += 1;
    }
    record.medianMs = median(record.elapsedSamples);
    record.errorRate = record.errorAttempts / record.attempts;
    await statsStore.put(record);
  }

  await tx.done;
}

export async function resetAllData(): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(["sessions", "patternStats"], "readwrite");
  await tx.objectStore("sessions").clear();
  await tx.objectStore("patternStats").clear();
  await tx.done;
}
