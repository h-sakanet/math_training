import { describe, expect, it } from "vitest";
import {
  GLOBAL_ANGLE_HIT_RADIUS,
  buildPatternIdBySymbols,
  createBaseFigures,
  createQuestionPatterns,
  sanitizeQuestionPatterns,
  validateBaseFigure,
  validateQuestionPattern
} from "./templates";

describe("templates", () => {
  it("creates exactly 4 base figures", () => {
    const baseFigures = createBaseFigures();
    expect(baseFigures).toHaveLength(4);
    for (const baseFigure of baseFigures) {
      expect(validateBaseFigure(baseFigure)).toBe(true);
      for (const angleDef of baseFigure.angles) {
        expect(angleDef.hitRadius).toBe(GLOBAL_ANGLE_HIT_RADIUS);
      }
    }
  });

  it("every pattern is valid for its base figure", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const figureMap = new Map(baseFigures.map((baseFigure) => [baseFigure.id, baseFigure]));

    expect(patterns.length).toBeGreaterThanOrEqual(8);
    for (const pattern of patterns) {
      const baseFigure = figureMap.get(pattern.baseFigureId);
      expect(baseFigure).toBeTruthy();
      const result = validateQuestionPattern(pattern, baseFigure!);
      expect(result.ok, result.message).toBe(true);
      expect(pattern.optionAngleIds).toHaveLength(4);
      expect(pattern.id).toContain(`${pattern.baseFigureId}-`);
      expect(pattern.id.includes("-single-")).toBe(false);
      expect(pattern.id.includes("-pair-")).toBe(false);
    }
  });

  it("sanitizes invalid patterns using fallback", () => {
    const baseFigures = createBaseFigures();
    const defaults = createQuestionPatterns();
    const [first] = defaults;

    const invalid = {
      ...first,
      targetAngleId: "NOT_FOUND"
    };

    const sanitized = sanitizeQuestionPatterns([invalid], baseFigures, defaults);
    expect(sanitized.length).toBeGreaterThan(0);
    for (const pattern of sanitized) {
      const baseFigure = baseFigures.find((candidate) => candidate.id === pattern.baseFigureId);
      expect(baseFigure).toBeTruthy();
      expect(validateQuestionPattern(pattern, baseFigure!).ok).toBe(true);
    }
  });

  it("validates 180 modes with the same target/option/correct schema", () => {
    const [baseFigure] = createBaseFigures();
    const ids = baseFigure.angles.map((angleDef) => angleDef.id);

    const valid180Single = {
      id: "F1-180S-temp",
      baseFigureId: baseFigure.id,
      mode: "180-single" as const,
      targetAngleId: ids[0],
      optionAngleIds: [ids[1], ids[2], ids[3], ids[4]] as [string, string, string, string],
      correctSingleAngleId: ids[1],
      explanation: "ok",
      enabled: true
    };
    expect(validateQuestionPattern(valid180Single, baseFigure).ok).toBe(true);

    const invalid180Single = {
      ...valid180Single,
      correctSingleAngleId: ids[8]
    };
    expect(validateQuestionPattern(invalid180Single, baseFigure).ok).toBe(false);

    const valid180Pair = {
      id: "F1-180P-temp",
      baseFigureId: baseFigure.id,
      mode: "180-pair" as const,
      targetAngleId: ids[0],
      optionAngleIds: [ids[1], ids[2], ids[3], ids[4]] as [string, string, string, string],
      correctPairAngleIds: [ids[1], ids[2]] as [string, string],
      explanation: "ok",
      enabled: true
    };
    expect(validateQuestionPattern(valid180Pair, baseFigure).ok).toBe(true);

    const invalid180Pair = {
      ...valid180Pair,
      correctPairAngleIds: [ids[1], ids[8]] as [string, string]
    };
    expect(validateQuestionPattern(invalid180Pair, baseFigure).ok).toBe(false);
  });

  it("builds readable pattern ids for 180 modes", () => {
    const [baseFigure] = createBaseFigures();
    const ids = baseFigure.angles.map((angleDef) => angleDef.id);

    const singleId = buildPatternIdBySymbols(baseFigure, "180-single", ids[0], ids[1], undefined);
    const pairId = buildPatternIdBySymbols(baseFigure, "180-pair", ids[0], undefined, [ids[2], ids[3]]);

    expect(singleId).toContain(`${baseFigure.id}-180S-`);
    expect(pairId).toContain(`${baseFigure.id}-180P-`);
  });
});
