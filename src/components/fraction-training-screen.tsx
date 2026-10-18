import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FractionValue } from "@/components/fraction-value";
import { ComplexExpressionView } from "@/components/complex-fraction-expression";
import { ComplexFractionExplanation, ComplexFractionHint } from "@/components/complex-fraction-explanation";
import { reverseComplexSteps } from "@/lib/complex-fractions";
import {
  FRACTION_LEVELS, fractionSeconds, getFractionAnswerPosition, getFractionOperator, getFractionSolution, isFractionAnswerCorrect,
  type FractionAnswerPosition, type FractionTrainingLevel, type FractionAttempt, type FractionQuestion, type FractionRun, type FractionSession
} from "@/lib/fractions";

type TrainingProps = {
  run: FractionRun;
  onFinish: (session: FractionSession) => void;
  onBack: () => void;
};

export function FractionTrainingScreen({ run, onFinish, onBack }: TrainingProps) {
  const [index, setIndex] = React.useState(0);
  const [attempts, setAttempts] = React.useState<FractionAttempt[]>([]);
  const advancing = React.useRef(false);
  const screen = React.useRef<HTMLDivElement>(null);

  function next() {
    if (!attempts[index] || advancing.current) return;
    advancing.current = true;
    if (index === run.questions.length - 1) {
      onFinish({ id: run.id, level: run.level, startedAt: run.startedAt, endedAt: Date.now(), attempts });
    } else {
      setIndex(index + 1);
    }
  }

  React.useEffect(() => { advancing.current = false; }, [index]);
  React.useEffect(() => {
    if (run.level === 4) screen.current?.scrollIntoView({ block: "start" });
  }, [index, run.level]);

  return (
    <div ref={screen} className="fraction-training-screen mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="fraction-training-heading flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-sky-700">分数 · レベル{run.level}</p>
          <h1 className="text-xl font-semibold sm:text-2xl">{FRACTION_LEVELS[run.level - 1].title}</h1>
        </div>
        <Button variant="outline" onClick={onBack}>レベル選択へ</Button>
      </div>
      <Card className="fraction-training-card">
        <CardHeader className="fraction-training-header pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">問題 {index + 1} / 5</CardTitle>
            <span className="text-sm text-muted-foreground">約分した答えを入力</span>
          </div>
          <div className="flex gap-2" aria-label={`${attempts.length}問回答済み`}>
            {run.questions.map((_, position) => (
              <span key={position} className={`h-1.5 flex-1 rounded-full ${position <= index ? "bg-sky-500" : "bg-slate-100"}`} />
            ))}
          </div>
        </CardHeader>
        <CardContent className="fraction-training-content">
          <FractionQuestionStep
            key={index}
            level={run.level}
            question={run.questions[index]}
            attempt={attempts[index]}
            isLast={index === 4}
            onAnswer={(attempt) => setAttempts((current) => current[index] ? current : [...current, attempt])}
            onNext={next}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FractionQuestionStep({ level, question, attempt, isLast, onAnswer, onNext }: {
  level: FractionTrainingLevel;
  question: FractionQuestion;
  attempt?: FractionAttempt;
  isLast: boolean;
  onAnswer: (attempt: FractionAttempt) => void;
  onNext: () => void;
}) {
  const solution = getFractionSolution(question);
  const isInteger = solution.denominator === 1;
  const [numerator, setNumerator] = React.useState("");
  const [denominator, setDenominator] = React.useState("");
  const [active, setActive] = React.useState<"numerator" | "denominator">(isInteger ? "numerator" : "denominator");
  const [hintsUsed, setHintsUsed] = React.useState(0);
  const startedAt = React.useRef(performance.now());
  const submitted = React.useRef(false);
  const complex = question.complex;
  const answerPosition = getFractionAnswerPosition(question);
  const complete = numerator !== "" && (isInteger || denominator !== "");

  const input = React.useCallback((key: string) => {
    if (submitted.current) return;
    const update = active === "numerator" ? setNumerator : setDenominator;
    update((value) => {
      if (key === "clear") return "";
      if (key === "backspace") return value.slice(0, -1);
      if (value.length >= 2) return value;
      return value === "0" ? key : value + key;
    });
  }, [active]);

  React.useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || submitted.current) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        input(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        input(event.key === "Backspace" ? "backspace" : "clear");
      } else if (!isInteger && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        setActive(event.key === "ArrowUp" ? "numerator" : "denominator");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [input, isInteger]);

  function answer() {
    if (!complete || submitted.current) return;
    submitted.current = true;
    onAnswer({
      question, numerator, denominator: isInteger ? "1" : denominator,
      correct: isFractionAnswerCorrect(solution, numerator, denominator),
      elapsedMs: Math.max(1, Math.round(performance.now() - startedAt.current)),
      ...(complex ? { hintsUsed } : {})
    });
  }

  function answerBox(field: "numerator" | "denominator") {
    const label = isInteger ? "答え" : field === "numerator" ? "答えの分子" : "答えの分母";
    const value = field === "numerator" ? numerator : denominator;
    return (
      <button
        type="button"
        aria-label={`${label}${value ? `: ${value}` : "（未入力）"}`}
        aria-pressed={active === field}
        disabled={Boolean(attempt)}
        className={`fraction-answer-box ${active === field ? "fraction-answer-active" : ""}`}
        onClick={() => setActive(field)}
      >{value}</button>
    );
  }

  function equationValue(position: FractionAnswerPosition) {
    if (position === answerPosition) {
      return answerFields();
    }
    return <FractionValue value={position === "result" ? question.answer : question[position]} />;
  }

  function answerFields() {
    return <span className="fraction-answer">
      {answerBox("numerator")}
      {!isInteger && <span className="fraction-answer-bottom">{answerBox("denominator")}</span>}
    </span>;
  }

  function hintButton(className: string) {
    return <Button className={className} variant="outline" disabled={hintsUsed >= 2}
      onClick={() => setHintsUsed((value) => Math.min(2, value + 1))}>
      {hintsUsed === 0 ? "ヒント：どこから考える？" : hintsUsed === 1 ? "最初の逆算を見る" : "ヒントを表示中"}
    </Button>;
  }

  return (
    <div className={`fraction-workspace ${complex ? "complex-workspace" : ""}`}>
      <div className="fraction-question-main flex min-w-0 flex-col gap-5">
        <div className="fraction-question-guide flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">□をタップして、右のテンキーで入力</p>
          {complex && <p className="font-medium text-sky-700">{complex.stages}段階の逆算</p>}
        </div>
        {complex ? <>
          <div className="complex-scroll complex-problem-scroll" tabIndex={0} role="group" aria-label="複雑な虫食い算の問題">
            <div className="complex-problem-equation">
              <ComplexExpressionView expression={complex.expression} blank={answerFields()}
                highlightId={hintsUsed > 0 ? reverseComplexSteps(complex)[0].target.id : undefined} />
              <span>＝</span><FractionValue value={complex.result} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:hidden">長い式は左右に動かせます。</p>
        </> : <div className="fraction-equation" role="group" aria-label={`${FRACTION_LEVELS[level - 1].title}の問題`}>
          {equationValue("left")}
          <span className="fraction-operator">{getFractionOperator(question, level)}</span>
          {equationValue("right")}
          <span className="fraction-operator">＝</span>
          {equationValue("result")}
        </div>}
        <div className={`fraction-assistance space-y-3 ${complex ? "fraction-complex-assistance" : ""}`}>
          {!attempt && complex && <div className="fraction-hint-area space-y-3">
            {hintButton("fraction-inline-hint")}
            <ComplexFractionHint problem={complex} hintsUsed={hintsUsed} />
          </div>}
        <div className={`fraction-question-feedback ${complex ? "" : "min-h-36"}`} aria-live="polite" aria-atomic="true">
          {attempt ? (
            <div className={`rounded-xl border p-3 sm:p-4 ${attempt.correct
              ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <p className={`font-semibold ${attempt.correct ? "text-emerald-700" : "text-rose-700"}`}>
                {attempt.correct ? "○ 正解！" : "× 不正解"}
              </p>
              {!complex && <div className="mt-2 flex items-center gap-3 text-sm">
                <span>正しい答え</span>
                <span className="fraction-feedback-value"><FractionValue value={solution} /></span>
              </div>}
              <p className="mt-2 text-xs text-muted-foreground">回答時間 {fractionSeconds(attempt.elapsedMs)} 秒</p>
            </div>
          ) : null}
        </div>
        {attempt && complex && <ComplexFractionExplanation problem={complex} />}
        </div>
        {attempt ? (
          <Button className="fraction-submit w-full" onClick={onNext}>{isLast ? "結果を見る" : "次の問題へ"}</Button>
        ) : (
          <Button className="fraction-submit w-full" disabled={!complete} onClick={answer}>回答する</Button>
        )}
      </div>
      <aside className="fraction-keypad" aria-label="テンキー">
        <p className="mb-3 text-center text-xs font-medium text-muted-foreground">
          {attempt ? "回答済み" : isInteger ? "答えを入力中" : active === "numerator" ? "分子を入力中" : "分母を入力中"}
        </p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {["7", "8", "9", "4", "5", "6", "1", "2", "3", "clear", "0", "backspace"].map((key) => (
            <Button
              key={key} variant="outline"
              className={`fraction-key ${key === "clear" ? "text-xs" : ""}`}
              disabled={Boolean(attempt)}
              aria-label={key === "clear" ? "選択中の欄をクリア" : key === "backspace" ? "1文字消す" : key}
              onClick={() => input(key)}
            >{key === "clear" ? "C" : key === "backspace" ? "⌫" : key}</Button>
          ))}
        </div>
        {!attempt && complex && hintButton("fraction-keypad-hint mt-3 h-auto w-full whitespace-normal px-2 py-2")}
      </aside>
    </div>
  );
}
