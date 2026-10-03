import React, { useState } from "react";
import { Button, Input, Label, ConfirmDialog } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Trash2, UserPlus } from "@jordiorriols/ui/icons";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { startOfMonth, format } from "date-fns";
import VacationCalendar from "@/components/organisms/vacation-calendar";
import { ROLE_LABELS, squadVelocity, parseDate } from "@/lib/planning";
import { ROLES, type Role, type PlannerMember } from "@/types/planner";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";

export default function Vacations() {
  const { repository, user } = useData();
  const { members, availability, workspace, isOwner, refresh } = useWorkspace();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedId, setSelectedId] = useState("");
  const selected =
    members.find((member) => member.id === selectedId) ??
    members.find((member) => member.user_id === user?.id) ??
    members[0];
  const canEdit = isOwner || selected?.user_id === user?.id;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("backend");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState<PlannerMember | null>(null);
  const action = useAsyncAction();
  if (!repository) throw new Error("Sign in to manage availability");
  const velocity = squadVelocity(members, availability, new Date(), 16);
  const chartData = velocity.map((week) => ({
    label: format(week.weekStart, "MMM d"),
    capacity: Number(week.capacity.toFixed(1)),
  }));
  const changes = availability
    .filter((item) => item.member_id === selected?.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Team vacations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Barcelona holidays and weekends are off by default. Mark time off or explicitly mark days
          you will work.
        </p>
      </div>
      {action.error && (
        <p role="alert" className="text-destructive">
          {action.error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="panel space-y-4 h-fit">
          <h2 className="font-semibold">Squad</h2>
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 border rounded-lg p-2">
              <button
                className="flex-1 text-left"
                aria-pressed={selected?.id === member.id}
                onClick={() => {
                  setSelectedId(member.id);
                  setStart("");
                  setEnd("");
                }}
              >
                <span
                  className={
                    selected?.id === member.id ? "text-primary font-semibold" : "font-medium"
                  }
                >
                  {member.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {ROLE_LABELS[member.role]} · {member.user_id ? "Joined" : "Invited"}
                </span>
              </button>
              {isOwner && member.user_id !== user?.id && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${member.name}`}
                  disabled={action.busy}
                  onClick={() => setDeleting(member)}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          ))}
          {isOwner && (
            <form
              className="border-t pt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  await repository.inviteMember(workspace.id, email, name, role);
                  setName("");
                  setEmail("");
                  await refresh();
                });
              }}
            >
              <h3 className="text-sm font-semibold">Invite a teammate</h3>
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={name}
                required
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="field"
                value={role}
                onChange={(event) => {
                  const next = ROLES.find((item) => item === event.target.value);
                  if (next) setRole(next);
                }}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                They join by signing in to Planner with this verified email. No invitation email is
                sent. Invited people already count toward capacity.
              </p>
              <Button type="submit" disabled={action.busy}>
                <UserPlus size={16} />
                Invite member
              </Button>
            </form>
          )}
        </aside>
        <section className="space-y-4">
          <p className="text-sm">
            Availability for <strong>{selected?.name ?? "No member"}</strong>.{" "}
            {canEdit
              ? "Select a range, then save."
              : "You can view the squad, but only edit your own availability."}
          </p>
          <div className="panel">
            <VacationCalendar
              key={selected?.id}
              month={month}
              onMonthChange={setMonth}
              teamMembers={members}
              availability={availability}
              selectedMember={selected?.id ?? ""}
              disabled={!canEdit || action.busy}
              onSelectRange={(first, last) => {
                setStart(first);
                setEnd(last);
              }}
            />
          </div>
          {canEdit && selected && (
            <form
              className="panel space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  parseDate(start);
                  parseDate(end);
                  if (end < start)
                    throw new Error("The end date must not be before the start date.");
                  await repository.setAvailability(selected.id, start, end, working);
                  setStart("");
                  setEnd("");
                  await refresh();
                });
              }}
            >
              <h2 className="font-semibold">Set availability</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="availability-start">First day</Label>
                  <Input
                    id="availability-start"
                    type="date"
                    value={start}
                    required
                    min="2026-01-01"
                    max="2027-12-31"
                    onChange={(event) => setStart(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="availability-end">Last day</Label>
                  <Input
                    id="availability-end"
                    type="date"
                    value={end}
                    required
                    min={start || "2026-01-01"}
                    max="2027-12-31"
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="working">Status</Label>
                  <select
                    id="working"
                    className="field"
                    value={String(working)}
                    onChange={(event) => setWorking(event.target.value === "true")}
                  >
                    <option value="false">Not working / time off</option>
                    <option value="true">Working</option>
                  </select>
                </div>
              </div>
              <Button type="submit" disabled={action.busy}>
                Save availability
              </Button>
            </form>
          )}
          {!!changes.length && (
            <div className="panel space-y-2">
              <h2 className="font-semibold">Saved overrides</h2>
              <div className="max-h-64 overflow-auto space-y-1">
                {changes.map((change) => (
                  <div
                    key={change.date}
                    className="flex justify-between items-center text-sm border-b pb-1"
                  >
                    <span>
                      {change.date} · {change.is_working ? "Working" : "Not working"}
                    </span>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(async () => {
                            await repository.clearAvailability(change.member_id, change.date);
                            await refresh();
                          })
                        }
                      >
                        Restore default {change.date}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      <section className="panel" aria-label="Squad velocity">
        <h2 className="font-semibold mb-2">Squad velocity</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Available person-weeks (five working days per person), next {velocity.length} verified
          weeks.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals />
            <Tooltip />
            <Bar
              dataKey="capacity"
              name="Available person-weeks"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <table className="sr-only">
          <caption>Weekly available person-weeks</caption>
          <tbody>
            {chartData.map((week) => (
              <tr key={week.label}>
                <th>{week.label}</th>
                <td>{week.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ConfirmDialog
        isOpen={!!deleting}
        title={`Remove ${deleting?.name ?? "member"}?`}
        description="Their invitation and availability will also be deleted."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting || action.busy) return;
          void action.run(async () => {
            await repository.deleteMember(deleting.id);
            setDeleting(null);
            await refresh();
          });
        }}
      />
    </div>
  );
}
