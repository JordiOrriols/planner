import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ROLES, type ProjectInput, type Role } from "@/types/planner";
import { validateProject } from "@/lib/planning";

const workspaceSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
});
const memberSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  name: z.string(),
  role: z.enum(ROLES).nullable(),
  can_edit: z.boolean(),
  vacation_token: z.string().uuid().nullable(),
});
const projectSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  in_backlog: z.boolean(),
  priority: z.number(),
  backend_devs: z.number(),
  backend_weeks: z.number(),
  frontend_devs: z.number(),
  frontend_weeks: z.number(),
  design_devs: z.number(),
  design_weeks: z.number(),
  qa_devs: z.number(),
  qa_weeks: z.number(),
});
const availabilitySchema = z.object({
  member_id: z.string().uuid(),
  date: z.string(),
  is_working: z.boolean(),
});
const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  access_level: z.enum(["owner", "editor", "viewer"]),
});
const linkedTeamSchema = teamSchema.pick({ id: true, name: true });
const vacationMemberSchema = memberSchema.pick({ id: true, name: true, role: true });

export function createPlannerRepository(client: SupabaseClient) {
  async function rpc(name: string, args?: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message, { cause: error });
    return data;
  }
  async function rpcList<T>(
    name: string,
    schema: z.ZodType<T>,
    args?: Record<string, unknown>
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.rpc(name, args).range(offset, offset + 499);
      if (error) throw new Error(error.message, { cause: error });
      const page = z.array(schema).parse(data);
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  async function list<T>(table: string, schema: z.ZodType<T>, workspace?: string): Promise<T[]> {
    // Supabase caps response sizes. Page instead of silently truncating capacity/history.
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = client
        .from(table)
        .select("*")
        .order(table.endsWith("availability") ? "date" : "id")
        .range(offset, offset + 499);
      if (table.endsWith("availability")) query = query.order("member_id");
      if (workspace) query = query.eq("workspace_id", workspace);
      const { data, error } = await query;
      if (error) throw new Error(error.message, { cause: error });
      const page = z.array(schema).parse(data);
      result.push(...page);
      if (page.length < 500) return result;
    }
  }
  return {
    listWorkspaces: () => list("planner_workspaces", workspaceSchema),
    createWorkspace: async (name: string) =>
      workspaceSchema.parse(
        await rpc("planner_create_linked_workspace", {
          workspace_name: name,
        })
      ),
    listTeams: () => rpcList("list_accessible_teams", teamSchema),
    setWorkspaceTeams: (workspace: string, ids: string[]) =>
      rpc("planner_set_workspace_teams", { workspace, team_ids: ids }),
    updatePlanningRole: (member: string, role: Role | null) =>
      rpc("planner_update_planning_role", { member, member_role: role }),
    async loadWorkspace(workspace: string) {
      const [projects, members, linkedTeams] = await Promise.all([
        list("planner_projects", projectSchema, workspace),
        rpcList("planner_workspace_roster", memberSchema, { workspace }),
        rpcList("planner_linked_teams", linkedTeamSchema, { workspace }),
      ]);
      const ids = new Set(members.map((member) => member.id));
      const availability = (await list("planner_team_availability", availabilitySchema)).filter(
        (item) => ids.has(item.member_id)
      );
      return { projects, members, availability, linkedTeams };
    },
    async saveProject(workspace: string, input: ProjectInput, id?: string) {
      validateProject(input);
      const payload = { ...input, name: input.name.trim(), workspace_id: workspace };
      const query = id
        ? client.from("planner_projects").update(payload).eq("id", id).eq("workspace_id", workspace)
        : client.from("planner_projects").insert(payload);
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.message, { cause: error });
      return projectSchema.parse(data);
    },
    async toggleBacklog(workspace: string, id: string, inBacklog: boolean) {
      return projectSchema.parse(
        await rpc("planner_toggle_backlog", { workspace, project: id, included: inBacklog })
      );
    },
    async deleteProject(workspace: string, id: string) {
      const { error, data } = await client
        .from("planner_projects")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspace)
        .select("id")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      if (!data) throw new Error("Project was not deleted.");
    },
    reorder: (workspace: string, ids: string[]) =>
      rpc("planner_reorder_projects", { workspace, project_ids: ids }),
    setAvailability: (member: string, start: string, end: string, working: boolean) =>
      rpc("planner_set_team_availability", { member, start_date: start, end_date: end, working }),
    async clearAvailability(member: string, date: string) {
      const { error } = await client
        .from("planner_team_availability")
        .delete()
        .eq("member_id", member)
        .eq("date", date);
      if (error) throw new Error(error.message, { cause: error });
    },
    async loadVacation(token: string) {
      const [members, availability] = await Promise.all([
        rpc("planner_vacation_member", { token }),
        rpcList("planner_vacation_list", availabilitySchema, { token }),
      ]);
      const member = z.array(vacationMemberSchema).parse(members)[0];
      if (!member) throw new Error("Invalid vacation link");
      return { member, availability: z.array(availabilitySchema).parse(availability) };
    },
    saveVacation: (token: string, start: string, end: string, working: boolean) =>
      rpc("planner_vacation_save", { token, start_date: start, end_date: end, working }),
    clearVacation: (token: string, date: string) =>
      rpc("planner_vacation_clear", { token, day: date }),
  };
}
export type PlannerRepository = ReturnType<typeof createPlannerRepository>;
