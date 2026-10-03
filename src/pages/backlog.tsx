import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Users, CalendarRange } from "lucide-react";
import GanttChart from "@/components/GanttChart";
import { computeSchedule, peakDevs, durationWeeks, fmtDate, getMonday } from "@/lib/planning";
import { format, addWeeks } from "date-fns";

export default function Backlog() {
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(getMonday(new Date()), "yyyy-MM-dd"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m, v] = await Promise.all([
        base44.entities.Project.list("-created_date", 200),
        base44.entities.TeamMember.list("-created_date", 200),
        base44.entities.Vacation.list("-created_date", 200),
      ]);
      setProjects(p);
      setMembers(m);
      setVacations(v);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const backlog = projects
    .filter((p) => p.in_backlog)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  const move = async (p, dir) => {
    const idx = backlog.findIndex((x) => x.id === p.id);
    const swap = backlog[idx + dir];
    if (!swap) return;
    await Promise.all([
      base44.entities.Project.update(p.id, { priority: swap.priority }),
      base44.entities.Project.update(swap.id, { priority: p.priority }),
    ]);
    load();
  };

  const start = parseISOsafe(startDate) || getMonday(new Date());
  const { weeks, schedule } = computeSchedule(backlog, members, vacations, start);
  const scheduledCount = schedule.filter((s) => s.startIdx != null).length;
  const lastEnd = schedule
    .filter((s) => s.startIdx != null)
    .reduce((m, s) => (s.endIdx > m ? s.endIdx : m), -1);
  const finishDate = lastEnd >= 0 ? weeks[lastEnd].weekStart : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Backlog plan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drag-order your backlog by priority. Projects run in parallel when squad capacity allows —
          capacity comes from your team minus planned time off.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard
          icon={Users}
          label="Squad size"
          value={`${members.length} dev${members.length === 1 ? "" : "s"}`}
        />
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <CalendarRange className="h-5 w-5 text-brand" />
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Plan starts
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm font-medium bg-transparent outline-none cursor-pointer"
            />
          </div>
        </div>
        <InfoCard
          icon={CalendarRange}
          label="Backlog finishes"
          value={finishDate ? fmtDate(addWeeks(finishDate, 1)) : "—"}
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : backlog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No projects in the backlog yet. Mark microprojects as “in backlog” from the Estimation
          page.
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {backlog.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="text-xs font-medium text-muted-foreground w-6 tabular-nums">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {peakDevs(p)} devs · {durationWeeks(p)} weeks
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={i === 0}
                  onClick={() => move(p, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={i === backlog.length - 1}
                  onClick={() => move(p, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold tracking-tight">Schedule</h2>
              <span className="text-xs text-muted-foreground">
                {scheduledCount}/{backlog.length} projects scheduled
              </span>
            </div>
            <GanttChart weeks={weeks} schedule={schedule} />
          </Card>
        </>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
      <Icon className="h-5 w-5 text-brand" />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function parseISOsafe(s) {
  try {
    const d = new Date(s + "T00:00:00");
    return isNaN(d) ? null : d;
  } catch {
    return null;
  }
}
