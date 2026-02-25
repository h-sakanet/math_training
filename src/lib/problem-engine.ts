import { randomInt, uniqueId } from "./math";
import { transformFigure } from "./geometry";
import type {
  AngleDef,
  ArrangementKind,
  AttemptLog,
  BaseFigure,
  DifficultyLevel,
  QuestionInstance,
  QuestionPattern,
  ReasoningMode,
  Segment,
  SymmetryVariant
} from "./types";

type CatalogEntry = {
  questionKey: string;
  patternId: string;
  sourcePatternId: string;
  baseFigure: BaseFigure;
  variant: SymmetryVariant;
  arrangementKind: ArrangementKind;
  pairEquationKind?: "sum" | "difference";
  mode: ReasoningMode;
  targetAngleId: string;
  interactiveAngleIds: [string, string, string, string];
  correctSingleAngleId?: string;
  correctPairAngleIds?: [string, string];
};

export const SESSION_QUESTION_COUNT = 5;
const SESSION_SINGLE_COUNT = 3;
const SESSION_PAIR_COUNT = 2;

const VARIANTS: SymmetryVariant[] = ["origin", "mirror_both"];

function isSingleMode(mode: ReasoningMode): mode is "single" | "180-single" {
  return mode === "single" || mode === "180-single";
}

function isPairMode(mode: ReasoningMode): mode is "pair" | "180-pair" {
  return mode === "pair" || mode === "180-pair";
}

function cloneSegments(segments: Segment[]): Segment[] {
  return segments.map((segment) => ({
    id: segment.id,
    start: { ...segment.start },
    end: { ...segment.end }
  }));
}

function cloneAngles(angles: AngleDef[]): AngleDef[] {
  return angles.map((angleDef) => ({
    ...angleDef,
    vertex: { ...angleDef.vertex },
    rayA: { ...angleDef.rayA },
    rayB: { ...angleDef.rayB },
    labelNudge: { ...angleDef.labelNudge }
  }));
}

export function buildQuestionPrompt(
  symbol: string,
  mode: ReasoningMode,
  arrangementKind: ArrangementKind
): string {
  if (mode === "single") {
    return `${symbol}と同じ角はどこですか？`;
  }
  if (mode === "180-single") {
    return `${symbol}は180からどの角を引くと求められる？`;
  }
  if (mode === "180-pair") {
    return `${symbol}は180からどの角とどの角度の和を引くと求められる？`;
  }
  if (arrangementKind === "pair_sum") {
    return `${symbol}は、どの角とどの角の和と同じですか？`;
  }
  return `${symbol}は、どの2つの角の差と同じですか？`;
}

function buildExplanation(mode: ReasoningMode, arrangementKind: ArrangementKind): string {
  if (mode === "single") {
    return "同じ角になる位置関係を確認しましょう。";
  }
  if (mode === "180-single") {
    return "180度から引く角を1つ見つけましょう。";
  }
  if (mode === "180-pair") {
    return "180度から引く2角の和を確認しましょう。";
  }
  if (arrangementKind === "pair_sum") {
    return "和になる2つの角の組み合わせを確認しましょう。";
  }
  return "差の関係になる2つの角を確認しましょう。";
}

function buildQuestionKey(
  patternId: string,
  variant: SymmetryVariant,
  arrangementKind: ArrangementKind
): string {
  return `${patternId}:${variant}:${arrangementKind}`;
}

function buildSingleEntries(baseFigure: BaseFigure, pattern: QuestionPattern): CatalogEntry[] {
  if (!pattern.correctSingleAngleId) {
    return [];
  }
  const arrangementKind: ArrangementKind =
    pattern.mode === "180-single" ? "single_180" : "single";
  return VARIANTS.map((variant) => ({
    questionKey: buildQuestionKey(pattern.id, variant, arrangementKind),
    patternId: pattern.id,
    sourcePatternId: pattern.id,
    baseFigure,
    variant,
    arrangementKind,
    mode: pattern.mode,
    targetAngleId: pattern.targetAngleId,
    interactiveAngleIds: [...pattern.optionAngleIds] as [string, string, string, string],
    correctSingleAngleId: pattern.correctSingleAngleId
  }));
}

