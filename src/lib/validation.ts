import type { Fillup, Settings, Vehicle } from "../types";

export function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}ต้องเป็นออบเจ็กต์`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`${label}ต้องเป็นข้อความ${allowEmpty ? "" : "ที่ไม่ว่าง"}`);
  }
  return value;
}

export function number(
  value: unknown,
  label: string,
  positive = false,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (positive ? value <= 0 : value < 0) ||
    (integer && !Number.isSafeInteger(value))
  ) {
    throw new Error(
      `${label}ต้องเป็น${integer ? "จำนวนเต็มในช่วงที่คำนวณได้อย่างแม่นยำ" : "ตัวเลขที่มีค่าจำกัด"}และ${positive ? "มากกว่าศูนย์" : "ไม่ติดลบ"}`,
    );
  }
  return value;
}

export function isDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function today(): string {
  const now = new Date();
  return `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
}

export function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      result,
    ) ||
    !isDate(result.slice(0, 10)) ||
    !Number.isFinite(Date.parse(result)) ||
    Number(result.slice(11, 13)) > 23 ||
    Number(result.slice(14, 16)) > 59 ||
    Number(result.slice(17, 19)) > 59
  ) {
    throw new Error(`${label}ต้องเป็นวันเวลารูปแบบ ISO ที่ถูกต้อง`);
  }
  return result;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`${label}ต้องเป็นค่าจริงหรือเท็จ`);
  return value;
}

function timestamps(value: Record<string, unknown>): {
  createdAt: string;
  updatedAt: string;
} {
  const createdAt = timestamp(value.createdAt, "เวลาสร้าง");
  const updatedAt = timestamp(value.updatedAt, "เวลาแก้ไข");
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new Error("เวลาแก้ไขต้องไม่อยู่ก่อนเวลาสร้าง");
  return { createdAt, updatedAt };
}

export function parseVehicle(value: unknown): Vehicle {
  const v = record(value, "ข้อมูลรถ");
  if (v.type !== "car" && v.type !== "motorcycle")
    throw new Error("ประเภทรถไม่ถูกต้อง");
  return {
    id: text(v.id, "รหัสรถ"),
    name: text(v.name, "ชื่อรถ"),
    type: v.type,
    fuelType: text(v.fuelType, "ชนิดน้ำมัน"),
    ...(v.manualEfficiency === undefined
      ? {}
      : {
          manualEfficiency: number(
            v.manualEfficiency,
            "อัตราสิ้นเปลืองที่กำหนดเอง",
            true,
          ),
        }),
    ...timestamps(v),
  };
}

export function parseFillup(value: unknown): Fillup {
  const f = record(value, "ข้อมูลการเติมน้ำมัน");
  if (!isDate(f.date))
    throw new Error("วันที่ต้องเป็นวันที่ที่ถูกต้องในรูปแบบ YYYY-MM-DD");
  if (f.date > today()) throw new Error("วันที่เติมน้ำมันต้องไม่อยู่ในอนาคต");
  if (f.inputMode !== "price" && f.inputMode !== "volume")
    throw new Error("รูปแบบการกรอกข้อมูลไม่ถูกต้อง");
  return {
    id: text(f.id, "รหัสการเติมน้ำมัน"),
    vehicleId: text(f.vehicleId, "รหัสรถ"),
    date: f.date,
    odometerKm: number(f.odometerKm, "เลขไมล์"),
    amountSatang: number(f.amountSatang, "จำนวนเงิน (สตางค์)", true, true),
    volumeMillilitres: number(
      f.volumeMillilitres,
      "ปริมาณน้ำมัน (มิลลิลิตร)",
      true,
      true,
    ),
    priceSatangPerLitre: number(
      f.priceSatangPerLitre,
      "ราคาน้ำมัน (สตางค์ต่อลิตร)",
      true,
      true,
    ),
    inputMode: f.inputMode,
    fullTank: boolean(f.fullTank, "สถานะเติมเต็มถัง"),
    missedFillupBefore: boolean(
      f.missedFillupBefore,
      "สถานะข้ามการบันทึกก่อนหน้านี้",
    ),
    fuelType: text(f.fuelType, "ชนิดน้ำมัน"),
    ...(f.station === undefined
      ? {}
      : { station: text(f.station, "สถานีบริการ", true) }),
    ...(f.note === undefined ? {} : { note: text(f.note, "หมายเหตุ", true) }),
    ...timestamps(f),
  };
}

export function parseSettings(value: unknown): Settings {
  const s = record(value, "การตั้งค่า");
  if (s.schemaVersion !== 1)
    throw new Error("ไม่รองรับเวอร์ชันข้อมูลในการตั้งค่า ต้องเป็นเวอร์ชัน 1");
  const inputs = record(s.calculatorInputs, "ข้อมูลเครื่องคำนวณ");
  const calculatorInputs = Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [
      key,
      text(value, `ข้อมูลเครื่องคำนวณ ${key} `, true),
    ]),
  );
  return {
    schemaVersion: 1,
    calculatorInputs,
    ...(s.activeVehicleId === undefined
      ? {}
      : { activeVehicleId: text(s.activeVehicleId, "รหัสรถที่เลือก") }),
    ...(s.lastBackupAt === undefined
      ? {}
      : { lastBackupAt: timestamp(s.lastBackupAt, "เวลาสำรองข้อมูลล่าสุด") }),
  };
}
