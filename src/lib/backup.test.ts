import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../types";
import { parseBackup, serializeBackup } from "./backup";

const data = (): AppData => ({
  trips: [],
  vehicles: [
    {
      id: "v",
      name: "Car",
      type: "car",
      fuelType: "gasoline",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  fillups: [
    {
      id: "f",
      vehicleId: "v",
      date: "2025-01-01",
      odometerKm: 100,
      amountSatang: 40000,
      volumeMillilitres: 10000,
      priceSatangPerLitre: 4000,
      inputMode: "price",
      fullTank: true,
      missedFillupBefore: false,
      fuelType: "gasoline",
      note: "Fuel",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  settings: {
    schemaVersion: 1,
    activeVehicleId: "v",
    calculatorInputs: { distance: "100" },
  },
});

afterEach(() => vi.useRealTimers());

describe("backup validation", () => {
  it("roundtrips complete data without mutating it", () => {
    const original = data();
    const result = parseBackup(serializeBackup(original));
    expect(result).toEqual(original);
    expect(result).not.toBe(original);
  });

  it("exports a top-level schema version and an ISO export timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T02:22:17.000Z"));
    const original = data();
    const exported = JSON.parse(serializeBackup(original));
    expect(exported).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-10-28T02:22:17.000Z",
      ...original,
    });
    expect(parseBackup(JSON.stringify(exported))).toEqual(original);
    expect(original).not.toHaveProperty("schemaVersion");
    expect(original).not.toHaveProperty("exportedAt");
  });

  it.each([
    { schemaVersion: 2 },
    { schemaVersion: "1" },
    { schemaVersion: null },
    { exportedAt: null },
    { exportedAt: 123 },
    { exportedAt: "2026-10-28" },
    { exportedAt: "2026-02-30T00:00:00Z" },
    { exportedAt: "2026-10-28T24:00:00Z" },
    { exportedAt: "2026-10-28T00:00:00+24:00" },
  ])("validates export metadata when present: %j", (metadata) => {
    expect(() =>
      parseBackup(JSON.stringify({ ...data(), ...metadata })),
    ).toThrow(/[\u0E00-\u0E7F]/);
  });

  it("accepts stored AppData without export-only metadata", () => {
    expect(parseBackup(JSON.stringify(data()))).toEqual(data());
  });

  it.each([
    (d: AppData) => {
      d.settings.schemaVersion = 2 as 1;
    },
    (d: AppData) => {
      d.vehicles.push({ ...d.vehicles[0]! });
    },
    (d: AppData) => {
      d.fillups.push({ ...d.fillups[0]! });
    },
    (d: AppData) => {
      d.fillups[0]!.vehicleId = "missing";
    },
    (d: AppData) => {
      d.settings.activeVehicleId = "missing";
    },
    (d: AppData) => {
      d.fillups[0]!.date = "2025-02-30";
    },
    (d: AppData) => {
      d.fillups[0]!.amountSatang = -1;
    },
    (d: AppData) => {
      d.fillups[0]!.fullTank = "true" as unknown as boolean;
    },
    (d: AppData) => {
      d.vehicles[0]!.manualEfficiency = 0;
    },
    (d: AppData) => {
      d.vehicles[0]!.createdAt = "2025-02-30T00:00:00Z";
    },
    (d: AppData) => {
      d.fillups[0]!.updatedAt = "2024-01-01T00:00:00Z";
    },
    (d: AppData) => {
      d.vehicles[0]!.createdAt = "2025-01-01T24:00:00Z";
    },
    (d: AppData) => {
      d.fillups[0]!.priceSatangPerLitre = Number.MAX_SAFE_INTEGER + 1;
    },
    (d: AppData) => {
      d.settings.calculatorInputs.distance = 100 as unknown as string;
    },
    (d: AppData) => {
      d.fillups.push({
        ...d.fillups[0]!,
        id: "g",
        date: "2025-01-02",
        odometerKm: 50,
      });
    },
  ])(
    "rejects malformed fields, duplicates, references and ordering",
    (mutate) => {
      const original = data();
      mutate(original);
      expect(() => parseBackup(JSON.stringify(original))).toThrow(
        /[\u0E00-\u0E7F]/,
      );
    },
  );

  it("rejects malformed JSON and invalid root shapes", () => {
    for (const text of ["{", "null", "[]", "{}"])
      expect(() => parseBackup(text)).toThrow(/[\u0E00-\u0E7F]/);
  });

  it("enforces the byte limit including multibyte text", () => {
    const original = data();
    original.fillups[0]!.note = "\u0e01".repeat(2 * 1024 * 1024);
    expect(() => parseBackup(JSON.stringify(original))).toThrow(/5 MB/);
    expect(() => serializeBackup(original)).toThrow(/5 MB/);
  });

  it("accepts unsorted storage while checking chronological odometer order", () => {
    const original = data();
    original.fillups.unshift({
      ...original.fillups[0]!,
      id: "g",
      date: "2025-01-02",
      odometerKm: 200,
    });
    expect(parseBackup(JSON.stringify(original))).toEqual(original);
  });

  it("preserves calculator keys safely without changing object prototypes", () => {
    const original = data();
    original.settings.calculatorInputs = JSON.parse(
      '{"__proto__":"user input","distance":"1"}',
    );
    const parsed = parseBackup(JSON.stringify(original));
    expect(Object.getPrototypeOf(parsed.settings.calculatorInputs)).toBe(
      Object.prototype,
    );
    expect(Object.hasOwn(parsed.settings.calculatorInputs, "__proto__")).toBe(
      true,
    );
    expect(parsed.settings.calculatorInputs["__proto__"]).toBe("user input");
  });
});
