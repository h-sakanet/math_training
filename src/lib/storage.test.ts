import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb", () => {
  type StoreValue = Record<string, unknown>;
  type StoreMap = Map<string, StoreValue>;

  const stores = new Map<string, StoreMap>();
  const keyPaths = new Map<string, string>();

  function getStore(name: string): StoreMap {
    const existing = stores.get(name);
    if (existing) {
      return existing;
    }
    const created: StoreMap = new Map();
    stores.set(name, created);
    return created;
  }

  function getKeyPath(name: string): string {
    return keyPaths.get(name) ?? "id";
  }

  async function openDB(_name: string, _version: number, options?: {
    upgrade?: (db: {
      objectStoreNames: { contains: (storeName: string) => boolean };
      deleteObjectStore: (storeName: string) => void;
      createObjectStore: (
        storeName: string,
        params?: { keyPath?: string }
      ) => { put: (value: StoreValue) => void };
    }, oldVersion: number) => void;
  }) {
    if (options?.upgrade) {
      const upgradeDb = {
        objectStoreNames: {
          contains(storeName: string) {
            return stores.has(storeName);
          }
        },
        deleteObjectStore(storeName: string) {
          stores.delete(storeName);
          keyPaths.delete(storeName);
        },
        createObjectStore(storeName: string, params?: { keyPath?: string }) {
          getStore(storeName);
          keyPaths.set(storeName, params?.keyPath ?? "id");
          return {
            put(value: StoreValue) {
              const key = String(value[getKeyPath(storeName)]);
              getStore(storeName).set(key, value);
            }
          };
        }
      };
      options.upgrade(upgradeDb, 0);
    }

    return {
      async getAll(storeName: string) {
        return [...getStore(storeName).values()];
      },
      async get(storeName: string, key: string) {
        return getStore(storeName).get(String(key));
      },
      async put(storeName: string, value: StoreValue) {
        const key = String(value[getKeyPath(storeName)]);
        getStore(storeName).set(key, value);
      },
      async delete(storeName: string, key: string) {
        getStore(storeName).delete(String(key));
      },
      transaction(storeNames: string | string[]) {
        void storeNames;
        return {
          objectStore(storeName: string) {
            return {
              async get(key: string) {
                return getStore(storeName).get(String(key));
              },
              async put(value: StoreValue) {
                const key = String(value[getKeyPath(storeName)]);
                getStore(storeName).set(key, value);
              },
              async delete(key: string) {
                getStore(storeName).delete(String(key));
              },
              async clear() {
                getStore(storeName).clear();
              }
            };
          },
          done: Promise.resolve()
        };
      }
    };
  }

  return { openDB };
});

beforeEach(() => {
  vi.resetModules();
});

describe("storage checkpoint", () => {
  it("sets, gets and clears active checkpoint timestamp", async () => {
    const storage = await import("./storage");
    const timestamp = Date.now() - 1_000;

    expect(await storage.getActiveCheckpointStartedAt()).toBeNull();
    await storage.setActiveCheckpointStartedAt(timestamp);
    expect(await storage.getActiveCheckpointStartedAt()).toBe(Math.floor(timestamp));

    await storage.clearActiveCheckpointStartedAt();
    expect(await storage.getActiveCheckpointStartedAt()).toBeNull();
  });

  it("rejects future checkpoint timestamp", async () => {
    const storage = await import("./storage");
    const future = Date.now() + 60_000;
    await expect(storage.setActiveCheckpointStartedAt(future)).rejects.toThrow(
      "checkpoint timestamp cannot be in the future"
    );
  });
});
