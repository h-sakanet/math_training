import type {
  AngleDef,
  BaseFigure,
  LabelPlacementMode,
  Point,
  QuestionPattern,
  Segment,
  SymmetryVariant
} from "./types";

export const VIEWBOX_WIDTH = 320;
export const VIEWBOX_HEIGHT = 220;

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point, factor: number): Point {
  return { x: a.x * factor, y: a.y * factor };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function norm(a: Point): number {
  return Math.hypot(a.x, a.y);
}

export function normalize(a: Point): Point {
  const length = norm(a);
  if (length < 1e-6) {
    return { x: 1, y: 0 };
  }
  return { x: a.x / length, y: a.y / length };
}

export function bisectorDirection(angle: AngleDef): Point {
  const d1 = normalize(sub(angle.rayA, angle.vertex));
  const d2 = normalize(sub(angle.rayB, angle.vertex));
  const sum = add(d1, d2);
  if (norm(sum) < 1e-4) {
    return normalize({ x: -d1.y, y: d1.x });
  }
  return normalize(sum);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function freeDragLabelPoint(angle: AngleDef, distance: number): Point {
  const direction = bisectorDirection(angle);
  const base = add(angle.vertex, scale(direction, distance));
  return add(base, angle.labelNudge);
}

function tangentTouchLabelPoint(angle: AngleDef, fallbackDistance: number): Point {
  const rayAVector = sub(angle.rayA, angle.vertex);
  const rayBVector = sub(angle.rayB, angle.vertex);
  if (norm(rayAVector) < 1e-6 || norm(rayBVector) < 1e-6) {
    return freeDragLabelPoint(angle, fallbackDistance);
  }

  const u = normalize(rayAVector);
  const v = normalize(rayBVector);
  const theta = Math.acos(clamp(dot(u, v), -1, 1));
  const sinHalf = Math.sin(theta / 2);
  if (Math.abs(sinHalf) < 1e-4) {
    return freeDragLabelPoint(angle, fallbackDistance);
  }

  const direction = bisectorDirection(angle);
  const distanceFromVertex = angle.hitRadius / sinHalf;
  if (!Number.isFinite(distanceFromVertex)) {
    return freeDragLabelPoint(angle, fallbackDistance);
  }
  return add(angle.vertex, scale(direction, distanceFromVertex));
}

type AngleLabelPointOptions = {
  mode?: LabelPlacementMode;
  distance?: number;
};

export function angleLabelPoint(
  angle: AngleDef,
  optionsOrDistance: AngleLabelPointOptions | number = 22
): Point {
  const options =
    typeof optionsOrDistance === "number"
      ? ({ distance: optionsOrDistance } satisfies AngleLabelPointOptions)
      : optionsOrDistance;
  const mode: LabelPlacementMode = options.mode ?? "free_drag";
  const distance = options.distance ?? 22;

  if (mode === "tangent_touch") {
    return tangentTouchLabelPoint(angle, distance);
  }
  return freeDragLabelPoint(angle, distance);
}

export function movePoint(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy };
}

export function pointsAlmostEqual(a: Point, b: Point, epsilon = 0.001): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

export function transformPoint(point: Point, variant: SymmetryVariant): Point {
  switch (variant) {
    case "mirror_lr":
      return { x: VIEWBOX_WIDTH - point.x, y: point.y };
    case "mirror_ud":
      return { x: point.x, y: VIEWBOX_HEIGHT - point.y };
    case "mirror_both":
      return { x: VIEWBOX_WIDTH - point.x, y: VIEWBOX_HEIGHT - point.y };
    default:
      return { ...point };
  }
}

export function transformNudge(nudge: Point, variant: SymmetryVariant): Point {
  switch (variant) {
    case "mirror_lr":
      return { x: -nudge.x, y: nudge.y };
    case "mirror_ud":
      return { x: nudge.x, y: -nudge.y };
    case "mirror_both":
      return { x: -nudge.x, y: -nudge.y };
    default:
      return { ...nudge };
  }
}

export function transformSegment(segment: Segment, variant: SymmetryVariant): Segment {
  return {
    ...segment,
    start: transformPoint(segment.start, variant),
    end: transformPoint(segment.end, variant)
  };
}

export function transformAngle(angleDef: AngleDef, variant: SymmetryVariant): AngleDef {
  return {
    ...angleDef,
    vertex: transformPoint(angleDef.vertex, variant),
    rayA: transformPoint(angleDef.rayA, variant),
    rayB: transformPoint(angleDef.rayB, variant),
    labelNudge: transformNudge(angleDef.labelNudge, variant)
  };
}

export function transformFigure(baseFigure: BaseFigure, variant: SymmetryVariant): BaseFigure {
  return {
    ...baseFigure,
    segments: baseFigure.segments.map((segment) => transformSegment(segment, variant)),
    angles: baseFigure.angles.map((angleDef) => transformAngle(angleDef, variant))
  };
}

export function formatBaseFigureFragment(baseFigure: BaseFigure): string {
  return JSON.stringify(baseFigure, null, 2);
}

export function formatBaseFiguresFragment(baseFigures: BaseFigure[]): string {
  return JSON.stringify(baseFigures, null, 2);
}

export function formatQuestionPatternsFragment(patterns: QuestionPattern[]): string {
  return JSON.stringify(patterns, null, 2);
}

export function formatCalibrationBundle(
  baseFigures: BaseFigure[],
  patterns: QuestionPattern[]
): string {
  return JSON.stringify({ baseFigures, questionPatterns: patterns }, null, 2);
}
