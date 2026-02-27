import * as React from "react";
import { toast, Toaster } from "sonner";
import { DataInspectionScreen } from "@/components/data-inspection-screen";
import { HomeScreen } from "@/components/home-screen";
import { ResultsScreen } from "@/components/results-screen";
import { TemplateCalibrationScreen } from "@/components/template-calibration-screen";
import { TrainingScreen } from "@/components/training-screen";
import {
  loadSavedBaseFigures,
  loadSavedQuestionPatterns
} from "@/lib/calibration-storage";
import { buildSessionQuestions } from "@/lib/problem-engine";
import {
  createBaseFigures,
  createQuestionPatterns,
  sanitizeQuestionPatterns
} from "@/lib/templates";
import { uniqueId } from "@/lib/math";
import {
  clearActiveCheckpointStartedAt,
  consumeMigrationNotice,
  getActiveCheckpointStartedAt,
  getSessions,
  saveSession,
  setActiveCheckpointStartedAt
} from "@/lib/storage";
import type { DifficultyLevel, SessionLog, SessionRun, UnitCard } from "@/lib/types";

type Screen = "home" | "training" | "results" | "data";

const unitCards: UnitCard[] = [
  {
    id: "angles",
    title: "角と角度",
    status: "active",
    description: "複合図で角の対応を見抜く反復トレーニング"
  },
  {
    id: "ratio",
    title: "割合",
    status: "coming_soon",
    description: "線分図と割合の対応づけを練習"
  },
  {
    id: "speed",
    title: "速さ",
    status: "coming_soon",
    description: "旅人算・通過算の図式化トレーニング"
  }
];

const DEFAULT_LEVEL: DifficultyLevel = 3;

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";

  if (pathname === "/ui-preview/template-calibration" || pathname === "/template-calibration") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-cyan-50 text-foreground">
        <TemplateCalibrationScreen />
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  const baseFigures = React.useMemo(() => {
    const defaults = createBaseFigures();
    return loadSavedBaseFigures(defaults);
  }, []);
  const questionPatterns = React.useMemo(() => {
    const defaults = createQuestionPatterns();
    const saved = loadSavedQuestionPatterns(defaults);
    return sanitizeQuestionPatterns(saved, baseFigures, defaults);
  }, [baseFigures]);

  const [screen, setScreen] = React.useState<Screen>("home");
  const [run, setRun] = React.useState<SessionRun | null>(null);
  const [latestSession, setLatestSession] = React.useState<SessionLog | null>(null);
  const [sessions, setSessions] = React.useState<SessionLog[]>([]);
  const [activeCheckpointStartedAt, setActiveCheckpointStartedAtState] = React.useState<number | null>(null);

  const reload = React.useCallback(async () => {
    const [allSessions, checkpointStartedAt] = await Promise.all([
      getSessions(),
      getActiveCheckpointStartedAt()
    ]);
    setSessions(allSessions);
    setLatestSession((current) => current ?? allSessions[0] ?? null);
    setActiveCheckpointStartedAtState(checkpointStartedAt);
  }, []);

  React.useEffect(() => {
    void (async () => {
      await reload();
      const notice = await consumeMigrationNotice();
      if (notice) {
        toast.message(notice);
      }
    })();
  }, [reload]);

  function startSession(nextLevel: DifficultyLevel = DEFAULT_LEVEL) {
    const allAttempts = sessions.flatMap((session) => session.attempts);
    const pastAttempts = activeCheckpointStartedAt === null
      ? allAttempts
      : allAttempts.filter((attempt) => attempt.startedAt >= activeCheckpointStartedAt);
    let questions;
    try {
      questions = buildSessionQuestions(baseFigures, questionPatterns, nextLevel, pastAttempts);
    } catch {
      toast.error("single系またはpair系の有効パターン不足のため、セッションを開始できません。");
      return;
    }
    const nextRun: SessionRun = {
      id: uniqueId("session"),
      level: nextLevel,
      unitId: "angles",
      startedAt: Date.now(),
      questions
    };
    setRun(nextRun);
    setScreen("training");
  }

  async function handleFinish(session: SessionLog) {
    await saveSession(session);
    setLatestSession(session);
    await reload();
    setScreen("results");
  }

  async function startNewCheckpoint() {
    const now = Date.now();
    try {
      await setActiveCheckpointStartedAt(now);
      setActiveCheckpointStartedAtState(now);
      toast.success("比較開始点を設定しました。");
    } catch {
      toast.error("比較開始点の設定に失敗しました。");
    }
  }

  async function clearCheckpoint() {
    await clearActiveCheckpointStartedAt();
    setActiveCheckpointStartedAtState(null);
    toast.success("比較を解除しました。");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-cyan-50 px-4 py-5 text-foreground md:px-8">
      {screen === "home" && (
        <HomeScreen
          unitCards={unitCards}
          onStart={() => startSession()}
          onOpenData={() => setScreen("data")}
          onOpenCalibration={() => {
            window.location.assign("/ui-preview/template-calibration");
          }}
        />
      )}

      {screen === "training" && run && (
        <TrainingScreen run={run} onFinish={(session) => void handleFinish(session)} />
      )}

      {screen === "results" && latestSession && (
        <ResultsScreen
          latestSession={latestSession}
          onRetry={() => startSession(latestSession.level)}
          onBackHome={() => setScreen("home")}
        />
      )}

      {screen === "data" && (
        <DataInspectionScreen
          baseFigures={baseFigures}
          questionPatterns={questionPatterns}
          sessions={sessions}
          activeCheckpointStartedAt={activeCheckpointStartedAt}
          onStartNewCheckpoint={startNewCheckpoint}
          onClearCheckpoint={clearCheckpoint}
          onBackHome={() => setScreen("home")}
        />
      )}

      <Toaster richColors position="top-center" />
    </div>
  );
}
