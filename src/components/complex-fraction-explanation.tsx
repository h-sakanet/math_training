import * as React from "react";
import { Button } from "@/components/ui/button";
import { FractionValue } from "@/components/fraction-value";
import { ComplexExpressionView } from "@/components/complex-fraction-expression";
import { complexVerification, reverseComplexSteps, type ComplexProblem, type ReverseStep } from "@/lib/complex-fractions";

function ReverseStepView({ step, index }: { step: ReverseStep; index: number }) {
  return <div className="rounded-lg border border-sky-100 bg-white p-3">
    <p className="text-sm font-medium text-sky-800">手順 {index + 1}</p>
    <p className="mt-1 text-sm leading-relaxed">{step.reason}</p>
    <div className="complex-scroll mt-3" tabIndex={0} aria-label={`手順${index + 1}の途中式`}>
      <div className="complex-step-equation">
        <ComplexExpressionView expression={step.target} highlightId={step.target.id} />
        <span>＝</span><FractionValue value={step.left} /><span>{step.operator}</span>
        <FractionValue value={step.right} /><span>＝</span><FractionValue value={step.value} />
      </div>
    </div>
  </div>;
}

export function ComplexFractionHint({ problem, hintsUsed }: { problem: ComplexProblem; hintsUsed: number }) {
  if (!hintsUsed) return null;
  const steps = reverseComplexSteps(problem);
  const operator = problem.expression.kind === "operation" ? problem.expression.operator : "";
  return <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3" aria-live="polite">
    <p className="text-sm leading-relaxed">青いまとまりを、ひとつの数と考えよう。<br />
      最後に計算する「{operator}」から、逆にたどります。</p>
    {hintsUsed >= 2 && <ReverseStepView step={steps[0]} index={0} />}
  </div>;
}

export function ComplexFractionExplanation({ problem }: { problem: ComplexProblem }) {
  const [visible, setVisible] = React.useState(1);
  const [verify, setVerify] = React.useState(false);
  const controls = React.useRef<HTMLDivElement>(null);
  const steps = reverseComplexSteps(problem);
  const verification = complexVerification(problem);
  React.useEffect(() => {
    if (visible > 1) controls.current?.scrollIntoView({ block: "nearest" });
  }, [visible]);
  return <div className="space-y-3 rounded-xl bg-sky-50 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold text-sky-900">外側から、ひとつずつほどこう</p>
      <span className="text-xs text-sky-700">{visible} / {steps.length} 手順</span>
    </div>
    <div className="space-y-3" aria-live="polite" aria-relevant="additions">
      {steps.slice(0, visible).map((step, index) => <ReverseStepView key={step.target.id} step={step} index={index} />)}
    </div>
    <div ref={controls}>{visible < steps.length ? <Button variant="outline" className="w-full bg-white" onClick={() => setVisible((value) => Math.min(steps.length, value + 1))}>
      次の手順を見る
    </Button> : <>
      <div className="flex items-center justify-center gap-3 py-2 text-lg font-semibold" aria-label="空欄の正解">
        <span>□の答え</span><FractionValue value={problem.solution} />
      </div>
      <Button variant="outline" className="w-full bg-white" aria-expanded={verify} onClick={() => setVerify((value) => !value)}>
        {verify ? "検算を閉じる" : "答えを入れて確かめる"}
      </Button>
    </>}</div>
    {verify && <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-3">
      <p className="text-sm font-medium text-emerald-800">□に答えを入れ、今度は計算する順に進みます。</p>
      <div className="complex-scroll" tabIndex={0} aria-label="元の式に答えを入れた検算">
        <div className="space-y-3">
          {verification.map((expression, index) => <div key={index} className="complex-step-equation">
            <ComplexExpressionView expression={expression} /><span>＝</span><FractionValue value={problem.result} />
          </div>)}
        </div>
      </div>
      <p className="text-sm font-semibold text-emerald-700">右辺と一致しました！</p>
    </div>}
  </div>;
}
