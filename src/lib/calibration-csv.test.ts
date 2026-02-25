import { describe, expect, it } from "vitest";
import { buildCalibrationCsv, parseCalibrationCsv } from "./calibration-csv";
import { createBaseFigures, createQuestionPatterns } from "./templates";

describe("calibration csv", () => {
  it("round-trips base figures and question patterns", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();

    const csv = buildCalibrationCsv(baseFigures, patterns, {
      globalHitRadius: 26,
      labelPlacementMode: "free_drag"
    });
    const parsed = parseCalibrationCsv(csv);

    expect(parsed.baseFigures).toEqual(baseFigures);
    expect(parsed.questionPatterns).toEqual(patterns);
    expect(parsed.settings).toEqual({
      globalHitRadius: 26,
      labelPlacementMode: "free_drag"
    });
  });

  it("throws on invalid header", () => {
    expect(() => parseCalibrationCsv("bad,header\n1,2026-01-01T00:00:00.000Z,abcd")).toThrow();
  });

  it("throws on invalid payload", () => {
    const invalidCsv = "format_version,exported_at,bundle_base64\n2,2026-01-01T00:00:00.000Z,%%%";
    expect(() => parseCalibrationCsv(invalidCsv)).toThrow();
  });

  it("keeps backward compatibility with version 1 payload", () => {
    const baseFigures = createBaseFigures();
    const patterns = createQuestionPatterns();
    const payload = Buffer.from(
      JSON.stringify({
        baseFigures,
        questionPatterns: patterns
      }),
      "utf8"
    ).toString("base64");
    const csv = `format_version,exported_at,bundle_base64\n1,2026-01-01T00:00:00.000Z,${payload}`;

    const parsed = parseCalibrationCsv(csv);
    expect(parsed.baseFigures).toEqual(baseFigures);
    expect(parsed.questionPatterns).toEqual(patterns);
    expect(parsed.settings?.labelPlacementMode).toBe("tangent_touch");
  });
});
