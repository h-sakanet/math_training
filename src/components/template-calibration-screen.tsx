import * as React from "react";
import { Copy, DownloadSimple, LineSegment, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildCalibrationCsv, parseCalibrationCsv } from "@/lib/calibration-csv";
import {
  loadSavedBaseFigures,
  loadSavedQuestionPatterns,
  saveBaseFigures,
  saveQuestionPatterns
} from "@/lib/calibration-storage";
import {
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  angleLabelPoint,
  formatBaseFigureFragment,
  formatBaseFiguresFragment,
  formatCalibrationBundle,
  formatQuestionPatternsFragment,
  movePoint,
  pointsAlmostEqual
} from "@/lib/geometry";
import {
  GLOBAL_ANGLE_HIT_RADIUS,
  buildPatternIdBySymbols,
  createBaseFigures,
  createQuestionPatterns,
  sanitizeQuestionPatterns,
  validateBaseFigure,
  validateQuestionPattern
} from "@/lib/templates";
import type {
  AngleDef,
  BaseFigure,
  Point,
  QuestionPattern,
  ReasoningMode
} from "@/lib/types";

const KATAKANA_SYMBOLS = [
  "ア",
  "イ",
  "ウ",
  "エ",
  "オ",
  "カ",
  "キ",
  "ク",
  "ケ",
  "コ",
  "サ",
  "シ",
  "ス",
  "セ",
  "ソ",
  "タ",
  "チ",
  "ツ",
  "テ",
  "ト",
  "ナ",
  "ニ",
  "ヌ",
  "ネ",
  "ノ",
  "ハ",
  "ヒ",
  "フ",
  "ヘ",
  "ホ",
  "マ",
  "ミ",
  "ム",
  "メ",
  "モ",
  "ヤ",
  "ユ",
  "ヨ",
  "ラ",
  "リ",
  "ル",
  "レ",
  "ロ",
  "ワ",
  "ヲ",
  "ン"
];

type EndpointKind = "start" | "end";

type PatternDraft = {
  sourceId: string | null;
  mode: ReasoningMode;
  targetAngleId: string;
  optionAngleIds: [string, string, string, string];
  correctSingleAngleId: string;
  correctPairAngleIds: [string, string];
  enabled: boolean;
};

function isSingleMode(mode: ReasoningMode): mode is "single" | "180-single" {
  return mode === "single" || mode === "180-single";
}

type DragState =
  | {
      pointerId: number;
      type: "label";
      figureId: string;
      angleId: string;
      startCursor: Point;
      baseFigure: BaseFigure;
    }
  | {
      pointerId: number;
      type: "endpoint";
      figureId: string;
      segmentId: string;
      endpoint: EndpointKind;
      startCursor: Point;
      baseFigure: BaseFigure;
    };

function applyGlobalHitRadius(baseFigures: BaseFigure[], radius: number): BaseFigure[] {
  return baseFigures.map((baseFigure) => ({
    ...baseFigure,
    angles: baseFigure.angles.map((angleDef) => ({
      ...angleDef,
      hitRadius: radius
    }))
  }));
}

function cloneBaseFigure(baseFigure: BaseFigure): BaseFigure {
  return {
    ...baseFigure,
    segments: baseFigure.segments.map((segment) => ({
      ...segment,
      start: { ...segment.start },
      end: { ...segment.end }
    })),
    angles: baseFigure.angles.map((angleDef) => ({
      ...angleDef,
      vertex: { ...angleDef.vertex },
      rayA: { ...angleDef.rayA },
      rayB: { ...angleDef.rayB },
      labelNudge: { ...angleDef.labelNudge }
    }))
  };
}

function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEWBOX_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT
  };
}

function relabelAnglesSequentially(angles: AngleDef[]): AngleDef[] {
  return angles.map((angleDef, index) => ({
    ...angleDef,
    symbol: KATAKANA_SYMBOLS[index] ?? angleDef.symbol
  }));
}

function nextKatakanaSymbol(angles: AngleDef[]): string {
  return KATAKANA_SYMBOLS[angles.length] ?? `角${angles.length + 1}`;
}

function createAddedAngle(figure: BaseFigure, globalHitRadius: number): AngleDef {
  const existingIds = new Set(figure.angles.map((angleDef) => angleDef.id));
  let serial = 1;
  let id = `CUSTOM_${serial}`;
  while (existingIds.has(id)) {
    serial += 1;
    id = `CUSTOM_${serial}`;
  }

  const vertex = { x: VIEWBOX_WIDTH - 72, y: 52 };
  return {
    id,
    symbol: nextKatakanaSymbol(figure.angles),
    vertex,
    rayA: { x: vertex.x + 32, y: vertex.y },
    rayB: { x: vertex.x, y: vertex.y + 32 },
    labelNudge: { x: 0, y: 0 },
    hitRadius: globalHitRadius
  };
}

