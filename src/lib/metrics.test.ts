import { describe, expect, it } from "vitest";
import {
  buildSessionMetrics,
  buildTrendRows,
  isPairReasoningAnswerCorrect,
  isSingleReasoningAnswerCorrect
} from "./metrics";
import type { SessionLog } from "./types";

describe("metrics", () => {
  it("checks single and pair answers", () => {
    expect(isSingleReasoningAnswerCorrect("A", "A")).toBe(true);
    expect(isSingleReasoningAnswerCorrect("A", "B")).toBe(false);

    expect(isPairReasoningAnswerCorrect(["A", "B"], ["A", "B"])).toBe(true);
    expect(isPairReasoningAnswerCorrect(["B", "A"], ["A", "B"])).toBe(true);
    expect(isPairReasoningAnswerCorrect(["A", "C"], ["A", "B"])).toBe(false);
  });

  it("computes median time and error rate", () => {
    const metrics = buildSessionMetrics([
      {
        questionId: "q1",
        questionKey: "p1:origin:single",
        patternId: "p1",
        sourcePatternId: "p1",
        baseFigureId: "F1",
        variant: "origin",
        arrangementKind: "single",
        startedAt: 1,
        solvedAt: 2,
        elapsedMs: 1100,
        wrongCount: 0,
        firstTryCorrect: true
      },
      {
        questionId: "q2",
        questionKey: "p2:mirror_lr:pair_sum",
        patternId: "p2",
        sourcePatternId: "p2",
        baseFigureId: "F2",
        variant: "mirror_lr",
        arrangementKind: "pair_sum",
        startedAt: 1,
        solvedAt: 2,
        elapsedMs: 2000,
        wrongCount: 2,
        firstTryCorrect: false
      },
      {
        questionId: "q3",
        questionKey: "p3:mirror_ud:single",
        patternId: "p3",
        sourcePatternId: "p3",
        baseFigureId: "F3",
        variant: "mirror_ud",
        arrangementKind: "single",
        startedAt: 1,
        solvedAt: 2,
        elapsedMs: 1500,
        wrongCount: 0,
        firstTryCorrect: true
      }
    ]);

    expect(metrics.medianMs).toBe(1500);
    expect(metrics.errorRate).toBeCloseTo(1 / 3, 5);
  });

  it("returns trend rows for only last 10 sessions", () => {
    const sessions: SessionLog[] = Array.from({ length: 11 }).map((_, index) => ({
      id: `s${index}`,
      unitId: "angles",
      level: 3,
      startedAt: index,
      endedAt: index + 1,
      attempts: [],
      medianMs: 1000 + index,
      errorRate: index / 100
    }));

    const rows = buildTrendRows(sessions);
    expect(rows).toHaveLength(10);
    expect(rows[0].medianMs).toBe(1001);
    expect(rows[9].medianMs).toBe(1010);
  });
});
