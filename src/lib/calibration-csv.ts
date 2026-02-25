import type { BaseFigure, LabelPlacementMode, QuestionPattern } from "./types";

const CSV_HEADER = "format_version,exported_at,bundle_base64";
const CSV_VERSION = "2";

type CalibrationSettings = {
  globalHitRadius: number;
  labelPlacementMode: LabelPlacementMode;
};

type CalibrationBundle = {
  baseFigures: BaseFigure[];
  questionPatterns: QuestionPattern[];
  settings?: CalibrationSettings;
};

function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function decodeBase64Utf8(base64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function isPointLike(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const cast = value as { x?: unknown; y?: unknown };
  return typeof cast.x === "number" && typeof cast.y === "number";
}

function isBaseFigureLike(value: unknown): value is BaseFigure {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Partial<BaseFigure>;
  return (
    typeof maybe.id === "string" &&
    typeof maybe.family === "string" &&
    typeof maybe.stepCount === "number" &&
    typeof maybe.difficultyLevel === "number" &&
    Array.isArray(maybe.segments) &&
    Array.isArray(maybe.angles) &&
    maybe.segments.every((segment) => {
      if (!segment || typeof segment !== "object") {
        return false;
      }
      const cast = segment as { id?: unknown; start?: unknown; end?: unknown };
      return typeof cast.id === "string" && isPointLike(cast.start) && isPointLike(cast.end);
    }) &&
    maybe.angles.every((angleDef) => {
      if (!angleDef || typeof angleDef !== "object") {
        return false;
      }
      const cast = angleDef as {
        id?: unknown;
        symbol?: unknown;
        vertex?: unknown;
        rayA?: unknown;
        rayB?: unknown;
        labelNudge?: unknown;
        hitRadius?: unknown;
      };
      return (
        typeof cast.id === "string" &&
        typeof cast.symbol === "string" &&
        isPointLike(cast.vertex) &&
        isPointLike(cast.rayA) &&
        isPointLike(cast.rayB) &&
        isPointLike(cast.labelNudge) &&
        typeof cast.hitRadius === "number"
      );
    })
  );
}

function isQuestionPatternLike(value: unknown): value is QuestionPattern {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Partial<QuestionPattern>;
  return (
    typeof maybe.id === "string" &&
    typeof maybe.baseFigureId === "string" &&
    (
      maybe.mode === "single" ||
      maybe.mode === "pair" ||
      maybe.mode === "180-single" ||
      maybe.mode === "180-pair"
    ) &&
    typeof maybe.targetAngleId === "string" &&
    Array.isArray(maybe.optionAngleIds) &&
    maybe.optionAngleIds.length === 4 &&
    maybe.optionAngleIds.every((angleId) => typeof angleId === "string") &&
    typeof maybe.explanation === "string" &&
    typeof maybe.enabled === "boolean"
  );
}

function isLabelPlacementMode(value: unknown): value is LabelPlacementMode {
  return value === "free_drag";
}

function isCalibrationSettings(value: unknown): value is CalibrationSettings {
  if (!value || typeof value !== "object") {
    return false;
  }
  const cast = value as {
    globalHitRadius?: unknown;
    labelPlacementMode?: unknown;
  };
  return (
    typeof cast.globalHitRadius === "number" &&
    typeof cast.labelPlacementMode === "string"
  );
}

function isCalibrationBundle(value: unknown): value is CalibrationBundle {
  if (!value || typeof value !== "object") {
    return false;
  }
  const cast = value as {
    baseFigures?: unknown;
    questionPatterns?: unknown;
    settings?: unknown;
  };
  return (
    Array.isArray(cast.baseFigures) &&
    cast.baseFigures.every((entry) => isBaseFigureLike(entry)) &&
    Array.isArray(cast.questionPatterns) &&
    cast.questionPatterns.every((entry) => isQuestionPatternLike(entry)) &&
    (cast.settings === undefined || isCalibrationSettings(cast.settings))
  );
}

export function buildCalibrationCsv(
  baseFigures: BaseFigure[],
  questionPatterns: QuestionPattern[],
  settings: CalibrationSettings
): string {
  const bundle: CalibrationBundle = {
    baseFigures,
    questionPatterns,
    settings
  };
  const bundleBase64 = encodeBase64Utf8(JSON.stringify(bundle));
  return [CSV_HEADER, `${CSV_VERSION},${new Date().toISOString()},${bundleBase64}`].join("\n");
}

export function parseCalibrationCsv(csvText: string): CalibrationBundle {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSVにデータ行がありません");
  }

  const header = lines[0].replace(/^\uFEFF/, "");
  if (header !== CSV_HEADER) {
    throw new Error("CSVヘッダーが想定と異なります");
  }

  const [version, _exportedAt, ...payloadParts] = lines[1].split(",");
  if (version !== "1" && version !== CSV_VERSION) {
    throw new Error(`CSVバージョン ${version ?? "(empty)"} は未対応です`);
  }
  const payload = payloadParts.join(",");
  if (!payload) {
    throw new Error("CSVのpayloadが空です");
  }

  let decodedText = "";
  try {
    decodedText = decodeBase64Utf8(payload);
  } catch {
    throw new Error("CSV payloadの復号に失敗しました");
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(decodedText);
  } catch {
    throw new Error("CSV payload(JSON)の解析に失敗しました");
  }

  if (!isCalibrationBundle(parsed)) {
    throw new Error("CSV payloadの構造が不正です");
  }

  if (!parsed.settings) {
    const fallbackRadius =
      parsed.baseFigures[0]?.angles[0]?.hitRadius ?? 22;
    parsed.settings = {
      globalHitRadius: fallbackRadius,
      labelPlacementMode: "free_drag"
    };
  } else if (!isLabelPlacementMode(parsed.settings.labelPlacementMode)) {
    parsed.settings.labelPlacementMode = "free_drag";
  }

  return parsed;
}
