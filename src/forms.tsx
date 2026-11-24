import { useState, type FormEvent } from "react";
import { Check, Info, Save } from "lucide-react";
import type { Vehicle, Fillup } from "./types";
import { validateFillup } from "./lib/calculations";
import { Field, ErrorMessage, fuelTypes, number, today } from "./components";

export function VehicleForm({
  vehicle,
  onSave,
  busy,
}: {
  vehicle?: Vehicle;
  onSave: (vehicle: Vehicle) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState(vehicle?.name ?? "");
  const [type, setType] = useState<Vehicle["type"]>(vehicle?.type ?? "car");
  const [fuelType, setFuelType] = useState(vehicle?.fuelType ?? fuelTypes[0]);
  const [efficiency, setEfficiency] = useState(
    vehicle?.manualEfficiency?.toString() ?? "",
  );
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("กรุณาตั้งชื่อรถ");
    if (
      efficiency &&
      (!Number.isFinite(Number(efficiency)) || Number(efficiency) <= 0)
    )
      return setError("อัตราสิ้นเปลืองต้องมากกว่า 0");
    const now = new Date().toISOString();
    try {
      await onSave({
        id: vehicle?.id ?? crypto.randomUUID(),
        name: name.trim(),
        type,
        fuelType,
        ...(efficiency ? { manualEfficiency: Number(efficiency) } : {}),
        createdAt: vehicle?.createdAt ?? now,
        updatedAt: now,
      });
    } catch {
      setError(
        "บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บและลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่",
      );
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <p className="muted">
        ตั้งชื่อที่จำง่าย แล้วให้เราแยกทุกการเดินทางให้คุณ
      </p>
      <Field
        label="ชื่อรถ"
        placeholder="เช่น รถไปทำงาน"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        autoComplete="off"
      />
      <label className="field">
        <span>ประเภทรถ</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Vehicle["type"])}
        >
          <option value="car">รถยนต์</option>
          <option value="motorcycle">มอเตอร์ไซค์</option>
        </select>
      </label>
      <label className="field">
        <span>น้ำมันที่ใช้ประจำ</span>
        <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
          {fuelTypes.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <Field
        label="อัตราสิ้นเปลืองที่ทราบ (ไม่บังคับ)"
        unit="กม./ลิตร"
        type="number"
        inputMode="decimal"
        min="0.01"
        step="any"
        value={efficiency}
        onChange={(e) => setEfficiency(e.target.value)}
        placeholder="กรอกเมื่อทราบค่า"
        hint="ใช้เป็นตัวเลือกในเครื่องคำนวณ ไม่แทนสถิติจากประวัติ"
      />
      <ErrorMessage>{error}</ErrorMessage>
      <div className="form-footer">
        <button className="button primary full" disabled={busy}>
          <Save size={18} />
          {busy ? "กำลังบันทึก…" : "บันทึกรถ"}
        </button>
      </div>
    </form>
  );
}

