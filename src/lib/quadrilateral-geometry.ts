export type GridPoint = {
  x: number;
  y: number;
};

export type QuadrilateralPoints = [GridPoint, GridPoint, GridPoint, GridPoint];

export function addPoints(a: GridPoint, b: GridPoint): GridPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractPoints(a: GridPoint, b: GridPoint): GridPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function snapPoint(point: GridPoint): GridPoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };
}

export function parallelogramFromABD(a: GridPoint, b: GridPoint, d: GridPoint): QuadrilateralPoints {
  return [a, b, addPoints(b, subtractPoints(d, a)), d];
}

export function squareFromAB(a: GridPoint, b: GridPoint): QuadrilateralPoints {
  const side = subtractPoints(b, a);
  const perpendicular = { x: -side.y, y: side.x };
  const d = addPoints(a, perpendicular);
  return [a, b, addPoints(b, perpendicular), d];
}

export function distance(a: GridPoint, b: GridPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleAt(previous: GridPoint, vertex: GridPoint, next: GridPoint): number {
  const ax = previous.x - vertex.x;
  const ay = previous.y - vertex.y;
  const bx = next.x - vertex.x;
  const by = next.y - vertex.y;
  const dot = ax * bx + ay * by;
  const lenA = Math.hypot(ax, ay);
  const lenB = Math.hypot(bx, by);

  if (lenA === 0 || lenB === 0) {
    return 0;
  }

  const cosine = Math.max(-1, Math.min(1, dot / (lenA * lenB)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function areParallel(a1: GridPoint, a2: GridPoint, b1: GridPoint, b2: GridPoint): boolean {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;
  return Math.abs(ax * by - ay * bx) < 0.0001;
}

export function polygonArea(points: QuadrilateralPoints): number {
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

export function midpoint(a: GridPoint, b: GridPoint): GridPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

export function formatMeasure(value: number, fractionDigits = 1): string {
  const rounded = Number(value.toFixed(fractionDigits));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(fractionDigits);
}
