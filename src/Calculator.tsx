import { useState } from "react";
import {
  ArrowRight,
  Calculator as CalculatorIcon,
  Route,
  Droplets,
  Info,
  ArrowDownUp,
} from "lucide-react";
import {
  calculateConsumption,
  calculateTrip,
  calculateRange,
} from "./lib/calculations";
import { Field, number } from "./components";
import type { Vehicle } from "./types";

type Props = {
  vehicle?: Vehicle;
  historyEfficiency: number | null;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
};
export default function Calculator({
  vehicle,
  historyEfficiency,
  values,
  onChange,
}: Props) {
  const [tab, setTab] = useState("trip");
  const [inputs, setInputs] = useState(values);
  const key = `${vehicle?.id ?? "guest"}:${tab}:`;
  const get = (name: string) => inputs[key + name] ?? "";
  const set = (name: string, value: string) => {
    setInputs((current) => ({ ...current, [key + name]: value }));
    onChange({ [key + name]: value });
  };
  const val = (name: string) => Number(get(name));
  const source = get('source') || 'manual';
  const rangeMode = get('rangeMode') || 'used';
  const consumptionMode = get('consumptionMode') || 'distance';
  const per100 = tab === 'trip' && get('efficiencyUnit') === 'l100km';
  const efficiencyUnit = per100 ? 'ลิตร/100กม.' : 'กม./ลิตร';
  const manualRate = per100 && val('efficiency') !== 0 ? 100 / val('efficiency') : val('efficiency');
  function changeEfficiencyUnit(unit: string) {
    const convert = get('efficiency') && Number.isFinite(val('efficiency')) && val('efficiency') > 0;
    const patch = {
      [key + 'efficiencyUnit']: unit,
      ...(convert ? { [key + 'efficiency']: String(100 / val('efficiency')) } : {}),
    };
    setInputs(current => ({ ...current, ...patch }));
    onChange(patch);
  }
  const displayRate = (kmPerLitre: number) => number(per100 ? 100 / kmPerLitre : kmPerLitre);
  const rate =
    source === "history"
      ? historyEfficiency
      : source === "vehicle"
        ? vehicle?.manualEfficiency
        : manualRate;
  const sourceLabel =
    source === "history"
      ? "ค่าเฉลี่ยรอบเต็มถังของรถคันนี้"
      : source === "vehicle"
        ? "ค่าที่ตั้งไว้ในข้อมูลรถ"
        : "อัตราที่คุณกรอกเอง";
  let result: {
    main: string;
    unit: string;
    rows: [string, string][];
    formula: string;
  } | null = null;
  let invalid = "";
  try {
    const activeFields = tab === 'trip' ? ['distance','price','extras','people'] : tab === 'consumption' ? [consumptionMode === 'distance' ? 'distance' : 'start', ...(consumptionMode === 'distance' ? [] : ['end']), 'litres'] : rangeMode === 'used' ? ['distance'] : rangeMode === 'budget' ? ['budget','price'] : ['litres'];
    for (const field of activeFields) {
      if (get(field) && (!Number.isFinite(val(field)) || val(field) < 0 || (val(field) === 0 && !['start','extras'].includes(field)))) throw new Error('กรุณากรอกตัวเลขมากกว่า 0 ยกเว้นเลขไมล์เริ่มต้นและค่าใช้จ่ายเพิ่มเติมที่เป็น 0 ได้');
    }
    if (tab !== 'consumption' && source === 'manual' && get('efficiency') && (val('efficiency') <= 0 || !rate || !Number.isFinite(rate) || rate <= 0)) throw new Error('อัตราสิ้นเปลืองต้องมากกว่า 0');
    if (tab === "trip" && get("distance") && get("price") && rate) {
      const trip = calculateTrip(
        val("distance"),
        rate,
        val("price"),
        get("round") === "yes",
        get("extras") ? val("extras") : 0,
        get("people") ? val("people") : 1,
      );
      if (!Number.isInteger(get("people") ? val("people") : 1))
        throw new Error("จำนวนคนต้องเป็นจำนวนเต็ม");
      result = {
        main: number(trip.total),
        unit: "บาท / ทริป",
        rows: [
          ["ระยะทางรวม", `${number(trip.distance, 0)} กม.`],
          ["น้ำมันที่ใช้โดยประมาณ", `${number(trip.litres)} ลิตร`],
          ["ค่าน้ำมัน", `${number(trip.fuelCost)} บาท`],
          ["หารต่อคน", `${number(trip.perPerson)} บาท`],
        ],
        formula:
          per100
            ? "น้ำมัน = ระยะทางรวม × ลิตร/100กม. ÷ 100 · ค่าน้ำมัน = ลิตร × ราคาต่อลิตร"
            : "น้ำมัน = ระยะทางรวม ÷ กม./ลิตร · ค่าน้ำมัน = ลิตร × ราคาต่อลิตร",
      };
    } else if (tab === "consumption") {
      const distance =
        consumptionMode === "distance"
          ? val("distance")
          : val("end") - val("start");
      if (
        get("litres") &&
        (consumptionMode === "distance"
          ? get("distance")
          : get("start") && get("end"))
      ) {
        const calculated = calculateConsumption(distance, val("litres"));
        result = {
          main: number(calculated.efficiency),
          unit: "กม. / ลิตร",
          rows: [
            [
              "การใช้น้ำมันต่อ 100 กม.",
              `${number(calculated.litresPer100)} ลิตร`,
            ],
            ["ระยะทาง", `${number(distance)} กม.`],
          ],
          formula:
            "กม./ลิตร = ระยะทาง ÷ น้ำมันที่ใช้ · ลิตร/100 กม. = 100 × ลิตร ÷ ระยะทาง",
        };
      }
    } else if (tab === "range" && rate && rate > 0) {
      if (rangeMode === "used" && get("distance")) {
        const distance = val("distance");
        if (!Number.isFinite(distance) || distance <= 0)
          throw new Error("กรุณากรอกระยะทางมากกว่า 0");
        result = {
          main: number(distance / rate),
          unit: "ลิตร ที่ใช้โดยประมาณ",
          rows: [
            ["ระยะทางที่วิ่ง", `${number(distance, 0)} กม.`],
            ["อัตราที่ใช้", `${number(rate)} กม./ลิตร`],
          ],
          formula: "ลิตรที่ใช้ = ระยะทาง ÷ กม./ลิตร",
        };
      } else if (
        rangeMode !== "used" &&
        (rangeMode === "budget" ? get("budget") && get("price") : get("litres"))
      ) {
        const litres =
          rangeMode === "budget" ? val("budget") / val("price") : val("litres");
        if (rangeMode === "budget" && (val("budget") <= 0 || val("price") <= 0))
          throw new Error("งบและราคาต้องมากกว่า 0");
        result = {
          main: number(calculateRange(litres, rate), 0),
          unit: "กม. ที่วิ่งได้โดยประมาณ",
          rows: [
            ["น้ำมัน", `${number(litres)} ลิตร`],
            ["อัตราที่ใช้", `${number(rate)} กม./ลิตร`],
          ],
          formula: "ระยะทาง = ลิตร × กม./ลิตร · ลิตรจากงบ = งบ ÷ ราคาต่อลิตร",
        };
      }
    }
  } catch (error) {
    invalid = error instanceof Error ? error.message : "กรุณาตรวจสอบข้อมูล";
  }
  function numeric(
    name: string,
    label: string,
    unit: string,
    placeholder = "0",
    optional = false,
  ) {
    return (
      <Field
        label={label}
        unit={unit}
        type="number"
        min={name === "start" || name === "extras" ? "0" : "0.001"}
        step={name === "people" ? "1" : "any"}
        inputMode="decimal"
        value={get(name)}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        hint={optional ? "ไม่บังคับ" : undefined}
      />
    );
  }
  const efficiencyFields = (
    <>
      {tab === 'trip' && <label className="field">
        <span>หน่วยอัตราสิ้นเปลือง</span>
        <select aria-label="หน่วยอัตราสิ้นเปลือง" value={per100 ? 'l100km' : 'kmpl'} onChange={e => changeEfficiencyUnit(e.target.value)}>
          <option value="kmpl">กม./ลิตร</option>
          <option value="l100km">ลิตร/100กม.</option>
        </select>
      </label>}
      <label className="field">
        <span>ใช้อัตราสิ้นเปลืองจาก</span>
        <select
          aria-label="ใช้อัตราสิ้นเปลืองจาก"
          value={source}
          onChange={(e) => set('source', e.target.value)}
        >
          <option value="manual">กรอกด้วยตัวเอง</option>
          {historyEfficiency && (
            <option value="history">
              ค่าเฉลี่ยจากประวัติ · {displayRate(historyEfficiency)} {efficiencyUnit}
            </option>
          )}
          {vehicle?.manualEfficiency && (
            <option value="vehicle">
              ค่าของรถ · {displayRate(vehicle.manualEfficiency)} {efficiencyUnit}
            </option>
          )}
        </select>
      </label>
      {source === "manual" ? (
        numeric("efficiency", "อัตราสิ้นเปลือง", efficiencyUnit)
      ) : (
        <p className="source-value">
          {rate ? displayRate(rate) : "—"} <span>{efficiencyUnit} · {sourceLabel}</span>
        </p>
      )}
    </>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLAN YOUR NEXT MILE</span>
          <h1>
            คำนวณก่อนออกเดินทาง<span className="heading-dot">.</span>
          </h1>
          <p>รู้ตัวเลขให้ชัด แล้วค่อยไปต่อ</p>
        </div>
        <span className="heading-icon">
          <CalculatorIcon size={28} strokeWidth={1.5} />
        </span>
      </div>
      <div className="calc-tabs" role="group" aria-label="ประเภทเครื่องคำนวณ">
        {[
          { id: "trip", name: "งบเดินทาง", icon: Route },
          { id: "consumption", name: "ความประหยัด", icon: ArrowDownUp },
          { id: "range", name: "ระยะทาง / น้ำมัน", icon: Droplets },
        ].map((item) => (
          <button
            key={item.id}
            aria-pressed={tab === item.id}
            className={tab === item.id ? "selected" : ""}
            onClick={() => setTab(item.id)}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="calculator-layout">
        <section className="card calculator-inputs">
          <div className="section-heading">
            <h2>
              {tab === "trip"
                ? "ทริปนี้ ไปไหนกัน"
                : tab === "consumption"
                  ? "รถคุณประหยัดแค่ไหน"
                  : "น้ำมันพาเราไปได้ไกลเท่าไร"}
            </h2>
            <span className="step-label">01 / ข้อมูล</span>
          </div>
          <div className="form-stack">
            {tab === "trip" && (
              <>
                {numeric("distance", "ระยะทางเที่ยวเดียว", "กม.")}
                <label className="check-card compact">
                  <input
                    type="checkbox"
                    checked={get("round") === "yes"}
                    onChange={(e) =>
                      set("round", e.target.checked ? "yes" : "no")
                    }
                  />
                  <span>
                    <strong>คำนวณไป–กลับ</strong>
                    <small>เพิ่มระยะทางเป็นสองเท่า</small>
                  </span>
                </label>
                {efficiencyFields}
                {numeric("price", "ราคาน้ำมัน", "บาท/ลิตร")}
                <div className="form-grid">
                  {numeric("extras", "ทางด่วน / จอดรถ", "บาท", "0", true)}
                  {numeric("people", "จำนวนคน", "คน", "1", true)}
                </div>
              </>
            )}
            {tab === "consumption" && (
              <>
                <label className="field">
                  <span>ระบุระยะทางแบบ</span>
                  <select
                    aria-label="ระบุระยะทางแบบ"
                    value={consumptionMode}
                    onChange={(e) => set('consumptionMode', e.target.value)}
                  >
                    <option value="distance">กรอกระยะทาง</option>
                    <option value="odometer">ใช้เลขไมล์ต้น–ปลาย</option>
                  </select>
                </label>
                {consumptionMode === "distance" ? (
                  numeric("distance", "ระยะทางที่วิ่ง", "กม.")
                ) : (
                  <div className="form-grid">
                    {numeric("start", "เลขไมล์เริ่มต้น", "กม.")}
                    {numeric("end", "เลขไมล์สิ้นสุด", "กม.")}
                  </div>
                )}
                {numeric("litres", "น้ำมันที่ใช้", "ลิตร")}
                <p className="hint">
                  <Info size={16} />
                  กรอกน้ำมันที่ใช้จริงในระยะนี้
                  ไม่ใช่น้ำมันที่เพิ่งเติมหากยังเหลืออยู่ในถัง
                </p>
              </>
            )}
            {tab === "range" && (
              <>
                <label className="field">
                  <span>ต้องการคำนวณ</span>
                  <select
                    aria-label="ต้องการคำนวณ"
                    value={rangeMode}
                    onChange={(e) => set('rangeMode', e.target.value)}
                  >
                    <option value="used">วิ่งระยะนี้ ใช้น้ำมันเท่าไร</option>
                    <option value="litres">
                      มีน้ำมันเท่านี้ วิ่งได้ไกลเท่าไร
                    </option>
                    <option value="budget">มีงบเท่านี้ วิ่งได้ไกลเท่าไร</option>
                  </select>
                </label>
                {rangeMode === "used" ? (
                  numeric("distance", "ระยะทางที่วิ่ง", "กม.")
                ) : rangeMode === "litres" ? (
                  numeric("litres", "ปริมาณน้ำมัน", "ลิตร")
                ) : (
                  <>
                    {numeric("budget", "งบน้ำมัน", "บาท")}
                    {numeric("price", "ราคาน้ำมัน", "บาท/ลิตร")}
                  </>
                )}
                {efficiencyFields}
              </>
            )}
          </div>
        </section>
        <aside className="calculator-results">
          <section className="result-card" aria-live="polite">
            <span className="eyebrow light">YOUR ESTIMATE</span>
            <div className="result-heading">
              {tab === "trip"
                ? "งบสำหรับทริปนี้"
                : tab === "consumption"
                  ? "อัตราสิ้นเปลืองของคุณ"
                  : "ผลคำนวณโดยประมาณ"}
            </div>
            <div className="result-number">
              {result?.main ?? "—"}
              <ArrowRight size={26} />
            </div>
            <span className="result-unit">
              {result?.unit ?? "กรอกข้อมูลเพื่อดูผลลัพธ์"}
            </span>
            <div className="result-breakdown">
              {result ? (
                result.rows.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))
              ) : (
                <p>
                  เริ่มจากข้อมูลด้านซ้าย
                  <br />
                  เราจะคำนวณให้ทันที
                </p>
              )}
            </div>
            {invalid && (
              <p className="result-error" role="alert">
                {invalid}
              </p>
            )}
          </section>
          <div className="calculation-note">
            <Info size={18} />
            <div>
              <strong>ตัวเลขที่ใช้วางแผนได้</strong>
              <p>
                {result?.formula ??
                  "ใส่ระยะทาง ปริมาณน้ำมัน หรืออัตราสิ้นเปลืองตามโหมดที่เลือก"}
              </p>
              {tab !== "consumption" && (
                <p>
                  แหล่งอัตรา: {sourceLabel}
                  <br />
                  การจราจร น้ำหนักบรรทุก และลักษณะการขับ มีผลต่อการใช้จริง
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
