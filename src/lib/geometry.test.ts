import { describe, expect, it } from "vitest";
import {
  angleLabelPoint,
  dot,
  formatBaseFiguresFragment,
  normalize,
  sub,
  transformFigure
} from "./geometry";
import { createBaseFigures } from "./templates";
import type { AngleDef, SymmetryVariant } from "./types";

function pointLineDistance(point: { x: number; y: number }, lineA: { x: number; y: number }, lineB: { x: number; y: number }): number {
  const ab = sub(lineB, lineA);
  const ap = sub(point, lineA);
  const area2 = Math.abs(ab.x * ap.y - ab.y * ap.x);
  const length = Math.hypot(ab.x, ab.y);
  return area2 / length;
}

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

  it("places label on tangency for both rays in tangent_touch mode", () => {
    const angleDef = sampleAngle();
    const labelPoint = angleLabelPoint(angleDef, { mode: "tangent_touch" });

    const d1 = pointLineDistance(labelPoint, angleDef.vertex, angleDef.rayA);
    const d2 = pointLineDistance(labelPoint, angleDef.vertex, angleDef.rayB);
    expect(Math.abs(d1 - angleDef.hitRadius)).toBeLessThan(1e-6);
    expect(Math.abs(d2 - angleDef.hitRadius)).toBeLessThan(1e-6);

    const rayDirA = normalize(sub(angleDef.rayA, angleDef.vertex));
    const towardLabel = normalize(sub(labelPoint, angleDef.vertex));
    expect(dot(rayDirA, towardLabel)).toBeGreaterThan(0);
  });

  it("falls back safely for degenerate angles in tangent_touch mode", () => {
    const degenerate: AngleDef = {
      ...sampleAngle(),
      rayB: { x: 100.0000001, y: 100.0000001 }
    };
    const labelPoint = angleLabelPoint(degenerate, { mode: "tangent_touch", distance: 20 });
    expect(Number.isFinite(labelPoint.x)).toBe(true);
    expect(Number.isFinite(labelPoint.y)).toBe(true);
  });

  it("keeps legacy free_drag behavior with labelNudge", () => {
    const angleDef = sampleAngle();
    const labelPoint = angleLabelPoint(angleDef, { mode: "free_drag", distance: 20 });
    const withoutNudge = angleLabelPoint({ ...angleDef, labelNudge: { x: 0, y: 0 } }, { mode: "free_drag", distance: 20 });
    expect(labelPoint.x).toBeCloseTo(withoutNudge.x + angleDef.labelNudge.x);
    expect(labelPoint.y).toBeCloseTo(withoutNudge.y + angleDef.labelNudge.y);
  });
});
