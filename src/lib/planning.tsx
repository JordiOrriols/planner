import { startOfWeek, addWeeks, addDays, format, parseISO, isWithinInterval, differenceInCalendarDays } from "date-fns";
import { BARCELONA_HOLIDAYS } from "./barcelonaHolidays";

export const ROLES = ["backend", "frontend", "design", "qa"];
export const ROLE_LABELS = { backend: "Backend", frontend: "Frontend", design: "Design", qa: "QA" };
export const ROLE_COLORS = {
  backend: "bg-[hsl(var(--chart-3))]",
  frontend: "bg-[hsl(var(--chart-2))]",
  design: "bg-[hsl(var(--chart-4))]",
  qa: "bg-[hsl(var(--chart-1))]"
};
export const ROLE_TEXT_COLORS = {
  backend: "text-[hsl(var(--chart-3))]",
  frontend: "text-[hsl(var(--chart-2))]",
  design: "text-[hsl(var(--chart-4))]",
  qa: "text-[hsl(var(--chart-1))]"
};

export function roleDevs(p, role) { return Number(p[`${role}_devs`] || 0); }
export function roleWeeks(p, role) { return Number(p[`${role}_weeks`] || 0); }

export function peakDevs(p) {
  return ROLES.reduce((s, r) => s + roleDevs(p, r), 0);
}

export function durationWeeks(p) {
  return Math.max(0, ...ROLES.map(r => roleWeeks(p, r)));
}

export function totalDevWeeks(p) {
  return ROLES.reduce((s, r) => s + roleDevs(p, r) * roleWeeks(p, r), 0);
}

export function getMonday(d) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function fmtDate(d) {
  return format(d, "MMM d, yyyy");
}

function holidaysInWeek(weekStart) {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const ds = format(addDays(weekStart, i), "yyyy-MM-dd");
    if (BARCELONA_HOLIDAYS.some(h => h.date === ds)) count++;
  }
  return count;
}

function memberOnVacation(memberName, date, vacations) {
  return vacations.some(v => {
    if (v.team_member_name !== memberName) return false;
    try {
      return isWithinInterval(date, { start: parseISO(v.start_date), end: parseISO(v.end_date) });
    } catch {
      return false;
    }
  });
}

// Available dev-capacity for a given week (Mon-start), reduced by vacations and public holidays.
export function weekCapacity(weekStart, teamMembers, vacations) {
  const availableMembers = teamMembers.filter(m => !memberOnVacation(m.name, weekStart, vacations)).length;
  const holidays = holidaysInWeek(weekStart);
  const workingFraction = Math.max(0, (5 - holidays) / 5);
  return availableMembers * workingFraction;
}

// Greedy scheduler: schedules backlog projects in priority order, each needing peakDevs
// for durationWeeks consecutive weeks, only when free capacity allows. Enables parallelism
// when several projects fit in the same weeks.
export function computeSchedule(projects, teamMembers, vacations, startDate) {
  const sorted = [...projects].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const start = getMonday(startDate || new Date());
  const WEEKS = 60;
  const weeks = [];
  for (let i = 0; i < WEEKS; i++) {
    const ws = addWeeks(start, i);
    weeks.push({ weekStart: ws, capacity: weekCapacity(ws, teamMembers, vacations), allocated: 0 });
  }
  const schedule = [];
  for (const p of sorted) {
    const peak = peakDevs(p);
    const dur = durationWeeks(p);
    if (peak === 0 || dur === 0) {
      schedule.push({ project: p, startIdx: null, endIdx: null, start: null, end: null, reason: "No estimates set" });
      continue;
    }
    let found = -1;
    for (let i = 0; i <= weeks.length - dur; i++) {
      let ok = true;
      for (let j = 0; j < dur; j++) {
        if (weeks[i + j].capacity - weeks[i + j].allocated < peak) { ok = false; break; }
      }
      if (ok) { found = i; break; }
    }
    if (found >= 0) {
      for (let j = 0; j < dur; j++) weeks[found + j].allocated += peak;
      schedule.push({
        project: p,
        startIdx: found,
        endIdx: found + dur - 1,
        start: weeks[found].weekStart,
        end: weeks[found + dur - 1].weekStart
      });
    } else {
      schedule.push({ project: p, startIdx: null, endIdx: null, start: null, end: null, reason: "Not enough capacity" });
    }
  }
  return { weeks, schedule };
}

// Squad velocity: available dev-capacity per week for the next N weeks.
export function squadVelocity(teamMembers, vacations, startDate, numWeeks = 16) {
  const start = getMonday(startDate || new Date());
  const out = [];
  for (let i = 0; i < numWeeks; i++) {
    const ws = addWeeks(start, i);
    out.push({ weekStart: ws, capacity: weekCapacity(ws, teamMembers, vacations) });
  }
  return out;
}