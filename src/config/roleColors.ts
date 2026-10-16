import type { Role } from "@/types/planner";

// Single palette for every role swatch: roadmap bars, legends, estimation badges and charts.
export const ROLE_COLORS: Record<Role, { className: string; textClassName: string; hex: string }> =
  {
    backend: { className: "bg-sky-700/70", textClassName: "text-sky-700", hex: "#0369a1" },
    frontend: { className: "bg-sky-400/60", textClassName: "text-sky-500", hex: "#38bdf8" },
    design: { className: "bg-amber-500/50", textClassName: "text-amber-600", hex: "#f59e0b" },
    qa: { className: "bg-emerald-600/50", textClassName: "text-emerald-700", hex: "#059669" },
  };