export function FillupForm({
  vehicle,
  fillup,
  existing,
  onSave,
  busy,
}: {
  vehicle: Vehicle;
  fillup?: Fillup;
  existing: Fillup[];
  onSave: (fillup: Fillup) => Promise<void>;
  busy: boolean;
}) {
  const latest = [...existing]
    .filter((f) => f.vehicleId === vehicle.id)
    .sort((a, b) => b.odometerKm - a.odometerKm)[0];
  const [date, setDate] = useState(fillup?.date ?? today());
  const [odometer, setOdometer] = useState(
    fillup?.odometerKm.toString() ?? latest?.odometerKm.toString() ?? "",
  );
  const [amount, setAmount] = useState(
    fillup ? (fillup.amountSatang / 100).toString() : "",
  );
  const [mode, setMode] = useState<"price" | "volume">(
    fillup?.inputMode ?? "price",
  );
  const [priceInput, setPriceInput] = useState(
    fillup ? (fillup.priceSatangPerLitre / 100).toString() : "",
  );
  const [volumeInput, setVolumeInput] = useState(
    fillup ? (fillup.volumeMillilitres / 1000).toString() : "",
  );
  const [fullTank, setFullTank] = useState(fillup?.fullTank ?? false);
  const [missed, setMissed] = useState(fillup?.missedFillupBefore ?? false);
  const [fuelType, setFuelType] = useState(
    fillup?.fuelType ?? vehicle.fuelType,
  );
  const [station, setStation] = useState(fillup?.station ?? "");
  const [note, setNote] = useState(fillup?.note ?? "");
  const [error, setError] = useState("");
  const total = Number(amount);
  const litres =
    mode === "price" ? total / Number(priceInput) : Number(volumeInput);
  const price =
    mode === "price" ? Number(priceInput) : total / Number(volumeInput);
  const derivedValid =
    total > 0 &&
    litres > 0 &&
    price > 0 &&
    [total, litres, price].every(Number.isFinite);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!derivedValid || !odometer.trim())
      return setError("กรุณากรอกเลขไมล์ ยอดจ่าย และราคาหรือปริมาณให้ครบ");
    const now = new Date().toISOString();
    const entry: Fillup = {
      id: fillup?.id ?? crypto.randomUUID(),
      vehicleId: vehicle.id,
      date,
      odometerKm: Number(odometer),
      amountSatang: Math.round(total * 100),
      volumeMillilitres: Math.round(litres * 1000),
      priceSatangPerLitre: Math.round(price * 100),
      inputMode: mode,
      fullTank,
      missedFillupBefore: missed,
      fuelType,
      station: station.trim(),
      note: note.trim(),
      createdAt: fillup?.createdAt ?? now,
      updatedAt: now,
    };
    const problem = validateFillup(entry, existing);
    if (problem) return setError(problem);
    try {
      await onSave(entry);
    } catch {
      setError(
        "บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บและลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่",
      );
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <div className="form-vehicle">
        <span className="status-dot" />
        {vehicle.name}
        <span className="muted">สมุดเติมน้ำมัน</span>
      </div>
      <div className="form-grid">
        <Field
          label="วันที่เติม"
          type="date"
          required
          max={today()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Field
          label="เลขไมล์"
          type="number"
          inputMode="decimal"
          required
          min="0"
          step="0.1"
          unit="กม."
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder="0"
        />
      </div>
      <Field
        label="ยอดจ่าย"
        type="number"
        inputMode="decimal"
        required
        min="0.01"
        step="0.01"
        unit="บาท"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
      />
      <div>
        <span className="field-caption">คำนวณจำนวนลิตรจาก</span>
        <div className="segmented">
          <button
            type="button"
            aria-pressed={mode === "price"}
            className={mode === "price" ? "active" : ""}
            onClick={() => setMode("price")}
          >
            ราคาต่อลิตร
          </button>
          <button
            type="button"
            aria-pressed={mode === "volume"}
            className={mode === "volume" ? "active" : ""}
            onClick={() => setMode("volume")}
          >
            จำนวนลิตร
          </button>
        </div>
      </div>
      {mode === "price" ? (
        <Field
          label="ราคาต่อลิตร"
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          step="0.01"
          unit="บาท/ลิตร"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          placeholder="0.00"
        />
      ) : (
        <Field
          label="จำนวนลิตร"
          type="number"
          inputMode="decimal"
          required
          min="0.001"
          step="0.001"
          unit="ลิตร"
          value={volumeInput}
          onChange={(e) => setVolumeInput(e.target.value)}
          placeholder="0.000"
        />
      )}
      {derivedValid && (
        <div className="derived">
          <Check size={17} />
          <span>
            {mode === "price"
              ? `ประมาณ ${number(litres, 3)} ลิตร`
              : `ราคาเฉลี่ย ${number(price)} บาท/ลิตร`}
          </span>
        </div>
      )}
      <label className="check-card">
        <input
          type="checkbox"
          checked={fullTank}
          onChange={(e) => setFullTank(e.target.checked)}
        />
        <span>
          <strong>เติมเต็มถัง</strong>
          <small>ใช้คำนวณความประหยัดระหว่างรอบเต็มถัง</small>
        </span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={missed}
          onChange={(e) => setMissed(e.target.checked)}
        />
        <span>มีการเติมที่ไม่ได้บันทึกก่อนรายการนี้</span>
      </label>
      <details className="optional-fields">
        <summary>ข้อมูลเพิ่มเติม · ชนิดน้ำมัน ปั๊ม หมายเหตุ</summary>
        <div className="form-stack">
          <label className="field">
            <span>ชนิดน้ำมัน</span>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
            >
              {fuelTypes.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <Field
            label="ปั๊มน้ำมัน"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            maxLength={120}
          />
          <Field
            label="หมายเหตุ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </div>
      </details>
      <p className="hint">
        <Info size={16} />
        เต็มถังอย่างน้อย 2 ครั้ง จึงเริ่มสรุปอัตราสิ้นเปลืองได้
      </p>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="form-footer">
        <button className="button primary full" disabled={busy}>
          <Save size={18} />
          {busy
            ? "กำลังบันทึก…"
            : fillup
              ? "บันทึกการแก้ไข"
              : "บันทึกเติมน้ำมัน"}
        </button>
      </div>
    </form>
  );
}
