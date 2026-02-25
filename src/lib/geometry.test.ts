import { describe, expect, it } from "vitest";
import {
  angleLabelPoint,
  formatBaseFiguresFragment,
  transformFigure
} from "./geometry";
import { createBaseFigures } from "./templates";
import type { AngleDef, SymmetryVariant } from "./types";

function sampleAngle(): AngleDef {
  return {
    id: "A",
    symbol: "ア",
    vertex: { x: 100, y: 100 },
    rayA: { x: 180, y: 100 },
    rayB: { x: 100, y: 180 },
    labelNudge: { x: 12, y: -6 },
    hitRadius: 20
  };
}

describe("geometry", () => {
  it("computes finite label positions for all figure angles", () => {
    const baseFigures = createBaseFigures();

    for (const baseFigure of baseFigures) {
      for (const angleDef of baseFigure.angles) {
        const point = angleLabelPoint(angleDef);
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it("transforms figure coordinates across 4 symmetry variants", () => {
    const baseFigure = createBaseFigures()[0];
    const variants: SymmetryVariant[] = ["origin", "mirror_lr", "mirror_ud", "mirror_both"];

    for (const variant of variants) {
      const transformed = transformFigure(baseFigure, variant);
      expect(transformed.segments).toHaveLength(baseFigure.segments.length);
      expect(transformed.angles).toHaveLength(baseFigure.angles.length);
      for (const angleDef of transformed.angles) {
        expect(Number.isFinite(angleDef.vertex.x)).toBe(true);
        expect(Number.isFinite(angleDef.vertex.y)).toBe(true);
      }
    }
  });

  it("formats base figures as parseable JSON", () => {
    const baseFigures = createBaseFigures();
    const serialized = formatBaseFiguresFragment(baseFigures);
    const parsed = JSON.parse(serialized) as unknown[];
    expect(parsed).toHaveLength(4);
  });

  it("keeps labelNudge behavior", () => {
    const angleDef = sampleAngle();
    const labelPoint = angleLabelPoint(angleDef, 20);
    const withoutNudge = angleLabelPoint({ ...angleDef, labelNudge: { x: 0, y: 0 } }, 20);
    expect(labelPoint.x).toBeCloseTo(withoutNudge.x + angleDef.labelNudge.x);
    expect(labelPoint.y).toBeCloseTo(withoutNudge.y + angleDef.labelNudge.y);
  });
});
