import * as React from "react";
import { ArrowCounterClockwise, ArrowLeft, HandPointing } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  angleAt,
  distance,
  formatMeasure,
  midpoint,
  parallelogramFromABD,
  polygonArea,
  snapPoint,
  squareFromAB,
  subtractPoints,
  type GridPoint,
  type QuadrilateralPoints
} from "@/lib/quadrilateral-geometry";
import { cn } from "@/lib/utils";

type QuadrilateralObserverScreenProps = {
  onBackHome: () => void;
};

type DragTarget = "move" | "a" | "b" | "c" | "d";
type ShapeTab = "正方形" | "長方形" | "ひし形" | "平行四辺形" | "台形";

type DragState = {
  target: DragTarget;
  pointerId: number;
  startPoint: GridPoint;
  startPoints: QuadrilateralPoints;
};

const GRID_WIDTH = 16;
const GRID_HEIGHT = 10;
const CELL = 32;
const MARGIN = 30;
const SVG_WIDTH = GRID_WIDTH * CELL + MARGIN * 2;
const SVG_HEIGHT = GRID_HEIGHT * CELL + MARGIN * 2;
const PARALLEL_PAIR_PRIMARY = "#f97316";
const PARALLEL_PAIR_SECONDARY = "#16a34a";
const SIDE_NEUTRAL = "#0284c7";
const RIGHT_ANGLE_COLOR = PARALLEL_PAIR_PRIMARY;

const DEFAULT_SQUARE_POINTS = squareFromAB(
  { x: 5, y: 2 },
  { x: 11, y: 2 }
);
const DEFAULT_RECTANGLE_POINTS: QuadrilateralPoints = [
  { x: 4, y: 2 },
  { x: 13, y: 2 },
  { x: 13, y: 8 },
  { x: 4, y: 8 }
];
const DEFAULT_RHOMBUS_POINTS: QuadrilateralPoints = [
  { x: 4, y: 5 },
  { x: 8, y: 2 },
  { x: 12, y: 5 },
  { x: 8, y: 8 }
];
const DEFAULT_TRAPEZOID_POINTS: QuadrilateralPoints = [
  { x: 5, y: 2 },
  { x: 11, y: 2 },
  { x: 13, y: 8 },
  { x: 3, y: 8 }
];
const DEFAULT_PARALLELOGRAM_POINTS = parallelogramFromABD(
  { x: 4, y: 3 },
  { x: 12, y: 3 },
  { x: 2, y: 9 }
);

const tabs = [
  "正方形",
  "長方形",
  "ひし形",
  "平行四辺形",
  "台形"
] as const;

const vertexLabels = ["A", "B", "C", "D"] as const;

function defaultPointsFor(tab: ShapeTab): QuadrilateralPoints {
  if (tab === "正方形") {
    return DEFAULT_SQUARE_POINTS;
  }
  if (tab === "長方形") {
    return DEFAULT_RECTANGLE_POINTS;
  }
  if (tab === "ひし形") {
    return DEFAULT_RHOMBUS_POINTS;
  }
  if (tab === "台形") {
    return DEFAULT_TRAPEZOID_POINTS;
  }
  return DEFAULT_PARALLELOGRAM_POINTS;
}

function toSvg(point: GridPoint): GridPoint {
  return {
    x: MARGIN + point.x * CELL,
    y: MARGIN + point.y * CELL
  };
}

function fromSvg(point: GridPoint): GridPoint {
  return {
    x: (point.x - MARGIN) / CELL,
    y: (point.y - MARGIN) / CELL
  };
}

function clampPoint(point: GridPoint): GridPoint {
  return {
    x: Math.max(0, Math.min(GRID_WIDTH, point.x)),
    y: Math.max(0, Math.min(GRID_HEIGHT, point.y))
  };
}

function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function pointInBounds(point: GridPoint): boolean {
  return point.x >= 0 && point.x <= GRID_WIDTH && point.y >= 0 && point.y <= GRID_HEIGHT;
}

function isUsableParallelogram(points: QuadrilateralPoints): boolean {
  const [a, b, c, d] = points;
  const sideLengths = [
    distance(a, b),
    distance(b, c),
    distance(c, d),
    distance(d, a)
  ];
  return (
    points.every(pointInBounds) &&
    sideLengths.every((sideLength) => sideLength >= 2) &&
    polygonArea(points) >= 6 &&
    !samePoint(a, b) &&
    !samePoint(b, c) &&
    !samePoint(c, d) &&
    !samePoint(d, a)
  );
}

