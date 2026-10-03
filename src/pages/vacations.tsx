import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { UserPlus, Trash2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import VacationCalendar from "@/components/VacationCalendar";
import { ROLE_LABELS, squadVelocity, fmtDate } from "@/lib/planning";
import { startOfMonth, format } from "date-fns";

export default function Vacations() {
  const [members, setMembers] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("backend");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, v] = await Promise.all([
        base44.entities.TeamMember.list("-created_date", 200),
        base44.entities.Vacation.list("-created_date", 200),
      ]);
      setMembers(m);
      setVacations(v);
      if (!selected && m.length) setSelected(m[0].name);
    } finally {
      setLoading(false);
    }
  }, [selected]);
  useEffect(() => {
    load();
  }, [load]);

  const addMember = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await base44.entities.TeamMember.create({ name: newName.trim(), role: newRole });
    setNewName("");
    load();
  };
  const removeMember = async (m) => {
    await base44.entities.TeamMember.delete(m.id);
    const remaining = vacations.filter((v) => v.team_member_name === m.name);
    if (remaining.length) await base44.entities.Vacation.deleteMany({ team_member_name: m.name });
    if (selected === m.name) setSelected("");
    load();
  };
  const createVacation = async (name, start, end) => {
    await base44.entities.Vacation.create({
      team_member_name: name,
      start_date: start,
      end_date: end,
      reason: "vacation",
    });
    load();
  };
  const deleteVacation = async (id) => {
    await base44.entities.Vacation.delete(id);
    load();
  };

  const velocity = squadVelocity(members, vacations, new Date(), 16);
  const chartData = velocity.map((w) => ({
    label: format(w.weekStart, "MMM d"),
    capacity: Math.round(w.capacity * 10) / 10,
  }));
  const avgCapacity = velocity.length
    ? (velocity.reduce((s, w) => s + w.capacity, 0) / velocity.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Team vacations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Mark time off for each team member. Barcelona public holidays are preloaded. Squad
          velocity below feeds the backlog plan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-5 h-fit space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-2">Team</h2>
            <div className="space-y-1.5">
              {members.length === 0 && (
                <p className="text-xs text-muted-foreground">No team members yet.</p>
              )}
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <button
                    className="flex items-center gap-2 min-w-0 text-left"
                    onClick={() => setSelected(m.name)}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${selected === m.name ? "bg-brand" : "bg-muted-foreground/30"}`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[m.role]}</div>
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeMember(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={addMember} className="space-y-2 pt-3 border-t border-border">
            <Label className="text-xs">Add team member</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
            />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" className="w-full">
              <UserPlus className="h-4 w-4 mr-1.5" /> Add member
            </Button>
          </form>
        </Card>

        <div className="space-y-5">
          {loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
          ) : members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
              Add a team member to start marking vacations.
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Marking time off for <strong className="text-foreground">{selected || "—"}</strong>.
                Click a first day, then a second day to set a range.
              </div>
              <Card className="p-5">
                <VacationCalendar
                  month={month}
                  onMonthChange={setMonth}
                  teamMembers={members}
                  vacations={vacations}
                  selectedMember={selected}
                  onCreateVacation={createVacation}
                  onDeleteVacation={deleteVacation}
                />
              </Card>
            </>
          )}
        </div>
      </div>

      {members.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="font-heading font-semibold tracking-tight">Squad velocity</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Avg {avgCapacity} devs/week · next 16 weeks
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
                formatter={(v) => [`${v} devs`, "Available"]}
                labelFormatter={(l) => `Week of ${l}`}
              />
              <Bar dataKey="capacity" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
