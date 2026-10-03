import React, { useState } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useQuery } from "@tanstack/react-query";
import VacationCalendar from "@/components/organisms/vacation-calendar";
import { AvailabilityEditor } from "@/components/organisms/availability-editor";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import { squadVelocity, ROLE_LABELS } from "@/lib/planning";
import { ROLES, type LinkedTeam } from "@/types/planner";

function TeamPicker({ linkedTeams }: { linkedTeams: LinkedTeam[] }) {
  const { workspace, refresh } = useWorkspace();
  const { repository, user } = useData();
  const query = useQuery({
    queryKey: ["planner-ladders-teams", user?.id, workspace.id],
    queryFn: () => {
      if (!repository) throw new Error("Sign in before loading teams");
      return repository.listTeams();
    },
  });
  const [selected, setSelected] = useState(linkedTeams.map((team) => team.id));
  const action = useAsyncAction();
  const teams = new Map(linkedTeams.map((team) => [team.id, { ...team, canLink: true }]));
  for (const team of query.data ?? [])
    teams.set(team.id, { ...team, canLink: team.access_level !== "viewer" });
  return (
    <form
      className="panel p-5 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          if (!repository) throw new Error("Sign in before linking teams");
          await repository.setWorkspaceTeams(workspace.id, selected);
          await refresh();
        });
      }}
    >
      <h2 className="font-semibold">Ladders teams</h2>
      <p className="text-sm text-muted-foreground">
        Link one or more teams. Their current members and vacations are shared across workspaces.
        Create or move members in Ladders, not here.
      </p>
      {query.isPending && <p role="status">Loading teams...</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {!query.isPending && !query.error && !teams.size && (
        <p>Create a team in Ladders using the same account first.</p>
      )}
      {[...teams.values()].map((team) => (
        <label key={team.id} className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={selected.includes(team.id)}
            disabled={action.busy || (!team.canLink && !linkedTeams.some((t) => t.id === team.id))}
            onChange={(event) =>
              setSelected((ids) =>
                event.target.checked ? [...ids, team.id] : ids.filter((id) => id !== team.id)
              )
            }
          />
          {team.name}
          {!team.canLink && <span className="text-sm text-muted-foreground">(view only)</span>}
        </label>
      ))}
      {action.error && <p role="alert">{action.error}</p>}
      <Button disabled={action.busy || query.isPending || !!query.error} type="submit">
        Save linked teams
      </Button>
    </form>
  );
}

export default function Vacations() {
  const { members, linkedTeams, availability, refresh, isOwner } = useWorkspace();
  const { repository } = useData();
  const [selected, setSelected] = useState("");
  const selectedMember = members.find((member) => member.id === selected) ?? members[0];
  const [month, setMonth] = useState(new Date());
  const [copiedMember, setCopiedMember] = useState<string | null>(null);
  const action = useAsyncAction();
  if (!repository) throw new Error("Sign in before opening vacations");
  const assignable = members.filter((member) => member.role !== null);
  const unassigned = members.length - assignable.length;
  const velocity = squadVelocity(assignable, availability, month, 16);
  const chartData = velocity.map((week) => ({
    label: format(week.weekStart, "MMM d"),
    capacity: Number(week.capacity.toFixed(2)),
  }));
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Team Vacations</h1>
      <p className="text-muted-foreground">
        Barcelona working calendar. Planning roles belong to Ladders members and are shared in every
        workspace; they do not change job titles.
      </p>
      {isOwner && (
        <TeamPicker key={linkedTeams.map((team) => team.id).join(",")} linkedTeams={linkedTeams} />
      )}
      {!!unassigned && (
        <p role="status">
          {unassigned} members have no planning role and are excluded from squad capacity.
        </p>
      )}
      <div className="panel p-5 space-y-3">
        <h2 className="font-semibold">Team members</h2>
        {!members.length && <p>No members in linked teams. Link a Ladders team to get started.</p>}
        {members.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{member.name}</span>
            <span className="text-sm text-muted-foreground">
              {linkedTeams.find((team) => team.id === member.team_id)?.name}
            </span>
            <select
              className="field w-auto"
              aria-label={`Planning role for ${member.name}`}
              value={member.role ?? ""}
              disabled={!member.can_edit || action.busy}
              onChange={(event) => {
                const role = ROLES.find((role) => role === event.target.value) ?? null;
                void action.run(async () => {
                  await repository.updatePlanningRole(member.id, role);
                  await refresh();
                });
              }}
            >
              <option value="">Unassigned</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {member.vacation_token && (
              <Button
                variant="outline"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    const url = new URL(window.location.href);
                    url.hash = `/vacations/${member.vacation_token}`;
                    await navigator.clipboard.writeText(url.toString());
                    setCopiedMember(member.id);
                  })
                }
              >
                Copy vacation link for {member.name}
              </Button>
            )}
            {copiedMember === member.id && (
              <span role="status" className="text-sm">
                Vacation link copied
              </span>
            )}
          </div>
        ))}
        {action.error && <p role="alert">{action.error}</p>}
      </div>
      {selectedMember && (
        <section className="panel p-5 space-y-4">
          <label className="block">
            Member
            <select
              aria-label="Member"
              className="field"
              value={selectedMember.id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <AvailabilityEditor
            key={selectedMember.id}
            member={selectedMember}
            members={members}
            availability={availability}
            month={month}
            onMonthChange={setMonth}
            canEdit={selectedMember.can_edit}
            save={async (start, end, working) => {
              await repository.setAvailability(selectedMember.id, start, end, working);
              await refresh();
            }}
            clear={async (date) => {
              await repository.clearAvailability(selectedMember.id, date);
              await refresh();
            }}
          />
        </section>
      )}
      {!selectedMember && (
        <VacationCalendar
          month={month}
          onMonthChange={setMonth}
          teamMembers={members}
          availability={availability}
          selectedMember=""
          onSelectRange={() => {}}
          disabled
        />
      )}
      <section className="panel p-5" aria-label="Squad velocity">
        <h2 className="font-semibold mb-4">Squad velocity</h2>
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
    </div>
  );
}
