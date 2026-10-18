import { describe, expect, it } from "vitest";
import {
  buildFractionQuestions, createFractionRun, fractionMetrics, gcd, getFractionAnswerPosition,
  getFractionOperator, getFractionSolution, isFractionAnswerCorrect,
  recentFractionSessions, reduceFraction, type FractionAttempt, type FractionQuestion, type FractionSession
} from "./fractions";

describe.each([1, 2] as const)("fraction level %i questions", (level) => {
  it("produces proper fractions and proper answers, with exactly one integer operand in five questions", () => {
    const integerPositions = new Set<number>();
    const integerSides = new Set<string>();
    for (let run = 0; run < 200; run += 1) {
      const questions = buildFractionQuestions(level);
      expect(questions).toHaveLength(5);
      const integerQuestions = questions.filter((question) =>
        question.left.denominator === 1 || question.right.denominator === 1);
      expect(integerQuestions).toHaveLength(1);
      integerPositions.add(questions.indexOf(integerQuestions[0]));
      integerSides.add(integerQuestions[0].left.denominator === 1 ? "left" : "right");
      expect(new Set(questions.map((question) => JSON.stringify(question))).size).toBe(5);
      for (const question of questions) {
        for (const value of [question.left, question.right, question.answer]) {
          expect(gcd(value.numerator, value.denominator)).toBe(1);
          expect(value.numerator).toBeGreaterThan(0);
          expect(value.numerator).toBeLessThanOrEqual(99);
          expect(value.denominator).toBeGreaterThan(0);
          expect(value.denominator).toBeLessThanOrEqual(99);
          if (value.denominator !== 1) {
            expect(value.numerator).toBeLessThan(value.denominator);
          }
        }
        const numerator = question.left.numerator * (level === 2 ? question.right.denominator : question.right.numerator);
        const denominator = question.left.denominator * (level === 2 ? question.right.numerator : question.right.denominator);
        expect(numerator).toBeLessThanOrEqual(99);
        expect(denominator).toBeLessThanOrEqual(99);
        expect(question.answer).toEqual(reduceFraction(numerator, denominator));
        expect(question.answer.numerator).toBeLessThan(question.answer.denominator);
        expect(question.answer.denominator).toBeGreaterThan(1);
      }
    }
    expect(integerPositions.size).toBe(5);
    // Integer ÷ proper fraction is always greater than one, so division must place the integer on the right.
    expect([...integerSides].sort()).toEqual(level === 1 ? ["left", "right"] : ["right"]);
  });

  it("preserves the selected level when creating a new run", () => {
    const run = createFractionRun(level);
    expect(run.level).toBe(level);
    expect(run.questions).toHaveLength(5);
  });

  it("grades reduced fractions, improper fractions and integers", () => {
    expect(isFractionAnswerCorrect({ numerator: 9, denominator: 35 }, "9", "35")).toBe(true);
    expect(isFractionAnswerCorrect({ numerator: 3, denominator: 2 }, "3", "2")).toBe(true);
    expect(isFractionAnswerCorrect({ numerator: 3, denominator: 2 }, "6", "4")).toBe(false);
    expect(isFractionAnswerCorrect({ numerator: 3, denominator: 2 }, "", "2")).toBe(false);
    expect(isFractionAnswerCorrect({ numerator: 3, denominator: 2 }, "3", "0")).toBe(false);
    expect(isFractionAnswerCorrect({ numerator: 3, denominator: 2 }, "3", "")).toBe(false);
    expect(isFractionAnswerCorrect({ numerator: 4, denominator: 1 }, "4", "")).toBe(true);
    expect(isFractionAnswerCorrect({ numerator: 4, denominator: 1 }, "5", "")).toBe(false);
  });
});

const question = { left: { numerator: 3, denominator: 7 }, right: { numerator: 3, denominator: 5 }, answer: { numerator: 9, denominator: 35 } };
const attempts: FractionAttempt[] = [true, false, true, false, true].map((correct, index) => ({
  question, numerator: "9", denominator: correct ? "35" : "36", correct, elapsedMs: (index + 1) * 1000
}));

