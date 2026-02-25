import * as React from "react";
import { cn } from "@/lib/utils";
import { angleLabelPoint } from "@/lib/geometry";
import type { QuestionInstance } from "@/lib/types";

type AngleDiagramProps = {
  question: QuestionInstance;
  selectedAngleIds: string[];
  feedbackByAngleId?: Record<string, "correct" | "incorrect">;
  feedbackStatus?: "correct" | "incorrect" | null;
  feedbackAnchorAngleId?: string | null;
  onTapAngle: (angleId: string) => void;
  disabled?: boolean;
};

type LabelLayoutEntry = {
  id: string;
  x: number;
  y: number;
  hitRadius: number;
  vertexX: number;
  vertexY: number;
  priority: number;
};

function isHorizontalSegment(
  segment: QuestionInstance["segments"][number],
  epsilon = 0.6
): boolean {
  return (
    Math.abs(segment.start.y - segment.end.y) <= epsilon &&
    Math.abs(segment.start.x - segment.end.x) >= 24
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolveLabelLayout(entries: LabelLayoutEntry[]): Map<string, { x: number; y: number }> {
  const placed: LabelLayoutEntry[] = [];
  const byId = new Map<string, { x: number; y: number }>();

  const ordered = [...entries].sort((a, b) => a.priority - b.priority);
  for (const entry of ordered) {
    let currentX = entry.x;
    let currentY = entry.y;

    for (let i = 0; i < 8; i += 1) {
      let moved = false;
      for (const other of placed) {
        const minDistance = Math.max(12, (entry.hitRadius + other.hitRadius) * 0.82);
        const actual = distance({ x: currentX, y: currentY }, { x: other.x, y: other.y });
        if (actual >= minDistance) {
          continue;
        }

        let ux = currentX - other.x;
        let uy = currentY - other.y;
        const len = Math.hypot(ux, uy);
        if (len < 0.001) {
          ux = currentX - entry.vertexX;
          uy = currentY - entry.vertexY;
        }
        const norm = Math.hypot(ux, uy) || 1;
        const push = minDistance - actual + 1.5;
        currentX += (ux / norm) * push;
        currentY += (uy / norm) * push;
        moved = true;
      }

      currentX = clamp(currentX, 8, 312);
      currentY = clamp(currentY, 10, 212);
      if (!moved) {
        break;
      }
    }

    placed.push({
      ...entry,
      x: currentX,
      y: currentY
    });
    byId.set(entry.id, { x: currentX, y: currentY });
  }

  return byId;
}

export function AngleDiagram({
  question,
  selectedAngleIds,
  feedbackByAngleId = {},
  feedbackStatus = null,
  feedbackAnchorAngleId = null,
  onTapAngle,
  disabled = false
}: AngleDiagramProps) {
  const selectedSet = new Set(selectedAngleIds);
  const interactiveSet = new Set(question.interactiveAngleIds);
  const visibleSet = new Set([...question.interactiveAngleIds, question.targetAngleId]);
  const labelLayout = React.useMemo(() => {
    const entries: LabelLayoutEntry[] = question.angles
      .filter((angleDef) => visibleSet.has(angleDef.id))
      .map((angleDef) => {
        const point = angleLabelPoint(angleDef, 20);
        const isTarget = angleDef.id === question.targetAngleId;
        const isInteractive = interactiveSet.has(angleDef.id);
        return {
          id: angleDef.id,
          x: point.x,
          y: point.y,
          hitRadius: isInteractive ? angleDef.hitRadius : 10,
          vertexX: angleDef.vertex.x,
          vertexY: angleDef.vertex.y,
          priority: isTarget ? 0 : isInteractive ? 1 : 2
        };
      });
    return resolveLabelLayout(entries);
  }, [interactiveSet, question.angles, question.targetAngleId, visibleSet]);
  const anchorAngle = feedbackAnchorAngleId
    ? question.angles.find((angleDef) => angleDef.id === feedbackAnchorAngleId)
    : undefined;
  const anchorPoint = anchorAngle ? labelLayout.get(anchorAngle.id) ?? null : null;

  return (
    <div className="mx-auto w-full max-w-[680px] rounded-lg border bg-white p-3">
      <svg viewBox="0 0 320 220" className="h-auto w-full" role="img" aria-label="角度問題の図">
        <text
          x={160}
          y={12}
          textAnchor="middle"
          fontSize="10"
          fill="#0f172a"
          fontWeight={700}
          pointerEvents="none"
        >
          {question.prompt}
        </text>

        {question.segments.map((segment) => (
          <line
            key={segment.id}
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            stroke="#0f172a"
            strokeWidth="1.4"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        ))}

        {question.segments.filter((segment) => isHorizontalSegment(segment)).map((segment) => {
          const leftX = Math.max(4, Math.min(segment.start.x, segment.end.x) - 14);
          const markerX = leftX + 18;
          const y = (segment.start.y + segment.end.y) / 2;
          return (
            <text
              key={`${segment.id}-h-marker`}
              x={markerX}
              y={y}
              textAnchor="start"
              dominantBaseline="central"
              fontSize="8"
              fill="#475569"
              fontWeight={700}
            >
              {"〉〉"}
            </text>
          );
        })}

        {question.angles.filter((angleDef) => visibleSet.has(angleDef.id)).map((angleDef) => {
          const labelPoint = labelLayout.get(angleDef.id);
          if (!labelPoint) {
            return null;
          }
          const isTarget = angleDef.id === question.targetAngleId;
          const isSelected = selectedSet.has(angleDef.id);
          const isInteractive = interactiveSet.has(angleDef.id);
          const feedback = feedbackByAngleId[angleDef.id];

          const color =
            feedback === "correct"
              ? "#059669"
              : feedback === "incorrect"
                ? "#dc2626"
                : isTarget
                  ? "#2563eb"
                  : isSelected
                    ? "#0369a1"
                    : "#0f172a";
          const fillColor =
            feedback === "correct"
              ? "#d1fae5"
              : feedback === "incorrect"
                ? "#fee2e2"
                : "transparent";

          return (
            <g key={angleDef.id}>
              {isInteractive && (
                <circle
                  className={cn(!disabled && "cursor-pointer")}
                  cx={labelPoint.x}
                  cy={labelPoint.y}
                  r={angleDef.hitRadius}
                  fill={fillColor}
                  stroke={
                    feedback === "correct"
                      ? "#059669"
                      : feedback === "incorrect"
                        ? "#dc2626"
                        : isSelected
                          ? "#0ea5e9"
                          : "#cbd5e1"
                  }
                  strokeDasharray="2 2"
                  strokeWidth={0.8}
                  pointerEvents="all"
                  onClick={() => {
                    if (disabled) {
                      return;
                    }
                    onTapAngle(angleDef.id);
                  }}
                />
              )}

              <text
                x={labelPoint.x}
                y={labelPoint.y + 3.5}
                textAnchor="middle"
                fontSize="10"
                fill={color}
                fontWeight={700}
                className={cn(isInteractive && !disabled && "cursor-pointer")}
                onClick={() => {
                  if (!isInteractive || disabled) {
                    return;
                  }
                  onTapAngle(angleDef.id);
                }}
              >
                {angleDef.symbol}
              </text>
            </g>
          );
        })}

        {feedbackStatus && anchorPoint && (
          <text
            x={anchorPoint.x + 10}
            y={anchorPoint.y - 10}
            textAnchor="start"
            fontSize="9"
            fill={feedbackStatus === "correct" ? "#059669" : "#dc2626"}
            stroke="#ffffff"
            strokeWidth={2}
            paintOrder="stroke"
            fontWeight={700}
          >
            {feedbackStatus === "correct" ? "正解" : "不正解"}
          </text>
        )}
      </svg>
    </div>
  );
}
