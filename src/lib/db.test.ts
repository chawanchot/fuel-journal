import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  transaction: vi.fn(),
  open: vi.fn(),
}));

vi.mock("idb", () => ({ openDB: mock.open }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mock.get.mockResolvedValue(undefined);
  mock.put.mockResolvedValue("current");
  mock.transaction.mockImplementation(() => ({
    store: { put: mock.put },
    done: Promise.resolve(),
  }));
  mock.open.mockResolvedValue({ get: mock.get, transaction: mock.transaction });
});

describe("snapshot persistence", () => {
  it("returns fresh empty data and reads the single snapshot", async () => {
    const { emptyData, loadData } = await import("./db");
    const first = emptyData();
    first.settings.calculatorInputs.x = "1";
    expect(emptyData().settings.calculatorInputs).toEqual({});
    expect(await loadData()).toEqual(emptyData());
    expect(mock.get).toHaveBeenCalledWith("snapshots", "current");
  });

  it("saves one validated snapshot and waits for the transaction commit", async () => {
    let commit!: () => void;
    const done = new Promise<void>((resolve) => {
      commit = resolve;
    });
    mock.transaction.mockReturnValue({ store: { put: mock.put }, done });
    const { emptyData, saveData } = await import("./db");
    let settled = false;
    const save = saveData(emptyData()).then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(mock.put).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    expect(mock.transaction).toHaveBeenCalledWith("snapshots", "readwrite");
    expect(mock.put).toHaveBeenCalledWith(emptyData(), "current");
    commit();
    await save;
    expect(settled).toBe(true);
  });

  it("does not open a write transaction for invalid data", async () => {
    const { emptyData, saveData } = await import("./db");
    const invalid = emptyData();
    invalid.settings.activeVehicleId = "missing";
    await expect(saveData(invalid)).rejects.toThrow();
    expect(mock.open).not.toHaveBeenCalled();
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("propagates transaction failures", async () => {
    mock.transaction.mockImplementation(() => ({
      store: { put: mock.put },
      done: Promise.reject(new Error("Quota exceeded")),
    }));
    const { emptyData, saveData } = await import("./db");
    await expect(saveData(emptyData())).rejects.toThrow("Quota exceeded");
  });

  it("rejects corrupt stored snapshots instead of silently resetting them", async () => {
    mock.get.mockResolvedValue({
      vehicles: [],
      fillups: [],
      settings: { schemaVersion: 2 },
    });
    const { loadData } = await import("./db");
    await expect(loadData()).rejects.toThrow();
    expect(mock.put).not.toHaveBeenCalled();
  });
});
