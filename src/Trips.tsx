import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Droplets,
  Info,
  Pencil,
  Plus,
  Route,
  Save,
  Trash2,
} from "lucide-react";
import type { Trip, Vehicle } from "./types";
import {
  displayDate,
  Empty,
  ErrorMessage,
  Field,
  money,
  number,
  today,
  DateRangeFilter,
} from "./components";
import { parseTrip, tripTotals, tripTitle } from "./lib/trips";

export function TripForm({
  vehicle,
  trip,
  historyEfficiency,
  busy,
  onSave,
}: {
  vehicle: Vehicle;
  trip?: Trip;
  historyEfficiency: number | null;
  busy: boolean;
  onSave: (trip: Trip) => Promise<void>;
}) {
  const [name, setName] = useState(trip?.name ?? "");
  const [ongoing, setOngoing] = useState(trip?.status === "ongoing");
  const [startDate, setStartDate] = useState(trip?.startDate ?? today());
  const [endDate, setEndDate] = useState(trip?.endDate ?? today());
  const [distanceMode, setDistanceMode] = useState<Trip["distanceMode"]>(
    trip?.distanceMode ?? "distance",
  );
  const [distanceInput, setDistance] = useState(
    trip?.distanceKm?.toString() ?? "",
  );
  const [startOdo, setStartOdo] = useState(
    trip?.startOdometerKm?.toString() ?? "",
  );
  const [endOdo, setEndOdo] = useState(trip?.endOdometerKm?.toString() ?? "");
  const [fuelMode, setFuelMode] = useState<Trip["fuelMode"]>(
    trip?.fuelMode ?? "estimated",
  );
  // Persist the rate used for this trip; subsequent vehicle/history changes must not rewrite it.
  const [source, setSource] = useState("manual");
  const [rateSource, setRateSource] = useState<Trip["efficiencySource"]>(
    trip?.efficiencySource ?? "manual",
  );
  const [unit, setUnit] = useState("kmpl");
  const [efficiency, setEfficiency] = useState(
    trip?.efficiencyKmPerLitre?.toString() ?? "",
  );
  const [actualLitres, setActualLitres] = useState(
    trip?.actualVolumeMillilitres
      ? String(trip.actualVolumeMillilitres / 1000)
      : "",
  );
  const [price, setPrice] = useState(
    trip?.priceSatangPerLitre ? String(trip.priceSatangPerLitre / 100) : "",
  );
  const [extras, setExtras] = useState(
    trip ? String(trip.extrasSatang / 100) : "",
  );
  const [note, setNote] = useState(trip?.note ?? "");
  const [error, setError] = useState("");
  const distance =
    distanceMode === "distance"
      ? Number(distanceInput)
      : Number(endOdo) - Number(startOdo);
  const rate =
    Number(efficiency) > 0
      ? unit === "l100km"
        ? 100 / Number(efficiency)
        : Number(efficiency)
      : 0;
  const litres =
    fuelMode === "actual"
      ? Number(actualLitres)
      : rate > 0
        ? distance / rate
        : 0;
  const ready =
    !ongoing &&
    Number.isFinite(distance) &&
    distance > 0 &&
    Number.isFinite(litres) &&
    litres > 0 &&
    (distanceMode === "distance" ||
      (startOdo.trim() !== "" &&
        endOdo.trim() !== "" &&
        Number(startOdo) >= 0));
  const estimatedCost =
    ready &&
    price !== "" &&
    Number(price) > 0 &&
    Number.isFinite(Number(price)) &&
    Number(extras) >= 0
      ? litres * Number(price) + Number(extras || 0)
      : null;
  function selectSource(value: string) {
    setSource(value);
    setRateSource(value as Trip["efficiencySource"]);
    const chosen =
      value === "history"
        ? historyEfficiency
        : value === "vehicle"
          ? vehicle.manualEfficiency
          : null;
    if (chosen)
      setEfficiency(String(unit === "l100km" ? 100 / chosen : chosen));
  }
  function switchUnit(value: string) {
    if (
      value !== unit &&
      Number(efficiency) > 0 &&
      Number.isFinite(Number(efficiency))
    )
      setEfficiency(String(100 / Number(efficiency)));
    setUnit(value);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (
        distanceMode === "distance"
          ? !distanceInput.trim()
          : !startOdo.trim() || (!ongoing && !endOdo.trim())
      )
        throw new Error("กรุณากรอกระยะทางหรือเลขไมล์ให้ครบ");
      if (!ongoing && fuelMode === "actual" && !actualLitres.trim())
        throw new Error("กรุณาระบุอัตราสิ้นเปลืองหรือน้ำมันที่ใช้จริง");
      const now = new Date().toISOString();
      const next = parseTrip({
        id: trip?.id ?? crypto.randomUUID(),
        vehicleId: vehicle.id,
        name: name.trim(),
        startDate,
        status: ongoing ? "ongoing" : "completed",
        ...(ongoing ? {} : { endDate }),
        distanceMode,
        ...(ongoing ? {} : { distanceKm: distance }),
        ...(distanceMode === "odometer"
          ? {
              startOdometerKm: Number(startOdo),
              ...(ongoing ? {} : { endOdometerKm: Number(endOdo) }),
            }
          : {}),
        fuelMode,
        ...(fuelMode === "estimated"
          ? {
              ...(efficiency.trim() ? { efficiencyKmPerLitre: rate } : {}),
              efficiencySource: rateSource,
            }
          : {
              ...(actualLitres.trim()
                ? {
                    actualVolumeMillilitres: Math.round(
                      Number(actualLitres) * 1000,
                    ),
                  }
                : {}),
            }),
        ...(price.trim()
          ? { priceSatangPerLitre: Math.round(Number(price) * 100) }
          : {}),
        extrasSatang: Math.round(Number(extras || 0) * 100),
        note: note.trim(),
        createdAt: trip?.createdAt ?? now,
        updatedAt: now,
      });
      await onSave(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "บันทึกทริปไม่ได้ ข้อมูลในฟอร์มยังอยู่",
      );
    }
  }
  const numeric = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    unitLabel: string,
    optional = false,
    min = "0.001",
  ) => (
    <Field
      label={label}
      value={value}
      type="number"
      inputMode="decimal"
      min={min}
      step="any"
      unit={unitLabel}
      required={!optional}
      onChange={(e) => onChange(e.target.value)}
      placeholder={optional ? "ไม่บังคับ" : "0"}
    />
  );
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-vehicle">
        <span className="status-dot" />
        {vehicle.name}
        <span className="muted">บันทึกการเดินทาง</span>
      </div>
      <Field
        label="ชื่อทริป"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="เช่น เที่ยวเขาใหญ่กับครอบครัว"
        hint="ไม่บังคับ ถ้าเว้นว่างจะแสดงชื่อจากวันเริ่มทริป"
        maxLength={120}
      />
        <label className="check-card">
          <input
            type="checkbox"
            checked={ongoing}
            onChange={(e) => {
              setOngoing(e.target.checked);
              if (e.target.checked) setDistanceMode("odometer");
            }}
          />
          <span>
            <strong>บันทึกเลขไมล์เริ่มต้นไว้ก่อน</strong>
            <small>ยังไม่จบทริป กลับมาใส่เลขไมล์จบภายหลังได้</small>
          </span>
        </label>
      <div className="form-grid">
        <Field
          label="วันเริ่มทริป"
          type="date"
          value={startDate}
          max={ongoing ? today() : endDate || today()}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        {!ongoing && (
          <Field
            label="วันสิ้นสุดทริป"
            type="date"
            value={endDate}
            min={startDate}
            max={today()}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        )}
      </div>
      <label className="field">
        <span>ระบุระยะทาง</span>
        <select
          aria-label="ระบุระยะทาง"
          value={distanceMode}
          onChange={(e) => {
            setDistanceMode(e.target.value as Trip["distanceMode"]);
            if (e.target.value === "distance") setOngoing(false);
          }}
        >
          <option value="distance">กรอกระยะทางรวม</option>
          <option value="odometer">เลขไมล์เริ่มต้น–สิ้นสุด</option>
        </select>
      </label>
      {ongoing && (
        <button
          type="button"
          className="button secondary"
          onClick={() => setOngoing(false)}
        >
          จบทริปและกรอกเลขไมล์
        </button>
      )}
      {distanceMode === "distance" ? (
        numeric("ระยะทางรวมของทริป", distanceInput, setDistance, "กม.")
      ) : (
        <div className="form-grid">
          {numeric(
            "เลขไมล์เริ่มทริป",
            startOdo,
            setStartOdo,
            "กม.",
            false,
            "0",
          )}
          {!ongoing && numeric("เลขไมล์จบทริป", endOdo, setEndOdo, "กม.")}
        </div>
      )}
      <p className="hint">
        <Route size={16} />
        {ongoing
          ? "บันทึกแค่เลขไมล์เริ่มต้นได้ ข้อมูลน้ำมันและค่าใช้จ่ายด้านล่างเติมภายหลังได้"
          : "ระยะทางรวมทั้งทริป รวมขากลับแล้วถ้ามี ไม่เพิ่มเป็นสองเท่าอัตโนมัติ"}
      </p>
      <label className="field">
        <span>น้ำมันที่ใช้ในทริป</span>
        <select
          aria-label="น้ำมันที่ใช้ในทริป"
          value={fuelMode}
          onChange={(e) => setFuelMode(e.target.value as Trip["fuelMode"])}
        >
          <option value="estimated">ประเมินจากอัตราสิ้นเปลือง</option>
          <option value="actual">กรอกปริมาณที่ใช้จริง</option>
        </select>
      </label>
      {fuelMode === "estimated" ? (
        <>
          <label className="field">
            <span>ใช้อัตราสิ้นเปลืองจาก</span>
            <select
              aria-label="ใช้อัตราสิ้นเปลืองจาก"
              value={source}
              onChange={(e) => selectSource(e.target.value)}
            >
              <option value="manual">
                {trip ? "ค่าที่บันทึกไว้ / กรอกเอง" : "กรอกด้วยตัวเอง"}
              </option>
              {historyEfficiency && (
                <option value="history">
                  ค่าเฉลี่ยปัจจุบันจากประวัติ · {number(historyEfficiency)}{" "}
                  กม./ลิตร
                </option>
              )}
              {vehicle.manualEfficiency && (
                <option value="vehicle">
                  ค่าของรถ · {number(vehicle.manualEfficiency)} กม./ลิตร
                </option>
              )}
            </select>
          </label>
          <label className="field">
            <span>หน่วยอัตราสิ้นเปลือง</span>
            <select
              aria-label="หน่วยอัตราสิ้นเปลือง"
              value={unit}
              onChange={(e) => switchUnit(e.target.value)}
            >
              <option value="kmpl">กม./ลิตร</option>
              <option value="l100km">ลิตร/100กม.</option>
            </select>
          </label>
          {numeric(
            "อัตราสิ้นเปลืองของทริป",
            efficiency,
            (value) => {
              setSource("manual");
              setRateSource("manual");
              setEfficiency(value);
            },
            unit === "kmpl" ? "กม./ลิตร" : "ลิตร/100กม.",
            true,
          )}
          <p className="hint">
            <Info size={16} />
            เก็บอัตราที่ใช้ ณ วันที่บันทึก
            สถิติรถที่เปลี่ยนภายหลังไม่เปลี่ยนทริปเก่า เว้นว่างได้หากยังไม่ทราบ
            ระบบจะแสดงเฉพาะระยะทาง
          </p>
        </>
      ) : (
        <>
          {numeric(
            "น้ำมันที่ใช้จริง",
            actualLitres,
            setActualLitres,
            "ลิตร",
            ongoing,
          )}
          <p className="hint">
            <Info size={16} />
            ใช้ปริมาณที่ทราบว่าใช้จริงตลอดทริป
            ยอดเติมระหว่างทางอาจไม่เท่ากับน้ำมันที่ใช้
          </p>
        </>
      )}
      <div className="form-grid">
        {numeric("ราคาน้ำมันของทริป", price, setPrice, "บาท/ลิตร", true)}
        {numeric("ค่าใช้จ่ายเพิ่มเติม", extras, setExtras, "บาท", true, "0")}
      </div>
      <p className="hint">
        ใส่ราคาต่อลิตรเพื่อประเมินค่าน้ำมัน หากไม่ใส่จะแสดงเฉพาะระยะทางและลิตร
      </p>
      {ready && (
        <div className="trip-preview" aria-live="polite">
          <span>{number(distance)} กม.</span>
          <ArrowRight size={16} />
          <strong>
            {number(litres)} ลิตร
            {fuelMode === "estimated" ? " (ประมาณ)" : " (กรอกจริง)"}
          </strong>
          {estimatedCost !== null && (
            <small>
              ค่าใช้จ่ายประมาณ ฿{number(estimatedCost)} รวมค่าใช้จ่ายเพิ่มเติม
            </small>
          )}
        </div>
      )}
      <Field
        label="บันทึกเกี่ยวกับทริป"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        placeholder="เส้นทาง สถานที่ หรือสิ่งที่อยากจำ"
      />
      <ErrorMessage>{error}</ErrorMessage>
      <div className="form-footer">
        <button className="button primary full" disabled={busy}>
          <Save size={18} />
          {busy
            ? "กำลังบันทึก…"
            : ongoing
              ? "บันทึกทริปที่ยังไม่จบ"
              : trip?.status === "ongoing"
                ? "บันทึกจบทริป"
                : trip
                  ? "บันทึกการแก้ไขทริป"
                  : "บันทึกทริป"}
        </button>
      </div>
    </form>
  );
}