function nextParallelogram(
  target: DragTarget,
  current: GridPoint,
  drag: DragState
): QuadrilateralPoints {
  const [a, b, c, d] = drag.startPoints;
  const delta = subtractPoints(current, drag.startPoint);

  if (target === "move" || target === "a") {
    return [a, b, c, d].map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y
    })) as QuadrilateralPoints;
  }

  if (target === "b") {
    return parallelogramFromABD(a, current, d);
  }

  if (target === "d") {
    return parallelogramFromABD(a, b, current);
  }

  const fixedSide = subtractPoints(d, a);
  const nextB = {
    x: current.x - fixedSide.x,
    y: current.y - fixedSide.y
  };
  return parallelogramFromABD(a, nextB, d);
}

function nextSquare(
  target: DragTarget,
  current: GridPoint,
  drag: DragState
): QuadrilateralPoints {
  const [a, b, c, d] = drag.startPoints;
  const delta = subtractPoints(current, drag.startPoint);

  if (target === "move" || target === "a") {
    return [a, b, c, d].map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y
    })) as QuadrilateralPoints;
  }

  if (target === "b") {
    return squareFromAB(a, current);
  }

  if (target === "d") {
    const sideFromD = subtractPoints(current, a);
    return squareFromAB(a, {
      x: a.x + sideFromD.y,
      y: a.y - sideFromD.x
    });
  }

  const diagonal = subtractPoints(current, a);
  return squareFromAB(a, snapPoint({
    x: a.x + (diagonal.x + diagonal.y) / 2,
    y: a.y + (diagonal.y - diagonal.x) / 2
  }));
}

function rectangleFromCorners(a: GridPoint, c: GridPoint): QuadrilateralPoints {
  return [
    a,
    { x: c.x, y: a.y },
    c,
    { x: a.x, y: c.y }
  ];
}

function nextRectangle(
  target: DragTarget,
  current: GridPoint,
  drag: DragState
): QuadrilateralPoints {
  const [a, b, c, d] = drag.startPoints;
  const delta = subtractPoints(current, drag.startPoint);

  if (target === "move" || target === "a") {
    return [a, b, c, d].map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y
    })) as QuadrilateralPoints;
  }

  if (target === "b") {
    return rectangleFromCorners(a, { x: current.x, y: c.y });
  }

  if (target === "d") {
    return rectangleFromCorners(a, { x: c.x, y: current.y });
  }

  return rectangleFromCorners(a, current);
}

function rhombusFromCenter(center: GridPoint, halfWidth: number, halfHeight: number): QuadrilateralPoints {
  return [
    { x: center.x - halfWidth, y: center.y },
    { x: center.x, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y },
    { x: center.x, y: center.y + halfHeight }
  ];
}

function nextRhombus(
  target: DragTarget,
  current: GridPoint,
  drag: DragState
): QuadrilateralPoints {
  const [a, b, c, d] = drag.startPoints;
  const delta = subtractPoints(current, drag.startPoint);

  if (target === "move") {
    return [a, b, c, d].map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y
    })) as QuadrilateralPoints;
  }

  const center = midpoint(a, c);
  const currentHalfWidth = Math.abs(c.x - a.x) / 2;
  const currentHalfHeight = Math.abs(d.y - b.y) / 2;
  const maxHalfWidth = Math.min(center.x, GRID_WIDTH - center.x);
  const maxHalfHeight = Math.min(center.y, GRID_HEIGHT - center.y);

  if (target === "a" || target === "c") {
    const nextHalfWidth = Math.max(2, Math.min(maxHalfWidth, Math.round(Math.abs(current.x - center.x))));
    return rhombusFromCenter(center, nextHalfWidth, currentHalfHeight);
  }

  const nextHalfHeight = Math.max(2, Math.min(maxHalfHeight, Math.round(Math.abs(current.y - center.y))));
  return rhombusFromCenter(center, currentHalfWidth, nextHalfHeight);
}

