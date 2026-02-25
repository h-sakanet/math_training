import * as React from "react";
import { House, X } from "@phosphor-icons/react";
import { AngleDiagram } from "@/components/angle-diagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { transformFigure } from "@/lib/geometry";
import { formatPercent } from "@/lib/math";
import { buildQuestionCatalog, buildQuestionPrompt } from "@/lib/problem-engine";
import type { BaseFigure, QuestionInstance, QuestionPattern, SessionLog } from "@/lib/types";

type DataInspectionScreenProps = {
  baseFigures: BaseFigure[];
  questionPatterns: QuestionPattern[];
  sessions: SessionLog[];
  onBackHome: () => void;
};

type SortKey = "patternKey" | "attempts" | "averageMs" | "accuracyRate";
type SortOrder = "asc" | "desc";
type CatalogEntry = ReturnType<typeof buildQuestionCatalog>[number];
type UnifiedStats = {
  attempts: number;
  solvedCount: number;
  totalSolvedMs: number;
  correct: number;
};

function unifiedPatternKey(sourcePatternId: string, arrangementKind: string): string {
  return `${sourcePatternId}:${arrangementKind}`;
}

function unifiedPatternKeyFromQuestionKey(questionKey: string): string {
  const [patternId, _variant, arrangementKind] = questionKey.split(":");
  if (!patternId || !arrangementKind) {
    return questionKey;
  }
  return unifiedPatternKey(patternId, arrangementKind);
}

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

export function DataInspectionScreen({
  baseFigures,
  questionPatterns,
  sessions,
  onBackHome
}: DataInspectionScreenProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("patternKey");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");
  const [previewEntry, setPreviewEntry] = React.useState<CatalogEntry | null>(null);

  const catalog = React.useMemo(
    () => buildQuestionCatalog(baseFigures, questionPatterns),
    [baseFigures, questionPatterns]
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

  const rows = React.useMemo(() => {
    const representativeByKey = new Map<string, CatalogEntry>();
    for (const entry of catalog) {
      const key = unifiedPatternKey(entry.sourcePatternId, entry.arrangementKind);
      const current = representativeByKey.get(key);
      if (!current || (current.variant !== "origin" && entry.variant === "origin")) {
        representativeByKey.set(key, entry);
      }
    }

    const raw = [...representativeByKey.entries()].map(([key, entry]) => {
      const stat = statsByUnifiedKey.get(key);
      const attempts = stat?.attempts ?? 0;
      const solvedCount = stat?.solvedCount ?? 0;
      const averageMs = solvedCount === 0 ? 0 : Math.round((stat?.totalSolvedMs ?? 0) / solvedCount);
      const accuracyRate = solvedCount === 0 ? 0 : (stat?.correct ?? 0) / solvedCount;
      return {
        key,
        entry,
        attempts,
        averageMs,
        accuracyRate
      };
    });

    return raw.sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "patternKey") {
        return a.key.localeCompare(b.key, "ja") * dir;
      }
      if (sortKey === "attempts") {
        return (a.attempts - b.attempts) * dir;
      }
      if (sortKey === "averageMs") {
        return (a.averageMs - b.averageMs) * dir;
      }
      return (a.accuracyRate - b.accuracyRate) * dir;
    });
  }, [catalog, statsByUnifiedKey, sortKey, sortOrder]);

  function onToggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortOrder("asc");
  }

  const previewQuestion = previewEntry ? toPreviewQuestion(previewEntry) : null;

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
        <CardContent className="pt-4">
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
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left text-sky-700 underline-offset-2 hover:underline"
                      onClick={() => setPreviewEntry(row.entry)}
                    >
                      {row.key}
                    </button>
                  </TableCell>
                  <TableCell>{row.attempts}</TableCell>
                  <TableCell>{Math.round(row.averageMs / 100) / 10} 秒</TableCell>
                  <TableCell>{formatPercent(row.accuracyRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
