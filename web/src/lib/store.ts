/** Minimal external stores for client-only state (localStorage prefs, ticking clock). */

type Listener = () => void;

function createStore<T>(read: () => T, write: (v: T) => void, serverValue: T) {
  const listeners = new Set<Listener>();
  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get: read,
    getServer: () => serverValue,
    set(v: T) {
      write(v);
      listeners.forEach((l) => l());
    },
  };
}

export type Theme = "arc" | "terminal";
export type Locale = "zh" | "en";

export const themeStore = createStore<Theme>(
  () => {
    const t = document.documentElement.dataset.theme;
    return t === "terminal" ? "terminal" : "arc";
  },
  (v) => {
    document.documentElement.dataset.theme = v;
    try {
      localStorage.setItem("arclaunch.theme", v);
    } catch {}
  },
  "arc",
);

export const localeStore = createStore<Locale>(
  () => {
    try {
      return localStorage.getItem("arclaunch.locale") === "en" ? "en" : "zh";
    } catch {
      return "zh";
    }
  },
  (v) => {
    try {
      localStorage.setItem("arclaunch.locale", v);
    } catch {}
  },
  "zh",
);

/** Shared clock that ticks every 15s; server snapshot is null so SSR renders a placeholder. */
const clockListeners = new Set<Listener>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let clockNow = 0;

export const clockStore = {
  subscribe(l: Listener) {
    clockListeners.add(l);
    if (!clockTimer) {
      clockNow = Date.now();
      clockTimer = setInterval(() => {
        clockNow = Date.now();
        clockListeners.forEach((fn) => fn());
      }, 15_000);
    }
    return () => {
      clockListeners.delete(l);
      if (clockListeners.size === 0 && clockTimer) {
        clearInterval(clockTimer);
        clockTimer = null;
      }
    };
  },
  get: (): number | null => (clockNow ||= Date.now()),
  getServer: (): number | null => null,
};
