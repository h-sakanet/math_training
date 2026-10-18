import { describe, expect, it } from "vitest";
import {
  buildComplexProblem, calculateFraction, complexVerification, containsBlank, evaluateComplex,
  needsComplexParentheses, reverseComplexSteps, type ArithmeticOperator, type ComplexExpression, type ComplexProblem
} from "./complex-fractions";
import { createFractionRun, fractionHintMetrics, getFractionSolution, gcd, type Fraction, type FractionAttempt } from "./fractions";

const value = (numerator: number, denominator = 1): Fraction => ({ numerator, denominator });
const blank: ComplexExpression = { kind: "blank", id: "blank" };
const number = (numerator: number, denominator = 1): ComplexExpression => ({ kind: "number", id: `n-${numerator}-${denominator}`, value: value(numerator, denominator) });
const operation = (operator: ArithmeticOperator, left: ComplexExpression, right: ComplexExpression, id = "op"): ComplexExpression =>
  ({ kind: "operation", id, operator, left, right });

function seededRandom(seed: number) {
  let state = seed;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}

function nodes(expression: ComplexExpression): ComplexExpression[] {
  return expression.kind === "operation" ? [expression, ...nodes(expression.left), ...nodes(expression.right)] : [expression];
}

// An independent numeric evaluator checks the generated equations and explanations.
function numeric(expression: ComplexExpression, solution: Fraction): number {
  if (expression.kind === "blank") return solution.numerator / solution.denominator;
  if (expression.kind === "number") return expression.value.numerator / expression.value.denominator;
  const left = numeric(expression.left, solution), right = numeric(expression.right, solution);
  switch (expression.operator) {
    case "+": return left + right;
    case "−": return left - right;
    case "×": return left * right;
    case "÷": return left / right;
  }
}

function expectSchoolNumber(fraction: Fraction) {
  expect(fraction.numerator).toBeGreaterThan(0);
  expect(fraction.numerator).toBeLessThanOrEqual(99);
  expect(fraction.denominator).toBeGreaterThan(0);
  expect(fraction.denominator).toBeLessThanOrEqual(24);
  expect(gcd(fraction.numerator, fraction.denominator)).toBe(1);
  expect(fraction.denominator === 1 || fraction.numerator < fraction.denominator).toBe(true);
}

