import { describe, expect, it } from "vitest";
import { buildQuestionCatalog, buildSessionQuestions } from "./problem-engine";
import { createBaseFigures, createQuestionPatterns } from "./templates";
import type { AttemptLog, QuestionPattern } from "./types";

function pairKey(pair: [string, string] | undefined): string {
  if (!pair) {
    return "";
  }
  return [...pair].sort().join("|");
}

function isSingleLike(mode: QuestionPattern["mode"]): boolean {
  return mode === "single" || mode === "180-single";
}

function isPairLike(mode: QuestionPattern["mode"]): boolean {
  return mode === "pair" || mode === "180-pair";
}

function makeAttempt(
  entry: ReturnType<typeof buildQuestionCatalog>[number],
  wrongCount = 0
): AttemptLog {
  return {
    questionId: `${entry.questionKey}-attempt`,
    questionKey: entry.questionKey,
    patternId: entry.patternId,
    sourcePatternId: entry.sourcePatternId,
    baseFigureId: entry.baseFigure.id,
    variant: entry.variant,
    arrangementKind: entry.arrangementKind,
    startedAt: 1,
    solvedAt: 2,
    elapsedMs: 1000,
    wrongCount,
    firstTryCorrect: wrongCount === 0,
    isSolved: true
  };
}

