export type Family = "F1" | "F2" | "F3" | "F4";
export type QuestionType = "reasoning";
export type ReasoningMode = "single" | "pair" | "180-single" | "180-pair";
export type ArrangementKind =
  | "single"
  | "pair_sum"
  | "pair_diff_1"
  | "pair_diff_2"
  | "single_180"
  | "pair_180";
export type SymmetryVariant = "origin" | "mirror_lr" | "mirror_ud" | "mirror_both";
export type LabelPlacementMode = "free_drag";
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  id: string;
  start: Point;
  end: Point;
}

export interface AngleDef {
  id: string;
  symbol: string;
  vertex: Point;
  rayA: Point;
  rayB: Point;
  labelNudge: Point;
  hitRadius: number;
}

export interface BaseFigure {
  id: string;
  family: Family;
  stepCount: 2 | 3 | 4;
  difficultyLevel: DifficultyLevel;
  segments: Segment[];
  angles: AngleDef[];
}

export interface QuestionPattern {
  id: string;
  baseFigureId: string;
  mode: ReasoningMode;
  targetAngleId: string;
  optionAngleIds: [string, string, string, string];
  correctSingleAngleId?: string;
  correctPairAngleIds?: [string, string];
  promptOverride?: string;
  explanation: string;
  enabled: boolean;
}

export interface QuestionInstance {
  id: string;
  questionKey: string;
  type: QuestionType;
  mode: ReasoningMode;
  prompt: string;
  explanation: string;
  baseFigureId: string;
  patternId: string;
  sourcePatternId: string;
  variant: SymmetryVariant;
  arrangementKind: ArrangementKind;
  pairEquationKind?: "sum" | "difference";
  targetAngleId: string;
  interactiveAngleIds: string[];
  correctSingleAngleId?: string;
  correctPairAngleIds?: [string, string];
  isBasic: boolean;
  stepCount: 2 | 3 | 4;
  segments: Segment[];
  angles: AngleDef[];
}

export interface AttemptLog {
  questionId: string;
  questionKey: string;
  patternId: string;
  sourcePatternId: string;
  baseFigureId: string;
  variant: SymmetryVariant;
  arrangementKind: ArrangementKind;
  startedAt: number;
  solvedAt: number | null;
  elapsedMs: number | null;
  wrongCount: number;
  firstTryCorrect: boolean | null;
  isSolved: boolean;
}

export interface SessionLog {
  id: string;
  unitId: string;
  level: DifficultyLevel;
  startedAt: number;
  endedAt: number;
  attempts: AttemptLog[];
  medianMs: number;
  errorRate: number;
  completed?: boolean;
}

export interface PatternStats {
  patternId: string;
  attempts: number;
  medianMs: number;
  errorRate: number;
  lastPlayedAt: number;
}

export interface ComparisonPeriodStats {
  attempts: number;
  solvedAttempts: number;
  averageMs: number | null;
  accuracyRate: number | null;
}

export interface PatternComparisonRow {
  patternKey: string;
  oldAttempts: number;
  newAttempts: number;
  oldSolvedAttempts: number;
  newSolvedAttempts: number;
  oldAverageMs: number | null;
  newAverageMs: number | null;
  deltaMs: number | null;
  oldAccuracyRate: number | null;
  newAccuracyRate: number | null;
  deltaAccuracyRate: number | null;
}

export interface UnitCard {
  id: string;
  title: string;
  status: "active" | "coming_soon";
  description: string;
}

export interface SessionRun {
  id: string;
  level: DifficultyLevel;
  unitId: string;
  startedAt: number;
  questions: QuestionInstance[];
}
