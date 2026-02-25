import { afterEach, describe, expect, it } from "vitest";
import {
  loadSavedBaseFigures,
  loadSavedQuestionPatterns,
  saveBaseFigures,
  saveQuestionPatterns
} from "./calibration-storage";
import { createBaseFigures, createQuestionPatterns } from "./templates";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function createStorageMock(initial: Record<string, string> = {}): StorageMock {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("calibration storage", () => {
  it("falls back to defaults when localStorage is unavailable", () => {
    (globalThis as { window?: unknown }).window = undefined;
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    expect(loadSavedBaseFigures(baseFigures)).toEqual(baseFigures);
    expect(loadSavedQuestionPatterns(patterns)).toEqual(patterns);
    expect(saveBaseFigures(baseFigures)).toBe(false);
    expect(saveQuestionPatterns(patterns)).toBe(false);
  });

  it("loads saved payloads when shape is valid", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const singleSeed = patterns.find((pattern) => pattern.mode === "single") ?? patterns[0];
    const pairSeed = patterns.find((pattern) => pattern.mode === "pair") ?? patterns[0];
    const patternsWith180 = [
      ...patterns,
      {
        ...singleSeed,
        id: `${singleSeed.id}-180S`,
        mode: "180-single" as const
      },
      {
        ...pairSeed,
        id: `${pairSeed.id}-180P`,
        mode: "180-pair" as const
      }
    ];
    (globalThis as { window?: { localStorage: StorageMock } }).window = {
      localStorage: createStorageMock({
        "math_training.calibration.base_figures_v1": JSON.stringify(baseFigures),
        "math_training.calibration.question_patterns_v1": JSON.stringify(patternsWith180)
      })
    };
    expect(loadSavedBaseFigures([])).toEqual(baseFigures);
    expect(loadSavedQuestionPatterns([])).toEqual(patternsWith180);
  });
});
