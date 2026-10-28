import {
  useEffect,
  useRef,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { X, ArrowUpRight, Fuel } from "lucide-react";

export const number = (value: number, digits = 2) =>
  new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
export const money = (satang: number) => number(satang / 100);
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const displayDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
export const fuelTypes = [
  "แก๊สโซฮอล์ 95",
  "แก๊สโซฮอล์ 91",
  "E20",
  "E85",
  "เบนซิน 95",
  "ดีเซล",
  "ดีเซล B7",
  "LPG",
];

export function Field({
  label,
  unit,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  unit?: string;
  hint?: string;
}) {
  const id = props.id ?? props.name ?? label;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <div className="input-wrap">
        <input {...props} id={id} aria-label={label} />
        {unit && (
          <span className="input-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function DateRangeFilter({ start, end, onStartChange, onEndChange, startLabel, endLabel }: {
  start: string; end: string; onStartChange: (value: string) => void; onEndChange: (value: string) => void; startLabel: string; endLabel: string;
}) {
  return <div className="date-range-filter">
    <div className="date-range-controls">
      <label className="date-range-field">
        <span>{startLabel}</span>
        <input type="date" aria-label={startLabel} value={start} max={end || today()} onChange={e => onStartChange(e.target.value)} />
      </label>
      <span className="date-range-separator">ถึง</span>
      <label className="date-range-field">
        <span>{endLabel}</span>
        <input type="date" aria-label={endLabel} value={end} min={start} max={today()} onChange={e => onEndChange(e.target.value)} />
      </label>
    </div>
    {(start || end) && <button type="button" className="text-button" onClick={() => { onStartChange(''); onEndChange(''); }}>ล้างตัวกรอง</button>}
  </div>;
}

export function Modal({
  title,
  children,
  onClose,
  dirty = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  function close() {
    if (!dirty || window.confirm("ปิดหน้านี้? ค่าที่ยังไม่ได้บันทึกจะหายไป"))
      onClose();
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">FUEL JOURNAL</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Empty({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Fuel size={30} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          {action}
          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return children ? (
    <p className="error-message" role="alert">
      {children}
    </p>
  ) : null;
}
