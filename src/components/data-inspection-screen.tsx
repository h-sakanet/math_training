import * as React from "react";
import { House, X } from "@phosphor-icons/react";
import { AngleDiagram } from "@/components/angle-diagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildOverallComparison,
  buildPatternComparisonRows,
  splitSessionsByCheckpoint,
  unifiedPatternKey,
  unifiedPatternKeyFromQuestionKey
} from "@/lib/comparison-metrics";
import { transformFigure } from "@/lib/geometry";
import { formatPercent } from "@/lib/math";
import { buildQuestionCatalog, buildQuestionPrompt } from "@/lib/problem-engine";
import type { BaseFigure, QuestionInstance, QuestionPattern, SessionLog } from "@/lib/types";

type DataInspectionScreenProps = {
  baseFigures: BaseFigure[];
  questionPatterns: QuestionPattern[];
  sessions: SessionLog[];
  activeCheckpointStartedAt: number | null;
  onStartNewCheckpoint: () => Promise<void> | void;
  onClearCheckpoint: () => Promise<void> | void;
  onBackHome: () => void;
};

type SortKey =
  | "patternKey"
  | "oldAttempts"
  | "attempts"
  | "averageMs"
  | "accuracyRate"
  | "newAttempts"
  | "newAverageMs"
  | "newAccuracyRate"
  | "deltaMs"
  | "deltaAccuracyRate";
type SortOrder = "asc" | "desc";
type CatalogEntry = ReturnType<typeof buildQuestionCatalog>[number];
type UnifiedStats = {
  attempts: number;
  solvedCount: number;
  totalSolvedMs: number;
  correct: number;
};
type AllPeriodRow = {
  key: string;
  entry: CatalogEntry | null;
  attempts: number;
  averageMs: number | null;
  accuracyRate: number | null;
};

function toPreviewQuestion(entry: CatalogEntry): QuestionInstance {
  const transformed = transformFigure(entry.baseFigure, entry.variant);
  const targetAngle = transformed.angles.find((angleDef) => angleDef.id === entry.targetAngleId);
  if (!targetAngle) {
    throw new Error(`target angle ${entry.targetAngleId} not found`);
  }
  return {
    id: entry.questionKey,
    questionKey: entry.questionKey,
    type: "reasoning",
    mode: entry.mode,
    prompt: buildQuestionPrompt(targetAngle.symbol, entry.mode, entry.arrangementKind),
    explanation: "",
    baseFigureId: entry.baseFigure.id,
    patternId: entry.patternId,
    sourcePatternId: entry.sourcePatternId,
    variant: entry.variant,
    arrangementKind: entry.arrangementKind,
    pairEquationKind: entry.pairEquationKind,
    targetAngleId: entry.targetAngleId,
    interactiveAngleIds: [...entry.interactiveAngleIds],
    correctSingleAngleId: entry.correctSingleAngleId,
    correctPairAngleIds: entry.correctPairAngleIds
      ? [...entry.correctPairAngleIds] as [string, string]
      : undefined,
    isBasic: entry.baseFigure.stepCount === 2,
    stepCount: entry.baseFigure.stepCount,
    segments: transformed.segments,
    angles: transformed.angles
  };
}

function sortArrow(active: boolean, order: SortOrder): string {
  if (!active) {
    return "↕";
  }
  return order === "asc" ? "↑" : "↓";
}

function formatSeconds(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  return `${Math.round(value / 100) / 10} 秒`;
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  return formatPercent(value);
}

function formatDeltaMs(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  if (value === 0) {
    return "0.0 秒";
  }
  const seconds = Math.round((Math.abs(value) / 100) * 10) / 10;
  return `${value > 0 ? "+" : "-"}${seconds} 秒`;
}

function formatDeltaRate(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  if (value === 0) {
    return "0.0 pt";
  }
  const points = Math.round(Math.abs(value) * 1000) / 10;
  return `${value > 0 ? "+" : "-"}${points} pt`;
}

