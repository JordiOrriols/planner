import i18n from "@/i18n";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ROLES,
  type FeatureInput,
  type Role,
  type WorkspaceAccess,
  type SprintResult,
} from "@/types/planner";
import { validateSprintSettings } from "@/lib/sprints";
import { parseDate, validateFeature } from "@/lib/planning";
import { hasHolidayCalendar } from "@/lib/barcelonaHolidays";

const workspaceSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  plan_start_date: z.string().refine(
    (value) => z.string().date().safeParse(value).success,
    () => ({ message: i18n.t("workspace.errors.invalidPlanStart") })
  ),
  sprint_start_date: z.string().date(),
  sprint_history: z.array(
    z.object({ start_date: z.string().date(), story_points: z.number().finite().nonnegative() })
  ),
});
const memberSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  name: z.string(),
  role: z.enum(ROLES).nullable(),
  can_edit: z.boolean(),
  vacation_token: z.string().uuid().nullable(),
});
const featureSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  project_id: z.string().uuid().nullable(),
  in_backlog: z.boolean(),
  delivered: z.boolean(),
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
const projectSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
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
const APP = "planner";
const workspaceShareSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  app: z.string(),
  access_level: z.enum(["viewer", "editor"]),
});

function validateProjectName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error(i18n.t("projects.errors.invalidName"));
  return trimmed;
}

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
  async function list<T>(
    table: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    workspace?: string
  ): Promise<T[]> {
    // Supabase caps response sizes. Page instead of silently truncating capacity/history.
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = client
        .from(table)
        .select("*")
        .order(table === "vacations" ? "date" : "id")
        .range(offset, offset + 499);
      if (table === "vacations") query = query.order("member_id");
      if (workspace) query = query.eq("workspace_id", workspace);
      const { data, error } = await query;
      if (error) throw new Error(error.message, { cause: error });
      const page = z.array(schema).parse(data);
      result.push(...page);
      if (page.length < 500) return result;
    }
  }
  return {
    listWorkspaces: () => list("workspaces", workspaceSchema),
    listWorkspaceShares: async (workspace: string) =>
      (await rpcList("list_workspace_shares", workspaceShareSchema, { workspace })).filter(
        (share) => share.app === APP
      ),
    shareWorkspace: (workspace: string, email: string, access: WorkspaceAccess) =>
      rpc("share_workspace", { workspace, account_email: email, app_name: APP, access }),
    updateWorkspaceShare: (workspace: string, account: string, access: WorkspaceAccess) =>
      rpc("update_workspace_share", { workspace, account, app_name: APP, access }),
    removeWorkspaceShare: (workspace: string, account: string) =>
      rpc("remove_workspace_share", { workspace, account, app_name: APP }),
    async setPlanStart(workspace: string, date: string) {
      parseDate(date);
      if (!hasHolidayCalendar(date)) throw new Error(i18n.t("planning.validation.unverifiedStart"));
      const { data, error } = await client
        .from("workspaces")
        .update({ plan_start_date: date })
        .eq("id", workspace)
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return workspaceSchema.parse(data);
    },
    async setSprintCalibration(workspace: string, anchor: string, history: SprintResult[]) {
      validateSprintSettings(anchor, history);
      const { data, error } = await client
        .from("workspaces")
        .update({ sprint_start_date: anchor, sprint_history: history })
        .eq("id", workspace)
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return workspaceSchema.parse(data);
    },
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
      const [features, projects, members, linkedTeams, canEdit] = await Promise.all([
        list("features", featureSchema, workspace),
        list("projects", projectSchema, workspace).then((items) =>
          items.sort((a, b) => a.name.localeCompare(b.name))
        ),
        rpcList("planner_workspace_roster", memberSchema, { workspace }),
        rpcList("planner_linked_teams", linkedTeamSchema, { workspace }),
        rpc("planner_can_edit_workspace", { workspace }).then((value) => z.boolean().parse(value)),
      ]);
      const ids = new Set(members.map((member) => member.id));
      const availability = (await list("vacations", availabilitySchema)).filter((item) =>
        ids.has(item.member_id)
      );
      return { features, projects, members, availability, linkedTeams, canEdit };
    },
    async saveFeature(workspace: string, input: FeatureInput, id?: string) {
      validateFeature(input);
      const payload = {
        ...input,
        name: input.name.trim(),
        workspace_id: workspace,
      };
      const query = id
        ? client.from("features").update(payload).eq("id", id).eq("workspace_id", workspace)
        : client.from("features").insert(payload);
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.message, { cause: error });
      return featureSchema.parse(data);
    },
    async createProject(workspace: string, name: string) {
      const { data, error } = await client
        .from("projects")
        .insert({ workspace_id: workspace, name: validateProjectName(name) })
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return projectSchema.parse(data);
    },
    async renameProject(workspace: string, id: string, name: string) {
      const { data, error } = await client
        .from("projects")
        .update({ name: validateProjectName(name) })
        .eq("id", id)
        .eq("workspace_id", workspace)
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return projectSchema.parse(data);
    },
    async deleteProject(workspace: string, id: string) {
      const { error } = await client
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspace);
      if (error) throw new Error(error.message, { cause: error });
    },
    async toggleBacklog(workspace: string, id: string, inBacklog: boolean) {
      return featureSchema.parse(
        await rpc("planner_toggle_backlog", { workspace, feature: id, included: inBacklog })
      );
    },
    async deleteFeature(workspace: string, id: string) {
      const { error, data } = await client
        .from("features")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspace)
        .select("id")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      if (!data) throw new Error(i18n.t("planning.errors.featureNotDeleted"));
    },
    async setDelivered(workspace: string, id: string, delivered: boolean) {
      const { data, error } = await client
        .from("features")
        .update({ delivered })
        .eq("id", id)
        .eq("workspace_id", workspace)
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return featureSchema.parse(data);
    },
    reorder: (workspace: string, ids: string[]) =>
      rpc("planner_reorder_features", { workspace, feature_ids: ids }),
    setAvailability: (member: string, start: string, end: string, working: boolean) =>
      rpc("planner_set_vacations", { member, start_date: start, end_date: end, working }),
    async clearAvailability(member: string, date: string) {
      const { error } = await client
        .from("vacations")
        .delete()
        .eq("member_id", member)
        .eq("date", date);
      if (error) throw new Error(error.message, { cause: error });
    },
    async loadVacation(token: string) {
      const [identity, members, availability] = await Promise.all([
        rpc("planner_vacation_member", { token }),
        rpcList("planner_vacation_team_members", vacationMemberSchema, { token }),
        rpcList("planner_vacation_team_list", availabilitySchema, { token }),
      ]);
      const member = z.array(vacationMemberSchema).parse(identity)[0];
      if (!member) throw new Error(i18n.t("vacationLink.errors.invalidLink"));
      if (!members.some((item) => item.id === member.id))
        throw new Error(i18n.t("vacationLink.errors.missingMember"));
      return { member, members, availability };
    },
    saveVacation: (token: string, start: string, end: string, working: boolean) =>
      rpc("planner_vacation_save", { token, start_date: start, end_date: end, working }),
    clearVacation: (token: string, date: string) =>
      rpc("planner_vacation_clear", { token, day: date }),
  };
}
export type PlannerRepository = ReturnType<typeof createPlannerRepository>;