export default function Trips({
  trips = [],
  vehicle,
  busy,
  onAdd,
  onEdit,
  onDelete,
}: {
  trips?: Trip[];
  vehicle?: Vehicle;
  busy: boolean;
  onAdd: () => void;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const ordered = trips
    .filter(
      (t) =>
        t.vehicleId === vehicle?.id &&
        (!start ||
          (t.status === "ongoing" ? today() : (t.endDate ?? t.startDate)) >=
            start) &&
        (!end || t.startDate <= end),
    )
    .sort(
      (a, b) =>
        b.startDate.localeCompare(a.startDate) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
  const distance = ordered.reduce(
    (sum, t) => sum + (t.status === "ongoing" ? 0 : (t.distanceKm ?? 0)),
    0,
  );
  const litres = ordered.reduce(
    (sum, t) => sum + (tripTotals(t).litres ?? 0),
    0,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MEMORIES ALONG THE WAY</span>
          <h1>
            ทริปของเรา<span className="heading-dot">.</span>
          </h1>
          <p>
            {vehicle
              ? `บันทึกทุกเส้นทางของ ${vehicle.name}`
              : "เพิ่มรถก่อนเริ่มบันทึกการเดินทาง"}
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={19} />
          เพิ่มทริป
        </button>
      </div>
      <div className="history-summary">
        <div>
          <span>ทริปในช่วงที่เลือก</span>
          <strong>
            {ordered.length} <small>ทริป</small>
          </strong>
        </div>
        <div>
          <span>ระยะทางทริปที่จบแล้ว</span>
          <strong>
            {number(distance)} <small>กม.</small>
          </strong>
        </div>
        <div>
          <span>น้ำมันเฉพาะทริปที่มีข้อมูล</span>
          <strong>
            {number(litres)} <small>ลิตร</small>
          </strong>
        </div>
      </div>
      <DateRangeFilter start={start} end={end} onStartChange={setStart} onEndChange={setEnd} startLabel="ทริปตั้งแต่วันที่" endLabel="ทริปถึงวันที่" />
      {ordered.length ? (
        <div className="trip-list">
          {ordered.map((t) => {
            const totals = tripTotals(t);
            return (
              <article className="card trip-card" key={t.id}>
                <div className="trip-card-heading">
                  <span className="stat-icon">
                    <Route size={21} />
                  </span>
                  <div>
                    <h2>{tripTitle(t)}</h2>
                    {t.status === "ongoing" && (
                      <span className="pill green">กำลังเดินทาง</span>
                    )}
                    <p className="record-meta">
                      {displayDate(t.startDate)}
                      {t.endDate &&
                        t.endDate !== t.startDate &&
                        ` – ${displayDate(t.endDate)}`}
                    </p>
                  </div>
                  <div className="trip-actions">
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label={`แก้ไขทริป ${tripTitle(t)}`}
                      onClick={() => onEdit(t)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button danger"
                      disabled={busy}
                      aria-label={`ลบทริป ${tripTitle(t)}`}
                      onClick={() => onDelete(t)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="trip-metrics">
                  <div>
                    <span>ระยะทางทั้งทริป</span>
                    <strong>
                      {t.status === "ongoing" ? "—" : number(t.distanceKm!)}{" "}
                      <small>กม.</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      {t.fuelMode === "actual"
                        ? "น้ำมันที่ใช้ (กรอกจริง)"
                        : "น้ำมันที่ใช้ (ประมาณ)"}
                    </span>
                    <strong>
                      {totals.litres === null ? "—" : number(totals.litres)}{" "}
                      <small>ลิตร</small>
                    </strong>
                  </div>
                </div>
                <div className="trip-cost">
                  <span>ค่าน้ำมันโดยประมาณ</span>
                  <strong>
                    {t.status === "ongoing"
                      ? "รอจบทริป"
                      : totals.litres === null
                        ? "ยังไม่มีข้อมูลน้ำมัน"
                        : totals.fuelCostSatang === null
                          ? "ยังไม่ได้ระบุราคา"
                          : `฿${money(totals.fuelCostSatang)}`}
                  </strong>
                </div>
                {t.extrasSatang > 0 && (
                  <div className="trip-cost">
                    <span>ค่าใช้จ่ายเพิ่มเติม</span>
                    <strong>฿{money(t.extrasSatang)}</strong>
                  </div>
                )}
                {totals.totalSatang !== null && (
                  <div className="trip-cost total">
                    <span>รวมค่าใช้จ่ายประมาณ</span>
                    <strong>฿{money(totals.totalSatang)}</strong>
                  </div>
                )}
                <p className="hint trip-detail">
                  <Droplets size={15} />
                  {t.efficiencyKmPerLitre === undefined &&
                  t.fuelMode === "estimated"
                    ? "ระบุอัตราสิ้นเปลืองภายหลังได้ ยังไม่คำนวณน้ำมัน"
                    : t.fuelMode === "estimated"
                      ? `อัตราที่บันทึก ${number(t.efficiencyKmPerLitre!)} กม./ลิตร · ${t.efficiencySource === "history" ? "จากประวัติ ณ วันบันทึก" : t.efficiencySource === "vehicle" ? "จากค่าของรถ ณ วันบันทึก" : "กรอกเอง"}`
                      : "ปริมาณน้ำมันที่ผู้ใช้ระบุว่าใช้จริง"}
                </p>
                {t.distanceMode === "odometer" && (
                  <p className="hint">
                    เลขไมล์ {number(t.startOdometerKm!)} →{" "}
                    {t.status === "ongoing"
                      ? "รอเลขไมล์จบ"
                      : number(t.endOdometerKm!)}{" "}
                    กม.
                  </p>
                )}
                {t.note && <p className="trip-note">{t.note}</p>}
                {t.status === "ongoing" && (
                  <button
                    className="button primary full"
                    style={{ marginTop: 18 }}
                    disabled={busy}
                    onClick={() => onEdit(t)}
                  >
                    กรอกเลขไมล์จบทริป
                    <ArrowRight size={17} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty
            title={
              trips.some((t) => t.vehicleId === vehicle?.id)
                ? "ไม่พบทริปในช่วงนี้"
                : "เก็บความทรงจำ จากทุกกิโลเมตร"
            }
            description="บันทึกทริปเที่ยวหรือเดินทาง แล้วกลับมาดูระยะทาง น้ำมัน และค่าใช้จ่ายได้ทุกเมื่อ"
            action="เพิ่มทริปแรก"
            onAction={onAdd}
          />
        </section>
      )}
      <p className="hint history-hint">
        <Info size={17} />
        บันทึกทริปเป็นสรุปการเดินทางแยกต่างหาก
        ไม่เพิ่มยอดเติมหรือรายจ่ายรายเดือนซ้ำ น้ำมันประมาณอาจต่างจากการใช้จริง
      </p>
    </>
  );
}