function buildPairEntries(baseFigure: BaseFigure, pattern: QuestionPattern): CatalogEntry[] {
  if (!pattern.correctPairAngleIds) {
    return [];
  }

  const [b, c] = pattern.correctPairAngleIds;
  const a = pattern.targetAngleId;

  if (pattern.mode === "180-pair") {
    return VARIANTS.map((variant) => ({
      questionKey: buildQuestionKey(pattern.id, variant, "pair_180"),
      patternId: pattern.id,
      sourcePatternId: pattern.id,
      baseFigure,
      variant,
      arrangementKind: "pair_180" as const,
      pairEquationKind: "sum" as const,
      mode: "180-pair" as const,
      targetAngleId: a,
      interactiveAngleIds: [...pattern.optionAngleIds] as [string, string, string, string],
      correctPairAngleIds: [b, c] as [string, string]
    }));
  }

  return VARIANTS.map((variant) => {
    const sumEntry: CatalogEntry = {
      questionKey: buildQuestionKey(pattern.id, variant, "pair_sum"),
      patternId: pattern.id,
      sourcePatternId: pattern.id,
      baseFigure,
      variant,
      arrangementKind: "pair_sum",
      pairEquationKind: "sum",
      mode: "pair",
      targetAngleId: a,
      interactiveAngleIds: [...pattern.optionAngleIds] as [string, string, string, string],
      correctPairAngleIds: [b, c]
    };

    return sumEntry;
  });
}

export function buildQuestionCatalog(
  baseFigures: BaseFigure[],
  patterns: QuestionPattern[]
): CatalogEntry[] {
  const figureMap = new Map(baseFigures.map((baseFigure) => [baseFigure.id, baseFigure]));
  const enabledPatterns = patterns.filter((pattern) => pattern.enabled);

  const entries: CatalogEntry[] = [];
  for (const pattern of enabledPatterns) {
    const baseFigure = figureMap.get(pattern.baseFigureId);
    if (!baseFigure) {
      continue;
    }
    if (isSingleMode(pattern.mode)) {
      entries.push(...buildSingleEntries(baseFigure, pattern));
      continue;
    }
    if (isPairMode(pattern.mode)) {
      entries.push(...buildPairEntries(baseFigure, pattern));
    }
  }
  return entries;
}

function buildHistoryState(pastAttempts: AttemptLog[]): Map<string, { seenCount: number; everWrong: boolean }> {
  const history = new Map<string, { seenCount: number; everWrong: boolean }>();

  for (const attempt of pastAttempts) {
    const key = attempt.questionKey;
    if (!key) {
      continue;
    }
    const previous = history.get(key) ?? { seenCount: 0, everWrong: false };
    previous.seenCount += 1;
    if (attempt.wrongCount > 0) {
      previous.everWrong = true;
    }
    history.set(key, previous);
  }

  return history;
}

function pickRandom<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function pickNextByAntiStreak(
  available: CatalogEntry[],
  previous: CatalogEntry | undefined
): CatalogEntry {
  if (!previous) {
    return pickRandom(available);
  }

  const strict = available.filter(
    (entry) =>
      entry.baseFigure.id !== previous.baseFigure.id &&
      entry.sourcePatternId !== previous.sourcePatternId
  );
  if (strict.length > 0) {
    return pickRandom(strict);
  }

  const relaxed = available.filter(
    (entry) => entry.sourcePatternId !== previous.sourcePatternId
  );
  if (relaxed.length > 0) {
    return pickRandom(relaxed);
  }

  return pickRandom(available);
}

function pickFromPool(
  pool: CatalogEntry[],
  selected: CatalogEntry[],
  selectedKeys: Set<string>,
  totalCount: number
): void {
  const available = pool.filter((entry) => !selectedKeys.has(entry.questionKey));

  while (selected.length < totalCount && available.length > 0) {
    const previous = selected[selected.length - 1];
    const next = pickNextByAntiStreak(available, previous);
    selected.push(next);
    selectedKeys.add(next.questionKey);

    const index = available.findIndex((entry) => entry.questionKey === next.questionKey);
    if (index >= 0) {
      available.splice(index, 1);
    }
  }
}

