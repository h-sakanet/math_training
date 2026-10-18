import { shuffle, uniqueId } from "./math";
import { buildComplexProblems, evaluateComplex, type ComplexProblem } from "./complex-fractions";

export type FractionLevel = 1 | 2 | 3 | 4;
export type FractionArithmeticLevel = 1 | 2;
export type FractionTrainingLevel = FractionLevel;
export type FractionOperator = "×" | "÷";
export type FractionAnswerPosition = "left" | "right" | "result";
export type Fraction = { numerator: number; denominator: number };
export type FractionQuestion = {
  left: Fraction;
  right: Fraction;
  answer: Fraction;
  operator?: FractionOperator;
  missing?: "left" | "right";
  complex?: ComplexProblem;
};
export type FractionAttempt = {
  question: FractionQuestion;
  numerator: string;
  denominator: string;
  correct: boolean;
  elapsedMs: number;
  hintsUsed?: number;
};
export type FractionSession = {
  id: string;
  level: FractionLevel;
  startedAt: number;
  endedAt: number;
  attempts: FractionAttempt[];
};

export const FRACTION_LEVELS = [
  { level: 1, title: "分数の掛け算" },
  { level: 2, title: "分数の割り算" },
  { level: 3, title: "分数の虫食い算" },
  { level: 4, title: "複雑な虫食い算" }
] as const;

export function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function reduceFraction(numerator: number, denominator: number): Fraction {
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

const fractions: Fraction[] = [];
for (let numerator = 1; numerator <= 12; numerator += 1) {
  for (let denominator = numerator + 1; denominator <= 12; denominator += 1) {
    if (gcd(numerator, denominator) === 1) fractions.push({ numerator, denominator });
  }
}

function buildPool(level: FractionArithmeticLevel, withInteger: boolean): FractionQuestion[] {
  const pool: FractionQuestion[] = [];
  const leftValues = withInteger
    ? Array.from({ length: 8 }, (_, index) => ({ numerator: index + 2, denominator: 1 }))
    : fractions;
  for (const left of leftValues) {
    for (const right of fractions) {
      // Division is not commutative, so bound and solve both integer positions independently.
      const pairs = withInteger ? [[left, right], [right, left]] : [[left, right]];
      for (const [first, second] of pairs) {
        const numerator = first.numerator * (level === 2 ? second.denominator : second.numerator);
        const denominator = first.denominator * (level === 2 ? second.numerator : second.denominator);
        if (numerator < denominator && numerator <= 99 && denominator <= 99) {
          pool.push({ left: first, right: second, answer: reduceFraction(numerator, denominator) });
        }
      }
    }
  }
  return pool;
}

const questionPools = {
  1: { fractions: buildPool(1, false), integers: buildPool(1, true) },
  2: { fractions: buildPool(2, false), integers: buildPool(2, true) }
};

function buildMissingPool(operator: FractionOperator, integerResult: boolean): FractionQuestion[] {
  const pool: FractionQuestion[] = [];
  // A product of two proper fractions cannot be an integer. In that case only,
  // include a known integer while keeping the missing value a proper fraction.
  const values = integerResult && operator === "×"
    ? [...fractions, ...Array.from({ length: 8 }, (_, index) => ({ numerator: index + 2, denominator: 1 }))]
    : fractions;
  for (const left of values) {
    for (const right of values) {
      const numerator = left.numerator * (operator === "÷" ? right.denominator : right.numerator);
      const denominator = left.denominator * (operator === "÷" ? right.numerator : right.denominator);
      if (numerator > 99 || denominator > 99) continue;
      const answer = reduceFraction(numerator, denominator);
      if (integerResult ? answer.denominator !== 1 : answer.numerator >= answer.denominator) continue;
      for (const missing of ["left", "right"] as const) {
        const solution = missing === "left" ? left : right;
        if (solution.numerator < solution.denominator) {
          pool.push({ left, right, answer, operator, missing });
        }
      }
    }
  }
  return pool;
}

const missingQuestionPools = {
  "×": { fraction: buildMissingPool("×", false), integer: buildMissingPool("×", true) },
  "÷": { fraction: buildMissingPool("÷", false), integer: buildMissingPool("÷", true) }
};

function buildMissingQuestions(): FractionQuestion[] {
  const used = new Set<string>();
  const questions = Array.from({ length: 5 }, (_, index) => {
    const operator = Math.random() < 0.5 ? "×" : "÷";
    const missing = Math.random() < 0.5 ? "left" : "right";
    const pool = missingQuestionPools[operator][index === 4 ? "integer" : "fraction"];
    const candidates = pool.filter((question) => question.missing === missing && !used.has(JSON.stringify(question)));
    const question = shuffle(candidates)[0];
    used.add(JSON.stringify(question));
    return question;
  });
  return shuffle(questions);
}

export function getFractionOperator(question: FractionQuestion, level: FractionLevel): FractionOperator {
  return question.operator ?? (level === 2 ? "÷" : "×");
}

export function getFractionAnswerPosition(question: FractionQuestion): FractionAnswerPosition {
  return question.missing ?? "result";
}

export function getFractionSolution(question: FractionQuestion): Fraction {
  if (question.complex) return question.complex.solution;
  return question.missing ? question[question.missing] : question.answer;
}

export function buildFractionQuestions(level: FractionTrainingLevel = 1): FractionQuestion[] {
  if (level === 4) return buildComplexProblems().map((complex) => {
    const expression = complex.expression;
    if (expression.kind !== "operation") throw new Error("Expected a compound expression");
    return {
      left: evaluateComplex(expression.left, complex.solution),
      right: evaluateComplex(expression.right, complex.solution),
      answer: complex.result, complex
    };
  });
  if (level === 3) return buildMissingQuestions();
  const pool = questionPools[level];
  return shuffle([...shuffle(pool.fractions).slice(0, 4), shuffle(pool.integers)[0]]);
}

export function createFractionRun(level: FractionTrainingLevel = 1) {
  return { id: uniqueId("fractions"), level, startedAt: Date.now(), questions: buildFractionQuestions(level) };
}

export type FractionRun = ReturnType<typeof createFractionRun>;

export function isFractionAnswerCorrect(answer: Fraction, numerator: string, denominator: string): boolean {
  // Equivalent but unreduced answers are intentionally incorrect.
  return /^\d{1,2}$/.test(numerator) && Number(numerator) === answer.numerator &&
    (answer.denominator === 1 || (/^\d{1,2}$/.test(denominator) && Number(denominator) === answer.denominator));
}

export function fractionMetrics(attempts: FractionAttempt[]) {
  return {
    correctCount: attempts.filter((attempt) => attempt.correct).length,
    accuracy: attempts.length ? attempts.filter((attempt) => attempt.correct).length / attempts.length : 0,
    averageMs: attempts.length ? attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) / attempts.length : 0
  };
}

export function recentFractionSessions(sessions: FractionSession[], level: FractionLevel): FractionSession[] {
  return sessions.filter((session) => session.level === level)
    .sort((a, b) => b.endedAt - a.endedAt).slice(0, 5);
}

export function fractionSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export function fractionHintMetrics(attempts: FractionAttempt[]) {
  return {
    correctWithoutHints: attempts.filter((attempt) => attempt.correct && !attempt.hintsUsed).length,
    hintedQuestions: attempts.filter((attempt) => (attempt.hintsUsed ?? 0) > 0).length
  };
}
