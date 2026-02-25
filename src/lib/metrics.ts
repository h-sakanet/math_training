import type { AttemptLog, SessionLog } from "./types";
import { median } from "./math";

export function buildSessionMetrics(attempts: AttemptLog[]): {
  medianMs: number;
  errorRate: number;
} {
  const solvedAttempts = attempts.filter(
    (attempt) => attempt.isSolved && typeof attempt.elapsedMs === "number"
  );
  const medianMs = median(solvedAttempts.map((attempt) => attempt.elapsedMs as number));
  const errorCount = solvedAttempts.filter((attempt) => attempt.wrongCount > 0).length;
  const errorRate = solvedAttempts.length === 0 ? 0 : errorCount / solvedAttempts.length;
  return { medianMs, errorRate };
}

export function sortSessionsNewestFirst(sessions: SessionLog[]): SessionLog[] {
  return [...sessions].sort((a, b) => b.startedAt - a.startedAt);
}

export function getRecentSessions(sessions: SessionLog[], limit = 10): SessionLog[] {
  return sortSessionsNewestFirst(sessions).slice(0, limit);
}

export function buildTrendRows(sessions: SessionLog[]): {
  label: string;
  medianMs: number;
  errorRatePercent: number;
}[] {
  const chronological = [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-10);

  return chronological.map((session, index) => ({
    label: `${index + 1}`,
    medianMs: session.medianMs,
    errorRatePercent: Math.round(session.errorRate * 100)
  }));
}

export function isSingleReasoningAnswerCorrect(
  selectedAngleId: string,
  correctAngleId: string | undefined
): boolean {
  return Boolean(correctAngleId) && selectedAngleId === correctAngleId;
}

export function isPairReasoningAnswerCorrect(
  selectedAngleIds: string[],
  correctPairAngleIds: [string, string] | undefined
): boolean {
  if (!correctPairAngleIds || selectedAngleIds.length !== 2) {
    return false;
  }
  const selected = [...selectedAngleIds].sort().join("|");
  const correct = [...correctPairAngleIds].sort().join("|");
  return selected === correct;
}