function nextTrapezoid(
  target: DragTarget,
  current: GridPoint,
  drag: DragState
): QuadrilateralPoints {
  const [a, b, c, d] = drag.startPoints;
  const delta = subtractPoints(current, drag.startPoint);

  if (target === "move" || target === "a") {
    return [a, b, c, d].map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y
    })) as QuadrilateralPoints;
  }

  if (target === "b") {
    return [a, { x: current.x, y: a.y }, c, d];
  }

  if (target === "c") {
    return [a, b, { x: current.x, y: d.y }, d];
  }

  return [a, b, c, { x: current.x, y: c.y }];
}

function nextShapePoints(
  tab: ShapeTab,
  target: DragTarget,
  current: GridPoint,
  drag: DragState
): QuadrilateralPoints {
  if (tab === "正方形") {
    return nextSquare(target, current, drag);
  }
  if (tab === "長方形") {
    return nextRectangle(target, current, drag);
  }
  if (tab === "ひし形") {
    return nextRhombus(target, current, drag);
  }
  if (tab === "台形") {
    return nextTrapezoid(target, current, drag);
  }
  return nextParallelogram(target, current, drag);
}

function svgPath(points: QuadrilateralPoints): string {
  return points.map((point) => {
    const svgPoint = toSvg(point);
    return `${svgPoint.x},${svgPoint.y}`;
  }).join(" ");
}

function segmentLabelPoint(a: GridPoint, b: GridPoint, offsetY = -8): GridPoint {
  const start = toSvg(a);
  const end = toSvg(b);
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 + offsetY
  };
}

function diagonalLabelPoint(a: GridPoint, b: GridPoint, offset: number): GridPoint {
  const start = toSvg(a);
  const end = toSvg(b);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const normalX = length === 0 ? 0 : -dy / length;
  const normalY = length === 0 ? 0 : dx / length;

  return {
    x: (start.x + end.x) / 2 + normalX * offset,
    y: (start.y + end.y) / 2 + normalY * offset
  };
}

function diagonalIntersection(a: GridPoint, b: GridPoint, c: GridPoint, d: GridPoint): GridPoint {
  const denominator = (a.x - c.x) * (b.y - d.y) - (a.y - c.y) * (b.x - d.x);
  if (Math.abs(denominator) < 0.0001) {
    return midpoint(a, c);
  }

  const acCross = a.x * c.y - a.y * c.x;
  const bdCross = b.x * d.y - b.y * d.x;
  return {
    x: (acCross * (b.x - d.x) - (a.x - c.x) * bdCross) / denominator,
    y: (acCross * (b.y - d.y) - (a.y - c.y) * bdCross) / denominator
  };
}

function angleLabelPoint(previous: GridPoint, vertex: GridPoint, next: GridPoint): GridPoint {
  const vertexSvg = toSvg(vertex);
  const previousVector = subtractPoints(toSvg(previous), vertexSvg);
  const nextVector = subtractPoints(toSvg(next), vertexSvg);
  const previousLength = Math.hypot(previousVector.x, previousVector.y) || 1;
  const nextLength = Math.hypot(nextVector.x, nextVector.y) || 1;
  const bisector = {
    x: previousVector.x / previousLength + nextVector.x / nextLength,
    y: previousVector.y / previousLength + nextVector.y / nextLength
  };
  const bisectorLength = Math.hypot(bisector.x, bisector.y) || 1;

  return {
    x: vertexSvg.x + (bisector.x / bisectorLength) * 38,
    y: vertexSvg.y + (bisector.y / bisectorLength) * 38
  };
}

function centerAngleLabelPoint(previous: GridPoint, center: GridPoint, next: GridPoint): GridPoint {
  const centerSvg = toSvg(center);
  const previousVector = subtractPoints(toSvg(previous), centerSvg);
  const nextVector = subtractPoints(toSvg(next), centerSvg);
  const previousLength = Math.hypot(previousVector.x, previousVector.y) || 1;
  const nextLength = Math.hypot(nextVector.x, nextVector.y) || 1;
  let bisector = {
    x: previousVector.x / previousLength + nextVector.x / nextLength,
    y: previousVector.y / previousLength + nextVector.y / nextLength
  };

  if (Math.hypot(bisector.x, bisector.y) < 0.001) {
    bisector = {
      x: previousVector.y / previousLength,
      y: -previousVector.x / previousLength
    };
  }

  const bisectorLength = Math.hypot(bisector.x, bisector.y) || 1;
  return {
    x: centerSvg.x + (bisector.x / bisectorLength) * 31,
    y: centerSvg.y + (bisector.y / bisectorLength) * 31
  };
}

