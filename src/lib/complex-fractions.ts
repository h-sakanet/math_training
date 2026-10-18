import { reduceFraction, type Fraction } from "./fractions";

export type ArithmeticOperator = "+" | "−" | "×" | "÷";
export type ComplexExpression =
  | { kind: "blank"; id: string }
  | { kind: "number"; id: string; value: Fraction }
  | { kind: "operation"; id: string; operator: ArithmeticOperator; left: ComplexExpression; right: ComplexExpression };
export type ComplexProblem = {
  expression: ComplexExpression;
  solution: Fraction;
  result: Fraction;
  stages: 2 | 3 | 4;
};
export type ReverseStep = {
  target: ComplexExpression;
  from: Fraction;
  left: Fraction;
  operator: ArithmeticOperator;
  right: Fraction;
  value: Fraction;
  reason: string;
};

export function calculateFraction(left: Fraction, operator: ArithmeticOperator, right: Fraction): Fraction {
  const a = left.numerator, b = left.denominator, c = right.numerator, d = right.denominator;
  if (b <= 0 || d <= 0 || (operator === "÷" && c === 0)) throw new Error("Invalid denominator");
  switch (operator) {
    case "+": return reduceFraction(a * d + c * b, b * d);
    case "−": return reduceFraction(a * d - c * b, b * d);
    case "×": return reduceFraction(a * c, b * d);
    case "÷": return reduceFraction(a * d, b * c);
  }
}

export function evaluateComplex(expression: ComplexExpression, solution: Fraction): Fraction {
  if (expression.kind === "blank") return solution;
  if (expression.kind === "number") return expression.value;
  return calculateFraction(evaluateComplex(expression.left, solution), expression.operator, evaluateComplex(expression.right, solution));
}

export function containsBlank(expression: ComplexExpression): boolean {
  return expression.kind === "blank" || (expression.kind === "operation" &&
    (containsBlank(expression.left) || containsBlank(expression.right)));
}

export function needsComplexParentheses(parent: ArithmeticOperator, child: ComplexExpression, right: boolean): boolean {
  if (child.kind !== "operation") return false;
  const parentPrecedence = parent === "+" || parent === "−" ? 1 : 2;
  const childPrecedence = child.operator === "+" || child.operator === "−" ? 1 : 2;
  return childPrecedence < parentPrecedence || (right && childPrecedence === parentPrecedence);
}

export function reverseComplexSteps(problem: ComplexProblem): ReverseStep[] {
  const steps: ReverseStep[] = [];
  let expression = problem.expression;
  let from = problem.result;
  while (expression.kind === "operation") {
    const missingLeft = containsBlank(expression.left);
    const target = missingLeft ? expression.left : expression.right;
    const known = evaluateComplex(missingLeft ? expression.right : expression.left, problem.solution);
    let left = from, right = known;
    let operator: ArithmeticOperator;
    let reason: string;
    switch (expression.operator) {
      case "+":
        operator = "−";
        reason = "足す前の数を求めるので、分かっている数を引きます。";
        break;
      case "−":
        operator = missingLeft ? "+" : "−";
        if (!missingLeft) { left = known; right = from; }
        reason = missingLeft ? "引く前の数を求めるので、引いた数を足します。"
          : "引く数を求めるので、もとの数から残った数を引きます。";
        break;
      case "×":
        operator = "÷";
        reason = "かけ算を逆にたどり、分かっている数で割ります。";
        break;
      case "÷":
        operator = missingLeft ? "×" : "÷";
        if (!missingLeft) { left = known; right = from; }
        reason = missingLeft ? "割る前の数を求めるので、割った数をかけます。"
          : "割る数を求めるので、もとの数を割った後の答えで割ります。";
        break;
    }
    const value = calculateFraction(left, operator, right);
    steps.push({ target, from, left, operator, right, value, reason });
    expression = target;
    from = value;
  }
  return steps;
}

// Keep every displayed value (including reverse work and verification) a proper fraction or integer.
function friendly(value: Fraction): boolean {
  return value.numerator > 0 && value.denominator > 0 && value.numerator <= 99 &&
    value.denominator <= 24 && value.numerator / value.denominator <= 20 &&
    (value.numerator < value.denominator || value.denominator === 1);
}

