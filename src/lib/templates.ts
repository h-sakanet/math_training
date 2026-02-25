import type {
  AngleDef,
  BaseFigure,
  DifficultyLevel,
  Family,
  Point,
  QuestionPattern,
  ReasoningMode,
  Segment
} from "./types";

const FIXED_BASE_FIGURE_COUNT = 4;
export const GLOBAL_ANGLE_HIT_RADIUS = 22;

const ANGLE_IDS = {
  target: "TARGET",
  sum: "SUM",
  chain1: "CHAIN1",
  chain2: "CHAIN2",
  g1: "G1",
  g2: "G2",
  g1Alt: "G1_ALT",
  g2Alt: "G2_ALT",
  decoy1: "DECOY1",
  decoy2: "DECOY2"
} as const;

function p(x: number, y: number): Point {
  return { x, y };
}

function seg(id: string, start: Point, end: Point): Segment {
  return { id, start, end };
}

function ang(
  id: string,
  symbol: string,
  vertex: Point,
  rayA: Point,
  rayB: Point,
  labelNudge: Point,
  hitRadius = 22
): AngleDef {
  return {
    id,
    symbol,
    vertex,
    rayA,
    rayB,
    labelNudge,
    hitRadius
  };
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

function applyGlobalHitRadius(baseFigure: BaseFigure, radius: number): BaseFigure {
  return {
    ...baseFigure,
    angles: baseFigure.angles.map((angleDef) => ({
      ...angleDef,
      hitRadius: radius
    }))
  };
}

function clonePattern(pattern: QuestionPattern): QuestionPattern {
  return {
    ...pattern,
    optionAngleIds: [...pattern.optionAngleIds] as [string, string, string, string],
    correctPairAngleIds: pattern.correctPairAngleIds
      ? [...pattern.correctPairAngleIds] as [string, string]
      : undefined
  };
}

function symbolForAngle(baseFigure: BaseFigure, angleId: string): string {
  return baseFigure.angles.find((angleDef) => angleDef.id === angleId)?.symbol ?? angleId;
}

function isSingleLikeMode(mode: ReasoningMode): mode is "single" | "180-single" {
  return mode === "single" || mode === "180-single";
}

export function buildPatternIdBySymbols(
  baseFigure: BaseFigure,
  mode: ReasoningMode,
  targetAngleId: string,
  correctSingleAngleId?: string,
  correctPairAngleIds?: [string, string]
): string {
  const targetSymbol = symbolForAngle(baseFigure, targetAngleId);
  if (mode === "single") {
    const correctSymbol = symbolForAngle(baseFigure, correctSingleAngleId ?? "");
    return `${baseFigure.id}-${targetSymbol}-${correctSymbol}`;
  }
  if (mode === "180-single") {
    const correctSymbol = symbolForAngle(baseFigure, correctSingleAngleId ?? "");
    return `${baseFigure.id}-180S-${targetSymbol}-${correctSymbol}`;
  }
  const first = symbolForAngle(baseFigure, correctPairAngleIds?.[0] ?? "");
  const second = symbolForAngle(baseFigure, correctPairAngleIds?.[1] ?? "");
  if (mode === "180-pair") {
    return `${baseFigure.id}-180P-${targetSymbol}-${first}+${second}`;
  }
  return `${baseFigure.id}-${targetSymbol}-${first}+${second}`;
}

function applyReadablePatternIds(
  patterns: QuestionPattern[],
  baseFigures: BaseFigure[]
): QuestionPattern[] {
  const figureMap = new Map(baseFigures.map((baseFigure) => [baseFigure.id, baseFigure]));
  const used = new Set<string>();

  return patterns.map((pattern) => {
    const baseFigure = figureMap.get(pattern.baseFigureId);
    if (!baseFigure) {
      return clonePattern(pattern);
    }

    const baseId = buildPatternIdBySymbols(
      baseFigure,
      pattern.mode,
      pattern.targetAngleId,
      pattern.correctSingleAngleId,
      pattern.correctPairAngleIds
    );
    let nextId = baseId;
    let serial = 2;
    while (used.has(nextId)) {
      nextId = `${baseId}-${serial}`;
      serial += 1;
    }
    used.add(nextId);

    return {
      ...clonePattern(pattern),
      id: nextId
    };
  });
}

function buildPatternId(family: Family, kind: "single" | "pair", index: number): string {
  return `${family}-${kind}-${index}`;
}

function singlePattern(
  family: Family,
  index: number,
  baseFigureId: string,
  targetAngleId: string,
  optionAngleIds: [string, string, string, string],
  correctSingleAngleId: string,
  explanation: string
): QuestionPattern {
  return {
    id: buildPatternId(family, "single", index),
    baseFigureId,
    mode: "single",
    targetAngleId,
    optionAngleIds,
    correctSingleAngleId,
    explanation,
    enabled: true
  };
}

function pairPattern(
  family: Family,
  index: number,
  baseFigureId: string,
  targetAngleId: string,
  optionAngleIds: [string, string, string, string],
  correctPairAngleIds: [string, string],
  explanation: string
): QuestionPattern {
  return {
    id: buildPatternId(family, "pair", index),
    baseFigureId,
    mode: "pair",
    targetAngleId,
    optionAngleIds,
    correctPairAngleIds,
    explanation,
    enabled: true
  };
}

const BASE_FIGURES: BaseFigure[] = [
  (() => {
    // sample: 5179...（三平行線 + 2斜線）
    const tl = p(24, 36);
    const tr = p(296, 36);
    const ml = p(24, 92);
    const mr = p(296, 92);
    const bl = p(24, 176);
    const br = p(296, 176);

    const topHit = p(110, 36);
    const apex = p(150, 92);
    const bottomLeft = p(94, 176);
    const bottomRight = p(210, 176);

    return {
      id: "F1",
      family: "F1",
      stepCount: 3,
      difficultyLevel: 3,
      segments: [
        seg("top", tl, tr),
        seg("mid", ml, mr),
        seg("bottom", bl, br),
        seg("diag-main", topHit, bottomRight),
        seg("diag-left", bottomLeft, apex)
      ],
      angles: [
        ang(ANGLE_IDS.target, "ア", bottomRight, apex, br, p(5, 0), 24),
        ang(ANGLE_IDS.sum, "イ", apex, bottomLeft, bottomRight, p(0, -2), 23),
        ang(ANGLE_IDS.chain1, "ウ", topHit, tr, apex, p(1, -1), 21),
        ang(ANGLE_IDS.chain2, "エ", bottomRight, bl, apex, p(-1, 1), 21),
        ang(ANGLE_IDS.g1, "オ", bottomLeft, apex, bottomRight, p(1, 2), 22),
        ang(ANGLE_IDS.g2, "カ", topHit, tl, apex, p(-2, -1), 22),
        ang(ANGLE_IDS.g1Alt, "キ", apex, mr, bottomLeft, p(3, 1), 22),
        ang(ANGLE_IDS.g2Alt, "ク", apex, ml, topHit, p(-3, -1), 22),
        ang(ANGLE_IDS.decoy1, "ケ", apex, topHit, bottomLeft, p(-5, -2), 18),
        ang(ANGLE_IDS.decoy2, "コ", bottomLeft, apex, bl, p(-5, 1), 20)
      ]
    } satisfies BaseFigure;
  })(),

  (() => {
    // sample: 768... (1)（二平行線 + 頂点三角）
    const tl = p(24, 104);
    const tr = p(296, 104);
    const bl = p(24, 178);
    const br = p(296, 178);

    const apex = p(160, 24);
    const leftBottom = p(146, 178);
    const rightBottom = p(248, 178);
    const leftTop = p(153, 104);
    const rightTop = p(206, 104);
    const leftSideExt = p(132, 332);
    const rightSideExt = p(336, 332);

    return {
      id: "F2",
      family: "F2",
      stepCount: 2,
      difficultyLevel: 2,
      segments: [
        seg("top", tl, tr),
        seg("bottom", bl, br),
        seg("left-side", apex, leftBottom),
        seg("right-side", apex, rightBottom)
      ],
      angles: [
        ang(ANGLE_IDS.target, "ア", rightBottom, apex, br, p(6, 0), 24),
        ang(ANGLE_IDS.sum, "イ", apex, leftBottom, rightBottom, p(0, -1), 23),
        ang(ANGLE_IDS.chain1, "ウ", leftBottom, apex, rightBottom, p(0, 2), 22),
        ang(ANGLE_IDS.chain2, "エ", leftBottom, apex, bl, p(-5, 0), 21),
        ang(ANGLE_IDS.g1, "オ", rightBottom, apex, leftBottom, p(-1, 2), 22),
        ang(ANGLE_IDS.g2, "カ", leftTop, tl, apex, p(-1, -2), 22),
        ang(ANGLE_IDS.g1Alt, "キ", rightBottom, rightSideExt, br, p(4, 2), 22),
        ang(ANGLE_IDS.g2Alt, "ク", leftBottom, leftSideExt, bl, p(-3, 2), 22),
        ang(ANGLE_IDS.decoy1, "ケ", rightTop, tr, apex, p(1, -2), 18),
        ang(ANGLE_IDS.decoy2, "コ", apex, rightBottom, leftTop, p(4, 0), 18)
      ]
    } satisfies BaseFigure;
  })(),

  (() => {
    // sample: 768... (2)（二平行線 + 折れ線三角）
    const tl = p(24, 62);
    const tr = p(296, 62);
    const bl = p(24, 166);
    const br = p(296, 166);

    const topApex = p(186, 24);
    const lowerApex = p(92, 200);
    const rightCorner = p(262, 112);

    const leftCrossTop = p(166, 62);
    const leftCrossBottom = p(110, 166);
    const rightCrossTop = p(219, 62);
    const rightCrossBottom = p(158, 166);

    const rightBaseExt = p(432, 24);
    const rightSideExt = p(338, 200);
    const leftBaseExt = p(-78, 288);

    return {
      id: "F3",
      family: "F3",
      stepCount: 4,
      difficultyLevel: 5,
      segments: [
        seg("top", tl, tr),
        seg("bottom", bl, br),
        seg("left-side", lowerApex, topApex),
        seg("right-side", topApex, rightCorner),
        seg("base", lowerApex, rightCorner)
      ],
      angles: [
        ang(ANGLE_IDS.target, "ア", rightCorner, topApex, rightBaseExt, p(6, 0), 24),
        ang(ANGLE_IDS.sum, "イ", topApex, lowerApex, rightCorner, p(0, -2), 23),
        ang(ANGLE_IDS.chain1, "ウ", rightCrossTop, tr, topApex, p(2, -2), 22),
        ang(ANGLE_IDS.chain2, "エ", lowerApex, topApex, rightCorner, p(-1, 2), 22),
        ang(ANGLE_IDS.g1, "オ", rightCorner, topApex, lowerApex, p(-2, 1), 22),
        ang(ANGLE_IDS.g2, "カ", leftCrossTop, tl, topApex, p(-2, -2), 22),
        ang(ANGLE_IDS.g1Alt, "キ", rightCorner, rightSideExt, rightBaseExt, p(4, 3), 22),
        ang(ANGLE_IDS.g2Alt, "ク", leftCrossBottom, bl, topApex, p(-2, 1), 22),
        ang(ANGLE_IDS.decoy1, "ケ", rightCrossBottom, lowerApex, br, p(1, 2), 18),
        ang(ANGLE_IDS.decoy2, "コ", lowerApex, topApex, leftBaseExt, p(-5, 0), 21)
      ]
    } satisfies BaseFigure;
  })(),

  (() => {
    // sample: D457...（三平行線 + 2斜線交差）
    const tl = p(24, 40);
    const tr = p(296, 40);
    const ml = p(24, 110);
    const mr = p(296, 110);
    const bl = p(24, 178);
    const br = p(296, 178);

    const crossDownTop = p(146, 40);
    const crossDownBottom = p(188, 178);
    const crossUpMid = p(72, 110);
    const crossUpTop = p(232, 40);
    const center = p(156, 73);

    return {
      id: "F4",
      family: "F4",
      stepCount: 3,
      difficultyLevel: 4,
      segments: [
        seg("top", tl, tr),
        seg("mid", ml, mr),
        seg("bottom", bl, br),
        seg("downward", crossDownTop, crossDownBottom),
        seg("upward", crossUpMid, crossUpTop)
      ],
      angles: [
        ang(ANGLE_IDS.target, "ア", center, crossDownBottom, crossUpMid, p(3, 1), 24),
        ang(ANGLE_IDS.sum, "イ", crossDownTop, center, crossUpTop, p(0, -2), 22),
        ang(ANGLE_IDS.chain1, "ウ", crossUpTop, crossDownTop, center, p(0, -2), 22),
        ang(ANGLE_IDS.chain2, "エ", crossDownTop, center, tl, p(-4, -1), 21),
        ang(ANGLE_IDS.g1, "オ", crossDownTop, tr, center, p(2, -1), 22),
        ang(ANGLE_IDS.g2, "カ", crossUpTop, tl, center, p(-2, -2), 22),
        ang(ANGLE_IDS.g1Alt, "キ", crossDownBottom, bl, center, p(-2, 1), 22),
        ang(ANGLE_IDS.g2Alt, "ク", crossUpMid, ml, center, p(-2, 1), 22),
        ang(ANGLE_IDS.decoy1, "ケ", center, crossDownTop, crossUpTop, p(0, -3), 19),
        ang(ANGLE_IDS.decoy2, "コ", crossDownBottom, center, br, p(4, 1), 18)
      ]
    } satisfies BaseFigure;
  })()
];

const INITIAL_PATTERNS: QuestionPattern[] = [
  singlePattern(
    "F1",
    1,
    "F1",
    ANGLE_IDS.g1,
    [ANGLE_IDS.g1Alt, ANGLE_IDS.chain1, ANGLE_IDS.chain2, ANGLE_IDS.decoy1],
    ANGLE_IDS.g1Alt,
    "対応する同じ大きさの角を1つ選びます。"
  ),
  singlePattern(
    "F1",
    2,
    "F1",
    ANGLE_IDS.g2,
    [ANGLE_IDS.chain2, ANGLE_IDS.g2Alt, ANGLE_IDS.g1, ANGLE_IDS.decoy2],
    ANGLE_IDS.chain2,
    "同じ角度になる角を見つけて選びます。"
  ),
  pairPattern(
    "F1",
    1,
    "F1",
    ANGLE_IDS.target,
    [ANGLE_IDS.sum, ANGLE_IDS.g1, ANGLE_IDS.g2, ANGLE_IDS.decoy2],
    [ANGLE_IDS.sum, ANGLE_IDS.g1],
    "和になる2つの角を選びます。"
  ),
  pairPattern(
    "F1",
    2,
    "F1",
    ANGLE_IDS.decoy2,
    [ANGLE_IDS.sum, ANGLE_IDS.chain2, ANGLE_IDS.g2, ANGLE_IDS.decoy1],
    [ANGLE_IDS.sum, ANGLE_IDS.chain2],
    "対象の角と同じ和になる2角を選びます。"
  ),

  singlePattern(
    "F2",
    1,
    "F2",
    ANGLE_IDS.g1,
    [ANGLE_IDS.g1Alt, ANGLE_IDS.chain1, ANGLE_IDS.chain2, ANGLE_IDS.decoy1],
    ANGLE_IDS.g1Alt,
    "同じ角度の角を4択から選びます。"
  ),
  singlePattern(
    "F2",
    2,
    "F2",
    ANGLE_IDS.chain1,
    [ANGLE_IDS.g2Alt, ANGLE_IDS.g1, ANGLE_IDS.g2, ANGLE_IDS.decoy2],
    ANGLE_IDS.g2Alt,
    "同角になる候補を選びます。"
  ),
  pairPattern(
    "F2",
    1,
    "F2",
    ANGLE_IDS.target,
    [ANGLE_IDS.sum, ANGLE_IDS.chain1, ANGLE_IDS.g1, ANGLE_IDS.decoy2],
    [ANGLE_IDS.sum, ANGLE_IDS.chain1],
    "和が等しくなる2角の組を選びます。"
  ),
  pairPattern(
    "F2",
    2,
    "F2",
    ANGLE_IDS.chain2,
    [ANGLE_IDS.sum, ANGLE_IDS.g1, ANGLE_IDS.g2, ANGLE_IDS.decoy1],
    [ANGLE_IDS.sum, ANGLE_IDS.g1],
    "対象角の和と一致する2角を選びます。"
  ),

  singlePattern(
    "F3",
    1,
    "F3",
    ANGLE_IDS.g1,
    [ANGLE_IDS.g1Alt, ANGLE_IDS.chain1, ANGLE_IDS.chain2, ANGLE_IDS.decoy1],
    ANGLE_IDS.g1Alt,
    "同角の候補から正しい1角を選択します。"
  ),
  singlePattern(
    "F3",
    2,
    "F3",
    ANGLE_IDS.g2,
    [ANGLE_IDS.g2Alt, ANGLE_IDS.g1, ANGLE_IDS.chain1, ANGLE_IDS.decoy2],
    ANGLE_IDS.g2Alt,
    "同じ角度の角を1つ選びます。"
  ),
  pairPattern(
    "F3",
    1,
    "F3",
    ANGLE_IDS.target,
    [ANGLE_IDS.sum, ANGLE_IDS.chain2, ANGLE_IDS.g1, ANGLE_IDS.decoy1],
    [ANGLE_IDS.sum, ANGLE_IDS.chain2],
    "対象角と等しい和を作る2角を選択します。"
  ),
  pairPattern(
    "F3",
    2,
    "F3",
    ANGLE_IDS.decoy2,
    [ANGLE_IDS.sum, ANGLE_IDS.g1, ANGLE_IDS.chain1, ANGLE_IDS.g2],
    [ANGLE_IDS.sum, ANGLE_IDS.g1],
    "和になる2角を選んで正解します。"
  ),

  singlePattern(
    "F4",
    1,
    "F4",
    ANGLE_IDS.g1,
    [ANGLE_IDS.g1Alt, ANGLE_IDS.g2, ANGLE_IDS.chain1, ANGLE_IDS.decoy2],
    ANGLE_IDS.g1Alt,
    "同角関係の1角を選びます。"
  ),
  singlePattern(
    "F4",
    2,
    "F4",
    ANGLE_IDS.g2,
    [ANGLE_IDS.g2Alt, ANGLE_IDS.g1, ANGLE_IDS.chain2, ANGLE_IDS.decoy1],
    ANGLE_IDS.g2Alt,
    "同じ大きさの角を選んでください。"
  ),
  pairPattern(
    "F4",
    1,
    "F4",
    ANGLE_IDS.target,
    [ANGLE_IDS.sum, ANGLE_IDS.chain1, ANGLE_IDS.g1, ANGLE_IDS.g2],
    [ANGLE_IDS.sum, ANGLE_IDS.chain1],
    "対象角に対応する和の2角を選びます。"
  ),
  pairPattern(
    "F4",
    2,
    "F4",
    ANGLE_IDS.chain2,
    [ANGLE_IDS.chain1, ANGLE_IDS.decoy1, ANGLE_IDS.sum, ANGLE_IDS.g2],
    [ANGLE_IDS.chain1, ANGLE_IDS.decoy1],
    "和が一致する2角の組み合わせを選びます。"
  )
];

function ensureDifficulty(level: number): level is DifficultyLevel {
  return level >= 1 && level <= 5;
}

export function createBaseFigures(): BaseFigure[] {
  if (BASE_FIGURES.length !== FIXED_BASE_FIGURE_COUNT) {
    throw new Error(`base figures must stay fixed to ${FIXED_BASE_FIGURE_COUNT}`);
  }
  return BASE_FIGURES.map((figure) =>
    applyGlobalHitRadius(cloneBaseFigure(figure), GLOBAL_ANGLE_HIT_RADIUS)
  );
}

export function createQuestionPatterns(): QuestionPattern[] {
  return applyReadablePatternIds(INITIAL_PATTERNS, BASE_FIGURES);
}

export function sanitizeQuestionPatterns(
  patterns: QuestionPattern[],
  baseFigures: BaseFigure[],
  fallbackPatterns: QuestionPattern[] = createQuestionPatterns()
): QuestionPattern[] {
  const baseFigureMap = new Map(baseFigures.map((baseFigure) => [baseFigure.id, baseFigure]));
  const sanitized = patterns.filter((pattern) => {
    const baseFigure = baseFigureMap.get(pattern.baseFigureId);
    if (!baseFigure) {
      return false;
    }
    return validateQuestionPattern(pattern, baseFigure).ok;
  });

  if (sanitized.length > 0) {
    return applyReadablePatternIds(sanitized, baseFigures);
  }

  return applyReadablePatternIds(
    fallbackPatterns
    .filter((pattern) => {
      const baseFigure = baseFigureMap.get(pattern.baseFigureId);
      return baseFigure ? validateQuestionPattern(pattern, baseFigure).ok : false;
    })
    .map((pattern) => clonePattern(pattern)),
    baseFigures
  );
}

export function validateQuestionPattern(
  pattern: QuestionPattern,
  baseFigure: BaseFigure
): { ok: boolean; message?: string } {
  if (pattern.baseFigureId !== baseFigure.id) {
    return { ok: false, message: "baseFigureId が一致しません" };
  }

  if (!ensureDifficulty(baseFigure.difficultyLevel)) {
    return { ok: false, message: "難易度が範囲外です" };
  }

  const angleIdSet = new Set(baseFigure.angles.map((angleDef) => angleDef.id));
  if (!angleIdSet.has(pattern.targetAngleId)) {
    return { ok: false, message: "targetAngleId が図形内に存在しません" };
  }

  if (pattern.optionAngleIds.length !== 4) {
    return { ok: false, message: "options は4件固定です" };
  }

  const optionUnique = new Set(pattern.optionAngleIds);
  if (optionUnique.size !== 4) {
    return { ok: false, message: "options に重複があります" };
  }

  if (pattern.optionAngleIds.some((angleId) => !angleIdSet.has(angleId))) {
    return { ok: false, message: "options に不正な angleId が含まれます" };
  }

  if (isSingleLikeMode(pattern.mode)) {
    if (!pattern.correctSingleAngleId) {
      return { ok: false, message: `${pattern.mode} の正解角が未設定です` };
    }
    if (!optionUnique.has(pattern.correctSingleAngleId)) {
      return { ok: false, message: `${pattern.mode} の正解角は options 内である必要があります` };
    }
    return { ok: true };
  }

  if (!pattern.correctPairAngleIds) {
    return { ok: false, message: `${pattern.mode} の正解2角が未設定です` };
  }
  const [a, b] = pattern.correctPairAngleIds;
  if (a === b) {
    return { ok: false, message: `${pattern.mode} の正解2角が重複しています` };
  }
  if (!optionUnique.has(a) || !optionUnique.has(b)) {
    return { ok: false, message: `${pattern.mode} の正解2角は options 内である必要があります` };
  }
  return { ok: true };
}

export function validateBaseFigure(baseFigure: BaseFigure): boolean {
  return baseFigure.segments.length > 0 && baseFigure.angles.length >= 4;
}