function formatCm(value: number): string {
  return `${formatMeasure(value)}cm`;
}

function formatDegree(value: number): string {
  return `${formatMeasure(value, 0)}°`;
}

function fixedConditionFor(tab: ShapeTab): string {
  switch (tab) {
    case "正方形":
      return "すべての角が直角ですべての辺の長さが等しい";
    case "長方形":
      return "すべての角が直角";
    case "ひし形":
      return "すべての辺の長さが等しい";
    case "平行四辺形":
      return "向かい合う2組の辺が平行";
    case "台形":
      return "向かい合う1組の辺が平行";
  }
}

export function QuadrilateralObserverScreen({ onBackHome }: QuadrilateralObserverScreenProps) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [activeTab, setActiveTab] = React.useState<ShapeTab>("正方形");
  const [points, setPoints] = React.useState<QuadrilateralPoints>(DEFAULT_SQUARE_POINTS);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const isSquare = activeTab === "正方形";
  const isRectangle = activeTab === "長方形";
  const isRhombus = activeTab === "ひし形";
  const isTrapezoid = activeTab === "台形";
  const horizontalSideColor = isRectangle ? SIDE_NEUTRAL : PARALLEL_PAIR_PRIMARY;
  const verticalSideColor = isSquare || isRhombus
    ? PARALLEL_PAIR_PRIMARY
    : isRectangle || isTrapezoid
      ? SIDE_NEUTRAL
      : PARALLEL_PAIR_SECONDARY;

  const [a, b, c, d] = points;
  const sideLengths = [
    distance(a, b),
    distance(b, c),
    distance(c, d),
    distance(d, a)
  ];
  const angles = [
    angleAt(d, a, b),
    angleAt(a, b, c),
    angleAt(b, c, d),
    angleAt(c, d, a)
  ];
  const diagonals = {
    ac: distance(a, c),
    bd: distance(b, d),
    center: diagonalIntersection(a, b, c, d),
    aToCenter: distance(a, diagonalIntersection(a, b, c, d)),
    cToCenter: distance(c, diagonalIntersection(a, b, c, d)),
    bToCenter: distance(b, diagonalIntersection(a, b, c, d)),
    dToCenter: distance(d, diagonalIntersection(a, b, c, d))
  };
  const centerAngles = [
    angleAt(a, diagonals.center, b),
    angleAt(b, diagonals.center, c),
    angleAt(c, diagonals.center, d),
    angleAt(d, diagonals.center, a)
  ];

  function svgPointFromEvent(event: React.PointerEvent<SVGElement>): GridPoint {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }
    const rect = svg.getBoundingClientRect();
    return fromSvg({
      x: ((event.clientX - rect.left) / rect.width) * SVG_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SVG_HEIGHT
    });
  }

  function startDrag(target: DragTarget, event: React.PointerEvent<SVGElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      target,
      pointerId: event.pointerId,
      startPoint: snapPoint(clampPoint(svgPointFromEvent(event))),
      startPoints: points
    });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const current = snapPoint(clampPoint(svgPointFromEvent(event)));
    const next = nextShapePoints(activeTab, drag.target, current, drag);
    if (isUsableParallelogram(next)) {
      setPoints(next);
    }
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (drag && event.pointerId === drag.pointerId) {
      setDrag(null);
    }
  }

  return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const nextTab = value as ShapeTab;
            if (nextTab !== "正方形" && nextTab !== "長方形" && nextTab !== "ひし形" && nextTab !== "平行四辺形" && nextTab !== "台形") {
              return;
            }
            setActiveTab(nextTab);
            setPoints(defaultPointsFor(nextTab));
            setDrag(null);
          }}
          className="min-w-0"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-white/80 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                disabled={tab !== "正方形" && tab !== "長方形" && tab !== "ひし形" && tab !== "平行四辺形" && tab !== "台形"}
                className={cn(tab !== "正方形" && tab !== "長方形" && tab !== "ひし形" && tab !== "平行四辺形" && tab !== "台形" && "opacity-45")}
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" onClick={onBackHome}>
          <ArrowLeft size={18} />
          ホーム
        </Button>
      </div>

      <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <HandPointing size={16} />
                点B・点C・点Dを動かすと形が変わります。図形本体を動かすと平行移動します。
              </p>
            </div>
            <Button variant="outline" onClick={() => setPoints(defaultPointsFor(activeTab))}>
              <ArrowCounterClockwise size={18} />
              標準に戻す
            </Button>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_220px] md:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="h-auto w-full touch-none rounded-md border bg-white"
              role="img"
              aria-label="平行四辺形の観察図"
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
            >
              <defs>
                <pattern id="quad-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                  <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="#dbeafe" strokeWidth="1" />
                </pattern>
              </defs>
              <rect x={MARGIN} y={MARGIN} width={GRID_WIDTH * CELL} height={GRID_HEIGHT * CELL} fill="url(#quad-grid)" />
              <rect x={MARGIN} y={MARGIN} width={GRID_WIDTH * CELL} height={GRID_HEIGHT * CELL} fill="none" stroke="#bfdbfe" />

              <polygon
                points={svgPath(points)}
                fill="#e0f2fe"
                stroke="transparent"
                strokeWidth="18"
                strokeLinejoin="round"
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(event) => startDrag("move", event)}
              />

              <line x1={toSvg(a).x} y1={toSvg(a).y} x2={toSvg(b).x} y2={toSvg(b).y} stroke={horizontalSideColor} strokeWidth="7" strokeLinecap="round" />
              <line x1={toSvg(d).x} y1={toSvg(d).y} x2={toSvg(c).x} y2={toSvg(c).y} stroke={horizontalSideColor} strokeWidth="7" strokeLinecap="round" />
              <line x1={toSvg(b).x} y1={toSvg(b).y} x2={toSvg(c).x} y2={toSvg(c).y} stroke={verticalSideColor} strokeWidth="7" strokeLinecap="round" />
              <line x1={toSvg(a).x} y1={toSvg(a).y} x2={toSvg(d).x} y2={toSvg(d).y} stroke={verticalSideColor} strokeWidth="7" strokeLinecap="round" />

              <line
                x1={toSvg(a).x}
                y1={toSvg(a).y}
                x2={toSvg(c).x}
                y2={toSvg(c).y}
                stroke="#475569"
                strokeWidth="1.6"
                strokeDasharray="7 6"
                strokeLinecap="round"
                pointerEvents="none"
              />
              <line
                x1={toSvg(b).x}
                y1={toSvg(b).y}
                x2={toSvg(d).x}
                y2={toSvg(d).y}
                stroke="#475569"
                strokeWidth="1.6"
                strokeDasharray="7 6"
                strokeLinecap="round"
                pointerEvents="none"
              />

              <circle cx={toSvg(diagonals.center).x} cy={toSvg(diagonals.center).y} r="7" fill="#475569" />

              {[
                {
                  key: "a-center",
                  point: diagonalLabelPoint(a, diagonals.center, 11),
                  label: formatCm(diagonals.aToCenter)
                },
                {
                  key: "c-center",
                  point: diagonalLabelPoint(c, diagonals.center, 11),
                  label: formatCm(diagonals.cToCenter)
                },
                {
                  key: "b-center",
                  point: diagonalLabelPoint(b, diagonals.center, -11),
                  label: formatCm(diagonals.bToCenter)
                },
                {
                  key: "d-center",
                  point: diagonalLabelPoint(d, diagonals.center, -11),
                  label: formatCm(diagonals.dToCenter)
                }
              ].map(({ key, point, label }) => (
                <g key={key} pointerEvents="none">
                  <text
                    x={point.x}
                    y={point.y + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="500"
                    fill="#334155"
                    stroke="#ffffff"
                    strokeWidth="4"
                    paintOrder="stroke"
                    strokeLinejoin="round"
                  >
                    {label}
                  </text>
                </g>
              ))}

              {[
                {
                  key: "center-angle-ab",
                  point: centerAngleLabelPoint(a, diagonals.center, b),
                  label: formatDegree(centerAngles[0])
                },
                {
                  key: "center-angle-bc",
                  point: centerAngleLabelPoint(b, diagonals.center, c),
                  label: formatDegree(centerAngles[1])
                },
                {
                  key: "center-angle-cd",
                  point: centerAngleLabelPoint(c, diagonals.center, d),
                  label: formatDegree(centerAngles[2])
                },
                {
                  key: "center-angle-da",
                  point: centerAngleLabelPoint(d, diagonals.center, a),
                  label: formatDegree(centerAngles[3])
                }
              ].map(({ key, point, label }) => (
                <text
                  key={key}
                  x={point.x}
                  y={point.y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="500"
                  fill="#475569"
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  pointerEvents="none"
                >
                  {label}
                </text>
              ))}

              {[
                { key: "angle-a", point: angleLabelPoint(d, a, b), label: formatDegree(angles[0]) },
                { key: "angle-b", point: angleLabelPoint(a, b, c), label: formatDegree(angles[1]) },
                { key: "angle-c", point: angleLabelPoint(b, c, d), label: formatDegree(angles[2]) },
                { key: "angle-d", point: angleLabelPoint(c, d, a), label: formatDegree(angles[3]) }
              ].map(({ key, point, label }) => (
                <text
                  key={key}
                  x={point.x}
                  y={point.y + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="800"
                  fill={isSquare || isRectangle ? RIGHT_ANGLE_COLOR : "#0f172a"}
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  pointerEvents="none"
                >
                  {label}
                </text>
              ))}

              {points.map((point, index) => {
                const svgPoint = toSvg(point);
                const target = vertexLabels[index].toLowerCase() as DragTarget;
                return (
                  <g key={vertexLabels[index]}>
                    <circle
                      cx={svgPoint.x}
                      cy={svgPoint.y}
                      r="15"
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth="3"
                      className="cursor-pointer"
                      onPointerDown={(event) => startDrag(target, event)}
                    />
                    <text
                      x={svgPoint.x}
                      y={svgPoint.y + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="800"
                      fill="#0f172a"
                      pointerEvents="none"
                    >
                      {vertexLabels[index]}
                    </text>
                  </g>
                );
              })}

                <text
                  {...segmentLabelPoint(a, b)}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={horizontalSideColor}
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                  strokeLinejoin="round"
              >
                AB {formatCm(sideLengths[0])}
              </text>
                <text
                  {...segmentLabelPoint(c, d, 18)}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={horizontalSideColor}
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                  strokeLinejoin="round"
              >
                CD {formatCm(sideLengths[2])}
              </text>
                <text
                  {...segmentLabelPoint(b, c)}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={verticalSideColor}
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                  strokeLinejoin="round"
              >
                BC {formatCm(sideLengths[1])}
              </text>
                <text
                  {...segmentLabelPoint(d, a)}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={verticalSideColor}
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                  strokeLinejoin="round"
              >
                DA {formatCm(sideLengths[3])}
              </text>
            </svg>
              </div>
              <aside className="rounded-md border bg-white/70 p-4 lg:p-5">
                <h2 className="text-lg font-semibold text-slate-950">{activeTab}の性質</h2>
                <div className="mt-5 space-y-6 text-sm">
              <div>
                <h3 className="mb-3 font-semibold text-slate-950">固定される条件</h3>
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3 leading-6 text-orange-950">
                  {fixedConditionFor(activeTab)}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-semibold text-slate-950">観察できること</h3>
                <div className="space-y-2 leading-6 text-slate-700">
                  {isSquare ? (
                    <>
                      <p>向かい合う辺は平行。</p>
                      <p>対角線の長さは等しい。</p>
                      <p>対角線は垂直に交わる。</p>
                      <p>対角線は、交わる点でそれぞれ半分になる。</p>
                    </>
                  ) : isRectangle ? (
                    <>
                      <p>向かい合う辺の長さは等しい。</p>
                      <p>向かい合う辺は平行。</p>
                      <p>対角線の長さは等しい。</p>
                      <p>対角線は、交わる点でそれぞれ半分になる。</p>
                    </>
                  ) : isRhombus ? (
                    <>
                      <p>向かい合う角の大きさは等しい。</p>
                      <p>向かい合う辺は平行。</p>
                      <p>対角線は垂直に交わる。</p>
                      <p>対角線は、交わる点でそれぞれ半分になる。</p>
                    </>
                  ) : isTrapezoid ? (
                    <>
                      <p>AB と DC は平行。</p>
                      <p>左右の辺の長さや角度は自由に変わる。</p>
                      <p>対角線は、交わる点で半分になるとは限らない。</p>
                    </>
                  ) : (
                    <>
                      <p>向かい合う辺の長さは等しい。</p>
                      <p>向かい合う角の大きさは等しい。</p>
                      <p>対角線は、交わる点でそれぞれ半分になる。</p>
                    </>
                  )}
                </div>
              </div>
                </div>
              </aside>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
