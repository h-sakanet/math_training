import * as React from "react";
import { Hourglass } from "@phosphor-icons/react";
import { AngleDiagram } from "@/components/angle-diagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildSessionMetrics,
  isPairReasoningAnswerCorrect,
  isSingleReasoningAnswerCorrect
} from "@/lib/metrics";
import { saveSessionProgress } from "@/lib/storage";
import type { AttemptLog, SessionLog, SessionRun } from "@/lib/types";

type TrainingScreenProps = {
  run: SessionRun;
  onFinish: (session: SessionLog) => void;
};

export function TrainingScreen({ run, onFinish }: TrainingScreenProps) {
  const [index, setIndex] = React.useState(0);
  const [attempts, setAttempts] = React.useState<AttemptLog[]>([]);
  const [wrongCount, setWrongCount] = React.useState(0);
  const [selectedAngleIds, setSelectedAngleIds] = React.useState<string[]>([]);
  const [feedbackStatus, setFeedbackStatus] = React.useState<"correct" | "incorrect" | null>(null);
  const [feedbackAngleIds, setFeedbackAngleIds] = React.useState<string[]>([]);
  const [feedbackAnchorAngleId, setFeedbackAnchorAngleId] = React.useState<string | null>(null);
  const [readyForNext, setReadyForNext] = React.useState(false);

  const startPerfMsRef = React.useRef(performance.now());
  const startEpochRef = React.useRef(Date.now());
  const wrongCountRef = React.useRef(0);
  const attemptsRef = React.useRef<AttemptLog[]>([]);

  const question = run.questions[index];
  const isLast = index === run.questions.length - 1;

  const persistProgress = React.useCallback(
    (nextAttempts: AttemptLog[]) => {
      const metrics = buildSessionMetrics(nextAttempts);
      const snapshot: SessionLog = {
        id: run.id,
        unitId: run.unitId,
        level: run.level,
        startedAt: run.startedAt,
        endedAt: 0,
        attempts: nextAttempts,
        medianMs: metrics.medianMs,
        errorRate: metrics.errorRate,
        completed: false
      };
      void saveSessionProgress(snapshot);
    },
    [run.id, run.level, run.startedAt, run.unitId]
  );

  const setAndPersistAttempts = React.useCallback(
    (nextAttempts: AttemptLog[]) => {
      attemptsRef.current = nextAttempts;
      setAttempts(nextAttempts);
      persistProgress(nextAttempts);
    },
    [persistProgress]
  );

  const createPresentedAttempt = React.useCallback(
    (startedAt: number): AttemptLog => ({
      questionId: question.id,
      questionKey: question.questionKey,
      patternId: question.patternId,
      sourcePatternId: question.sourcePatternId,
      baseFigureId: question.baseFigureId,
      variant: question.variant,
      arrangementKind: question.arrangementKind,
      startedAt,
      solvedAt: null,
      elapsedMs: null,
      wrongCount: 0,
      firstTryCorrect: null,
      isSolved: false
    }),
    [question]
  );

  const updateCurrentAttempt = React.useCallback(
    (updater: (attempt: AttemptLog) => AttemptLog) => {
      const currentAttempts = attemptsRef.current;
      const existingIndex = currentAttempts.findIndex((attempt) => attempt.questionId === question.id);
      const fallback = createPresentedAttempt(startEpochRef.current);
      const baseAttempt = existingIndex >= 0 ? currentAttempts[existingIndex] : fallback;
      const nextAttempt = updater(baseAttempt);
      const nextAttempts = existingIndex >= 0
        ? currentAttempts.map((attempt, idx) => (idx === existingIndex ? nextAttempt : attempt))
        : [...currentAttempts, nextAttempt];
      setAndPersistAttempts(nextAttempts);
      return nextAttempt;
    },
    [createPresentedAttempt, question.id, setAndPersistAttempts]
  );

  React.useEffect(() => {
    startPerfMsRef.current = performance.now();
    const startedAt = Date.now();
    startEpochRef.current = startedAt;
    setWrongCount(0);
    wrongCountRef.current = 0;
    setSelectedAngleIds([]);
    setFeedbackStatus(null);
    setFeedbackAngleIds([]);
    setFeedbackAnchorAngleId(null);
    setReadyForNext(false);
    const currentAttempts = attemptsRef.current;
    if (!currentAttempts.some((attempt) => attempt.questionId === question.id)) {
      setAndPersistAttempts([...currentAttempts, createPresentedAttempt(startedAt)]);
    }
  }, [createPresentedAttempt, index, question.id, setAndPersistAttempts]);

  function markCorrect(markedAngleIds: string[]) {
    const solvedAt = Date.now();
    const elapsedMs = Math.max(1, Math.round(performance.now() - startPerfMsRef.current));
    const currentWrongCount = wrongCountRef.current;

    updateCurrentAttempt((attempt) => ({
      ...attempt,
      solvedAt,
      elapsedMs,
      wrongCount: currentWrongCount,
      firstTryCorrect: currentWrongCount === 0,
      isSolved: true
    }));
    setFeedbackStatus("correct");
    setFeedbackAngleIds(markedAngleIds);
    setFeedbackAnchorAngleId(markedAngleIds[markedAngleIds.length - 1] ?? null);
    setReadyForNext(true);
  }

  function markWrong(markedAngleIds: string[]) {
    const nextWrongCount = incrementWrongCount();
    updateCurrentAttempt((attempt) => ({
      ...attempt,
      wrongCount: nextWrongCount,
      firstTryCorrect: null
    }));
    setFeedbackStatus("incorrect");
    setFeedbackAngleIds(markedAngleIds);
    setFeedbackAnchorAngleId(markedAngleIds[markedAngleIds.length - 1] ?? null);
  }

  function incrementWrongCount(): number {
    const next = wrongCountRef.current + 1;
    wrongCountRef.current = next;
    setWrongCount(next);
    return next;
  }

  function onTapAngle(angleId: string) {
    if (readyForNext || question.type !== "reasoning") {
      return;
    }

    if (question.mode === "single" || question.mode === "180-single") {
      setSelectedAngleIds([angleId]);
      const isCorrect = isSingleReasoningAnswerCorrect(angleId, question.correctSingleAngleId);
      if (isCorrect) {
        markCorrect([angleId]);
      } else {
        markWrong([angleId]);
      }
      return;
    }

    const base =
      feedbackStatus === "incorrect"
        ? []
        : selectedAngleIds;

    const next = base.includes(angleId)
      ? base.filter((id) => id !== angleId)
      : [...base, angleId].slice(-2);
    setSelectedAngleIds(next);

    if (next.length < 2) {
      setFeedbackStatus(null);
      setFeedbackAngleIds([]);
      setFeedbackAnchorAngleId(null);
      return;
    }

    const isCorrect = isPairReasoningAnswerCorrect(next, question.correctPairAngleIds);
    if (isCorrect) {
      markCorrect(next);
      return;
    }

    markWrong(next);
  }

  function goNext() {
    if (!readyForNext) {
      return;
    }

    if (!isLast) {
      setIndex((prev) => prev + 1);
      return;
    }

    const endedAt = Date.now();
    const solvedAttempts = attempts.length === attemptsRef.current.length
      ? attempts
      : attemptsRef.current;
    const metrics = buildSessionMetrics(solvedAttempts);

    const session: SessionLog = {
      id: run.id,
      unitId: run.unitId,
      level: run.level,
      startedAt: run.startedAt,
      endedAt,
      attempts: solvedAttempts,
      medianMs: metrics.medianMs,
      errorRate: metrics.errorRate,
      completed: true
    };

    onFinish(session);
  }

  const feedbackByAngleId = React.useMemo(() => {
    const map: Record<string, "correct" | "incorrect"> = {};
    if (!feedbackStatus) {
      return map;
    }
    for (const angleId of feedbackAngleIds) {
      map[angleId] = feedbackStatus;
    }
    return map;
  }, [feedbackAngleIds, feedbackStatus]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-3">
          <CardTitle className="text-lg">角と角度トレーニング</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hourglass size={18} weight="duotone" />
            問題 {index + 1} / {run.questions.length}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-3 pt-0">
          <div className="relative">
            <AngleDiagram
              question={question}
              selectedAngleIds={selectedAngleIds}
              feedbackByAngleId={feedbackByAngleId}
              feedbackStatus={feedbackStatus}
              feedbackAnchorAngleId={feedbackAnchorAngleId}
              onTapAngle={onTapAngle}
              disabled={readyForNext}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              {(question.mode === "pair" || question.mode === "180-pair") && (
                <span>選択中: {selectedAngleIds.length} / 2</span>
              )}
              <span>誤答回数: {wrongCount} 回</span>
            </div>
            <Button onClick={goNext} disabled={!readyForNext}>
              {isLast ? "結果を見る" : "次へ"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
