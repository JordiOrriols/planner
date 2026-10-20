import { useSyncExternalStore } from "react";

export interface RoadmapDisplay {
  fullWidth: boolean;
  wrapTitles: boolean;
}

const KEY = "planner:roadmap-display:v1";
const DEFAULT: RoadmapDisplay = { fullWidth: false, wrapTitles: false };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached = DEFAULT;

function readRaw() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): RoadmapDisplay {
  const raw = readRaw();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<RoadmapDisplay>) : {};
    cached = {
      fullWidth: parsed.fullWidth === true,
      wrapTitles: parsed.wrapTitles === true,
    };
  } catch {
    cached = DEFAULT;
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function updateRoadmapDisplay(change: Partial<RoadmapDisplay>) {
  const next = { ...snapshot(), ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cachedRaw = JSON.stringify(next);
    cached = next;
  }
  listeners.forEach((listener) => listener());
}

/** Shared by the roadmap page, its layout and the public link so they stay in sync. */
export function useRoadmapDisplay() {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT);
}
