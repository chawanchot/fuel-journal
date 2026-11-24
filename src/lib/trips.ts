import type { Trip } from "../types";
import { isDate, number, record, timestamp, today } from "./validation";

export function parseTrip(value: unknown): Trip {
  const t = record(value, "ทริป");
  for (const field of ["id", "vehicleId"] as const) {
    if (typeof t[field] !== "string" || !t[field].trim())
      throw new Error("กรุณาระบุชื่อทริปและรถให้ครบ");
  }
  if (typeof t.name !== "string") throw new Error("ชื่อทริปต้องเป็นข้อความ");
  if (
    t.status !== undefined &&
    t.status !== "ongoing" &&
    t.status !== "completed"
  )
    throw new Error("สถานะทริปไม่ถูกต้อง");
  const ongoing = t.status === "ongoing";
  if (
    !isDate(t.startDate) ||
    t.startDate > today() ||
    (!ongoing &&
      (!isDate(t.endDate) || t.startDate > t.endDate || t.endDate > today()))
  )
    throw new Error("วันเริ่มและวันสิ้นสุดทริปต้องเรียงกันและไม่อยู่ในอนาคต");
  if (t.distanceMode !== "distance" && t.distanceMode !== "odometer")
    throw new Error("รูปแบบระยะทางไม่ถูกต้อง");
  if (
    ongoing &&
    (t.distanceMode !== "odometer" ||
      t.endDate !== undefined ||
      t.endOdometerKm !== undefined ||
      t.distanceKm !== undefined)
  )
    throw new Error("ทริปที่ยังไม่จบให้บันทึกเฉพาะเลขไมล์เริ่มต้น");
  const distanceKm = ongoing
    ? undefined
    : number(t.distanceKm, "ระยะทาง", true);
  let odometers: Pick<Trip, "startOdometerKm" | "endOdometerKm"> = {};
  if (t.distanceMode === "odometer") {
    const startOdometerKm = number(t.startOdometerKm, "เลขไมล์เริ่มต้น");
    const endOdometerKm = ongoing
      ? undefined
      : number(t.endOdometerKm, "เลขไมล์สิ้นสุด", true);
    if (
      !ongoing &&
      (endOdometerKm! <= startOdometerKm ||
        Math.abs(endOdometerKm! - startOdometerKm - distanceKm!) > 0.000001)
    )
      throw new Error(
        "เลขไมล์สิ้นสุดต้องมากกว่าเลขไมล์เริ่มต้นและสอดคล้องกับระยะทาง",
      );
    odometers = { startOdometerKm, ...(ongoing ? {} : { endOdometerKm }) };
  }
  let fuel: Pick<
    Trip,
    | "fuelMode"
    | "efficiencyKmPerLitre"
    | "efficiencySource"
    | "actualVolumeMillilitres"
  >;
  if (
    ongoing &&
    t.fuelMode === "actual" &&
    t.actualVolumeMillilitres === undefined
  ) {
    fuel = { fuelMode: "actual" };
  } else if (t.fuelMode === "actual") {
    fuel = {
      fuelMode: "actual",
      actualVolumeMillilitres: number(
        t.actualVolumeMillilitres,
        "ปริมาณน้ำมันที่ใช้จริง",
        true,
        true,
      ),
    };
  } else if (t.fuelMode === "estimated") {
    if (
      !["manual", "history", "vehicle"].includes(t.efficiencySource as string)
    )
      throw new Error("กรุณาเลือกแหล่งอัตราสิ้นเปลือง");
    fuel = {
      fuelMode: "estimated",
      ...(t.efficiencyKmPerLitre === undefined
        ? {}
        : {
            efficiencyKmPerLitre: number(
              t.efficiencyKmPerLitre,
              "อัตราสิ้นเปลือง",
              true,
            ),
          }),
      efficiencySource: t.efficiencySource as Trip["efficiencySource"],
    };
  } else throw new Error("รูปแบบการใช้น้ำมันไม่ถูกต้อง");
  const createdAt = timestamp(t.createdAt, "เวลาสร้างทริป");
  const updatedAt = timestamp(t.updatedAt, "เวลาแก้ไขทริป");
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new Error("เวลาแก้ไขทริปต้องไม่อยู่ก่อนเวลาสร้าง");
  if (t.note !== undefined && typeof t.note !== "string")
    throw new Error("หมายเหตุต้องเป็นข้อความ");
  const trip: Trip = {
    id: t.id as string,
    vehicleId: t.vehicleId as string,
    name: (t.name as string).trim(),
    startDate: t.startDate,
    ...(t.status === undefined ? {} : { status: t.status }),
    ...(ongoing ? {} : { endDate: t.endDate as string }),
    distanceMode: t.distanceMode,
    ...(ongoing ? {} : { distanceKm }),
    ...odometers,
    ...fuel,
    ...(t.priceSatangPerLitre === undefined
      ? {}
      : {
          priceSatangPerLitre: number(
            t.priceSatangPerLitre,
            "ราคาน้ำมัน",
            true,
            true,
          ),
        }),
    extrasSatang: number(t.extrasSatang, "ค่าใช้จ่ายเพิ่มเติม", false, true),
    ...(t.note === undefined ? {} : { note: t.note }),
    createdAt,
    updatedAt,
  };
  tripTotals(trip);
  return trip;
}

export function tripTotals(trip: Trip) {
  if (
    trip.status === "ongoing" ||
    (trip.fuelMode === "estimated" && trip.efficiencyKmPerLitre === undefined)
  )
    return { litres: null, fuelCostSatang: null, totalSatang: null };
  const litres =
    trip.fuelMode === "actual"
      ? trip.actualVolumeMillilitres! / 1000
      : trip.distanceKm! / trip.efficiencyKmPerLitre!;
  const fuelCostSatang =
    trip.priceSatangPerLitre === undefined
      ? null
      : litres * trip.priceSatangPerLitre;
  const totalSatang =
    fuelCostSatang === null ? null : fuelCostSatang + trip.extrasSatang;
  if (
    litres <= 0 ||
    !Number.isFinite(litres) ||
    [fuelCostSatang, totalSatang].some(
      (v) => v !== null && (!Number.isFinite(v) || v > Number.MAX_SAFE_INTEGER),
    )
  )
    throw new Error("ค่าทริปเกินช่วงที่คำนวณได้ กรุณาตรวจสอบข้อมูล");
  return { litres, fuelCostSatang, totalSatang };
}

export function tripTitle(trip: Trip): string {
  return (
    trip.name.trim() ||
    `ทริปวันที่ ${new Date(`${trip.startDate}T12:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`
  );
}