function pickByPriority(
  catalog: CatalogEntry[],
  history: Map<string, { seenCount: number; everWrong: boolean }>,
  selected: CatalogEntry[],
  selectedKeys: Set<string>,
  addCount: number
): void {
  const targetCount = selected.length + addCount;

  const primary = catalog.filter((entry) => {
    const state = history.get(entry.questionKey);
    if (!state) {
      return true;
    }
    return state.everWrong;
  });
  pickFromPool(primary, selected, selectedKeys, targetCount);

  if (selected.length < targetCount) {
    const wrongSupplement = catalog.filter((entry) => history.get(entry.questionKey)?.everWrong);
    pickFromPool(wrongSupplement, selected, selectedKeys, targetCount);
  }
  if (selected.length < targetCount) {
    const solvedSupplement = catalog.filter((entry) => {
      const state = history.get(entry.questionKey);
      return Boolean(state && !state.everWrong);
    });
    pickFromPool(solvedSupplement, selected, selectedKeys, targetCount);
  }
  if (selected.length < targetCount) {
    pickFromPool(catalog, selected, selectedKeys, targetCount);
  }
}

function selectCatalogEntries(
  catalog: CatalogEntry[],
  pastAttempts: AttemptLog[],
  count: number
): CatalogEntry[] {
  if (count !== SESSION_QUESTION_COUNT) {
    throw new Error(`unsupported question count: ${count}`);
  }
  if (SESSION_SINGLE_COUNT + SESSION_PAIR_COUNT !== count) {
    throw new Error("session mode split is inconsistent");
  }

  const singleCatalog = catalog.filter((entry) => isSingleMode(entry.mode));
  const pairCatalog = catalog.filter((entry) => isPairMode(entry.mode));

  if (singleCatalog.length < SESSION_SINGLE_COUNT) {
    throw new Error(`single pool shortage: ${singleCatalog.length}/${SESSION_SINGLE_COUNT}`);
  }
  if (pairCatalog.length < SESSION_PAIR_COUNT) {
    throw new Error(`pair pool shortage: ${pairCatalog.length}/${SESSION_PAIR_COUNT}`);
  }

  const history = buildHistoryState(pastAttempts);
  const selected: CatalogEntry[] = [];
  const selectedKeys = new Set<string>();

  pickByPriority(singleCatalog, history, selected, selectedKeys, SESSION_SINGLE_COUNT);
  if (selected.length < SESSION_SINGLE_COUNT) {
    throw new Error(`single selection failed: ${selected.length}/${SESSION_SINGLE_COUNT}`);
  }

  pickByPriority(pairCatalog, history, selected, selectedKeys, SESSION_PAIR_COUNT);
  if (selected.length < count) {
    const pairSelected = selected.length - SESSION_SINGLE_COUNT;
    throw new Error(`pair selection failed: ${Math.max(pairSelected, 0)}/${SESSION_PAIR_COUNT}`);
  }

  return selected.slice(0, count);
}

function createQuestionInstance(entry: CatalogEntry): QuestionInstance {
  const transformed = transformFigure(entry.baseFigure, entry.variant);
  const targetAngle = transformed.angles.find((angleDef) => angleDef.id === entry.targetAngleId);

  if (!targetAngle) {
    throw new Error(`target angle ${entry.targetAngleId} not found in ${entry.baseFigure.id}`);
  }

  return {
    id: uniqueId("question"),
    questionKey: entry.questionKey,
    type: "reasoning",
    mode: entry.mode,
    prompt: buildQuestionPrompt(targetAngle.symbol, entry.mode, entry.arrangementKind),
    explanation: buildExplanation(entry.mode, entry.arrangementKind),
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
    segments: cloneSegments(transformed.segments),
    angles: cloneAngles(transformed.angles)
  };
}

export function buildSessionQuestions(
  baseFigures: BaseFigure[],
  patterns: QuestionPattern[],
  _level: DifficultyLevel,
  pastAttempts: AttemptLog[] = []
): QuestionInstance[] {
  void _level;
  const catalog = buildQuestionCatalog(baseFigures, patterns);
  if (catalog.length === 0) {
    throw new Error("no questions available");
  }

  const selectedEntries = selectCatalogEntries(catalog, pastAttempts, SESSION_QUESTION_COUNT);
  return selectedEntries.map((entry) => createQuestionInstance(entry));
}
