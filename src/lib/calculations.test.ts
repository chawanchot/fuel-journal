import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fillup } from "../types";
import {
  calculateConsumption,
  calculateRange,
  calculateStats,
  calculateTrip,
  sortFillups,
  validateFillup,
} from "./calculations";

const fillup = (
  id: string,
  date: string,
  odometerKm: number,
  overrides: Partial<Fillup> = {},
): Fillup => ({
  id,
  vehicleId: "car",
  date,
  odometerKm,
  amountSatang: 40000,
  volumeMillilitres: 10000,
  priceSatangPerLitre: 4000,
  inputMode: "volume",
  fullTank: true,
  missedFillupBefore: false,
  fuelType: "gasoline",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("full-to-full statistics", () => {
  it("includes partials and closing fuel, excludes baseline and unfinished fuel, and weights cycles", () => {
    const rows = [
      fillup("a", "2025-01-01", 100),
      fillup("b", "2025-01-02", 150, { fullTank: false }),
      fillup("c", "2025-01-03", 300),
      fillup("d", "2025-01-04", 600),
      fillup("e", "2025-01-05", 650, { fullTank: false }),
    ];
    expect(calculateStats(rows.reverse())).toEqual({
      distanceKm: 500,
      litres: 30,
      amountSatang: 120000,
      efficiency: 500 / 30,
      costPerKm: 2.4,
      cycles: 2,
    });
  });

  it("discards a broken cycle and waits for a full tank baseline", () => {
    expect(
      calculateStats([
        fillup("a", "2025-01-01", 100),
        fillup("b", "2025-01-02", 200, {
          fullTank: false,
          missedFillupBefore: true,
        }),
        fillup("c", "2025-01-03", 300),
        fillup("d", "2025-01-04", 450),
      ]),
    ).toMatchObject({
      distanceKm: 150,
      litres: 10,
      amountSatang: 40000,
      cycles: 1,
    });
  });

  it("uses a marked full tank as the new baseline and isolates vehicles", () => {
    expect(
      calculateStats([
        fillup("a", "2025-01-01", 100),
        fillup("b", "2025-01-02", 300, { missedFillupBefore: true }),
        fillup("x", "2025-01-02", 9000, { vehicleId: "bike" }),
        fillup("c", "2025-01-03", 500),
        fillup("y", "2025-01-03", 9100, { vehicleId: "bike" }),
      ]),
    ).toMatchObject({ distanceKm: 300, litres: 20, cycles: 2, efficiency: 15 });
  });

  it("returns null ratios when no complete cycle exists", () => {
    expect(calculateStats([])).toEqual({
      distanceKm: 0,
      litres: 0,
      amountSatang: 0,
      efficiency: null,
      costPerKm: null,
      cycles: 0,
    });
    expect(calculateStats([fillup("a", "2025-01-01", 0)])).toMatchObject({
      cycles: 0,
      efficiency: null,
    });
  });

  it("excludes zero-distance cycles including their fuel and cost", () => {
    expect(
      calculateStats([
        fillup("a", "2025-01-01", 100),
        fillup("b", "2025-01-02", 100),
      ]),
    ).toEqual({
      cycles: 0,
      distanceKm: 0,
      litres: 0,
      amountSatang: 0,
      efficiency: null,
      costPerKm: null,
    });
  });

  it("excludes zero-distance fuel between valid cycles and resets the baseline", () => {
    expect(
      calculateStats([
        fillup("a", "2025-01-01", 100),
        fillup("b", "2025-01-02", 200),
        fillup("c", "2025-01-03", 200, {
          fullTank: false,
          volumeMillilitres: 5000,
          amountSatang: 20000,
        }),
        fillup("d", "2025-01-04", 200, {
          volumeMillilitres: 20000,
          amountSatang: 80000,
        }),
        fillup("e", "2025-01-05", 500, {
          volumeMillilitres: 20000,
          amountSatang: 80000,
        }),
        fillup("f", "2025-01-06", 500),
      ]),
    ).toEqual({
      distanceKm: 400,
      litres: 30,
      amountSatang: 120000,
      efficiency: 400 / 30,
      costPerKm: 3,
      cycles: 2,
    });
  });

  it("starts a valid cycle from the ending full tank of an initial zero-distance cycle", () => {
    expect(
      calculateStats([
        fillup("a", "2025-01-01", 100),
        fillup("b", "2025-01-02", 100, {
          volumeMillilitres: 30000,
          amountSatang: 120000,
        }),
        fillup("c", "2025-01-03", 300),
      ]),
    ).toEqual({
      distanceKm: 200,
      litres: 10,
      amountSatang: 40000,
      efficiency: 20,
      costPerKm: 2,
      cycles: 1,
    });
  });

  it("rejects decreasing odometers and invalid numeric data", () => {
    expect(() =>
      calculateStats([
        fillup("a", "2025-01-01", 200),
        fillup("b", "2025-01-02", 100),
      ]),
    ).toThrow(/Odometer/);
    expect(() => calculateStats([fillup("a", "2025-01-01", NaN)])).toThrow();
  });
});

describe("sorting and validation", () => {
  it("sorts deterministically without mutating the input", () => {
    const rows = [
      fillup("z", "2025-01-02", 1),
      fillup("b", "2025-01-01", 2),
      fillup("a", "2025-01-01", 2),
      fillup("c", "2025-01-01", 1),
    ];
    expect(sortFillups(rows).map((f) => f.id)).toEqual(["c", "a", "b", "z"]);
    expect(rows[0]?.id).toBe("z");
  });

  it("breaks same-day odometer ties by creation timestamp before id", () => {
    const rows = [
      fillup("a", "2025-01-01", 2, { createdAt: "2025-01-01T00:00:01Z" }),
      fillup("z", "2025-01-01", 2),
    ];
    expect(sortFillups(rows).map((f) => f.id)).toEqual(["z", "a"]);
  });

  it("checks both neighbors, ignores other vehicles and excludes an edited id", () => {
    const rows = [
      fillup("a", "2025-01-01", 100),
      fillup("b", "2025-01-03", 300),
      fillup("x", "2025-01-02", 9999, { vehicleId: "bike" }),
    ];
    expect(validateFillup(fillup("c", "2025-01-02", 50), rows)).toBe(
      "เลขไมล์ต้องไม่น้อยกว่าการเติมน้ำมันครั้งก่อน",
    );
    expect(validateFillup(fillup("c", "2025-01-02", 350), rows)).toBe(
      "เลขไมล์ต้องไม่มากกว่าการเติมน้ำมันครั้งถัดไป",
    );
    expect(validateFillup(fillup("a", "2025-01-02", 200), rows)).toBeNull();
  });

  it("rejects impossible and future dates using the local current date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 12));
    expect(validateFillup(fillup("a", "2025-02-29", 1), [])).toBe(
      "วันที่ต้องเป็นวันที่ที่ถูกต้องในรูปแบบ YYYY-MM-DD",
    );
    expect(validateFillup(fillup("a", "2026-10-29", 1), [])).toBe(
      "วันที่เติมน้ำมันต้องไม่อยู่ในอนาคต",
    );
    expect(validateFillup(fillup("a", "2026-10-28", 1), [])).toBeNull();
  });

  it.each([
    { odometerKm: -1 },
    { amountSatang: 0 },
    { volumeMillilitres: Infinity },
    { priceSatangPerLitre: -1 },
    { amountSatang: 1.5 },
  ])("rejects invalid fields %j", (patch) => {
    expect(validateFillup(fillup("a", "2025-01-01", 1, patch), [])).toMatch(
      /[\u0E00-\u0E7F]/,
    );
  });
});

describe("calculators", () => {
  it("doubles distance only and splits all trip costs", () => {
    expect(calculateTrip(100, 20, 40, true, 100, 3)).toEqual({
      distance: 200,
      litres: 10,
      fuelCost: 400,
      total: 500,
      perPerson: 500 / 3,
    });
    expect(calculateConsumption(200, 10)).toEqual({
      efficiency: 20,
      litresPer100: 5,
    });
    expect(calculateRange(10, 20)).toBe(200);
    expect(calculateRange(0, 20)).toBe(0);
  });

  it("throws instead of substituting zero for invalid input or overflow", () => {
    expect(() => calculateTrip(100, 0, 40, false, 0, 1)).toThrow();
    expect(() => calculateTrip(100, 20, 40, false, 0, 0)).toThrow();
    expect(() => calculateTrip(100, 20, 40, false, -1, 1)).toThrow();
    expect(() => calculateConsumption(0, 1)).toThrow();
    expect(() => calculateConsumption(1, NaN)).toThrow();
    expect(() => calculateRange(Infinity, 1)).toThrow();
    expect(() => calculateRange(Number.MAX_VALUE, 2)).toThrow();
  });
});
