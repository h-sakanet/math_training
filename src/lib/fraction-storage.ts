import { openDB, type DBSchema } from "idb";
import type { FractionSession } from "./fractions";

interface FractionDb extends DBSchema {
  sessions: { key: string; value: FractionSession };
}

// Separate storage keeps the existing angle history and migration untouched.
function openFractionDb() {
  return openDB<FractionDb>("math-training-fractions", 1, {
    upgrade(db) {
      db.createObjectStore("sessions", { keyPath: "id" });
    }
  });
}

export async function getFractionSessions(): Promise<FractionSession[]> {
  const db = await openFractionDb();
  try {
    return (await db.getAll("sessions")).sort((a, b) => b.endedAt - a.endedAt);
  } finally {
    db.close();
  }
}

export async function saveFractionSession(session: FractionSession): Promise<void> {
  const db = await openFractionDb();
  try {
    await db.put("sessions", session);
  } finally {
    db.close();
  }
}