describe("fraction missing-number questions", () => {
  it("varies the operator and missing side, with exactly one integer result in every five questions", () => {
    const integerPositions = new Set<number>();
    const fractionVariants = new Set<string>();
    const integerVariants = new Set<string>();
    for (let run = 0; run < 200; run += 1) {
      const questions = buildFractionQuestions(3);
      expect(questions).toHaveLength(5);
      expect(new Set(questions.map((item) => JSON.stringify(item))).size).toBe(5);
      const integerQuestions = questions.filter((item) => item.answer.denominator === 1);
      expect(integerQuestions).toHaveLength(1);
      integerPositions.add(questions.indexOf(integerQuestions[0]));
      for (const item of questions) {
        expect(["×", "÷"]).toContain(item.operator);
        expect(["left", "right"]).toContain(item.missing);
        const solution = getFractionSolution(item);
        expect(solution.numerator).toBeLessThan(solution.denominator);
        expect(getFractionAnswerPosition(item)).toBe(item.missing);
        for (const value of [item.left, item.right, item.answer]) {
          expect(gcd(value.numerator, value.denominator)).toBe(1);
          expect(value.numerator).toBeGreaterThan(0);
          expect(value.numerator).toBeLessThanOrEqual(99);
          expect(value.denominator).toBeGreaterThan(0);
          expect(value.denominator).toBeLessThanOrEqual(99);
          if (value.denominator !== 1) expect(value.numerator).toBeLessThan(value.denominator);
        }
        const numerator = item.left.numerator * (item.operator === "÷" ? item.right.denominator : item.right.numerator);
        const denominator = item.left.denominator * (item.operator === "÷" ? item.right.numerator : item.right.denominator);
        expect(numerator).toBeLessThanOrEqual(99);
        expect(denominator).toBeLessThanOrEqual(99);
        expect(item.answer).toEqual(reduceFraction(numerator, denominator));
        if (item.answer.denominator === 1) {
          integerVariants.add(`${item.operator}:${item.missing}`);
          if (item.operator === "×") {
            const known = item.missing === "left" ? item.right : item.left;
            expect(known.denominator).toBe(1);
          }
        } else {
          fractionVariants.add(`${item.operator}:${item.missing}`);
          expect(item.left.numerator).toBeLessThan(item.left.denominator);
          expect(item.right.numerator).toBeLessThan(item.right.denominator);
        }
      }
    }
    expect(integerPositions.size).toBe(5);
    expect([...fractionVariants].sort()).toEqual(["×:left", "×:right", "÷:left", "÷:right"]);
    expect([...integerVariants].sort()).toEqual(["×:left", "×:right", "÷:left", "÷:right"]);
  });

  it.each(["left", "right"] as const)("grades the missing %s operand instead of the equation result", (missing) => {
    const item: FractionQuestion = { ...question, operator: "×", missing };
    const expected = item[missing];
    expect(getFractionSolution(item)).toEqual(expected);
    expect(isFractionAnswerCorrect(getFractionSolution(item), String(expected.numerator), String(expected.denominator))).toBe(true);
    expect(isFractionAnswerCorrect(getFractionSolution(item), "9", "35")).toBe(false);
  });

  it("preserves level three in a new run", () => {
    const run = createFractionRun(3);
    expect(run.level).toBe(3);
    expect(run.questions.every((item) => item.missing && item.operator)).toBe(true);
  });

  it("keeps old multiplication and division records readable without new metadata", () => {
    expect(getFractionAnswerPosition(question)).toBe("result");
    expect(getFractionSolution(question)).toEqual(question.answer);
    expect(getFractionOperator(question, 1)).toBe("×");
    expect(getFractionOperator(question, 2)).toBe("÷");
    expect(getFractionOperator({ ...question, operator: "÷", missing: "right" }, 3)).toBe("÷");
  });
});

describe("fraction results and history", () => {
  it("averages the submission time of every question, including wrong answers", () => {
    expect(fractionMetrics(attempts)).toEqual({ correctCount: 3, accuracy: 0.6, averageMs: 3000 });
    expect(fractionMetrics([])).toEqual({ correctCount: 0, accuracy: 0, averageMs: 0 });
  });

  it("shows the latest five sessions for the selected level without changing stored order", () => {
    const sessions: FractionSession[] = Array.from({ length: 8 }, (_, index) => ({
      id: String(index), level: index === 7 ? 2 : 1, startedAt: index * 1000,
      endedAt: index * 1000 + 500, attempts
    }));
    expect(recentFractionSessions(sessions, 1).map((session) => session.id)).toEqual(["6", "5", "4", "3", "2"]);
    expect(recentFractionSessions(sessions, 2).map((session) => session.id)).toEqual(["7"]);
    expect(recentFractionSessions(sessions, 3)).toEqual([]);
    expect(sessions[0].id).toBe("0");
  });
});