describe("problem engine", () => {
  it("builds pair patterns as sum-only arrangements", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const catalog = buildQuestionCatalog(baseFigures, patterns);

    const pairPattern = patterns.find((pattern) => pattern.mode === "pair");
    expect(pairPattern).toBeTruthy();

    const [b, c] = pairPattern!.correctPairAngleIds!;
    const a = pairPattern!.targetAngleId;

    const originEntries = catalog.filter(
      (entry) => entry.sourcePatternId === pairPattern!.id && entry.variant === "origin"
    );
    expect(originEntries).toHaveLength(1);

    const sum = originEntries.find((entry) => entry.arrangementKind === "pair_sum");

    expect(sum).toBeTruthy();

    expect(sum!.targetAngleId).toBe(a);
    expect(pairKey(sum!.correctPairAngleIds)).toBe(pairKey([b, c]));
  });

  it("builds 5 questions with unique question keys and arrangement-aware prompts", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const questions = buildSessionQuestions(baseFigures, patterns, 3, []);

    expect(questions).toHaveLength(5);
    expect(questions.every((question) => question.type === "reasoning")).toBe(true);

    const keys = new Set(questions.map((question) => question.questionKey));
    expect(keys.size).toBe(5);
    expect(questions.slice(0, 3).every((question) => isSingleLike(question.mode))).toBe(true);
    expect(questions.slice(3).every((question) => isPairLike(question.mode))).toBe(true);

    for (const question of questions) {
      const target = question.angles.find((angleDef) => angleDef.id === question.targetAngleId);
      expect(target).toBeTruthy();

      if (question.arrangementKind === "single") {
        expect(question.prompt).toBe(`${target!.symbol}と同じ角はどこですか？`);
      } else if (question.arrangementKind === "pair_sum") {
        expect(question.prompt).toBe(`${target!.symbol}は、どの角とどの角の和と同じですか？`);
      } else {
        expect(question.prompt).toBe(`${target!.symbol}は180からどの角とどの角度の和を引くと求められる？`);
      }
    }
  });

  it("supports 180 modes and keeps 180-pair as one arrangement per variant", () => {
    const baseFigures = createBaseFigures();
    const [figure] = baseFigures;
    const ids = figure.angles.map((angleDef) => angleDef.id);
    const optionA: [string, string, string, string] = [ids[1], ids[2], ids[3], ids[4]];
    const optionB: [string, string, string, string] = [ids[2], ids[3], ids[4], ids[5]];

    const patterns: QuestionPattern[] = [
      {
        id: "F1-180S-a",
        baseFigureId: figure.id,
        mode: "180-single" as const,
        targetAngleId: ids[0],
        optionAngleIds: optionA,
        correctSingleAngleId: ids[1],
        explanation: "180 single",
        enabled: true
      },
      {
        id: "F1-180S-b",
        baseFigureId: figure.id,
        mode: "180-single" as const,
        targetAngleId: ids[2],
        optionAngleIds: optionB,
        correctSingleAngleId: ids[3],
        explanation: "180 single",
        enabled: true
      },
      {
        id: "F1-180S-c",
        baseFigureId: figure.id,
        mode: "180-single" as const,
        targetAngleId: ids[4],
        optionAngleIds: optionA,
        correctSingleAngleId: ids[2],
        explanation: "180 single",
        enabled: true
      },
      {
        id: "F1-180P-a",
        baseFigureId: figure.id,
        mode: "180-pair" as const,
        targetAngleId: ids[5],
        optionAngleIds: optionA,
        correctPairAngleIds: [ids[1], ids[2]] as [string, string],
        explanation: "180 pair",
        enabled: true
      },
      {
        id: "F1-180P-b",
        baseFigureId: figure.id,
        mode: "180-pair" as const,
        targetAngleId: ids[6],
        optionAngleIds: optionB,
        correctPairAngleIds: [ids[3], ids[4]] as [string, string],
        explanation: "180 pair",
        enabled: true
      }
    ];

    const catalog = buildQuestionCatalog(baseFigures, patterns);
    const firstPairEntries = catalog.filter((entry) => entry.sourcePatternId === "F1-180P-a");
    expect(firstPairEntries).toHaveLength(2);
    expect(firstPairEntries.every((entry) => entry.arrangementKind === "pair_180")).toBe(true);

    const questions = buildSessionQuestions(baseFigures, patterns, 3, []);
    expect(questions).toHaveLength(5);
    expect(questions.every((question) => question.mode === "180-single" || question.mode === "180-pair")).toBe(true);

    for (const question of questions) {
      const target = question.angles.find((angleDef) => angleDef.id === question.targetAngleId);
      expect(target).toBeTruthy();
      if (question.mode === "180-single") {
        expect(question.prompt).toBe(`${target!.symbol}は180からどの角を引くと求められる？`);
      } else {
        expect(question.prompt).toBe(`${target!.symbol}は180からどの角とどの角度の和を引くと求められる？`);
      }
    }
  });

  it("prioritizes unseen or wrong-history questions", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const catalog = buildQuestionCatalog(baseFigures, patterns);
    const singleCatalog = catalog.filter((entry) => isSingleLike(entry.mode));
    const pairCatalog = catalog.filter((entry) => isPairLike(entry.mode));

    const unseenSingle = singleCatalog.slice(-4).map((entry) => entry.questionKey);
    const unseenPair = pairCatalog.slice(-3).map((entry) => entry.questionKey);
    const seenSingle = singleCatalog.slice(0, Math.max(singleCatalog.length - 4, 0));
    const seenPair = pairCatalog.slice(0, Math.max(pairCatalog.length - 3, 0));

    const wrongEntry = seenPair[0];
    const attempts: AttemptLog[] = [...seenSingle, ...seenPair].map((entry) => makeAttempt(entry, 0));
    if (wrongEntry) {
      attempts.push(makeAttempt(wrongEntry, 1));
    }

    const questions = buildSessionQuestions(baseFigures, patterns, 3, attempts);
    const unseenSingleSet = new Set(unseenSingle);
    const unseenPairSet = new Set(unseenPair);

    expect(questions).toHaveLength(5);
    expect(questions.slice(0, 3).every((question) => unseenSingleSet.has(question.questionKey))).toBe(true);
    expect(
      questions.slice(3).every(
        (question) => unseenPairSet.has(question.questionKey) || question.questionKey === wrongEntry?.questionKey
      )
    ).toBe(true);
  });

  it("avoids consecutive same base figure and source pattern under normal pool size", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const questions = buildSessionQuestions(baseFigures, patterns, 3, []);

    for (let i = 1; i < questions.length; i += 1) {
      expect(questions[i].baseFigureId).not.toBe(questions[i - 1].baseFigureId);
      expect(questions[i].sourcePatternId).not.toBe(questions[i - 1].sourcePatternId);
    }
  });

  it("throws when single-like pool is insufficient", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns().filter((pattern) => isPairLike(pattern.mode));

    expect(() => buildSessionQuestions(baseFigures, patterns, 3, [])).toThrow("single pool shortage");
  });

  it("throws when pair-like pool is insufficient", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns().filter((pattern) => isSingleLike(pattern.mode));

    expect(() => buildSessionQuestions(baseFigures, patterns, 3, [])).toThrow("pair pool shortage");
  });
});
