import { describe, expect, it } from "vitest";
import {
  angleAt,
  areParallel,
  distance,
  midpoint,
  parallelogramFromABD,
  squareFromAB
} from "@/lib/quadrilateral-geometry";

describe("quadrilateral geometry", () => {
  it("builds a parallelogram from three points", () => {
    const points = parallelogramFromABD({ x: 4, y: 4 }, { x: 12, y: 4 }, { x: 2, y: 10 });

    expect(points).toEqual([
      { x: 4, y: 4 },
      { x: 12, y: 4 },
      { x: 10, y: 10 },
      { x: 2, y: 10 }
    ]);
    expect(areParallel(points[0], points[1], points[3], points[2])).toBe(true);
    expect(areParallel(points[1], points[2], points[0], points[3])).toBe(true);
  });

  it("measures sides, angles, and diagonal midpoint properties", () => {
    const [a, b, c, d] = parallelogramFromABD({ x: 4, y: 4 }, { x: 12, y: 4 }, { x: 2, y: 10 });

    expect(distance(a, b)).toBe(8);
    expect(distance(b, c)).toBeCloseTo(Math.sqrt(40));
    expect(angleAt(d, a, b)).toBeCloseTo(108.435, 3);
    expect(midpoint(a, c)).toEqual(midpoint(b, d));
  });

  it("builds a square from one side", () => {
    const [a, b, c, d] = squareFromAB({ x: 5, y: 2 }, { x: 11, y: 2 });

    expect([a, b, c, d]).toEqual([
      { x: 5, y: 2 },
      { x: 11, y: 2 },
      { x: 11, y: 8 },
      { x: 5, y: 8 }
    ]);
    expect(distance(a, b)).toBe(6);
    expect(distance(b, c)).toBe(6);
    expect(distance(c, d)).toBe(6);
    expect(distance(d, a)).toBe(6);
    expect(angleAt(d, a, b)).toBeCloseTo(90);
    expect(distance(a, c)).toBeCloseTo(distance(b, d));
  });
});
