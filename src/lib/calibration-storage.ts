import type { BaseFigure, QuestionPattern } from "./types";

const BASE_FIGURES_STORAGE_KEY = "math_training.calibration.base_figures_v1";
const QUESTION_PATTERNS_STORAGE_KEY = "math_training.calibration.question_patterns_v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function safeRead<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isPointLike(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as { x?: unknown; y?: unknown };
  return typeof maybe.x === "number" && typeof maybe.y === "number";
}

function isBaseFigureLike(value: unknown): value is BaseFigure {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Partial<BaseFigure>;
  return (
    typeof maybe.id === "string" &&
    typeof maybe.family === "string" &&
    typeof maybe.difficultyLevel === "number" &&
    Array.isArray(maybe.segments) &&
    Array.isArray(maybe.angles) &&
    maybe.segments.every((segment) => {
      if (!segment || typeof segment !== "object") {
        return false;
      }
      const cast = segment as {
        id?: unknown;
        start?: unknown;
        end?: unknown;
      };
      return (
        typeof cast.id === "string" &&
        isPointLike(cast.start) &&
        isPointLike(cast.end)
      );
    }) &&
    maybe.angles.every((angleDef) => {
      if (!angleDef || typeof angleDef !== "object") {
        return false;
      }
      const cast = angleDef as {
        id?: unknown;
        symbol?: unknown;
        vertex?: unknown;
        rayA?: unknown;
        rayB?: unknown;
        labelNudge?: unknown;
        hitRadius?: unknown;
      };
      return (
        typeof cast.id === "string" &&
        typeof cast.symbol === "string" &&
        isPointLike(cast.vertex) &&
        isPointLike(cast.rayA) &&
        isPointLike(cast.rayB) &&
        isPointLike(cast.labelNudge) &&
        typeof cast.hitRadius === "number"
      );
    })
  );
}

function isQuestionPatternLike(value: unknown): value is QuestionPattern {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Partial<QuestionPattern>;
  return (
    typeof maybe.id === "string" &&
    typeof maybe.baseFigureId === "string" &&
    (
      maybe.mode === "single" ||
      maybe.mode === "pair" ||
      maybe.mode === "180-single" ||
      maybe.mode === "180-pair"
    ) &&
    typeof maybe.targetAngleId === "string" &&
    Array.isArray(maybe.optionAngleIds) &&
    maybe.optionAngleIds.length === 4 &&
    maybe.optionAngleIds.every((angleId) => typeof angleId === "string") &&
    typeof maybe.explanation === "string" &&
    typeof maybe.enabled === "boolean"
  );
}

export function loadSavedBaseFigures(defaultValue: BaseFigure[]): BaseFigure[] {
  const data = safeRead<unknown>(BASE_FIGURES_STORAGE_KEY);
  if (!Array.isArray(data)) {
    return defaultValue;
  }
  if (!data.every((entry) => isBaseFigureLike(entry))) {
    return defaultValue;
  }
  return data as BaseFigure[];
}

export function saveBaseFigures(baseFigures: BaseFigure[]): boolean {
  return safeWrite(BASE_FIGURES_STORAGE_KEY, baseFigures);
}

export function loadSavedQuestionPatterns(defaultValue: QuestionPattern[]): QuestionPattern[] {
  const data = safeRead<unknown>(QUESTION_PATTERNS_STORAGE_KEY);
  if (!Array.isArray(data)) {
    return defaultValue;
  }
  if (!data.every((entry) => isQuestionPatternLike(entry))) {
    return defaultValue;
  }
  return data as QuestionPattern[];
}

export function saveQuestionPatterns(patterns: QuestionPattern[]): boolean {
  return safeWrite(QUESTION_PATTERNS_STORAGE_KEY, patterns);
}
