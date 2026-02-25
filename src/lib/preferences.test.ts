import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_PLACEMENT_MODE,
  LABEL_PLACEMENT_MODE_KEY,
  getLabelPlacementMode,
  setLabelPlacementMode
} from "./preferences";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function createStorageMock(initial: Record<string, string> = {}): StorageMock {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("preferences", () => {
  it("returns default mode when localStorage is unavailable", () => {
    (globalThis as { window?: unknown }).window = undefined;
    expect(getLabelPlacementMode()).toBe(DEFAULT_LABEL_PLACEMENT_MODE);
  });

  it("persists and reads label placement mode", () => {
    (globalThis as { window?: { localStorage: StorageMock } }).window = {
      localStorage: createStorageMock()
    };
    setLabelPlacementMode("free_drag");
    expect(getLabelPlacementMode()).toBe("free_drag");
  });

  it("falls back to default for invalid stored value", () => {
    (globalThis as { window?: { localStorage: StorageMock } }).window = {
      localStorage: createStorageMock({
        [LABEL_PLACEMENT_MODE_KEY]: "unsupported-mode"
      })
    };
    expect(getLabelPlacementMode()).toBe(DEFAULT_LABEL_PLACEMENT_MODE);
  });
});
