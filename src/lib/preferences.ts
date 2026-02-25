import type { LabelPlacementMode } from "./types";

export const LABEL_PLACEMENT_MODE_KEY = "math_training.label_placement_mode";
export const DEFAULT_LABEL_PLACEMENT_MODE: LabelPlacementMode = "free_drag";

function isLabelPlacementMode(value: unknown): value is LabelPlacementMode {
  return value === "free_drag";
}

function readStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function getLabelPlacementMode(): LabelPlacementMode {
  const storage = readStorage();
  if (!storage) {
    return DEFAULT_LABEL_PLACEMENT_MODE;
  }

  try {
    const raw = storage.getItem(LABEL_PLACEMENT_MODE_KEY);
    if (!isLabelPlacementMode(raw)) {
      return DEFAULT_LABEL_PLACEMENT_MODE;
    }
    return raw;
  } catch {
    return DEFAULT_LABEL_PLACEMENT_MODE;
  }
}

export function setLabelPlacementMode(mode: LabelPlacementMode): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LABEL_PLACEMENT_MODE_KEY, mode);
  } catch {
    // no-op
  }
}
