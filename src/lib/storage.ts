import { openDB } from "idb";
import { median } from "./math";
import type { AttemptLog, PatternStats, SessionLog } from "./types";

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
const ACTIVE_CHECKPOINT_STARTED_AT_KEY = "active_checkpoint_started_at";
let progressWriteQueue: Promise<void> = Promise.resolve();

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

function normalizeAttempt(attempt: AttemptLog): AttemptLog {
  const solvedAt = typeof attempt.solvedAt === "number" ? attempt.solvedAt : null;
  const elapsedMs = typeof attempt.elapsedMs === "number" ? attempt.elapsedMs : null;
  const isSolved = typeof attempt.isSolved === "boolean"
    ? attempt.isSolved
    : solvedAt !== null && elapsedMs !== null;
  const firstTryCorrect = typeof attempt.firstTryCorrect === "boolean"
    ? attempt.firstTryCorrect
    : isSolved
      ? attempt.wrongCount === 0
      : null;

  return {
    ...attempt,
    solvedAt,
    elapsedMs,
    firstTryCorrect,
    isSolved
  };
}

function normalizeSession(session: SessionLog): SessionLog {
  const attempts = session.attempts.map((attempt) => normalizeAttempt(attempt));
  const solvedAttempts = attempts.filter(
    (attempt) => attempt.isSolved && typeof attempt.elapsedMs === "number"
  );
  const elapsedSamples = solvedAttempts.map((attempt) => attempt.elapsedMs as number);
  const errorCount = solvedAttempts.filter((attempt) => attempt.wrongCount > 0).length;
  const completed = typeof session.completed === "boolean"
    ? session.completed
    : attempts.length > 0 && attempts.every((attempt) => attempt.isSolved);

  return {
    ...session,
    endedAt: typeof session.endedAt === "number" ? session.endedAt : 0,
    attempts,
    medianMs: elapsedSamples.length === 0 ? 0 : median(elapsedSamples),
    errorRate: solvedAttempts.length === 0 ? 0 : errorCount / solvedAttempts.length,
    completed
  };
}

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

function parseEpoch(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export async function getActiveCheckpointStartedAt(): Promise<number | null> {
  const db = await dbPromise;
  const record = await db.get("meta", ACTIVE_CHECKPOINT_STARTED_AT_KEY);
  return parseEpoch(record?.value);
}

export async function setActiveCheckpointStartedAt(epochMs: number): Promise<void> {
  const startedAt = Math.floor(epochMs);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    throw new Error("invalid checkpoint timestamp");
  }
  if (startedAt > Date.now()) {
    throw new Error("checkpoint timestamp cannot be in the future");
  }
  const db = await dbPromise;
  await db.put("meta", {
    key: ACTIVE_CHECKPOINT_STARTED_AT_KEY,
    value: String(startedAt)
  });
}

export async function clearActiveCheckpointStartedAt(): Promise<void> {
  const db = await dbPromise;
  await db.delete("meta", ACTIVE_CHECKPOINT_STARTED_AT_KEY);
}

export async function getSessions(): Promise<SessionLog[]> {
  const db = await dbPromise;
  const sessions = await db.getAll("sessions");
  return sessions.map((session) => normalizeSession(session)).sort((a, b) => b.startedAt - a.startedAt);
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
  await progressWriteQueue.catch(() => undefined);
  const db = await dbPromise;
  const tx = db.transaction(["sessions", "patternStats"], "readwrite");
  const normalizedSession = normalizeSession({
    ...session,
    completed: true
  });

  await tx.objectStore("sessions").put(normalizedSession);

  const statsStore = tx.objectStore("patternStats");

  for (const attempt of normalizedSession.attempts) {
    if (!attempt.isSolved || attempt.solvedAt === null || attempt.elapsedMs === null) {
      continue;
    }
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

export async function saveSessionProgress(session: SessionLog): Promise<void> {
  const progress = normalizeSession({
    ...session,
    completed: false,
    endedAt: 0
  });
  progressWriteQueue = progressWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await dbPromise;
      await db.put("sessions", progress);
    });
  await progressWriteQueue;
}

export async function resetAllData(): Promise<void> {
  await progressWriteQueue.catch(() => undefined);
  const db = await dbPromise;
  const tx = db.transaction(["sessions", "patternStats"], "readwrite");
  await tx.objectStore("sessions").clear();
  await tx.objectStore("patternStats").clear();
  await tx.done;
}