function formatCheckpoint(epochMs: number | null): string {
  if (epochMs === null) {
    return "未設定";
  }
  const date = new Date(epochMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function compareNullableNumber(
  a: number | null,
  b: number | null,
  order: SortOrder
): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return order === "asc" ? a - b : b - a;
}

function buildCatalogEntryByUnifiedKey(catalog: CatalogEntry[]): Map<string, CatalogEntry> {
  const representativeByKey = new Map<string, CatalogEntry>();
  for (const entry of catalog) {
    const key = unifiedPatternKey(entry.sourcePatternId, entry.arrangementKind);
    const current = representativeByKey.get(key);
    if (!current || (current.variant !== "origin" && entry.variant === "origin")) {
      representativeByKey.set(key, entry);
    }
  }
  return representativeByKey;
}

export function DataInspectionScreen({
  baseFigures,
  questionPatterns,
  sessions,
  activeCheckpointStartedAt,
  onStartNewCheckpoint,
  onClearCheckpoint,
  onBackHome
}: DataInspectionScreenProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("patternKey");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");
  const [previewEntry, setPreviewEntry] = React.useState<CatalogEntry | null>(null);
  const isComparing = activeCheckpointStartedAt !== null;

  const catalog = React.useMemo(
    () => buildQuestionCatalog(baseFigures, questionPatterns),
    [baseFigures, questionPatterns]
  );

  const catalogEntryByKey = React.useMemo(
    () => buildCatalogEntryByUnifiedKey(catalog),
    [catalog]
  );

  const statsByUnifiedKey = React.useMemo(() => {
    const map = new Map<string, UnifiedStats>();
    for (const session of sessions) {
      for (const attempt of session.attempts) {
        const key = attempt.sourcePatternId && attempt.arrangementKind
          ? unifiedPatternKey(attempt.sourcePatternId, attempt.arrangementKind)
          : unifiedPatternKeyFromQuestionKey(attempt.questionKey);
        const current = map.get(key) ?? { attempts: 0, solvedCount: 0, totalSolvedMs: 0, correct: 0 };
        current.attempts += 1;
        if (attempt.isSolved && typeof attempt.elapsedMs === "number") {
          current.solvedCount += 1;
          current.totalSolvedMs += attempt.elapsedMs;
          if (attempt.wrongCount === 0) {
            current.correct += 1;
          }
        }
        map.set(key, current);
      }
    }
    return map;
  }, [sessions]);

  const allPeriodRows = React.useMemo(() => {
    const keys = new Set<string>(catalogEntryByKey.keys());
    for (const key of statsByUnifiedKey.keys()) {
      keys.add(key);
    }

    const raw: AllPeriodRow[] = [...keys].map((key) => {
      const stat = statsByUnifiedKey.get(key);
      const solvedCount = stat?.solvedCount ?? 0;
      return {
        key,
        entry: catalogEntryByKey.get(key) ?? null,
        attempts: stat?.attempts ?? 0,
        averageMs: solvedCount === 0 ? null : Math.round((stat?.totalSolvedMs ?? 0) / solvedCount),
        accuracyRate: solvedCount === 0 ? null : (stat?.correct ?? 0) / solvedCount
      };
    });

    return raw.sort((a, b) => {
      if (sortKey === "attempts") {
        return sortOrder === "asc" ? a.attempts - b.attempts : b.attempts - a.attempts;
      }
      if (sortKey === "averageMs") {
        return compareNullableNumber(a.averageMs, b.averageMs, sortOrder);
      }
      if (sortKey === "accuracyRate") {
        return compareNullableNumber(a.accuracyRate, b.accuracyRate, sortOrder);
      }
      const dir = sortOrder === "asc" ? 1 : -1;
      return a.key.localeCompare(b.key, "ja") * dir;
    });
  }, [catalogEntryByKey, sortKey, sortOrder, statsByUnifiedKey]);

  const comparisonData = React.useMemo(() => {
    if (activeCheckpointStartedAt === null) {
      return null;
    }
    const { oldSessions, newSessions } = splitSessionsByCheckpoint(sessions, activeCheckpointStartedAt);
    const overall = buildOverallComparison(oldSessions, newSessions);
    const rows = buildPatternComparisonRows(
      oldSessions,
      newSessions,
      [...catalogEntryByKey.keys()]
    ).map((row) => ({
      ...row,
      entry: catalogEntryByKey.get(row.patternKey) ?? null
    }));
    return { overall, rows };
  }, [activeCheckpointStartedAt, catalogEntryByKey, sessions]);

  React.useEffect(() => {
    if (isComparing) {
      return;
    }
    if (
      sortKey !== "patternKey" &&
      sortKey !== "attempts" &&
      sortKey !== "averageMs" &&
      sortKey !== "accuracyRate"
    ) {
      setSortKey("patternKey");
      setSortOrder("asc");
    }
  }, [isComparing, sortKey]);

  const sortedComparisonRows = React.useMemo(() => {
    if (!comparisonData) {
      return [];
    }
    const rows = [...comparisonData.rows];
    rows.sort((a, b) => {
      if (sortKey === "oldAttempts") {
        return sortOrder === "asc" ? a.oldAttempts - b.oldAttempts : b.oldAttempts - a.oldAttempts;
      }
      if (sortKey === "newAttempts") {
        return sortOrder === "asc" ? a.newAttempts - b.newAttempts : b.newAttempts - a.newAttempts;
      }
      if (sortKey === "newAverageMs") {
        return compareNullableNumber(a.newAverageMs, b.newAverageMs, sortOrder);
      }
      if (sortKey === "newAccuracyRate") {
        return compareNullableNumber(a.newAccuracyRate, b.newAccuracyRate, sortOrder);
      }
      if (sortKey === "deltaMs") {
        return compareNullableNumber(a.deltaMs, b.deltaMs, sortOrder);
      }
      if (sortKey === "deltaAccuracyRate") {
        return compareNullableNumber(a.deltaAccuracyRate, b.deltaAccuracyRate, sortOrder);
      }
      const dir = sortOrder === "asc" ? 1 : -1;
      return a.patternKey.localeCompare(b.patternKey, "ja") * dir;
    });
    return rows;
  }, [comparisonData, sortKey, sortOrder]);

  function onToggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortOrder("asc");
  }

  const previewQuestion = previewEntry ? toPreviewQuestion(previewEntry) : null;
  const overall = comparisonData?.overall;
  const hasEnoughComparisonData = Boolean(
    overall &&
      overall.oldPeriod.solvedAttempts > 0 &&
      overall.newPeriod.solvedAttempts > 0
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>データ確認</CardTitle>
          <Button variant="outline" onClick={onBackHome}>
            <House size={16} />
            ホームへ
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成長比較（チェックポイント方式）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              比較開始: {formatCheckpoint(activeCheckpointStartedAt)}
            </span>
            <Button onClick={() => void onStartNewCheckpoint()}>
              ここから新期間を開始
            </Button>
            <Button
              variant="outline"
              disabled={activeCheckpointStartedAt === null}
              onClick={() => void onClearCheckpoint()}
            >
              比較を解除
            </Button>
          </div>

          {overall && (
            <>
              {!hasEnoughComparisonData && (
                <p className="text-sm text-muted-foreground">
                  比較に十分なデータがありません
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">旧期間</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>挑戦回数: {overall.oldPeriod.attempts}</p>
                    <p>平均回答時間: {formatSeconds(overall.oldPeriod.averageMs)}</p>
                    <p>正答率: {formatRate(overall.oldPeriod.accuracyRate)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">新期間</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>挑戦回数: {overall.newPeriod.attempts}</p>
                    <p>平均回答時間: {formatSeconds(overall.newPeriod.averageMs)}</p>
                    <p>正答率: {formatRate(overall.newPeriod.accuracyRate)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">差分（新 - 旧）</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>時間差: {formatDeltaMs(overall.deltaMs)}</p>
                    <p>正答率差: {formatDeltaRate(overall.deltaAccuracyRate)}</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isComparing ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("patternKey")}
                    >
                      設問パターン {sortArrow(sortKey === "patternKey", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("oldAttempts")}
                    >
                      旧期間挑戦回数 {sortArrow(sortKey === "oldAttempts", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("newAttempts")}
                    >
                      新期間挑戦回数 {sortArrow(sortKey === "newAttempts", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>旧平均</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("newAverageMs")}
                    >
                      新平均 {sortArrow(sortKey === "newAverageMs", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("deltaMs")}
                    >
                      時間差 {sortArrow(sortKey === "deltaMs", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>旧正答率</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("newAccuracyRate")}
                    >
                      新正答率 {sortArrow(sortKey === "newAccuracyRate", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("deltaAccuracyRate")}
                    >
                      正答率差 {sortArrow(sortKey === "deltaAccuracyRate", sortOrder)}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedComparisonRows.map((row) => (
                  <TableRow key={row.patternKey}>
                    <TableCell>
                      {row.entry ? (
                        <button
                          type="button"
                          className="text-left text-sky-700 underline-offset-2 hover:underline"
                          onClick={() => setPreviewEntry(row.entry)}
                        >
                          {row.patternKey}
                        </button>
                      ) : (
                        <span>{row.patternKey}</span>
                      )}
                    </TableCell>
                    <TableCell>{row.oldAttempts}</TableCell>
                    <TableCell>{row.newAttempts}</TableCell>
                    <TableCell>{formatSeconds(row.oldAverageMs)}</TableCell>
                    <TableCell>{formatSeconds(row.newAverageMs)}</TableCell>
                    <TableCell>{formatDeltaMs(row.deltaMs)}</TableCell>
                    <TableCell>{formatRate(row.oldAccuracyRate)}</TableCell>
                    <TableCell>{formatRate(row.newAccuracyRate)}</TableCell>
                    <TableCell>{formatDeltaRate(row.deltaAccuracyRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("patternKey")}
                    >
                      設問パターン {sortArrow(sortKey === "patternKey", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("attempts")}
                    >
                      挑戦回数 {sortArrow(sortKey === "attempts", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("averageMs")}
                    >
                      平均回答時間 {sortArrow(sortKey === "averageMs", sortOrder)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium text-foreground"
                      onClick={() => onToggleSort("accuracyRate")}
                    >
                      正答率 {sortArrow(sortKey === "accuracyRate", sortOrder)}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPeriodRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {row.entry ? (
                        <button
                          type="button"
                          className="text-left text-sky-700 underline-offset-2 hover:underline"
                          onClick={() => setPreviewEntry(row.entry)}
                        >
                          {row.key}
                        </button>
                      ) : (
                        <span>{row.key}</span>
                      )}
                    </TableCell>
                    <TableCell>{row.attempts}</TableCell>
                    <TableCell>{formatSeconds(row.averageMs)}</TableCell>
                    <TableCell>{formatRate(row.accuracyRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {previewEntry && previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <Card className="relative w-full max-w-3xl">
            <Button
              variant="outline"
              size="icon"
              className="absolute right-3 top-3 z-10"
              onClick={() => setPreviewEntry(null)}
            >
              <X size={16} />
            </Button>
            <CardContent className="pt-6">
              <AngleDiagram
                question={previewQuestion}
                selectedAngleIds={[]}
                onTapAngle={() => undefined}
                disabled
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
