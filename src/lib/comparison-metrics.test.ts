import { describe, expect, it } from "vitest";
import {
  buildOverallComparison,
  buildPatternComparisonRows,
  splitSessionsByCheckpoint,
  unifiedPatternKey
} from "./comparison-metrics";
import type { AttemptLog, SessionLog } from "./types";

function makeAttempt(
  id: string,
  patternId: string,
  arrangementKind: AttemptLog["arrangementKind"],
  startedAt: number,
  solvedAt: number | null,
  elapsedMs: number | null,
  wrongCount: number
): AttemptLog {
  return {
    questionId: id,
    questionKey: `${patternId}:origin:${arrangementKind}`,
    patternId,
    sourcePatternId: patternId,
    baseFigureId: "F1",
    variant: "origin",
    arrangementKind,
    startedAt,
    solvedAt,
    elapsedMs,
    wrongCount,
    firstTryCorrect: solvedAt && elapsedMs ? wrongCount === 0 : null,
    isSolved: solvedAt !== null && elapsedMs !== null
  };
}

function makeSession(id: string, attempts: AttemptLog[]): SessionLog {
  return {
    id,
    unitId: "angles",
    level: 3,
    startedAt: attempts[0]?.startedAt ?? 1,
    endedAt: attempts[attempts.length - 1]?.startedAt ?? 1,
    attempts,
    medianMs: 0,
    errorRate: 0,
    completed: true
  };
}

describe("comparison metrics", () => {
  it("splits sessions by attempt boundary timestamp", () => {
    const checkpointAt = 1_000;
    const sessions: SessionLog[] = [
      makeSession("s1", [
        makeAttempt("a1", "P1", "single", 900, 930, 1200, 0),
        makeAttempt("a2", "P1", "pair_sum", 1_000, 1_040, 1300, 1)
      ])
    ];

    const { oldSessions, newSessions } = splitSessionsByCheckpoint(sessions, checkpointAt);
    expect(oldSessions).toHaveLength(1);
    expect(newSessions).toHaveLength(1);
    expect(oldSessions[0].attempts).toHaveLength(1);
    expect(newSessions[0].attempts).toHaveLength(1);
    expect(oldSessions[0].attempts[0].questionId).toBe("a1");
    expect(newSessions[0].attempts[0].questionId).toBe("a2");
  });

  it("computes overall comparison and handles no-solved case", () => {
    const oldSessions: SessionLog[] = [
      makeSession("old", [
        makeAttempt("a1", "P1", "single", 100, 140, 2000, 0),
        makeAttempt("a2", "P2", "pair_sum", 120, 170, 1000, 1)
      ])
    ];
    const newSessions: SessionLog[] = [
      makeSession("new", [
        makeAttempt("a3", "P1", "single", 200, null, null, 0)
      ])
    ];

    const result = buildOverallComparison(oldSessions, newSessions);
    expect(result.oldPeriod.attempts).toBe(2);
    expect(result.oldPeriod.averageMs).toBe(1500);
    expect(result.oldPeriod.accuracyRate).toBe(0.5);
    expect(result.newPeriod.attempts).toBe(1);
    expect(result.newPeriod.averageMs).toBeNull();
    expect(result.newPeriod.accuracyRate).toBeNull();
    expect(result.deltaMs).toBeNull();
    expect(result.deltaAccuracyRate).toBeNull();
  });

  it("builds pattern comparison rows with deltas and NA cases", () => {
    const keyA = unifiedPatternKey("P1", "single");
    const keyB = unifiedPatternKey("P2", "pair_sum");

    const oldSessions: SessionLog[] = [
      makeSession("old", [
        makeAttempt("a1", "P1", "single", 100, 140, 2000, 1)
      ])
    ];
    const newSessions: SessionLog[] = [
      makeSession("new", [
        makeAttempt("a2", "P1", "single", 200, 230, 1000, 0),
        makeAttempt("a3", "P2", "pair_sum", 220, 260, 1500, 0)
      ])
    ];

    const rows = buildPatternComparisonRows(oldSessions, newSessions, [keyA, keyB]);
    const rowA = rows.find((row) => row.patternKey === keyA)!;
    const rowB = rows.find((row) => row.patternKey === keyB)!;

    expect(rowA.oldAttempts).toBe(1);
    expect(rowA.newAttempts).toBe(1);
    expect(rowA.oldAverageMs).toBe(2000);
    expect(rowA.newAverageMs).toBe(1000);
    expect(rowA.deltaMs).toBe(-1000);
    expect(rowA.oldAccuracyRate).toBe(0);
    expect(rowA.newAccuracyRate).toBe(1);
    expect(rowA.deltaAccuracyRate).toBe(1);

    expect(rowB.oldAttempts).toBe(0);
    expect(rowB.newAttempts).toBe(1);
    expect(rowB.oldAverageMs).toBeNull();
    expect(rowB.newAverageMs).toBe(1500);
    expect(rowB.deltaMs).toBeNull();
    expect(rowB.oldAccuracyRate).toBeNull();
    expect(rowB.newAccuracyRate).toBe(1);
    expect(rowB.deltaAccuracyRate).toBeNull();
  });
});
