import type { ServiceRecord } from "../types";
import { isDate, number, record, timestamp, today } from "./validation";

export function parseService(value: unknown): ServiceRecord {
  const s = record(value, "ประวัติซ่อมบำรุง");
  for (const key of ["id", "vehicleId"] as const) {
    if (typeof s[key] !== "string" || !s[key].trim())
      throw new Error("กรุณาระบุรหัสประวัติซ่อมบำรุงและรถให้ครบ");
  }
  if (!isDate(s.date) || s.date > today())
    throw new Error("วันที่ซ่อมบำรุงต้องเป็นวันที่ถูกต้องและไม่อยู่ในอนาคต");
  if (
    !Array.isArray(s.items) ||
    s.items.length === 0 ||
    s.items.length > 50 ||
    s.items.some(
      (item) => typeof item !== "string" || !item.trim() || item.length > 200,
    )
  )
    throw new Error(
      "กรุณาระบุรายการที่ทำอย่างน้อย 1 รายการ ไม่เกิน 50 รายการ และรายการละไม่เกิน 200 ตัวอักษร",
    );
  for (const key of ["shop", "note"] as const) {
    if (
      s[key] !== undefined &&
      (typeof s[key] !== "string" ||
        s[key].length > (key === "shop" ? 120 : 2000))
    )
      throw new Error(
        key === "shop"
          ? "ชื่ออู่หรือศูนย์บริการต้องเป็นข้อความไม่เกิน 120 ตัวอักษร"
          : "หมายเหตุต้องเป็นข้อความไม่เกิน 2,000 ตัวอักษร",
      );
  }
  const createdAt = timestamp(s.createdAt, "เวลาสร้างประวัติซ่อมบำรุง");
  const updatedAt = timestamp(s.updatedAt, "เวลาแก้ไขประวัติซ่อมบำรุง");
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new Error("เวลาแก้ไขต้องไม่อยู่ก่อนเวลาสร้าง");
  return {
    id: s.id as string,
    vehicleId: s.vehicleId as string,
    date: s.date,
    odometerKm: number(s.odometerKm, "เลขไมล์ที่ซ่อมบำรุง"),
    items: (s.items as string[]).map((item) => item.trim()),
    ...(s.amountSatang === undefined
      ? {}
      : {
          amountSatang: number(
            s.amountSatang,
            "ค่าใช้จ่ายซ่อมบำรุง (สตางค์)",
            false,
            true,
          ),
        }),
    ...(s.shop === undefined ? {} : { shop: (s.shop as string).trim() }),
    ...(s.note === undefined ? {} : { note: (s.note as string).trim() }),
    createdAt,
    updatedAt,
  };
}

export function sortServices(services: ServiceRecord[]): ServiceRecord[] {
  return [...services].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.odometerKm - a.odometerKm ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
}