export function buildComplexProblem(stages: 2 | 3 | 4, random: () => number = Math.random): ComplexProblem {
  const pick = <T,>(values: T[]): T => values[Math.floor(random() * values.length)];
  const knownValues: Fraction[] = [];
  const solutions: Fraction[] = [];
  for (let denominator = 1; denominator <= 12; denominator += 1) {
    for (let numerator = 1; numerator <= 24; numerator += 1) {
      const value = reduceFraction(numerator, denominator);
      if (value.numerator !== numerator || !friendly(value)) continue;
      knownValues.push(value);
      if ((numerator < denominator || denominator === 1) && numerator <= 9) solutions.push(value);
    }
  }

  attempts: for (let attempt = 0; attempt < 100; attempt += 1) {
    const solution = pick(solutions);
    let expression: ComplexExpression = { kind: "blank", id: "blank" };
    let current = solution;
    let hasFraction = solution.denominator !== 1;
    let hasMultiplicativeGroup = false;
    for (let depth = 0; depth < stages; depth += 1) {
      const options: { operator: ArithmeticOperator; childOnLeft: boolean; values: { known: Fraction; result: Fraction }[] }[] = [];
      for (const operator of ["+", "−", "×", "÷"] as const) {
        for (const childOnLeft of [true, false]) {
          const parentheses = needsComplexParentheses(operator, expression, !childOnLeft);
          // Parenthesized groups must be multiplied or divided, never added or subtracted.
          if (parentheses && (operator === "+" || operator === "−")) continue;
          // Every problem includes an actual parenthesized group used in × or ÷.
          if (depth === stages - 1 && !hasMultiplicativeGroup && !parentheses) continue;
          const values = knownValues.flatMap((known) => {
            if (depth === stages - 1 && !hasFraction && known.denominator === 1) return [];
            if ((operator === "×" || operator === "÷") && known.numerator === known.denominator) return [];
            const result = childOnLeft ? calculateFraction(current, operator, known) : calculateFraction(known, operator, current);
            return friendly(result) ? [{ known, result }] : [];
          });
          if (values.length) options.push({ operator, childOnLeft, values });
        }
      }
      if (options.length === 0) continue attempts;
      const option = pick(options);
      const { known, result } = pick(option.values);
      const number: ComplexExpression = { kind: "number", id: `number-${depth}`, value: known };
      hasMultiplicativeGroup ||= needsComplexParentheses(option.operator, expression, !option.childOnLeft);
      expression = {
        kind: "operation", id: `operation-${depth}`, operator: option.operator,
        left: option.childOnLeft ? expression : number, right: option.childOnLeft ? number : expression
      };
      current = result;
      hasFraction ||= known.denominator !== 1;
    }
    if (hasFraction && hasMultiplicativeGroup) return { expression, solution, result: current, stages };
  }
  throw new Error("Could not generate a fraction problem");
}

export function buildComplexProblems(): ComplexProblem[] {
  return ([2, 2, 3, 3, 4] as const).map((stages) => buildComplexProblem(stages));
}

export function substituteComplex(expression: ComplexExpression, solution: Fraction): ComplexExpression {
  if (expression.kind === "blank") return { kind: "number", id: expression.id, value: solution };
  if (expression.kind === "number") return expression;
  return { ...expression, left: substituteComplex(expression.left, solution), right: substituteComplex(expression.right, solution) };
}

export function complexVerification(problem: ComplexProblem): ComplexExpression[] {
  const expressions = [substituteComplex(problem.expression, problem.solution)];
  function collapse(expression: ComplexExpression): ComplexExpression {
    if (expression.kind !== "operation") return expression;
    if (expression.left.kind === "number" && expression.right.kind === "number") {
      return { kind: "number", id: expression.id, value: calculateFraction(expression.left.value, expression.operator, expression.right.value) };
    }
    return expression.left.kind === "operation"
      ? { ...expression, left: collapse(expression.left) }
      : { ...expression, right: collapse(expression.right) };
  }
  while (expressions[expressions.length - 1].kind === "operation") expressions.push(collapse(expressions[expressions.length - 1]));
  return expressions;
}
