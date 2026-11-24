import { describe, expect, it } from "vitest";
import type { ServiceRecord } from "../types";
import { parseService, sortServices } from "./services";
import { parseBackup, serializeBackup } from "./backup";
import { emptyData } from "./db";

const service = (patch: Partial<ServiceRecord> = {}): ServiceRecord => ({
  id: "service-1",
  vehicleId: "v1",
  date: "2026-01-01",
  odometerKm: 20000,
  items: ["เปลี่ยนน้ำมันเครื่อง", "เปลี่ยนไส้กรอง"],
  amountSatang: 150000,
  shop: "อู่ใกล้บ้าน",
  note: "น้ำมันเครื่อง 5W-30",
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-01T12:00:00Z",
  ...patch,
});
const data = () => ({
  ...emptyData(),
  vehicles: [
    {
      id: "v1",
      name: "รถ",
      type: "car" as const,
      fuelType: "E20",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  services: [service()],
});

describe("service history", () => {
  it("parses mileage, multiple work items and exact satang costs", () =>
    expect(parseService(service())).toEqual(service()));
  it("allows omitted cost without representing it as a zero-cost service", () =>
    expect(
      parseService(service({ amountSatang: undefined })).amountSatang,
    ).toBeUndefined());
  it("accepts zero cost and zero mileage", () =>
    expect(
      parseService(service({ amountSatang: 0, odometerKm: 0 })),
    ).toMatchObject({ amountSatang: 0, odometerKm: 0 }));
  it("trims user-entered item descriptions", () =>
    expect(parseService(service({ items: [" เปลี่ยนยาง "] })).items).toEqual([
      "เปลี่ยนยาง",
    ]));
  it.each<Partial<ServiceRecord>>([
    { id: "" },
    { vehicleId: " " },
    { date: "2026-02-30" },
    { date: "2999-01-01" },
    { odometerKm: -1 },
    { odometerKm: NaN },
    { odometerKm: Infinity },
    { items: [] },
    { items: [" "] },
    { items: ["x".repeat(201)] },
    { items: Array(51).fill("เปลี่ยนยาง") },
    { amountSatang: -1 },
    { amountSatang: 1.5 },
    { amountSatang: Infinity },
    { amountSatang: Number.MAX_SAFE_INTEGER + 1 },
    { shop: "x".repeat(121) },
    { note: "x".repeat(2001) },
    { updatedAt: "2025-01-01T00:00:00Z" },
  ])("rejects invalid service %j", (patch) =>
    expect(() => parseService(service(patch))).toThrow(),
  );
  it("rejects wrong runtime types", () => {
    expect(() => parseService({ ...service(), items: [1] })).toThrow();
    expect(() => parseService({ ...service(), note: null })).toThrow();
    expect(() => parseService({ ...service(), amountSatang: "100" })).toThrow();
  });
  it("sorts newest first by date, then mileage, without mutating input", () => {
    const records = [
      service({ id: "old", date: "2025-12-01", odometerKm: 30000 }),
      service({ id: "low", odometerKm: 10000 }),
      service({ id: "high" }),
    ];
    expect(sortServices(records).map((s) => s.id)).toEqual([
      "high",
      "low",
      "old",
    ]);
    expect(records[0].id).toBe("old");
  });
  it("roundtrips service history through backups", () =>
    expect(parseBackup(serializeBackup(data()))).toEqual(data()));
  it("migrates old snapshots and backups without replacing other data", () => {
    const { services: _, ...old } = data();
    expect(parseBackup(JSON.stringify(old))).toEqual({ ...old, services: [] });
  });
  it("rejects corrupt collection, duplicate IDs and missing vehicle references", () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...data(), services: null })),
    ).toThrow();
    expect(() =>
      serializeBackup({ ...data(), services: [service(), service()] }),
    ).toThrow();
    expect(() =>
      serializeBackup({
        ...data(),
        services: [service({ vehicleId: "missing" })],
      }),
    ).toThrow();
  });
});
