import type { AttemptLog, SessionLog } from "./types";
import { median } from "./math";

export function buildSessionMetrics(attempts: AttemptLog[]): {
  medianMs: number;
  errorRate: number;
} {
  const medianMs = median(attempts.map((attempt) => attempt.elapsedMs));
  const errorCount = attempts.filter((attempt) => attempt.wrongCount > 0).length;
  const errorRate = attempts.length === 0 ? 0 : errorCount / attempts.length;
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