describe("complex missing-number generation", () => {
  it.each([2, 3, 4] as const)("always includes a multiplied or divided parenthesized group at %i stages", (stages) => {
    const random = seededRandom(418 + stages);
    for (let index = 0; index < 100; index += 1) {
      const problem = buildComplexProblem(stages, random);
      let groups = 0;
      for (const node of nodes(problem.expression)) {
        if (node.kind !== "operation") continue;
        for (const [child, right] of [[node.left, false], [node.right, true]] as const) {
          if (needsComplexParentheses(node.operator, child, right)) {
            groups += 1;
            expect(["×", "÷"]).toContain(node.operator);
          }
        }
      }
      expect(groups).toBeGreaterThan(0);
      expect(nodes(problem.expression).some((node) => node.kind === "operation" && (node.operator === "×" || node.operator === "÷"))).toBe(true);
    }
  });

  it("uses the fixed 2,2,3,3,4 progression and keeps the true solution separate from the right-hand result", () => {
    const run = createFractionRun(4);
    expect(run.level).toBe(4);
    expect(run.questions.map((question) => question.complex?.stages)).toEqual([2, 2, 3, 3, 4]);
    for (const question of run.questions) {
      expect(getFractionSolution(question)).toEqual(question.complex?.solution);
      expect(question.answer).toEqual(question.complex?.result);
    }
  });

  it("keeps all operands, intermediate values, answers and verification proper or integer, with one innermost blank", () => {
    const variants = new Set<string>();
    const positions = new Set<number>();
    const solutionKinds = new Set<string>();
    const random = seededRandom(10418);
    for (let index = 0; index < 150; index += 1) {
      const stages = ([2, 3, 4] as const)[index % 3];
      const problem = buildComplexProblem(stages, random);
      const allNodes = nodes(problem.expression);
      expect(allNodes.filter((node) => node.kind === "blank")).toHaveLength(1);
      expect(allNodes.filter((node) => node.kind === "operation")).toHaveLength(stages);
      expectSchoolNumber(problem.solution);
      expectSchoolNumber(problem.result);
      solutionKinds.add(problem.solution.denominator === 1 ? "integer" : "fraction");
      expect(numeric(problem.expression, problem.solution)).toBeCloseTo(problem.result.numerator / problem.result.denominator, 10);
      for (const node of allNodes) {
        expectSchoolNumber(evaluateComplex(node, problem.solution));
        if (node.kind === "operation") {
          expect(containsBlank(node.left) !== containsBlank(node.right)).toBe(true);
          variants.add(`${node.operator}:${containsBlank(node.left) ? "left" : "right"}`);
        }
      }
      positions.add(allNodes.filter((node) => node.kind !== "operation").findIndex((node) => node.kind === "blank"));
      const steps = reverseComplexSteps(problem);
      expect(steps).toHaveLength(stages);
      for (const step of steps) {
        [step.from, step.left, step.right, step.value].forEach(expectSchoolNumber);
        expect(numeric(step.target, problem.solution)).toBeCloseTo(step.value.numerator / step.value.denominator, 10);
      }
      expect(steps[stages - 1].target.kind).toBe("blank");
      expect(steps[stages - 1].value).toEqual(problem.solution);
      const verification = complexVerification(problem);
      expect(verification).toHaveLength(stages + 1);
      verification.forEach((expression, index) => {
        expect(containsBlank(expression)).toBe(false);
        expect(nodes(expression).filter((node) => node.kind === "operation")).toHaveLength(stages - index);
        expect(numeric(expression, problem.solution)).toBeCloseTo(problem.result.numerator / problem.result.denominator, 10);
      });
      expect(verification[stages]).toMatchObject({ kind: "number", value: problem.result });
    }
    expect(variants.size).toBe(8);
    expect([...positions].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(solutionKinds.size).toBe(2);
  });

  it.each(["+", "−", "×", "÷"] as const)("inverts %s correctly for both operand positions", (operator) => {
    const solution = value(2, 3);
    for (const missingLeft of [true, false]) {
      const known = missingLeft ? number(1, 6) : number(5, 6);
      const inner = operation(operator, missingLeft ? blank : known, missingLeft ? known : blank, "inner");
      const expression = operation("+", inner, number(1), "outer");
      const problem: ComplexProblem = { expression, solution, result: evaluateComplex(expression, solution), stages: 2 };
      const steps = reverseComplexSteps(problem);
      expect(steps[1].value).toEqual(solution);
      expect(steps[1].target).toEqual(blank);
      expect(calculateFraction(steps[1].left, steps[1].operator, steps[1].right)).toEqual(solution);
    }
  });

  it("keeps full explanation metadata through JSON storage", () => {
    const problem = buildComplexProblem(4, seededRandom(88));
    const stored = JSON.parse(JSON.stringify(problem)) as ComplexProblem;
    expect(reverseComplexSteps(stored)).toEqual(reverseComplexSteps(problem));
    expect(complexVerification(stored)).toEqual(complexVerification(problem));
  });

  it("distinguishes correct answers without hints from hinted and wrong answers", () => {
    const question = createFractionRun(4).questions[0];
    const attempts: FractionAttempt[] = [
      { question, numerator: "1", denominator: "2", correct: true, elapsedMs: 1000, hintsUsed: 0 },
      { question, numerator: "1", denominator: "2", correct: true, elapsedMs: 2000, hintsUsed: 2 },
      { question, numerator: "1", denominator: "3", correct: false, elapsedMs: 3000, hintsUsed: 1 }
    ];
    expect(fractionHintMetrics(attempts)).toEqual({ correctWithoutHints: 1, hintedQuestions: 2 });
    expect(fractionHintMetrics([])).toEqual({ correctWithoutHints: 0, hintedQuestions: 0 });
    expect(fractionHintMetrics([{ ...attempts[0], hintsUsed: undefined }])).toEqual({ correctWithoutHints: 1, hintedQuestions: 0 });
  });
});
