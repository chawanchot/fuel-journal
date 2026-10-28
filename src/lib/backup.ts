import type { AppData } from "../types";
import { sortFillups } from "./calculations";
import { parseTrip } from "./trips";
import {
  parseFillup,
  parseSettings,
  parseVehicle,
  record,
  timestamp,
} from "./validation";

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

function validateData(value: unknown): AppData {
  const data = record(value, "ข้อมูลสำรอง");
  if ("schemaVersion" in data && data.schemaVersion !== 1)
    throw new Error("ไม่รองรับเวอร์ชันข้อมูลสำรอง ต้องเป็นเวอร์ชัน 1");
  if ("exportedAt" in data) timestamp(data.exportedAt, "เวลาส่งออกข้อมูล");
  if (!Array.isArray(data.vehicles) || !Array.isArray(data.fillups))
    throw new Error("รายการรถและรายการเติมน้ำมันต้องเป็นอาร์เรย์");
  const vehicles = data.vehicles.map(parseVehicle);
  const fillups = data.fillups.map(parseFillup);
  // Existing on-device snapshots and older backup files predate trip records.
  if (data.trips !== undefined && !Array.isArray(data.trips))
    throw new Error("รายการทริปต้องเป็นอาร์เรย์");
  const trips = ((data.trips as unknown[] | undefined) ?? []).map(parseTrip);
  const settings = parseSettings(data.settings);
  const vehicleIds = new Set<string>();
  for (const vehicle of vehicles) {
    if (vehicleIds.has(vehicle.id)) throw new Error("รหัสรถซ้ำกัน");
    vehicleIds.add(vehicle.id);
  }
  if (
    settings.activeVehicleId !== undefined &&
    !vehicleIds.has(settings.activeVehicleId)
  )
    throw new Error("ไม่พบรถที่เลือกในรายการรถ");
  const fillupIds = new Set<string>();
  const previousOdometers = new Map<string, number>();
  for (const fillup of sortFillups(fillups)) {
    if (fillupIds.has(fillup.id)) throw new Error("รหัสการเติมน้ำมันซ้ำกัน");
    fillupIds.add(fillup.id);
    if (!vehicleIds.has(fillup.vehicleId))
      throw new Error("รายการเติมน้ำมันอ้างอิงรถที่ไม่มีอยู่");
    const previous = previousOdometers.get(fillup.vehicleId);
    if (previous !== undefined && fillup.odometerKm < previous)
      throw new Error("เลขไมล์ต้องไม่ลดลงระหว่างการเติมน้ำมัน");
    previousOdometers.set(fillup.vehicleId, fillup.odometerKm);
  }
  const tripIds = new Set<string>();
  for (const trip of trips) {
    if (tripIds.has(trip.id)) throw new Error("รหัสทริปซ้ำกัน");
    if (!vehicleIds.has(trip.vehicleId))
      throw new Error("ทริปอ้างอิงรถที่ไม่มีอยู่");
    tripIds.add(trip.id);
  }
  return { vehicles, fillups, trips, settings };
}

export function serializeBackup(data: AppData): string {
  const text = JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...validateData(data),
    },
    null,
    2,
  );
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error("ข้อมูลสำรองมีขนาดเกิน 5 MB");
  return text;
}

export function parseBackup(text: string): AppData {
  if (typeof text !== "string") throw new Error("ข้อมูลสำรองต้องเป็นข้อความ");
  if (
    text.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES
  )
    throw new Error("ข้อมูลสำรองมีขนาดเกิน 5 MB");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("ข้อมูลสำรองไม่ใช่ JSON ที่ถูกต้อง");
  }
  // Parsing is pure: persistence is an explicit, separate caller action.
  return validateData(value);
}
