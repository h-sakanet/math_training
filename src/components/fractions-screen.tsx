import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FractionTrainingScreen } from "@/components/fraction-training-screen";
import { FractionValue } from "@/components/fraction-value";
import { ComplexExpressionView } from "@/components/complex-fraction-expression";
import { ComplexFractionExplanation } from "@/components/complex-fraction-explanation";
import { getFractionSessions, saveFractionSession } from "@/lib/fraction-storage";
import {
  FRACTION_LEVELS, createFractionRun, fractionHintMetrics, fractionMetrics, fractionSeconds, getFractionOperator, recentFractionSessions,
  type FractionTrainingLevel, type FractionRun, type FractionSession
} from "@/lib/fractions";

export function FractionsScreen({ onBackHome }: { onBackHome: () => void }) {
  const [sessions, setSessions] = React.useState<FractionSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [run, setRun] = React.useState<FractionRun | null>(null);
  const [result, setResult] = React.useState<FractionSession | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"saving" | "saved" | "error">("saved");

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setSessions(await getFractionSessions());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadHistory(); }, [loadHistory]);

  function start(level: FractionTrainingLevel) {
    setResult(null);
    setRun(createFractionRun(level));
  }

  async function persist(session: FractionSession) {
    setSaveStatus("saving");
    try {
      await saveFractionSession(session);
      setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  if (result) {
    const metrics = fractionMetrics(result.attempts);
    const hintMetrics = fractionHintMetrics(result.attempts);
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-sky-700">分数 · レベル{result.level}</p>
            <CardTitle>5問の結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-sky-50 p-4 sm:p-6">
                <p className="text-sm text-muted-foreground">正答率</p>
                <p className="mt-2 text-3xl font-semibold text-sky-800">{Math.round(metrics.accuracy * 100)}<span className="ml-1 text-base">%</span></p>
                <p className="mt-1 text-xs text-muted-foreground">5問中 {metrics.correctCount} 問正解</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 sm:p-6">
                <p className="text-sm text-muted-foreground">回答速度</p>
                <p className="mt-2 text-3xl font-semibold">{fractionSeconds(metrics.averageMs)}<span className="ml-1 text-base">秒 / 問</span></p>
                <p className="mt-1 text-xs text-muted-foreground">5問の平均回答時間</p>
              </div>
            </div>
            {result.level === 4 && <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
              ヒントなしで正解 {hintMetrics.correctWithoutHints} / 5 問 · ヒント利用 {hintMetrics.hintedQuestions} 問
            </div>}
            <div className="divide-y rounded-xl border px-3 sm:px-5" aria-label="問題ごとの結果">
              {result.attempts.map((attempt, index) => attempt.question.complex ? (
                <div key={index} className="min-w-0 space-y-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className={`font-semibold ${attempt.correct ? "text-emerald-700" : "text-rose-700"}`}>
                      {index + 1}. {attempt.correct ? "○" : "×"} · {attempt.question.complex.stages}段階
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {attempt.hintsUsed ? `ヒント${attempt.hintsUsed}回` : "ヒントなし"} · {fractionSeconds(attempt.elapsedMs)} 秒
                    </span>
                  </div>
                  <div className="complex-scroll" tabIndex={0} aria-label={`問題${index + 1}の式`}>
                    <div className="complex-step-equation">
                      <ComplexExpressionView expression={attempt.question.complex.expression} /><span>＝</span>
                      <FractionValue value={attempt.question.complex.result} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>□の答え</span><FractionValue value={attempt.question.complex.solution} />
                  </div>
                  <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium text-sky-800">解き方を見る</summary>
                    <div className="mt-3"><ComplexFractionExplanation problem={attempt.question.complex} /></div>
                  </details>
                </div>
              ) : (
                <div key={index} className="flex items-center justify-between gap-2 py-4">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className={`text-sm font-semibold ${attempt.correct ? "text-emerald-700" : "text-rose-700"}`}>
                      {index + 1}. {attempt.correct ? "○" : "×"}
                    </span>
                    <div className="fraction-result-equation">
                      <FractionValue value={attempt.question.left} /><span>{getFractionOperator(attempt.question, result.level)}</span>
                      <FractionValue value={attempt.question.right} /><span>＝</span>
                      <FractionValue value={attempt.question.answer} />
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">{fractionSeconds(attempt.elapsedMs)} 秒</span>
                </div>
              ))}
            </div>
            <div aria-live="polite" className="text-sm text-muted-foreground">
              {saveStatus === "saving" && "結果を保存しています…"}
              {saveStatus === "saved" && "結果を保存しました。レベル選択画面で直近5回を確認できます。"}
              {saveStatus === "error" && (
                <div className="space-y-2 text-rose-700" role="alert">
                  <p>履歴を保存できませんでした。この画面を離れると今回の記録が失われます。</p>
                  <Button variant="outline" onClick={() => void persist(result)}>保存を再試行</Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={saveStatus === "saving"} onClick={onBackHome}>ホームへ戻る</Button>
              <Button disabled={saveStatus === "saving"} onClick={() => start(result.level)}>もう一度チャレンジ</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (run) {
    return <FractionTrainingScreen key={run.id} run={run}
      onBack={() => setRun(null)}
      onFinish={(session) => { setResult(session); void persist(session); }} />;
  }

  return <FractionLevelsScreen sessions={sessions} loading={loading} loadError={loadError}
    onReload={() => void loadHistory()} onStart={start} onBackHome={onBackHome} />;
}

export function FractionLevelsScreen({ sessions, loading, loadError, onReload, onStart, onBackHome }: {
  sessions: FractionSession[];
  loading: boolean;
  loadError: boolean;
  onReload: () => void;
  onStart: (level: FractionTrainingLevel) => void;
  onBackHome: () => void;
}) {
  return (
    <div className="fraction-levels-screen mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Card className="fraction-levels-heading">
        <CardHeader className="fraction-levels-heading-content flex flex-row items-center justify-between gap-3">
          <div className="fraction-levels-heading-copy flex flex-col gap-2">
            <CardTitle className="text-2xl">分数</CardTitle>
            <p className="text-sm text-muted-foreground">4つのレベルで、分数の計算を練習しましょう。</p>
          </div>
          <Button variant="outline" onClick={onBackHome}>ホームへ戻る</Button>
        </CardHeader>
      </Card>
      {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-700">
        <span>履歴を読み込めませんでした。</span><Button variant="outline" onClick={onReload}>再読み込み</Button>
      </div>}
      <div className="fraction-levels-grid grid gap-4 md:grid-cols-2">
        {FRACTION_LEVELS.map(({ level, title }) => {
          const recent = recentFractionSessions(sessions, level);
          return (
            <Card key={level} className="fraction-level-card">
              <CardHeader className="fraction-level-card-header">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-sky-700">レベル {level}</p>
                </div>
                <CardTitle className="text-xl">{title}</CardTitle>
                {level === 4 && <p className="text-xs text-muted-foreground">2 → 2 → 3 → 3 → 4段階 · ヒントと途中式つき</p>}
              </CardHeader>
              <CardContent className="fraction-level-card-content flex flex-col gap-4">
                <div className="fraction-level-history rounded-lg bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">直近5回の記録 · 新しい順</p>
                  <table className="w-full text-right text-sm">
                    <thead><tr className="text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-normal">実施日時</th>
                      <th className="pb-2 font-normal">正答率</th>
                      <th className="pb-2 font-normal">回答速度</th>
                    </tr></thead>
                    <tbody>
                      {recent.map((session) => {
                        const metrics = fractionMetrics(session.attempts);
                        return <tr key={session.id}>
                          <td className="py-1 text-left text-xs">{new Date(session.endedAt).toLocaleString("ja-JP", {
                            month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })}</td>
                          <td className="py-1 font-medium">{Math.round(metrics.accuracy * 100)}%
                            {level === 4 && <p className="fraction-history-hints text-xs font-normal text-muted-foreground">自力 {fractionHintMetrics(session.attempts).correctWithoutHints}問</p>}
                          </td>
                          <td className="py-1">{fractionSeconds(metrics.averageMs)} 秒/問</td>
                        </tr>;
                      })}
                      {recent.length === 0 && <tr><td colSpan={3} className="py-5 text-center text-xs text-muted-foreground">
                        {loading ? "読み込み中…" : loadError ? "履歴を表示できません" : "まだ記録がありません"}
                      </td></tr>}
                    </tbody>
                  </table>
                </div>
                <Button className="w-full" onClick={() => onStart(level)}>
                  5問にチャレンジ
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="fraction-levels-note text-xs text-muted-foreground">回答速度は1問あたりの平均回答時間です。履歴はこの端末のブラウザに保存されます。</p>
    </div>
  );
}
