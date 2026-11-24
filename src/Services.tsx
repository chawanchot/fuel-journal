import { useState, type FormEvent } from "react";
import { Info, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { ServiceRecord, Vehicle } from "./types";
import {
  DateRangeFilter,
  displayDate,
  Empty,
  ErrorMessage,
  Field,
  money,
  number,
  today,
} from "./components";
import { parseService, sortServices } from "./lib/services";

export function ServiceForm({
  vehicle,
  service,
  busy,
  onSave,
}: {
  vehicle: Vehicle;
  service?: ServiceRecord;
  busy: boolean;
  onSave: (service: ServiceRecord) => Promise<void>;
}) {
  const [date, setDate] = useState(service?.date ?? today());
  const [odometer, setOdometer] = useState(
    service?.odometerKm.toString() ?? "",
  );
  const [items, setItems] = useState(service?.items.join("\n") ?? "");
  const [amount, setAmount] = useState(
    service?.amountSatang === undefined
      ? ""
      : String(service.amountSatang / 100),
  );
  const [shop, setShop] = useState(service?.shop ?? "");
  const [note, setNote] = useState(service?.note ?? "");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (!odometer.trim()) throw new Error("กรุณาระบุเลขไมล์ที่เข้ารับบริการ");
      const now = new Date().toISOString();
      const next = parseService({
        id: service?.id ?? crypto.randomUUID(),
        vehicleId: vehicle.id,
        date,
        odometerKm: Number(odometer),
        items: items
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
        ...(amount.trim()
          ? { amountSatang: Math.round(Number(amount) * 100) }
          : {}),
        shop: shop.trim(),
        note: note.trim(),
        createdAt: service?.createdAt ?? now,
        updatedAt: now,
      });
      await onSave(next);
    } catch (error) {
      setError(
        error instanceof Error && !(error instanceof DOMException)
          ? error.message
          : "บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บ ข้อมูลในฟอร์มยังอยู่",
      );
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-vehicle">
        <span className="status-dot" />
        {vehicle.name}
        <span className="muted">ประวัติซ่อมบำรุง</span>
      </div>
      <div className="form-grid">
        <Field
          label="วันที่เข้ารับบริการ"
          type="date"
          max={today()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Field
          label="เลขไมล์ที่เข้ารับบริการ"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          unit="กม."
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          required
          placeholder="0"
        />
      </div>
      <label className="field" htmlFor="service-items">
        <span>รายการที่ทำ</span>
        <textarea
          id="service-items"
          aria-label="รายการที่ทำ"
          className="service-textarea"
          value={items}
          onChange={(e) => setItems(e.target.value)}
          rows={5}
          maxLength={10049}
          required
          placeholder={"เปลี่ยนน้ำมันเครื่อง\nเปลี่ยนไส้กรองน้ำมันเครื่อง\nสลับยาง"}
          aria-describedby="service-items-hint"
        />
        <small id="service-items-hint">
          พิมพ์ 1 รายการต่อบรรทัด อย่างน้อย 1 รายการ
        </small>
      </label>
      <Field
        label="ค่าใช้จ่ายรวม"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        unit="บาท"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="ไม่บังคับ"
        hint="เว้นว่างหากไม่ทราบ ใส่ 0 หากไม่มีค่าใช้จ่าย"
      />
      <Field
        label="อู่ / ศูนย์บริการ"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        maxLength={120}
        placeholder="ไม่บังคับ"
      />
      <label className="field" htmlFor="service-note">
        <span>หมายเหตุ</span>
        <textarea
          id="service-note"
          aria-label="หมายเหตุการซ่อมบำรุง"
          className="service-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="เช่น ยี่ห้อน้ำมันเครื่อง อะไหล่ หรือสิ่งที่ช่างแนะนำ"
        />
      </label>
      <p className="hint">
        <Info size={16} />
        บันทึกย้อนหลังได้ ประวัตินี้แยกจากรายการเติมน้ำมันและไม่เปลี่ยนค่าอัตราสิ้นเปลือง
      </p>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="form-footer">
        <button className="button primary full" disabled={busy}>
          <Save size={18} />
          {busy ? "กำลังบันทึก…" : service ? "บันทึกการแก้ไขซ่อมบำรุง" : "บันทึกซ่อมบำรุง"}
        </button>
      </div>
    </form>
  );
}

export default function Services({
  services = [],
  vehicle,
  busy,
  onAdd,
  onEdit,
  onDelete,
}: {
  services?: ServiceRecord[];
  vehicle?: Vehicle;
  busy: boolean;
  onAdd: () => void;
  onEdit: (service: ServiceRecord) => void;
  onDelete: (service: ServiceRecord) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const records = sortServices(
    services.filter(
      (s) =>
        s.vehicleId === vehicle?.id &&
        (!start || s.date >= start) &&
        (!end || s.date <= end),
    ),
  );
  const knownCosts = records.filter((s) => s.amountSatang !== undefined);
  const total = knownCosts.reduce((sum, s) => sum + s.amountSatang!, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CARE FOR EVERY MILE</span>
          <h1>
            สมุดซ่อมบำรุง<span className="heading-dot">.</span>
          </h1>
          <p>
            {vehicle
              ? `จำได้ว่า ${vehicle.name} ทำอะไรไปแล้วบ้าง`
              : "เพิ่มรถเพื่อเริ่มเก็บประวัติเซอร์วิสและซ่อมบำรุง"}
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={19} />
          เพิ่มบันทึก
        </button>
      </div>
      <div className="history-summary service-summary">
        <div>
          <span>เข้ารับบริการในช่วงที่เลือก</span>
          <strong>
            {records.length} <small>ครั้ง</small>
          </strong>
        </div>
        <div>
          <span>ค่าใช้จ่ายที่บันทึกไว้</span>
          <strong>{knownCosts.length ? `฿${money(total)}` : "—"}</strong>
          <small>
            {knownCosts.length} จาก {records.length} รายการระบุยอดจ่าย
          </small>
        </div>
        <div>
          <span>เลขไมล์ครั้งล่าสุดในช่วงนี้</span>
          <strong>
            {records.length ? number(records[0].odometerKm, 0) : "—"}{" "}
            <small>กม.</small>
          </strong>
        </div>
      </div>
      <DateRangeFilter
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        startLabel="ซ่อมบำรุงตั้งแต่วันที่"
        endLabel="ซ่อมบำรุงถึงวันที่"
      />
      {records.length ? (
        <section className="service-table-section">
          <p className="service-scroll-hint">เลื่อนตารางซ้าย–ขวาเพื่อดูรายละเอียดทั้งหมด</p>
          <div className="service-table-scroll" role="region" aria-label="ตารางประวัติซ่อมบำรุง เลื่อนแนวนอนได้" tabIndex={0}>
            <table className="service-table">
              <caption className="sr-only">ประวัติซ่อมบำรุงของ {vehicle?.name} เรียงจากวันที่ล่าสุด</caption>
              <thead><tr>
                <th scope="col">วันที่</th>
                <th scope="col" className="service-numeric">เลขไมล์ (กม.)</th>
                <th scope="col">รายการที่ทำ</th>
                <th scope="col">อู่ / ศูนย์บริการ</th>
                <th scope="col" className="service-numeric">ค่าใช้จ่าย (บาท)</th>
                <th scope="col">หมายเหตุ</th>
                <th scope="col">จัดการ</th>
              </tr></thead>
              <tbody>{records.map((service) => (
                <tr className="service-row" key={service.id}>
                  <td className="service-date"><time dateTime={service.date}>{displayDate(service.date)}</time></td>
                  <td className="service-numeric">{number(service.odometerKm, 1)}</td>
                  <td><ul className="service-items">{service.items.map((item,index)=><li key={index}>{item}</li>)}</ul></td>
                  <td className="service-table-text">{service.shop || '—'}</td>
                  <td className="service-numeric service-cost">{service.amountSatang === undefined ? 'ยังไม่ระบุ' : `฿${money(service.amountSatang)}`}</td>
                  <td className="service-table-text">{service.note || '—'}</td>
                  <td><div className="service-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`แก้ไขซ่อมบำรุง ${service.date} ${service.odometerKm}`}
                    disabled={busy}
                    onClick={() => onEdit(service)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`ลบซ่อมบำรุง ${service.date} ${service.odometerKm}`}
                    disabled={busy}
                    onClick={() => onDelete(service)}
                  >
                    <Trash2 size={17} />
                  </button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card">
          <Empty
            title={
              services.some((s) => s.vehicleId === vehicle?.id)
                ? "ไม่พบประวัติในช่วงนี้"
                : "รถคันนี้ ดูแลอะไรไปแล้วบ้าง"
            }
            description="จดเลขไมล์และรายการที่ทำ เช่น เปลี่ยนน้ำมันเครื่อง เปลี่ยนยาง หรือเช็กระยะ ไว้ย้อนดูได้ในที่เดียว"
            action="บันทึกซ่อมบำรุงครั้งแรก"
            onAction={onAdd}
          />
        </section>
      )}
      <p className="hint history-hint">
        <Info size={17} />
        ค่าใช้จ่ายซ่อมบำรุงแสดงแยกจากค่าน้ำมัน ไม่บวกซ้ำในรายจ่ายการเติมหรือทริป
      </p>
    </>
  );
}
