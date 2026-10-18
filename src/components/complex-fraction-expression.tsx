import type { ReactNode } from "react";
import { FractionValue } from "@/components/fraction-value";
import { needsComplexParentheses, type ComplexExpression } from "@/lib/complex-fractions";

export function ComplexExpressionView({ expression, blank, highlightId }: {
  expression: ComplexExpression;
  blank?: ReactNode;
  highlightId?: string;
}) {
  function render(node: ComplexExpression): ReactNode {
    const highlight = node.id === highlightId;
    let content: ReactNode;
    if (node.kind === "blank") {
      content = blank ?? <span className="complex-blank-symbol" aria-label="空欄">□</span>;
    } else if (node.kind === "number") {
      content = <FractionValue value={node.value} />;
    } else {
      function child(value: ComplexExpression, right: boolean) {
        const parentheses = node.kind === "operation" && needsComplexParentheses(node.operator, value, right);
        return <>{parentheses && <span className="complex-parenthesis">(</span>}{render(value)}{parentheses && <span className="complex-parenthesis">)</span>}</>;
      }
      content = <>{child(node.left, false)}<span className="complex-operator">{node.operator}</span>{child(node.right, true)}</>;
    }
    return <span className={`complex-expression-node ${highlight ? "complex-highlight" : ""}`}>{content}</span>;
  }
  return <span className="complex-expression">{render(expression)}</span>;
}
