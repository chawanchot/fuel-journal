import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  ArrowUpRight,
  Bike,
  Calculator as CalculatorIcon,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudOff,
  Download,
  Droplets,
  Fuel,
  Gauge,
  History,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import type { AppData, Fillup, Vehicle, Trip } from "./types";
import { emptyData, loadData, updateData } from "./lib/db";
import {
  calculateStats,
  sortFillups,
  validateFillup,
} from "./lib/calculations";
import { parseBackup, serializeBackup } from "./lib/backup";
import { registerPwa, checkForUpdates } from "./pwa";
import {
  displayDate,
  Empty,
  ErrorMessage,
  Modal,
  money,
  number,
  today,
  DateRangeFilter,
} from "./components";
import { FillupForm, VehicleForm } from "./forms";
import Calculator from "./Calculator";
import Trips, { TripForm } from "./Trips";
import { tripTitle } from "./lib/trips";

const navigation = [
  { id: "overview", label: "ภาพรวม", icon: LayoutDashboard },
  { id: "calculator", label: "คำนวณ", icon: CalculatorIcon },
  { id: "trips", label: "ทริป", icon: Route },
  { id: "history", label: "ประวัติ", icon: History },
  { id: "vehicles", label: "รถของฉัน", icon: Car },
];
type FormState =
  | { type: "vehicle"; vehicle?: Vehicle }
  | { type: "fillup"; fillup?: Fillup }
  | { type: "trip"; trip?: Trip };
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
function hashPage() {
  const page = window.location.hash.slice(1);
  return navigation.some((n) => n.id === page) ? page : "overview";
}
function monthKey(date: string) {
  return date.slice(0, 7);
}
function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00`).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
}
function saveDownload(text: string, fileName: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [storedData, setData] = useState<AppData>(emptyData);
  // Fast Refresh can preserve pre-trip state without re-running the initializer.
  const data = { ...storedData, trips: storedData.trips ?? [] };
  const dataRef = useRef(data);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(hashPage);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [update, setUpdate] = useState<null | (() => Promise<void>)>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [installHelp, setInstallHelp] = useState(false);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const vehicle =
    data.vehicles.find((v) => v.id === data.settings.activeVehicleId) ??
    data.vehicles[0];
  const fillups = sortFillups(
    data.fillups.filter((f) => f.vehicleId === vehicle?.id),
  );
  const stats = calculateStats(fillups);
  const currentMonth = monthKey(today());
  const monthFillups = fillups.filter((f) => monthKey(f.date) === currentMonth);
  const monthSpend = monthFillups.reduce((sum, f) => sum + f.amountSatang, 0);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleDateString("th-TH", { month: "short" }),
      amount: fillups
        .filter((f) => monthKey(f.date) === key)
        .reduce((s, f) => s + f.amountSatang, 0),
    };
  });
  const previousSpend = months[4].amount;
  const maxMonth = Math.max(...months.map((m) => m.amount), 1);
  const filtered = [...fillups]
    .reverse()
    .filter(
      (f) =>
        (!filterStart || f.date >= filterStart) &&
        (!filterEnd || f.date <= filterEnd),
    );
  const grouped = new Map<string, Fillup[]>();
  for (const f of filtered) {
    const key = monthKey(f.date);
    grouped.set(key, [...(grouped.get(key) ?? []), f]);
  }

  useEffect(() => {
    let active = true;
    loadData()
      .then((next) => {
        if (active) {
          dataRef.current = next;
          setData(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(
            "เปิดสมุดบันทึกไม่ได้ กรุณาอนุญาตการจัดเก็บข้อมูลในเบราว์เซอร์ แล้วลองโหลดใหม่",
          );
          setLoading(false);
        }
      });
    const hash = () => {
      setPage(hashPage());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const connectivity = () => setOnline(navigator.onLine);
    const installation = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    window.addEventListener("beforeinstallprompt", installation);
    window.addEventListener("appinstalled", installed);
    return () => {
      active = false;
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("beforeinstallprompt", installation);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    return registerPwa((state) => {
      if (state.offlineReady) setOfflineReady(true);
      if (state.needRefresh && state.update) setUpdate(() => state.update!);
    });
  }, []);
  useEffect(() => {
    async function refresh() {
      if (busyRef.current) return;
      try {
        const next = await loadData();
        dataRef.current = next;
        setData(next);
      } catch {
        /* Keep the last successful read visible. */
      }
    }
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("term-pai-data");
      channelRef.current = channel;
      channel.onmessage = refresh;
    }
    window.addEventListener("focus", refresh);
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!form) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [form]);

  const persist = useCallback((change: (current: AppData) => AppData) => {
    const operation = writeQueue.current.then(async () => {
      const next = await updateData(change);
      dataRef.current = next;
      setData(next);
      channelRef.current?.postMessage("updated");
    });
    writeQueue.current = operation.catch(() => {});
    return operation;
  }, []);
  async function mutate(
    change: (current: AppData) => AppData,
    message: string,
    close = false,
  ) {
    if (busyRef.current) throw new Error("กำลังบันทึก");
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await persist(change);
      setNotice(message);
      if (close) setForm(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function navigate(id: string) {
    window.location.hash = id;
    setPage(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openMenu(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(id);
  }
  function newFillup() {
    if (vehicle) setForm({ type: "fillup" });
    else {
      setForm({ type: "vehicle" });
      setNotice("เพิ่มรถคันแรกก่อนเริ่มบันทึก");
    }
  }
  async function vehicleSave(next: Vehicle) {
    await mutate(
      (current) => ({
        ...current,
        vehicles: current.vehicles.some((v) => v.id === next.id)
          ? current.vehicles.map((v) => (v.id === next.id ? next : v))
          : [...current.vehicles, next],
        settings: { ...current.settings, activeVehicleId: next.id },
      }),
      "บันทึกข้อมูลรถแล้ว",
      true,
    );
  }
  function newTrip() {
    if (vehicle) setForm({ type: "trip" });
    else {
      setForm({ type: "vehicle" });
      setNotice("เพิ่มรถก่อนเริ่มบันทึกทริป");
    }
  }
  async function tripSave(next: Trip) {
    await mutate(
      (current) => ({
        ...current,
        trips: current.trips.some((t) => t.id === next.id)
          ? current.trips.map((t) => (t.id === next.id ? next : t))
          : [...current.trips, next],
      }),
      "บันทึกทริปแล้ว",
      true,
    );
  }
  async function removeTrip(trip: Trip) {
    if (
      !window.confirm(
        `ลบทริป “${tripTitle(trip)}”? รายการเติมน้ำมันจะยังอยู่เหมือนเดิม`,
      )
    )
      return;
    try {
      await mutate(
        (current) => ({
          ...current,
          trips: current.trips.filter((t) => t.id !== trip.id),
        }),
        "ลบทริปแล้ว",
      );
    } catch {
      setError("ลบทริปไม่ได้ กรุณาลองอีกครั้ง");
    }
  }
  async function fillupSave(next: Fillup) {
    await mutate(
      (current) => {
        if (!current.vehicles.some((v) => v.id === next.vehicleId))
          throw new Error("ไม่พบรถคันนี้ กรุณาเปิดหน้ารถอีกครั้ง");
        const problem = validateFillup(next, current.fillups);
        if (problem) throw new Error(problem);
        return {
          ...current,
          fillups: current.fillups.some((f) => f.id === next.id)
            ? current.fillups.map((f) => (f.id === next.id ? next : f))
            : [...current.fillups, next],
        };
      },
      "บันทึกเติมน้ำมันแล้ว",
      true,
    );
  }
  async function removeFillup(entry: Fillup) {
    if (
      !window.confirm(
        `ลบรายการวันที่ ${displayDate(entry.date)} ยอด ${money(entry.amountSatang)} บาท? การลบรายการระหว่างรอบจะทำให้รอบนั้นเริ่มนับใหม่`,
      )
    )
      return;
    try {
      await mutate((current) => {
        const ordered = sortFillups(
          current.fillups.filter((f) => f.vehicleId === entry.vehicleId),
        );
        const following =
          ordered[ordered.findIndex((f) => f.id === entry.id) + 1];
        return {
          ...current,
          fillups: current.fillups
            .filter((f) => f.id !== entry.id)
            .map((f) =>
              f.id === following?.id ? { ...f, missedFillupBefore: true } : f,
            ),
        };
      }, "ลบรายการแล้ว");
    } catch {
      setError("ลบไม่ได้ กรุณาลองอีกครั้ง");
    }
  }
  async function removeVehicle(v: Vehicle) {
    const count = data.fillups.filter((f) => f.vehicleId === v.id).length;
    const tripCount = data.trips.filter((t) => t.vehicleId === v.id).length;
    if (
      !window.confirm(
        `ลบรถ “${v.name}” ประวัติเติม ${count} รายการ และ ${tripCount} ทริป? ควรส่งออกไฟล์สำรองก่อน ข้อมูลที่ลบจะกู้คืนจากเครื่องไม่ได้`,
      )
    )
      return;
    try {
      await mutate(
        (current) => ({
          ...current,
          vehicles: current.vehicles.filter((x) => x.id !== v.id),
          fillups: current.fillups.filter((f) => f.vehicleId !== v.id),
          trips: current.trips.filter((t) => t.vehicleId !== v.id),
          settings: {
            ...current.settings,
            activeVehicleId:
              current.settings.activeVehicleId === v.id
                ? current.vehicles.find((x) => x.id !== v.id)?.id
                : current.settings.activeVehicleId,
          },
        }),
        "ลบรถแล้ว",
      );
    } catch {
      setError("ลบรถไม่ได้ กรุณาลองอีกครั้ง");
    }
  }
  async function exportData() {
    try {
      const timestamp = new Date().toISOString();
      saveDownload(
        serializeBackup(dataRef.current),
        `term-pai-${today()}.json`,
      );
      await mutate(
        (current) => ({
          ...current,
          settings: { ...current.settings, lastBackupAt: timestamp },
        }),
        "ส่งออกไฟล์แล้ว ตรวจสอบไฟล์ในโฟลเดอร์ดาวน์โหลด",
      );
    } catch {
      setError("ส่งออกไฟล์ไม่ได้ กรุณาลองอีกครั้ง");
    }
  }
  async function importData(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      const imported = parseBackup(await file.text());
      if (
        !window.confirm(
          `ไฟล์นี้มีรถ ${imported.vehicles.length} คัน รายการเติม ${imported.fillups.length} รายการ และ ${imported.trips.length} ทริป ต้องการแทนที่ข้อมูลทั้งหมดหรือไม่? ระบบจะดาวน์โหลดสำรองข้อมูลเดิมให้ก่อน`,
        )
      )
        return;
      saveDownload(
        serializeBackup(dataRef.current),
        `term-pai-before-import-${today()}.json`,
      );
      await mutate(() => imported, "นำเข้าข้อมูลเรียบร้อยแล้ว");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "นำเข้าไฟล์ไม่ได้ ข้อมูลเดิมยังอยู่",
      );
    }
  }
  function calculatorChange(values: Record<string, string>) {
    void persist((current) => ({
      ...current,
      settings: {
        ...current.settings,
        calculatorInputs: { ...current.settings.calculatorInputs, ...values },
      },
    })).catch(() =>
      setError("จำค่าเครื่องคำนวณไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บ"),
    );
  }
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else setInstallHelp(true);
  }
  async function checkUpdate() {
    setCheckingUpdate(true);setUpdateMessage('');
    try { setUpdateMessage(await checkForUpdates()); }
    catch (error) {setUpdateMessage(error instanceof Error ? error.message : 'ตรวจสอบอัปเดตไม่สำเร็จ กรุณาลองใหม่');}
    finally {setCheckingUpdate(false);}
  }

  function recordRow(entry: Fillup) {
    return (
      <article className="record-row" key={entry.id}>
        <div className={`record-icon ${entry.fullTank ? "is-full" : ""}`}>
          <Fuel size={21} strokeWidth={1.6} />
        </div>
        <div className="record-main">
          <div className="record-title">
            {entry.station || entry.fuelType}
            <span className={`pill ${entry.fullTank ? "green" : ""}`}>
              {entry.fullTank ? "เต็มถัง" : "เติมย่อย"}
            </span>
          </div>
          <div className="record-meta">
            {displayDate(entry.date)}
            <span>·</span>
            {number(entry.odometerKm, 0)} กม.<span>·</span>
            {number(entry.volumeMillilitres / 1000, 3)} ลิตร
          </div>
          {entry.missedFillupBefore && (
            <small className="gap-note">
              มีช่วงที่ไม่ได้บันทึก · เริ่มรอบใหม่
            </small>
          )}
          {entry.note && <p className="record-note">{entry.note}</p>}
        </div>
        <div className="record-amount">
          ฿{money(entry.amountSatang)}
          <small>{number(entry.priceSatangPerLitre / 100)} บาท/ลิตร</small>
        </div>
        <div className="record-actions">
          <button
            className="icon-button"
            aria-label={`แก้ไขรายการ ${entry.date}`}
            disabled={busy}
            onClick={() => setForm({ type: "fillup", fillup: entry })}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button danger"
            aria-label={`ลบรายการ ${entry.date}`}
            disabled={busy}
            onClick={() => void removeFillup(entry)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </article>
    );
  }

  if (loading)
    return (
      <main className="loading-screen">
        <Fuel size={36} />
        <h1>เติมไป</h1>
        <LoaderCircle className="spin" size={24} />
        <p>กำลังเปิดสมุดเดินทาง</p>
      </main>
    );
  if (loadError)
    return (
      <main className="loading-screen">
        <CloudOff size={40} />
        <h1>เปิดสมุดไม่สำเร็จ</h1>
        <p role="alert">{loadError}</p>
        <button className="button primary" onClick={() => location.reload()}>
          ลองอีกครั้ง
        </button>
      </main>
    );
  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#overview" aria-label="เติมไป หน้าภาพรวม">
          <span className="brand-symbol">
            <Fuel size={23} strokeWidth={1.8} />
          </span>
          <span>
            เติมไป<span className="brand-sub">FUEL JOURNAL</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="เมนูหลัก">
          {navigation.map((n) => (
            <a
              href={`#${n.id}`}
              onClick={(event) => openMenu(event, n.id)}
              key={n.id}
              className={page === n.id ? "active" : ""}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={17} />
              {n.label}
            </a>
          ))}
        </nav>
        <div className="header-right">
          <span className={`connection ${!online ? "is-offline" : ""}`}>
            {!online ? <WifiOff size={14} /> : <span className="status-dot" />}
            <span>
              {!online
                ? "ออฟไลน์"
                : offlineReady
                  ? "พร้อมใช้ออฟไลน์"
                  : "ข้อมูลอยู่ในเครื่อง"}
            </span>
          </span>
          <button
            className="icon-button help-button"
            onClick={() => setInstallHelp(true)}
            aria-label="วิธีใช้งานและติดตั้ง"
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </header>
      <main className="main-content" id="main">
        <div className="context-row">
          <div className="breadcrumb">
            สมุดเดินทางของคุณ <ChevronRight size={13} />
            <span>{navigation.find((n) => n.id === page)?.label}</span>
          </div>
          {data.vehicles.length > 0 && (
            <div className="vehicle-switch">
              <Car size={17} />
              <label className="sr-only" htmlFor="active-vehicle">
                รถที่ใช้งาน
              </label>
              <select
                id="active-vehicle"
                value={vehicle?.id ?? ""}
                disabled={busy}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  void persist((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      activeVehicleId: selectedId,
                    },
                  })).catch(() => setError("เปลี่ยนรถไม่ได้"));
                }}
              >
                {data.vehicles.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          )}
        </div>
        {error && (
          <div className="banner error-banner" role="alert">
            {error}
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="ปิดข้อความ"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {update && (
          <div className="banner">
            <span>มีเวอร์ชันใหม่พร้อมใช้งาน</span>
            <button
              className="text-button"
              disabled={!!form || busy}
              onClick={() => void update()}
            >
              อัปเดตตอนนี้
            </button>
            {form && <small>บันทึกหรือปิดฟอร์มก่อนอัปเดต</small>}
          </div>
        )}

        {page === "overview" && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  A LITTLE FURTHER, A LITTLE WISER
                </span>
                <h1>
                  ทุกการเติม มีเรื่องให้รู้
                  <span className="heading-dot">.</span>
                </h1>
                <p>รู้ค่าใช้จ่าย เข้าใจรถ แล้วออกไปใช้ชีวิต</p>
              </div>
              <button className="button primary add-header" onClick={newFillup}>
                <Plus size={19} />
                บันทึกเติมน้ำมัน
              </button>
            </div>
            <div className="dashboard-top">
              <section className="spend-card">
                <div className="spend-top">
                  <span className="eyebrow light">MONTHLY FUEL SPENDING</span>
                  <span className="month-chip">{monthLabel(currentMonth)}</span>
                </div>
                <p className="spend-label">ค่าเติมเดือนนี้</p>
                <div className="spend-value">
                  <span>฿</span>
                  {vehicle ? money(monthSpend) : "—"}
                </div>
                <div className="spend-footer">
                  <span>{monthFillups.length} ครั้งที่แวะเติม</span>
                  <span>
                    {previousSpend > 0
                      ? `${monthSpend >= previousSpend ? "+" : ""}${number(((monthSpend - previousSpend) / previousSpend) * 100, 0)}% จากเดือนก่อน`
                      : "เริ่มจด แล้วค่อย ๆ รู้จักรถ"}
                  </span>
                </div>
                <svg
                  className="journey-lines"
                  viewBox="0 0 300 160"
                  aria-hidden="true"
                >
                  <path d="M-20 150C20 150 5 50 70 60s30 105 100 60S220 0 320 20" />
                  <path d="M-20 168C40 168 20 72 76 80s40 100 105 56S232 22 320 42" />
                  <circle cx="168" cy="120" r="6" />
                </svg>
              </section>
              <div className="stats-grid">
                <section className="stat-card">
                  <span className="stat-icon">
                    <Gauge size={21} />
                  </span>
                  <div>
                    <p>อัตราสิ้นเปลืองเฉลี่ย</p>
                    <strong>
                      {stats.efficiency ? number(stats.efficiency) : "—"}
                    </strong>
                    <span className="stat-unit">กม./ลิตร</span>
                    <small>
                      {stats.cycles > 0
                        ? `จาก ${stats.cycles} รอบเต็มถัง`
                        : "รอรอบเต็มถังที่สมบูรณ์"}
                    </small>
                  </div>
                </section>
                <section className="stat-card">
                  <span className="stat-icon terracotta">
                    <Route size={21} />
                  </span>
                  <div>
                    <p>ต้นทุนต่อกิโลเมตร</p>
                    <strong>
                      {stats.costPerKm !== null ? number(stats.costPerKm) : "—"}
                    </strong>
                    <span className="stat-unit">บาท/กม.</span>
                    <small>คำนวณจากรอบเติมที่สมบูรณ์</small>
                  </div>
                </section>
              </div>
            </div>
            <button
              className="button primary mobile-add full"
              onClick={newFillup}
            >
              <Plus size={20} />
              บันทึกเติมน้ำมัน
            </button>
            <div className="dashboard-bottom">
              <section className="card chart-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">THE BIGGER PICTURE</span>
                    <h2>ค่าใช้จ่ายที่ผ่านมา</h2>
                  </div>
                  <span className="subtle-badge">6 เดือนล่าสุด</span>
                </div>
                <div className="chart-caption">
                  <span>ค่าน้ำมัน (บาท)</span>
                  <span className="legend-dot" />
                  ยอดจ่ายจริง
                </div>
                <div
                  className="expense-chart"
                  role="img"
                  aria-label={`ค่าใช้จ่าย 6 เดือน: ${months.map((m) => `${m.label} ${money(m.amount)} บาท`).join(", ")}`}
                >
                  <div className="chart-grid">
                    <i />
                    <i />
                    <i />
                  </div>
                  {months.map((m, i) => (
                    <div
                      className={`bar-column ${i === 5 ? "current" : ""}`}
                      key={m.key}
                    >
                      <div className="bar-area">
                        <span className="bar-value">
                          {m.amount ? number(m.amount / 100, 0) : "—"}
                        </span>
                        <div
                          className="bar"
                          style={{
                            height: m.amount
                              ? `${Math.max(4, (m.amount / maxMonth) * 100)}%`
                              : "3px",
                          }}
                        />
                      </div>
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
                <p className="chart-footnote">
                  ทุกการเติมนับเป็นรายจ่ายของเดือนที่บันทึก
                </p>
              </section>
              <section className="card journey-card">
                <div className="journey-illustration" aria-hidden="true">
                  <div className="sun" />
                  <svg viewBox="0 0 280 110">
                    <path
                      className="landscape"
                      d="M0 95Q35 60 70 82T150 70T280 85"
                    />
                    <path
                      className="road"
                      d="M120 120C70 100 190 85 140 65S110 45 160 28"
                    />
                    <path
                      className="road-center"
                      d="M120 120C70 100 190 85 140 65S110 45 160 28"
                    />
                    <path
                      className="tree"
                      d="M55 70V94m-13-9 13-23 13 23M225 67v30m-16-12 16-29 16 29"
                    />
                  </svg>
                  <span className="mini-car">
                    <Car size={29} />
                  </span>
                </div>
                <span className="eyebrow">LESS GUESSING. MORE GOING.</span>
                <h2>ทริปหน้า ใช้งบเท่าไร?</h2>
                <p>
                  ระยะทาง ค่าน้ำมัน และเงินหารกัน
                  <br />
                  คิดให้เรียบร้อยก่อนสตาร์ต
                </p>
                <button
                  className="text-button"
                  onClick={() => navigate("calculator")}
                >
                  ลองคำนวณทริป
                  <ArrowUpRight size={18} />
                </button>
              </section>
            </div>
            <section className="card recent-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">YOUR PIT STOPS</span>
                  <h2>แวะเติมล่าสุด</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("history")}
                >
                  ดูทั้งหมด
                  <ArrowRight size={16} />
                </button>
              </div>
              {fillups.length ? (
                [...fillups].reverse().slice(0, 3).map(recordRow)
              ) : (
                <Empty
                  title={vehicle ? "ยังไม่มีจุดแวะเติม" : "เริ่มต้นที่รถของคุณ"}
                  description={
                    vehicle
                      ? "บันทึกครั้งแรกวันนี้ แล้วค่อยเห็นภาพค่าใช้จ่ายชัดขึ้น"
                      : "เพิ่มรถคันแรก เพื่อเริ่มสมุดเติมน้ำมันส่วนตัว"
                  }
                  action={vehicle ? "บันทึกครั้งแรก" : "เพิ่มรถคันแรก"}
                  onAction={newFillup}
                />
              )}
            </section>
            <div className="privacy-footer">
              <ShieldCheck size={16} />
              <span>สมุดเล่มนี้อยู่ในเครื่องคุณ · ไม่ต้องสมัครสมาชิก</span>
              <span className="footer-wordmark">
                เติมไป / GO A LITTLE FURTHER
              </span>
            </div>
          </>
        )}

        {page === "trips" && (
          <Trips
            trips={data.trips}
            vehicle={vehicle}
            busy={busy}
            onAdd={newTrip}
            onEdit={(trip) => setForm({ type: "trip", trip })}
            onDelete={(trip) => void removeTrip(trip)}
          />
        )}
        {page === "calculator" && (
          <Calculator
            key={vehicle?.id ?? "guest"}
            vehicle={vehicle}
            historyEfficiency={stats.efficiency}
            values={data.settings.calculatorInputs}
            onChange={calculatorChange}
          />
        )}

        {page === "history" && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">EVERY STOP TELLS A STORY</span>
                <h1>
                  สมุดเติมน้ำมัน<span className="heading-dot">.</span>
                </h1>
                <p>
                  {vehicle
                    ? `ทุกจุดแวะของ ${vehicle.name}`
                    : "เพิ่มรถเพื่อเริ่มเก็บประวัติ"}
                </p>
              </div>
              <button className="button primary" onClick={newFillup}>
                <Plus size={19} />
                บันทึกเติมน้ำมัน
              </button>
            </div>
            <div className="history-summary">
              <div>
                <span>รายการทั้งหมด</span>
                <strong>
                  {fillups.length} <small>ครั้ง</small>
                </strong>
              </div>
              <div>
                <span>ยอดจ่ายทั้งหมด</span>
                <strong>
                  ฿{money(fillups.reduce((s, f) => s + f.amountSatang, 0))}
                </strong>
              </div>
              <div>
                <span>ปริมาณที่เติม</span>
                <strong>
                  {number(
                    fillups.reduce((s, f) => s + f.volumeMillilitres, 0) / 1000,
                  )}{" "}
                  <small>ลิตร</small>
                </strong>
              </div>
            </div>
            <DateRangeFilter start={filterStart} end={filterEnd} onStartChange={setFilterStart} onEndChange={setFilterEnd} startLabel="ตั้งแต่วันที่" endLabel="ถึงวันที่" />
            {filtered.length ? (
              [...grouped.entries()].map(([key, entries]) => (
                <section className="card history-month" key={key}>
                  <div className="section-heading">
                    <h2>{monthLabel(key)}</h2>
                    <span className="month-total">
                      ฿{money(entries.reduce((s, f) => s + f.amountSatang, 0))}
                    </span>
                  </div>
                  {entries.map(recordRow)}
                </section>
              ))
            ) : (
              <section className="card">
                <Empty
                  title={
                    fillups.length
                      ? "ไม่พบรายการในช่วงนี้"
                      : "สมุดหน้าแรก ยังว่างอยู่"
                  }
                  description={
                    fillups.length
                      ? "ลองเปลี่ยนช่วงวันที่หรือล้างตัวกรอง"
                      : "จดเลขไมล์ ยอดจ่าย และน้ำมันที่เติมไว้ในที่เดียว"
                  }
                  action={fillups.length ? undefined : "บันทึกเติมน้ำมัน"}
                  onAction={newFillup}
                />
              </section>
            )}
            <p className="hint history-hint">
              <Leaf size={17} />
              การเติมย่อยนับรวมกับรอบเต็มถังถัดไป
              ช่วงที่ขาดบันทึกจะไม่นำมาคำนวณความประหยัด
            </p>
          </>
        )}

        {page === "vehicles" && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR EVERYDAY COMPANIONS</span>
                <h1>
                  รถของฉัน<span className="heading-dot">.</span>
                </h1>
                <p>แยกสมุดให้แต่ละคัน เดินทางแบบสบายใจ</p>
              </div>
              <button
                className="button primary"
                onClick={() => setForm({ type: "vehicle" })}
              >
                <Plus size={19} />
                เพิ่มรถ
              </button>
            </div>
            <div className="vehicles-grid">
              {data.vehicles.map((v) => {
                const entries = data.fillups.filter(
                  (f) => f.vehicleId === v.id,
                );
                const s = calculateStats(entries);
                return (
                  <section
                    className={`card vehicle-card ${vehicle?.id === v.id ? "is-active" : ""}`}
                    key={v.id}
                  >
                    <div className="vehicle-card-top">
                      <span className="vehicle-portrait">
                        {v.type === "car" ? (
                          <Car size={42} strokeWidth={1.3} />
                        ) : (
                          <Bike size={42} strokeWidth={1.3} />
                        )}
                      </span>
                      {vehicle?.id === v.id && (
                        <span className="pill green">
                          <Check size={13} />
                          กำลังใช้งาน
                        </span>
                      )}
                      <div className="vehicle-edit">
                        <button
                          className="icon-button"
                          aria-label={`แก้ไขรถ ${v.name}`}
                          onClick={() =>
                            setForm({ type: "vehicle", vehicle: v })
                          }
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`ลบรถ ${v.name}`}
                          disabled={busy}
                          onClick={() => void removeVehicle(v)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <h2>{v.name}</h2>
                    <p className="muted">
                      {v.type === "car" ? "รถยนต์" : "มอเตอร์ไซค์"} ·{" "}
                      {v.fuelType}
                    </p>
                    <div className="vehicle-details">
                      <div>
                        <span>บันทึก</span>
                        <strong>{entries.length} ครั้ง</strong>
                      </div>
                      <div>
                        <span>ค่าเฉลี่ยจากประวัติ</span>
                        <strong>
                          {s.efficiency
                            ? `${number(s.efficiency)} กม./ลิตร`
                            : "ยังไม่มีรอบสมบูรณ์"}
                        </strong>
                      </div>
                    </div>
                    {v.manualEfficiency && (
                      <p className="hint">
                        ค่าที่ตั้งไว้: {number(v.manualEfficiency)} กม./ลิตร
                      </p>
                    )}
                    <button
                      className="button secondary full"
                      disabled={busy || vehicle?.id === v.id}
                      onClick={() =>
                        void persist((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            activeVehicleId: v.id,
                          },
                        })).catch(() => setError("เปลี่ยนรถไม่ได้"))
                      }
                    >
                      {vehicle?.id === v.id
                        ? "รถที่เลือกอยู่"
                        : "เลือกใช้รถคันนี้"}
                      <ArrowRight size={17} />
                    </button>
                  </section>
                );
              })}
              <button
                className="add-vehicle-card"
                onClick={() => setForm({ type: "vehicle" })}
              >
                <span>
                  <Plus size={26} />
                </span>
                <strong>เพิ่มเพื่อนร่วมทาง</strong>
                <small>รถยนต์หรือมอเตอร์ไซค์ แยกบันทึกได้</small>
              </button>
            </div>
            <section className="card backup-card">
              <div>
                <span className="eyebrow">YOURS TO KEEP</span>
                <h2>เก็บสมุดเล่มนี้ไว้ให้ดี</h2>
                <p>
                  ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้ ไม่มีการซิงก์อัตโนมัติ
                  <br />
                  สำรองไฟล์ไว้เพื่อย้ายเครื่องหรือกู้คืนหลังล้างข้อมูลเว็บไซต์
                </p>
                <small>
                  {data.settings.lastBackupAt
                    ? `ส่งออกล่าสุด ${new Date(data.settings.lastBackupAt).toLocaleString("th-TH")}`
                    : "ยังไม่เคยส่งออกไฟล์สำรอง"}
                </small>
              </div>
              <div className="backup-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void exportData()}
                >
                  <ArrowDownToLine size={18} />
                  ส่งออกไฟล์สำรอง
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <ArrowUpFromLine size={18} />
                  นำเข้าไฟล์สำรอง
                </button>
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept=".json,application/json"
                  aria-label="เลือกไฟล์สำรอง"
                  onChange={(e) => void importData(e)}
                />
              </div>
            </section>
            <section className="card" style={{marginTop:22}}>
              <h2>เวอร์ชันแอป</h2>
              <p className="hint" style={{marginTop:10}}>ตรวจสอบเวอร์ชันที่เผยแพร่แล้ว โดยไม่ลบข้อมูลในเครื่อง</p>
              <button className="button secondary" style={{marginTop:15}} disabled={checkingUpdate} onClick={() => void checkUpdate()}>{checkingUpdate ? 'กำลังตรวจสอบ…' : 'ตรวจสอบอัปเดต'}</button>
              {updateMessage && <p className="hint" role="status" style={{marginTop:12}}>{updateMessage}</p>}
            </section>
            <section className="install-card">
              <div className="install-icon">
                <Download size={24} />
              </div>
              <div>
                <h3>พกเติมไป ไว้หน้าจอหลัก</h3>
                <p>เปิดเร็ว ใช้งานออฟไลน์ได้หลังเตรียมข้อมูลสำเร็จ</p>
              </div>
              <button className="text-button" onClick={() => void install()}>
                {installPrompt ? "ติดตั้งแอป" : "วิธีติดตั้ง"}
                <ArrowUpRight size={17} />
              </button>
            </section>
          </>
        )}
      </main>
      <nav className="mobile-nav" aria-label="เมนูมือถือ">
        {navigation.map((n) => (
          <a
            href={`#${n.id}`}
            onClick={(event) => openMenu(event, n.id)}
            key={n.id}
            className={page === n.id ? "active" : ""}
            aria-current={page === n.id ? "page" : undefined}
          >
            <n.icon size={21} strokeWidth={page === n.id ? 2 : 1.6} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {form && (
        <Modal
          title={
            form.type === "vehicle"
              ? form.vehicle
                ? "แก้ไขข้อมูลรถ"
                : "เพิ่มเพื่อนร่วมทาง"
              : form.type === "trip"
                ? form.trip
                  ? "แก้ไขทริป"
                  : "บันทึกทริป"
                : form.fillup
                  ? "แก้ไขการเติมน้ำมัน"
                  : "บันทึกเติมน้ำมัน"
          }
          onClose={() => {
            if (!busy) setForm(null);
          }}
        >
          {form.type === "vehicle" ? (
            <VehicleForm
              vehicle={form.vehicle}
              busy={busy}
              onSave={vehicleSave}
            />
          ) : form.type === "trip" ? (
            vehicle && (
              <TripForm
                vehicle={vehicle}
                trip={form.trip}
                historyEfficiency={stats.efficiency}
                busy={busy}
                onSave={tripSave}
              />
            )
          ) : (
            vehicle && (
              <FillupForm
                vehicle={vehicle}
                fillup={form.fillup}
                existing={data.fillups}
                busy={busy}
                onSave={fillupSave}
              />
            )
          )}
        </Modal>
      )}
      {installHelp && (
        <Modal
          title="พกสมุดไปทุกการเดินทาง"
          onClose={() => setInstallHelp(false)}
          dirty={false}
        >
          <div className="form-stack install-help">
            <div className="help-illustration">
              <Fuel size={46} strokeWidth={1.4} />
            </div>
            <h3>เติมไป · สมุดเติมน้ำมันส่วนตัว</h3>
            <p>
              iPhone / iPad: เปิดด้วย Safari แล้วแตะเมนูแชร์ →
              เพิ่มไปยังหน้าจอโฮม
            </p>
            <p>
              Android: เปิดด้วย Chrome แล้วเลือกเมนู → ติดตั้งแอป หรือ
              เพิ่มลงในหน้าจอหลัก
            </p>
            <p className="hint">
              <WifiOff size={18} />
              เปิดออนไลน์ครั้งแรกจนขึ้น “พร้อมใช้ออฟไลน์”
              ก่อนใช้โดยไม่มีอินเทอร์เน็ต
            </p>
            <p className="hint">
              <ShieldCheck size={18} />
              ข้อมูลแยกตามเบราว์เซอร์และโดเมน ควรสำรองเป็นไฟล์จากหน้ารถของฉัน
              ไม่ใช้โหมดไม่ระบุตัวตนเก็บประวัติระยะยาว
            </p>
            {installPrompt && (
              <button className="button primary" onClick={() => void install()}>
                ติดตั้งแอป
              </button>
            )}
            <button
              className="button secondary"
              onClick={() => setInstallHelp(false)}
            >
              เข้าใจแล้ว
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
