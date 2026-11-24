import { describe, expect, it } from "vitest";
import type { AppData, Trip } from "../types";
import { parseTrip, tripTotals } from "./trips";
import { parseBackup, serializeBackup } from "./backup";
import { emptyData } from "./db";

const trip = (patch: Partial<Trip> = {}): Trip => ({
  id: "trip-1",
  vehicleId: "v1",
  name: "เขาใหญ่",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  distanceMode: "distance",
  distanceKm: 400,
  fuelMode: "estimated",
  efficiencyKmPerLitre: 20,
  efficiencySource: "manual",
  priceSatangPerLitre: 4000,
  extrasSatang: 20000,
  createdAt: "2026-01-02T10:00:00Z",
  updatedAt: "2026-01-02T10:00:00Z",
  ...patch,
});
const data = (): AppData => ({
  ...emptyData(),
  vehicles: [
    {
      id: "v1",
      name: "รถ",
      type: "car",
      fuelType: "E20",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  trips: [trip()],
});

describe("trip records", () => {
  it("calculates estimated fuel and costs without rounding the chain", () => {
    expect(tripTotals(parseTrip(trip()))).toEqual({
      litres: 20,
      fuelCostSatang: 80000,
      totalSatang: 100000,
    });
  });
  it("uses actual fuel instead of estimated fuel when supplied", () => {
    expect(
      tripTotals(
        parseTrip(trip({ fuelMode: "actual", actualVolumeMillilitres: 25000 })),
      ),
    ).toEqual({ litres: 25, fuelCostSatang: 100000, totalSatang: 120000 });
  });
  it("does not fabricate fuel cost when price is omitted", () => {
    expect(
      tripTotals(parseTrip(trip({ priceSatangPerLitre: undefined }))),
    ).toEqual({ litres: 20, fuelCostSatang: null, totalSatang: null });
  });
  it("accepts odometer differences including zero starting odometer", () => {
    expect(
      parseTrip(
        trip({
          distanceMode: "odometer",
          startOdometerKm: 0,
          endOdometerKm: 400,
        }),
      ).distanceKm,
    ).toBe(400);
  });
  it.each<Partial<Trip>>([
    { distanceKm: 0 },
    { distanceKm: -1 },
    { distanceKm: Infinity },
    { efficiencyKmPerLitre: 0 },
    { efficiencyKmPerLitre: NaN },
    { startDate: "2026-02-30" },
    { startDate: "2026-01-03" },
    { endDate: "2999-01-01" },
    { distanceMode: "odometer", startOdometerKm: 200, endOdometerKm: 100 },
    { distanceMode: "odometer", startOdometerKm: 0, endOdometerKm: 100 },
    { fuelMode: "actual", actualVolumeMillilitres: 0 },
    { fuelMode: "actual", actualVolumeMillilitres: 1.1 },
    { priceSatangPerLitre: 0 },
    { extrasSatang: -1 },
    { extrasSatang: NaN },
  ])("rejects invalid trip input %j", (patch) =>
    expect(() => parseTrip(trip(patch))).toThrow(),
  );
  it("roundtrips trips in backups", () =>
    expect(parseBackup(serializeBackup(data()))).toEqual(data()));
  it("accepts unnamed trips and preserves an empty name", () => {
    expect(parseTrip(trip({ name: "   " })).name).toBe("");
  });
  it("stores ongoing trips with only a start odometer and no made-up totals", () => {
    const record = parseTrip(
      trip({
        name: "",
        status: "ongoing",
        distanceMode: "odometer",
        startOdometerKm: 10000,
        endDate: undefined,
        distanceKm: undefined,
        efficiencyKmPerLitre: undefined,
      }),
    );
    expect(record).not.toHaveProperty("endDate");
    expect(record).not.toHaveProperty("distanceKm");
    expect(record).not.toHaveProperty("endOdometerKm");
    expect(tripTotals(record)).toEqual({
      litres: null,
      fuelCostSatang: null,
      totalSatang: null,
    });
    const saved = { ...data(), trips: [record] };
    expect(parseBackup(serializeBackup(saved))).toEqual(saved);
  });
  it("does not require an efficiency rate to finish a mileage-only trip", () => {
    expect(
      tripTotals(parseTrip(trip({ efficiencyKmPerLitre: undefined }))),
    ).toEqual({ litres: null, fuelCostSatang: null, totalSatang: null });
  });
  it("rejects inconsistent ongoing trip end fields and invalid start odometers", () => {
    expect(() =>
      parseTrip(
        trip({
          status: "ongoing",
          distanceMode: "odometer",
          startOdometerKm: 100,
        }),
      ),
    ).toThrow();
    expect(() =>
      parseTrip(
        trip({
          status: "ongoing",
          distanceMode: "odometer",
          startOdometerKm: -1,
          endDate: undefined,
          distanceKm: undefined,
        }),
      ),
    ).toThrow();
  });
  it("migrates pre-trip stored snapshots and old backups without losing fillups/settings", () => {
    const old: Partial<AppData> = data();
    delete old.trips;
    expect(parseBackup(JSON.stringify(old))).toEqual({ ...old, trips: [] });
  });
  it("rejects duplicate trip IDs, broken vehicle references and non-array trips", () => {
    const d = data();
    d.trips.push(trip());
    expect(() => serializeBackup(d)).toThrow();
    expect(() =>
      serializeBackup({ ...data(), trips: [trip({ vehicleId: "missing" })] }),
    ).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...data(), trips: {} })),
    ).toThrow();
  });
});
