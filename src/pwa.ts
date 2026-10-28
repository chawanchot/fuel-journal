import { registerSW } from "virtual:pwa-register";

export type PwaState = {
  offlineReady?: boolean;
  needRefresh?: boolean;
  update?: () => Promise<void>;
};

const listeners = new Set<(state: PwaState) => void>();
let state: PwaState = {};
let started = false;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | undefined;
let currentRegistration: ServiceWorkerRegistration | undefined;

function watchRegistration(registration: ServiceWorkerRegistration) {
  const waiting = () => { if (registration.waiting && navigator.serviceWorker.controller) publish({ needRefresh: true }); };
  const installing = () => {
    const worker = registration.installing;
    if (worker) worker.addEventListener('statechange', waiting);
    waiting();
  };
  registration.addEventListener('updatefound', installing);
  installing();
}

export async function checkForUpdates(): Promise<string> {
  if (!import.meta.env.PROD) return 'โหมดพัฒนาอัปเดตโค้ดให้อัตโนมัติ ปุ่มอัปเดตใช้กับเว็บที่ build และ deploy แล้ว';
  if (!navigator.onLine) throw new Error('กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อตรวจสอบอัปเดต');
  const registration = currentRegistration ?? await registrationPromise;
  if (!registration) throw new Error('ระบบอัปเดตยังไม่พร้อม กรุณาเปิดผ่าน HTTPS แล้วลองใหม่');
  await registration.update();
  const worker = registration.installing;
  if (worker) await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); resolve(); }, 15000);
    const cleanup = () => {clearTimeout(timer);worker.removeEventListener('statechange', changed);};
    const changed = () => {
      if (worker.state === 'installed' || worker.state === 'activated') {cleanup();resolve();}
      else if (worker.state === 'redundant') {cleanup();reject(new Error('ดาวน์โหลดอัปเดตไม่สำเร็จ กรุณาลองใหม่'));}
    };
    worker.addEventListener('statechange',changed);changed();
  });
  if (registration.waiting && navigator.serviceWorker.controller) publish({needRefresh:true});
  return state.needRefresh ? 'พบเวอร์ชันใหม่ กด “อัปเดตตอนนี้” ด้านบนได้เลย' : registration.installing ? 'กำลังเตรียมเวอร์ชันใหม่ จะแจ้งเมื่อพร้อม' : 'แอปเป็นเวอร์ชันล่าสุดที่เผยแพร่แล้ว';
}

function publish(next: PwaState) {
  state = { ...state, ...next };
  for (const listener of listeners) listener({ ...state });
}

export function registerPwa(callback: (state: PwaState) => void): () => void {
  listeners.add(callback);

  // Share one registration across mounts, including React StrictMode remounts.
  if (
    !started &&
    import.meta.env.PROD &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  ) {
    started = true;
    let resolveRegistration!: (registration: ServiceWorkerRegistration | undefined) => void;
    registrationPromise = new Promise(resolve => {resolveRegistration = resolve;});
    let approved = false;
    let controller = navigator.serviceWorker.controller;
    // An update in another tab must not discard an unfinished form here.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const previous = controller;
      controller = navigator.serviceWorker.controller;
      if (!previous || previous === controller) return;
      if (approved) window.location.reload();
      else publish({ needRefresh: true, update: async () => { window.location.reload(); } });
    });
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedReload() { /* Reload only after this tab has explicitly approved. */ },
      onOfflineReady() {
        publish({ offlineReady: true });
      },
      onNeedRefresh() {
        publish({ needRefresh: true });
      },
      onRegisteredSW(_url, registration) {
        currentRegistration = registration;
        resolveRegistration(registration);
        if (!registration) return;
        watchRegistration(registration);
        if (registration?.active) publish({ offlineReady: true });
        // Check when returning to an installed app, without interrupting a form.
        window.addEventListener("focus", () => {
          if (navigator.onLine) void registration?.update().catch(() => {});
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => {});
        });
        window.addEventListener('online', () => {void registration.update().catch(() => {});});
      },
      onRegisterError(error: unknown) {
        resolveRegistration(undefined);
        console.error("Service worker registration failed:", error);
      },
    });

    state = {
      ...state,
      // Activation and reload happen only after the UI calls this function.
      update: async () => {
        approved = true;
        if (currentRegistration?.waiting) {
          currentRegistration.waiting.postMessage({type:'SKIP_WAITING'});
          return;
        }
        await updateServiceWorker(true);
      },
    };
  }

  callback({ ...state });
  return () => {
    listeners.delete(callback);
  };
}