function updateAnglePoint(angleDef: AngleDef, source: Point, replacement: Point): AngleDef {
  const patch = (point: Point): Point => (pointsAlmostEqual(point, source) ? replacement : point);
  return {
    ...angleDef,
    vertex: patch(angleDef.vertex),
    rayA: patch(angleDef.rayA),
    rayB: patch(angleDef.rayB)
  };
}

function ensureTuple4(input: string[], fallback: string): [string, string, string, string] {
  const values = [...input];
  while (values.length < 4) {
    values.push(fallback);
  }
  return [values[0], values[1], values[2], values[3]];
}

function createDraftFromPattern(pattern: QuestionPattern, figure: BaseFigure): PatternDraft {
  const firstOption = pattern.optionAngleIds[0] ?? figure.angles[0]?.id ?? "";
  const secondOption = pattern.optionAngleIds[1] ?? firstOption;
  return {
    sourceId: pattern.id,
    mode: pattern.mode,
    targetAngleId: pattern.targetAngleId,
    optionAngleIds: [...pattern.optionAngleIds] as [string, string, string, string],
    correctSingleAngleId: pattern.correctSingleAngleId ?? firstOption,
    correctPairAngleIds: pattern.correctPairAngleIds
      ? [...pattern.correctPairAngleIds] as [string, string]
      : [firstOption, secondOption],
    enabled: pattern.enabled
  };
}

function createDefaultDraft(figure: BaseFigure): PatternDraft {
  const angleIds = figure.angles.map((angleDef) => angleDef.id);
  const target = angleIds[0] ?? "";
  const options = ensureTuple4(angleIds.slice(1, 5), target);
  return {
    sourceId: null,
    mode: "single",
    targetAngleId: target,
    optionAngleIds: options,
    correctSingleAngleId: options[0],
    correctPairAngleIds: [options[0], options[1]],
    enabled: true
  };
}

function fixedExplanationByMode(mode: ReasoningMode): string {
  if (mode === "single") {
    return "同じ角になる位置関係を確認しましょう。";
  }
  if (mode === "180-single") {
    return "180度から引く角を1つ確認しましょう。";
  }
  if (mode === "180-pair") {
    return "180度から引く2角の和を確認しましょう。";
  }
  return "和になる2つの角の組み合わせを確認しましょう。";
}

function buildUniquePatternId(baseId: string, reserved: Set<string>): string {
  let nextId = baseId;
  let serial = 2;
  while (reserved.has(nextId)) {
    nextId = `${baseId}-${serial}`;
    serial += 1;
  }
  return nextId;
}

function buildPatternFromDraft(figureId: string, patternId: string, draft: PatternDraft): QuestionPattern {
  if (isSingleMode(draft.mode)) {
    return {
      id: patternId,
      baseFigureId: figureId,
      mode: draft.mode,
      targetAngleId: draft.targetAngleId,
      optionAngleIds: [...draft.optionAngleIds] as [string, string, string, string],
      correctSingleAngleId: draft.correctSingleAngleId,
      explanation: fixedExplanationByMode(draft.mode),
      enabled: draft.enabled
    };
  }
  return {
    id: patternId,
    baseFigureId: figureId,
    mode: draft.mode,
    targetAngleId: draft.targetAngleId,
    optionAngleIds: [...draft.optionAngleIds] as [string, string, string, string],
    correctPairAngleIds: [...draft.correctPairAngleIds] as [string, string],
    explanation: fixedExplanationByMode(draft.mode),
    enabled: draft.enabled
  };
}

type CalibrationInitData = {
  baseFigures: BaseFigure[];
  patterns: QuestionPattern[];
  globalHitRadius: number;
};

function initializeCalibrationData(): CalibrationInitData {
  const defaultBaseFigures = applyGlobalHitRadius(createBaseFigures(), GLOBAL_ANGLE_HIT_RADIUS);
  const loadedBaseFigures = loadSavedBaseFigures(defaultBaseFigures);
  const normalizedRadius = Math.round(
    loadedBaseFigures[0]?.angles[0]?.hitRadius ?? GLOBAL_ANGLE_HIT_RADIUS
  );
  const normalizedBaseFigures = applyGlobalHitRadius(loadedBaseFigures, normalizedRadius);

  const defaultPatterns = createQuestionPatterns();
  const loadedPatterns = loadSavedQuestionPatterns(defaultPatterns);
  const normalizedPatterns = sanitizeQuestionPatterns(
    loadedPatterns,
    normalizedBaseFigures,
    defaultPatterns
  );

  return {
    baseFigures: normalizedBaseFigures,
    patterns: normalizedPatterns,
    globalHitRadius: normalizedRadius
  };
}

