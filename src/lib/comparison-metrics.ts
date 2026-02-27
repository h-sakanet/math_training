import type {
  AttemptLog,
  ComparisonPeriodStats,
  PatternComparisonRow,
  SessionLog
} from "./types";

type PatternPeriodStats = {
  attempts: number;
  solvedAttempts: number;
  totalSolvedMs: number;
  correctSolved: number;
};

type PatternStatsMap = Map<string, PatternPeriodStats>;

export function unifiedPatternKey(sourcePatternId: string, arrangementKind: string): string {
  return `${sourcePatternId}:${arrangementKind}`;
}

export function unifiedPatternKeyFromQuestionKey(questionKey: string): string {
  const [patternId, _variant, arrangementKind] = questionKey.split(":");
  if (!patternId || !arrangementKind) {
    return questionKey;
  }
  return unifiedPatternKey(patternId, arrangementKind);
}

function patternKeyFromAttempt(attempt: AttemptLog): string {
  if (attempt.sourcePatternId && attempt.arrangementKind) {
    return unifiedPatternKey(attempt.sourcePatternId, attempt.arrangementKind);
  }
  return unifiedPatternKeyFromQuestionKey(attempt.questionKey);
}

function cloneSessionWithAttempts(session: SessionLog, attempts: AttemptLog[]): SessionLog {
  return {
    ...session,
    attempts
  };
}

function flattenAttempts(sessions: SessionLog[]): AttemptLog[] {
  return sessions.flatMap((session) => session.attempts);
}

function buildPeriodStats(attempts: AttemptLog[]): ComparisonPeriodStats {
  const solved = attempts.filter(
    (attempt) => attempt.isSolved && typeof attempt.elapsedMs === "number"
  );
  if (solved.length === 0) {
    return {
      attempts: attempts.length,
      solvedAttempts: 0,
      averageMs: null,
      accuracyRate: null
    };
  }

  const totalMs = solved.reduce((sum, attempt) => sum + (attempt.elapsedMs as number), 0);
  const correctCount = solved.filter((attempt) => attempt.wrongCount === 0).length;
  return {
    attempts: attempts.length,
    solvedAttempts: solved.length,
    averageMs: Math.round(totalMs / solved.length),
    accuracyRate: correctCount / solved.length
  };
}

function buildPatternStatsMap(attempts: AttemptLog[]): PatternStatsMap {
  const map: PatternStatsMap = new Map();
  for (const attempt of attempts) {
    const key = patternKeyFromAttempt(attempt);
    const current = map.get(key) ?? {
      attempts: 0,
      solvedAttempts: 0,
      totalSolvedMs: 0,
      correctSolved: 0
    };
    current.attempts += 1;
    if (attempt.isSolved && typeof attempt.elapsedMs === "number") {
      current.solvedAttempts += 1;
      current.totalSolvedMs += attempt.elapsedMs;
      if (attempt.wrongCount === 0) {
        current.correctSolved += 1;
      }
    }
    map.set(key, current);
  }
  return map;
}

export function splitSessionsByCheckpoint(
  sessions: SessionLog[],
  checkpointAt: number
): { oldSessions: SessionLog[]; newSessions: SessionLog[] } {
  const oldSessions: SessionLog[] = [];
  const newSessions: SessionLog[] = [];

  for (const session of sessions) {
    const oldAttempts = session.attempts.filter((attempt) => attempt.startedAt < checkpointAt);
    const newAttempts = session.attempts.filter((attempt) => attempt.startedAt >= checkpointAt);

    if (oldAttempts.length > 0) {
      oldSessions.push(cloneSessionWithAttempts(session, oldAttempts));
    }
    if (newAttempts.length > 0) {
      newSessions.push(cloneSessionWithAttempts(session, newAttempts));
    }
  }

  return { oldSessions, newSessions };
}

export function buildOverallComparison(
  oldSessions: SessionLog[],
  newSessions: SessionLog[]
): {
  oldPeriod: ComparisonPeriodStats;
  newPeriod: ComparisonPeriodStats;
  deltaMs: number | null;
  deltaAccuracyRate: number | null;
} {
  const oldPeriod = buildPeriodStats(flattenAttempts(oldSessions));
  const newPeriod = buildPeriodStats(flattenAttempts(newSessions));

  const deltaMs =
    oldPeriod.averageMs === null || newPeriod.averageMs === null
      ? null
      : newPeriod.averageMs - oldPeriod.averageMs;
  const deltaAccuracyRate =
    oldPeriod.accuracyRate === null || newPeriod.accuracyRate === null
      ? null
      : newPeriod.accuracyRate - oldPeriod.accuracyRate;

  return {
    oldPeriod,
    newPeriod,
    deltaMs,
    deltaAccuracyRate
  };
}

export function buildPatternComparisonRows(
  oldSessions: SessionLog[],
  newSessions: SessionLog[],
  catalogPatternKeys: string[]
): PatternComparisonRow[] {
  const oldMap = buildPatternStatsMap(flattenAttempts(oldSessions));
  const newMap = buildPatternStatsMap(flattenAttempts(newSessions));

  const keys = new Set<string>([
    ...catalogPatternKeys,
    ...oldMap.keys(),
    ...newMap.keys()
  ]);

  return [...keys].map((patternKey) => {
    const oldStat = oldMap.get(patternKey);
    const newStat = newMap.get(patternKey);

    const oldAverageMs =
      oldStat && oldStat.solvedAttempts > 0
        ? Math.round(oldStat.totalSolvedMs / oldStat.solvedAttempts)
        : null;
    const newAverageMs =
      newStat && newStat.solvedAttempts > 0
        ? Math.round(newStat.totalSolvedMs / newStat.solvedAttempts)
        : null;
    const oldAccuracyRate =
      oldStat && oldStat.solvedAttempts > 0
        ? oldStat.correctSolved / oldStat.solvedAttempts
        : null;
    const newAccuracyRate =
      newStat && newStat.solvedAttempts > 0
        ? newStat.correctSolved / newStat.solvedAttempts
        : null;

    return {
      patternKey,
      oldAttempts: oldStat?.attempts ?? 0,
      newAttempts: newStat?.attempts ?? 0,
      oldSolvedAttempts: oldStat?.solvedAttempts ?? 0,
      newSolvedAttempts: newStat?.solvedAttempts ?? 0,
      oldAverageMs,
      newAverageMs,
      deltaMs:
        oldAverageMs === null || newAverageMs === null
          ? null
          : newAverageMs - oldAverageMs,
      oldAccuracyRate,
      newAccuracyRate,
      deltaAccuracyRate:
        oldAccuracyRate === null || newAccuracyRate === null
          ? null
          : newAccuracyRate - oldAccuracyRate
    };
  });
}