export function TemplateCalibrationScreen() {
  const initialData = React.useMemo(() => initializeCalibrationData(), []);

  const [globalHitRadius, setGlobalHitRadius] = React.useState<number>(initialData.globalHitRadius);
  const [baseFigures, setBaseFigures] = React.useState<BaseFigure[]>(initialData.baseFigures);
  const [patterns, setPatterns] = React.useState<QuestionPattern[]>(initialData.patterns);
  const [editorTab, setEditorTab] = React.useState<"figures" | "patterns">("figures");
  const [selectedFigureId, setSelectedFigureId] = React.useState<string>("");
  const [selectedAngleId, setSelectedAngleId] = React.useState<string | null>(null);
  const [selectedPatternId, setSelectedPatternId] = React.useState<string | null>(null);
  const [isCreatingPattern, setIsCreatingPattern] = React.useState(false);
  const [draft, setDraft] = React.useState<PatternDraft | null>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const csvInputRef = React.useRef<HTMLInputElement | null>(null);

  const selectedFigure = React.useMemo(
    () => baseFigures.find((figure) => figure.id === selectedFigureId) ?? baseFigures[0],
    [baseFigures, selectedFigureId]
  );

  const figurePatterns = React.useMemo(
    () => patterns.filter((pattern) => pattern.baseFigureId === selectedFigure?.id),
    [patterns, selectedFigure?.id]
  );

  React.useEffect(() => {
    if (!selectedFigureId && baseFigures.length > 0) {
      setSelectedFigureId(baseFigures[0].id);
    }
  }, [baseFigures, selectedFigureId]);

  React.useEffect(() => {
    if (!selectedFigure) {
      return;
    }
    if (!selectedAngleId || !selectedFigure.angles.some((angleDef) => angleDef.id === selectedAngleId)) {
      setSelectedAngleId(selectedFigure.angles[0]?.id ?? null);
    }
  }, [selectedFigure, selectedAngleId]);

  React.useEffect(() => {
    if (!selectedFigure) {
      return;
    }
    if (isCreatingPattern) {
      setSelectedPatternId(null);
      setDraft(createDefaultDraft(selectedFigure));
      return;
    }
    if (selectedPatternId) {
      const selected = figurePatterns.find((pattern) => pattern.id === selectedPatternId);
      if (selected) {
        setDraft(createDraftFromPattern(selected, selectedFigure));
        return;
      }
    }
    if (figurePatterns.length > 0) {
      setSelectedPatternId(figurePatterns[0].id);
      setDraft(createDraftFromPattern(figurePatterns[0], selectedFigure));
      return;
    }
    setSelectedPatternId(null);
    setDraft(createDefaultDraft(selectedFigure));
  }, [selectedFigure, selectedPatternId, figurePatterns, isCreatingPattern]);

  function updateFigure(figureId: string, updater: (figure: BaseFigure) => BaseFigure) {
    setBaseFigures((current) =>
      current.map((figure) => (figure.id === figureId ? updater(figure) : figure))
    );
  }

  function revalidatePatternsForFigure(nextFigure: BaseFigure) {
    setPatterns((current) =>
      current.map((pattern) => {
        if (pattern.baseFigureId !== nextFigure.id) {
          return pattern;
        }
        const validation = validateQuestionPattern(pattern, nextFigure);
        if (validation.ok) {
          return pattern;
        }
        return { ...pattern, enabled: false };
      })
    );
  }

  function onStartDragLabel(event: React.PointerEvent<SVGCircleElement>, figure: BaseFigure, angleId: string) {
    if (!svgRef.current) {
      return;
    }
    const cursor = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    setDragState({
      pointerId: event.pointerId,
      type: "label",
      figureId: figure.id,
      angleId,
      startCursor: cursor,
      baseFigure: cloneBaseFigure(figure)
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onStartDragEndpoint(
    event: React.PointerEvent<SVGCircleElement>,
    figure: BaseFigure,
    segmentId: string,
    endpoint: EndpointKind
  ) {
    if (!svgRef.current) {
      return;
    }
    const cursor = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    setDragState({
      pointerId: event.pointerId,
      type: "endpoint",
      figureId: figure.id,
      segmentId,
      endpoint,
      startCursor: cursor,
      baseFigure: cloneBaseFigure(figure)
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState || !svgRef.current || dragState.pointerId !== event.pointerId) {
      return;
    }

    const cursor = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    const dx = cursor.x - dragState.startCursor.x;
    const dy = cursor.y - dragState.startCursor.y;

    updateFigure(dragState.figureId, () => {
      if (dragState.type === "label") {
        return {
          ...dragState.baseFigure,
          angles: dragState.baseFigure.angles.map((angleDef) =>
            angleDef.id === dragState.angleId
              ? { ...angleDef, labelNudge: movePoint(angleDef.labelNudge, dx, dy) }
              : angleDef
          )
        };
      }

      const baseSegment = dragState.baseFigure.segments.find(
        (segment) => segment.id === dragState.segmentId
      );
      if (!baseSegment) {
        return dragState.baseFigure;
      }
      const basePoint = dragState.endpoint === "start" ? baseSegment.start : baseSegment.end;
      const movedPoint = movePoint(basePoint, dx, dy);

      return {
        ...dragState.baseFigure,
        segments: dragState.baseFigure.segments.map((segment) =>
          segment.id === dragState.segmentId
            ? {
                ...segment,
                [dragState.endpoint]: movedPoint
              }
            : segment
        ),
        angles: dragState.baseFigure.angles.map((angleDef) =>
          updateAnglePoint(angleDef, basePoint, movedPoint)
        )
      };
    });
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    setDragState(null);
  }

  function onChangeGlobalHitRadius(nextValue: number) {
    setGlobalHitRadius(nextValue);
    setBaseFigures((current) => applyGlobalHitRadius(current, nextValue));
  }

  function onAddAngle(figureId: string) {
    let newAngleId = "";
    updateFigure(figureId, (figure) => {
      const nextAngle = createAddedAngle(figure, globalHitRadius);
      newAngleId = nextAngle.id;
      return {
        ...figure,
        angles: [...figure.angles, nextAngle]
      };
    });
    if (newAngleId) {
      setSelectedAngleId(newAngleId);
      toast.success(`角 ${newAngleId} を追加しました`);
    }
  }

  function onRemoveAngle(figureId: string, angleId: string) {
    updateFigure(figureId, (figure) => {
      const nextFigure: BaseFigure = {
        ...figure,
        angles: relabelAnglesSequentially(
          figure.angles.filter((angleDef) => angleDef.id !== angleId)
        )
      };
      revalidatePatternsForFigure(nextFigure);
      return nextFigure;
    });
    toast.success(`角 ${angleId} を削除しました。関連パターンは再検証されます。`);
  }

  function onPatternSelect(patternId: string) {
    if (!selectedFigure) {
      return;
    }
    const pattern = figurePatterns.find((candidate) => candidate.id === patternId);
    if (!pattern) {
      return;
    }
    setIsCreatingPattern(false);
    setSelectedPatternId(pattern.id);
    setDraft(createDraftFromPattern(pattern, selectedFigure));
  }

  function onNewPattern() {
    if (!selectedFigure) {
      return;
    }
    setIsCreatingPattern(true);
    setSelectedPatternId(null);
    setDraft(createDefaultDraft(selectedFigure));
    toast.success("新規の出題パターンを作成できます");
  }

  function onSavePattern() {
    if (!selectedFigure || !draft) {
      return;
    }

    const baseId = buildPatternIdBySymbols(
      selectedFigure,
      draft.mode,
      draft.targetAngleId,
      draft.correctSingleAngleId,
      draft.correctPairAngleIds
    );
    const reserved = new Set(
      patterns
        .filter((pattern) => pattern.id !== draft.sourceId)
        .map((pattern) => pattern.id)
    );
    const patternId = buildUniquePatternId(baseId, reserved);
    const pattern = buildPatternFromDraft(selectedFigure.id, patternId, draft);
    const validation = validateQuestionPattern(pattern, selectedFigure);
    if (!validation.ok) {
      toast.error(validation.message ?? "パターンの検証に失敗しました");
      return;
    }

    setPatterns((current) => {
      const sourceIndex = draft.sourceId
        ? current.findIndex((candidate) => candidate.id === draft.sourceId)
        : -1;
      if (sourceIndex >= 0) {
        const next = [...current];
        next[sourceIndex] = pattern;
        return next;
      }
      const exists = current.some((candidate) => candidate.id === pattern.id);
      if (exists) {
        return current.map((candidate) => (candidate.id === pattern.id ? pattern : candidate));
      }
      return [...current, pattern];
    });
    setSelectedPatternId(pattern.id);
    setIsCreatingPattern(false);
    setDraft((current) => (current ? { ...current, sourceId: pattern.id } : current));
    toast.success("パターンを保存しました");
  }

  function onDeletePattern() {
    if (!selectedPatternId || !selectedFigure) {
      return;
    }
    setPatterns((current) => current.filter((pattern) => pattern.id !== selectedPatternId));
    setSelectedPatternId(null);
    setIsCreatingPattern(false);
    setDraft(createDefaultDraft(selectedFigure));
    toast.success("パターンを削除しました");
  }

  function updateDraftOption(index: 0 | 1 | 2 | 3, value: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextOptions = [...current.optionAngleIds] as [string, string, string, string];
      nextOptions[index] = value;
      return {
        ...current,
        optionAngleIds: nextOptions,
        correctSingleAngleId: nextOptions.includes(current.correctSingleAngleId)
          ? current.correctSingleAngleId
          : nextOptions[0],
        correctPairAngleIds: [
          nextOptions.includes(current.correctPairAngleIds[0])
            ? current.correctPairAngleIds[0]
            : nextOptions[0],
          nextOptions.includes(current.correctPairAngleIds[1])
            ? current.correctPairAngleIds[1]
            : nextOptions[1] ?? nextOptions[0]
        ]
      };
    });
  }

  async function copyCurrentFigure() {
    if (!selectedFigure) {
      return;
    }
    await navigator.clipboard.writeText(formatBaseFigureFragment(selectedFigure));
    toast.success("現在の基本図形JSONをコピーしました");
  }

  async function copyAllFigures() {
    await navigator.clipboard.writeText(formatBaseFiguresFragment(baseFigures));
    toast.success("全基本図形JSONをコピーしました");
  }

  async function copyPatterns() {
    await navigator.clipboard.writeText(formatQuestionPatternsFragment(patterns));
    toast.success("出題パターンJSONをコピーしました");
  }

  async function copyBundle() {
    await navigator.clipboard.writeText(formatCalibrationBundle(baseFigures, patterns));
    toast.success("図形+パターンJSONをコピーしました");
  }

  function onPersistBaseFigures() {
    const ok = saveBaseFigures(baseFigures);
    if (ok) {
      toast.success("基本図形を保存しました");
      return;
    }
    toast.error("基本図形の保存に失敗しました");
  }

  function onPersistPatterns() {
    const baseFigureMap = new Map(baseFigures.map((baseFigure) => [baseFigure.id, baseFigure]));
    const invalidPatterns = patterns.filter((pattern) => {
      const baseFigure = baseFigureMap.get(pattern.baseFigureId);
      if (!baseFigure) {
        return true;
      }
      return !validateQuestionPattern(pattern, baseFigure).ok;
    });

    if (invalidPatterns.length > 0) {
      toast.error(`保存できないパターンが ${invalidPatterns.length} 件あります`);
      return;
    }

    const ok = saveQuestionPatterns(patterns);
    if (ok) {
      toast.success("出題パターンを保存しました");
      return;
    }
    toast.error("出題パターンの保存に失敗しました");
  }

  function buildExportFileName(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `math_training_calibration_${stamp}.csv`;
  }

  function triggerCsvDownload(fileName: string, text: string) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function onExportCalibrationCsv() {
    const csv = buildCalibrationCsv(baseFigures, patterns, {
      globalHitRadius,
      labelPlacementMode: "free_drag"
    });
    triggerCsvDownload(buildExportFileName(), csv);
    toast.success("CSVをエクスポートしました");
  }

  function onClickImportCsv() {
    csvInputRef.current?.click();
  }

  async function onImportCalibrationCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCalibrationCsv(text);

      if (parsed.baseFigures.length !== 4) {
        throw new Error("基本図形は4件である必要があります");
      }

      const figureIdSet = new Set<string>();
      for (const figure of parsed.baseFigures) {
        if (!validateBaseFigure(figure)) {
          throw new Error(`基本図形 ${figure.id} の構造が不正です`);
        }
        if (figureIdSet.has(figure.id)) {
          throw new Error(`基本図形ID ${figure.id} が重複しています`);
        }
        figureIdSet.add(figure.id);
      }

      const importedRadius = Math.round(
        parsed.settings?.globalHitRadius ??
        parsed.baseFigures[0]?.angles[0]?.hitRadius ??
        GLOBAL_ANGLE_HIT_RADIUS
      );
      const normalizedFigures = applyGlobalHitRadius(parsed.baseFigures, importedRadius);
      const figureMap = new Map(normalizedFigures.map((figure) => [figure.id, figure]));

      const patternIdSet = new Set<string>();
      for (const pattern of parsed.questionPatterns) {
        if (patternIdSet.has(pattern.id)) {
          throw new Error(`出題パターンID ${pattern.id} が重複しています`);
        }
        patternIdSet.add(pattern.id);

        const baseFigure = figureMap.get(pattern.baseFigureId);
        if (!baseFigure) {
          throw new Error(`出題パターン ${pattern.id} の baseFigureId が不正です`);
        }
        const validation = validateQuestionPattern(pattern, baseFigure);
        if (!validation.ok) {
          throw new Error(`出題パターン ${pattern.id}: ${validation.message ?? "検証エラー"}`);
        }
      }

      setGlobalHitRadius(importedRadius);
      setBaseFigures(normalizedFigures);
      setPatterns(parsed.questionPatterns);
      setSelectedFigureId(normalizedFigures[0]?.id ?? "");
      setSelectedAngleId(normalizedFigures[0]?.angles[0]?.id ?? null);
      setSelectedPatternId(null);
      setIsCreatingPattern(false);
      setDraft(normalizedFigures[0] ? createDefaultDraft(normalizedFigures[0]) : null);

      saveBaseFigures(normalizedFigures);
      saveQuestionPatterns(parsed.questionPatterns);

      toast.success("CSVをインポートしました");
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSVの読み込みに失敗しました";
      toast.error(message);
    }
  }

  if (!selectedFigure) {
    return null;
  }

  const angleOptions = selectedFigure.angles.map((angleDef) => (
    <option key={angleDef.id} value={angleDef.id}>
      {angleDef.symbol} ({angleDef.id})
    </option>
  ));

  const draftValidation = draft
    ? validateQuestionPattern(buildPatternFromDraft(selectedFigure.id, "__draft__", draft), selectedFigure)
    : { ok: false, message: "パターンが未選択です" };

  const draftPatternName = draft
    ? buildPatternIdBySymbols(
        selectedFigure,
        draft.mode,
        draft.targetAngleId,
        draft.correctSingleAngleId,
        draft.correctPairAngleIds
      )
    : "";

  function renderFigureListCard() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本図形一覧</CardTitle>
          <CardDescription>編集対象の基本図形を選択します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {baseFigures.map((figure) => (
            <button
              key={figure.id}
              type="button"
              className={`w-full rounded border p-2 text-left text-sm transition ${
                figure.id === selectedFigure.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/60"
              }`}
              onClick={() => setSelectedFigureId(figure.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{figure.id}</span>
                <span className="text-xs text-muted-foreground">Lv.{figure.difficultyLevel}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <LineSegment size={14} />
                segments: {figure.segments.length} / angles: {figure.angles.length}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5">
      <Card>
        <CardHeader>
          <CardTitle>Template Calibration</CardTitle>
          <CardDescription>
            「基本図形定義」と「出題パターン定義」を分離して編集できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportCalibrationCsv}
          />
          <Button variant="outline" onClick={onExportCalibrationCsv}>
            <DownloadSimple size={16} />
            CSVをエクスポート
          </Button>
          <Button variant="outline" onClick={onClickImportCsv}>
            <UploadSimple size={16} />
            CSVをインポート
          </Button>
          <Button variant="outline" onClick={copyCurrentFigure}>
            <Copy size={16} />
            現在図形をコピー
          </Button>
          <Button variant="outline" onClick={copyAllFigures}>
            <Copy size={16} />
            全図形をコピー
          </Button>
          <Button variant="outline" onClick={copyPatterns}>
            <Copy size={16} />
            パターンをコピー
          </Button>
          <Button variant="outline" onClick={copyBundle}>
            <Copy size={16} />
            図形+パターンをコピー
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle>{selectedFigure.id}</CardTitle>
            <CardDescription>
              角ラベルをドラッグして位置補正、線端点ドラッグ、角の追加/削除ができます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative rounded-lg border bg-white p-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-white"
                onClick={() => onAddAngle(selectedFigure.id)}
                title="角ラベルを追加"
              >
                <Plus size={14} />
              </Button>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className="h-auto w-full touch-none"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {selectedFigure.segments.map((segment) => (
                  <g key={segment.id}>
                    <line
                      x1={segment.start.x}
                      y1={segment.start.y}
                      x2={segment.end.x}
                      y2={segment.end.y}
                      stroke="#0f172a"
                      strokeWidth="1.4"
                      strokeLinecap="butt"
                      strokeLinejoin="miter"
                    />
                    <circle
                      cx={segment.start.x}
                      cy={segment.start.y}
                      r={3.6}
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth={1}
                      onPointerDown={(event) =>
                        onStartDragEndpoint(event, selectedFigure, segment.id, "start")
                      }
                    />
                    <circle
                      cx={segment.end.x}
                      cy={segment.end.y}
                      r={3.6}
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth={1}
                      onPointerDown={(event) =>
                        onStartDragEndpoint(event, selectedFigure, segment.id, "end")
                      }
                    />
                  </g>
                ))}

                {selectedFigure.angles.map((angleDef) => {
                  const label = angleLabelPoint(angleDef, 20);
                  const isSelected = selectedAngleId === angleDef.id;
                  return (
                    <g key={angleDef.id}>
                      <circle
                        cx={label.x}
                        cy={label.y}
                        r={12}
                        fill="transparent"
                        stroke="none"
                        style={{ cursor: "grab" }}
                        onPointerDown={(event) => onStartDragLabel(event, selectedFigure, angleDef.id)}
                        onClick={() => setSelectedAngleId(angleDef.id)}
                      />
                      <text
                        x={label.x}
                        y={label.y + 3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fill={isSelected ? "#0369a1" : "#0f172a"}
                        fontWeight={700}
                        pointerEvents="none"
                      >
                        {angleDef.symbol}
                      </text>
                      <circle
                        cx={label.x}
                        cy={label.y}
                        r={angleDef.hitRadius}
                        fill="none"
                        stroke={isSelected ? "#0ea5e9" : "#cbd5e1"}
                        strokeDasharray="2 2"
                        strokeWidth={0.8}
                        pointerEvents="none"
                      />
                      <g>
                        <circle
                          cx={label.x + 12}
                          cy={label.y - 12}
                          r={6}
                          fill="#ffffff"
                          stroke="#dc2626"
                          strokeWidth={1}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveAngle(selectedFigure.id, angleDef.id);
                          }}
                          style={{ cursor: "pointer" }}
                        />
                        <text
                          x={label.x + 12}
                          y={label.y - 9.4}
                          textAnchor="middle"
                          fontSize="8.5"
                          fill="#dc2626"
                          fontWeight={700}
                          pointerEvents="none"
                        >
                          ×
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs value={editorTab} onValueChange={(value) => setEditorTab(value as "figures" | "patterns")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="figures">基本図形定義</TabsTrigger>
              <TabsTrigger value="patterns">出題パターン定義</TabsTrigger>
            </TabsList>

            <TabsContent value="figures" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">グローバル設定</CardTitle>
                  <CardDescription>全問題で共通の角タップ半径を設定します。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <label className="block space-y-1">
                    <span>角タップ半径: {globalHitRadius}px</span>
                    <input
                      type="range"
                      min={12}
                      max={36}
                      step={1}
                      value={globalHitRadius}
                      onChange={(event) => onChangeGlobalHitRadius(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    図形ごとの個別設定は行わず、すべての角に同じ半径を適用します。
                  </p>
                </CardContent>
              </Card>

              {renderFigureListCard()}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">基本図形を保存</CardTitle>
                  <CardDescription>
                    4つの基本図形（角位置・線位置・カタカナ配置）を保存します。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={copyCurrentFigure}>
                      <Copy size={16} />
                      現在図形をコピー
                    </Button>
                    <Button variant="outline" onClick={copyAllFigures}>
                      <Copy size={16} />
                      全図形をコピー
                    </Button>
                    <Button onClick={onPersistBaseFigures}>基本図形を保存</Button>
                  </div>
                  <textarea
                    className="h-44 w-full rounded border bg-slate-50 p-2 font-mono text-xs"
                    readOnly
                    value={formatBaseFigureFragment(selectedFigure)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patterns" className="mt-4 space-y-4">
              {renderFigureListCard()}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">出題パターン</CardTitle>
                  <CardDescription>
                    基本図形 {selectedFigure.id} の target / option / correct を定義します。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {figurePatterns.map((pattern) => {
                      const validation = validateQuestionPattern(pattern, selectedFigure);
                      const isSelected = pattern.id === selectedPatternId;
                      return (
                        <button
                          key={pattern.id}
                          type="button"
                          className={`w-full rounded border p-2 text-left text-xs ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/60"
                          }`}
                          onClick={() => onPatternSelect(pattern.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span>{pattern.id}</span>
                            <span className={pattern.enabled ? "text-emerald-600" : "text-amber-600"}>
                              {pattern.enabled ? "enabled" : "disabled"}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            {pattern.mode} / target: {pattern.targetAngleId}
                          </p>
                          {!validation.ok && (
                            <p className="text-red-600">{validation.message}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onNewPattern}>
                      <Plus size={16} />
                      新規
                    </Button>
                    <Button type="button" variant="outline" onClick={onDeletePattern} disabled={!selectedPatternId}>
                      <Trash size={16} />
                      削除
                    </Button>
                  </div>

                  {isCreatingPattern && (
                    <p className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                      新規作成モードです。mode/target/correctを設定して「編集中パターンを反映」を押すと追加されます。
                    </p>
                  )}

                  {draft && (
                    <div className="space-y-2 rounded border bg-slate-50 p-2 text-xs">
                      <div className="rounded border bg-white p-2">
                        <span className="font-medium">pattern name: </span>
                        <span>{draftPatternName}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="font-medium">mode</label>
                        <select
                          className="w-full rounded border bg-white px-2 py-1"
                          value={draft.mode}
                          onChange={(event) =>
                            setDraft((current) =>
                              current
                                ? { ...current, mode: event.target.value as ReasoningMode }
                                : current
                            )
                          }
                        >
                          <option value="single">single</option>
                          <option value="pair">pair</option>
                          <option value="180-single">180-single</option>
                          <option value="180-pair">180-pair</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-medium">target</label>
                        <select
                          className="w-full rounded border bg-white px-2 py-1"
                          value={draft.targetAngleId}
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, targetAngleId: event.target.value } : current
                            )
                          }
                        >
                          {angleOptions}
                        </select>
                      </div>
                      {[0, 1, 2, 3].map((index) => (
                        <div className="space-y-1" key={`option-${index}`}>
                          <label className="font-medium">option {index + 1}</label>
                          <select
                            className="w-full rounded border bg-white px-2 py-1"
                            value={draft.optionAngleIds[index as 0 | 1 | 2 | 3]}
                            onChange={(event) => updateDraftOption(index as 0 | 1 | 2 | 3, event.target.value)}
                          >
                            {angleOptions}
                          </select>
                        </div>
                      ))}

                      {isSingleMode(draft.mode) ? (
                        <div className="space-y-1">
                          <label className="font-medium">correct(single)</label>
                          <select
                            className="w-full rounded border bg-white px-2 py-1"
                            value={draft.correctSingleAngleId}
                            onChange={(event) =>
                              setDraft((current) =>
                                current ? { ...current, correctSingleAngleId: event.target.value } : current
                              )
                            }
                          >
                            {draft.optionAngleIds.map((angleId) => {
                              const symbol = selectedFigure.angles.find((angleDef) => angleDef.id === angleId)?.symbol ?? "?";
                              return (
                                <option key={`single-${angleId}`} value={angleId}>
                                  {symbol} ({angleId})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="font-medium">correct(pair) 1</label>
                            <select
                              className="w-full rounded border bg-white px-2 py-1"
                              value={draft.correctPairAngleIds[0]}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        correctPairAngleIds: [event.target.value, current.correctPairAngleIds[1]]
                                      }
                                    : current
                                )
                              }
                            >
                              {draft.optionAngleIds.map((angleId) => {
                                const symbol = selectedFigure.angles.find((angleDef) => angleDef.id === angleId)?.symbol ?? "?";
                                return (
                                  <option key={`pair1-${angleId}`} value={angleId}>
                                    {symbol} ({angleId})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="font-medium">correct(pair) 2</label>
                            <select
                              className="w-full rounded border bg-white px-2 py-1"
                              value={draft.correctPairAngleIds[1]}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        correctPairAngleIds: [current.correctPairAngleIds[0], event.target.value]
                                      }
                                    : current
                                )
                              }
                            >
                              {draft.optionAngleIds.map((angleId) => {
                                const symbol = selectedFigure.angles.find((angleDef) => angleDef.id === angleId)?.symbol ?? "?";
                                return (
                                  <option key={`pair2-${angleId}`} value={angleId}>
                                    {symbol} ({angleId})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </>
                      )}

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, enabled: event.target.checked } : current
                            )
                          }
                        />
                        enabled
                      </label>

                      <div className="rounded border bg-white p-2 text-xs">
                        {draftValidation.ok ? (
                          <span className="text-emerald-600">検証OK</span>
                        ) : (
                          <span className="text-red-600">検証NG: {draftValidation.message}</span>
                        )}
                      </div>

                      <Button type="button" onClick={onSavePattern} className="w-full">
                        編集中パターンを反映
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">出題パターンを保存</CardTitle>
                  <CardDescription>
                    target / option / correct 定義を保存します。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={copyPatterns}>
                      <Copy size={16} />
                      パターンをコピー
                    </Button>
                    <Button variant="outline" onClick={copyBundle}>
                      <Copy size={16} />
                      図形+パターンをコピー
                    </Button>
                    <Button onClick={onPersistPatterns}>出題パターンを保存</Button>
                  </div>
                  <textarea
                    className="h-44 w-full rounded border bg-slate-50 p-2 font-mono text-xs"
                    readOnly
                    value={formatQuestionPatternsFragment(figurePatterns)}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
