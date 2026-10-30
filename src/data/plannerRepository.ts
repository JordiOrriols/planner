import i18n from "@/i18n";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  FEATURE_STATUSES,
  ROLES,
  type FeatureInput,
  type FeatureStatus,
  type Role,
  type SprintResult,
} from "@/types/planner";
import { validateSprintSettings } from "@/lib/sprints";
import { parseDate, validateFeature } from "@/lib/planning";
import { hasHolidayCalendar } from "@/lib/barcelonaHolidays";
import { publicRoadmapSchema } from "./publicRoadmapSchema";

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
  name: z.string(),
  description: z.string(),
  project_id: z.string().uuid(),
  in_backlog: z.boolean(),
  status: z.enum(FEATURE_STATUSES),
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
const markerSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  date: z.string().date(),
});
const vacationSchema = z.object({
  member_id: z.string().uuid(),
  date: z.string(),
  is_working: z.boolean(),
});
const linkedTeamSchema = z.object({ id: z.string().uuid(), name: z.string() });
const vacationMemberSchema = memberSchema.pick({ id: true, name: true, role: true });

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
    workspace?: string,
    { select = "*", workspaceColumn = "workspace_id" } = {}
  ): Promise<T[]> {
    // Supabase caps response sizes. Page instead of silently truncating capacity/history.
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = client
        .from(table)
        .select(select)
        .order(table === "vacations" ? "date" : "id")
        .range(offset, offset + 499);
      if (table === "vacations") query = query.order("member_id");
      if (workspace) query = query.eq(workspaceColumn, workspace);
      const { data, error } = await query;
      if (error) throw new Error(error.message, { cause: error });
      const page = z.array(schema).parse(data);
      result.push(...page);
      if (page.length < 500) return result;
    }
  }
  return {
    async createMarker(workspace: string, name: string, date: string) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 80 || !z.string().date().safeParse(date).success)
        throw new Error(i18n.t("markers.invalid"));
      const { data, error } = await client
        .from("roadmap_markers")
        .insert({ workspace_id: workspace, name: trimmed, date })
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return markerSchema.parse(data);
    },
    async deleteMarker(workspace: string, id: string) {
      const { data, error } = await client
        .from("roadmap_markers")
        .delete()
        .eq("workspace_id", workspace)
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return z.object({ id: z.string().uuid() }).parse(data);
    },
    async roadmapShare(workspace: string, enabled?: boolean) {
      return z
        .string()
        .uuid()
        .nullable()
        .parse(
          await rpc("planner_roadmap_share", {
            workspace,
            ...(enabled === undefined ? {} : { enabled }),
          })
        );
    },
    async loadRoadmapLink(token: string) {
      if (!z.string().uuid().safeParse(token).success)
        throw new Error(i18n.t("publicRoadmap.invalid"));
      const { data, error } = await client.functions.invoke("roadmap", { body: { token } });
      if (error) throw new Error(i18n.t("publicRoadmap.unavailable"), { cause: error });
      return publicRoadmapSchema.parse(data);
    },
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
    async createTeam(workspace: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error(i18n.t("teamConfiguration.errors.teamNameRequired"));
      return linkedTeamSchema.parse(
        await rpc("create_team", { p_name: trimmed, p_workspace: workspace })
      );
    },
    updatePlanningRole: (member: string, role: Role | null) =>
      rpc("planner_update_planning_role", { member, member_role: role }),
    async loadWorkspace(workspace: string) {
      const [settings, features, projects, members, linkedTeams, canEdit, markers] =
        await Promise.all([
          client
            .from("workspaces")
            .select("*")
            .eq("id", workspace)
            .single()
            .then(({ data, error }) => {
              if (error) throw new Error(error.message, { cause: error });
              return workspaceSchema.parse(data);
            }),
          // Features reach their workspace through their project.
          list("features", featureSchema, workspace, {
            select: "*, projects!inner(workspace_id)",
            workspaceColumn: "projects.workspace_id",
          }),
          list("projects", projectSchema, workspace).then((items) =>
            items.sort((a, b) => a.name.localeCompare(b.name))
          ),
          rpcList("planner_workspace_roster", memberSchema, { workspace }),
          rpcList("planner_linked_teams", linkedTeamSchema, { workspace }),
          rpc("planner_can_edit_workspace", { workspace }).then((value) =>
            z.boolean().parse(value)
          ),
          list("roadmap_markers", markerSchema, workspace).then((items) =>
            items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
          ),
        ]);
      const ids = new Set(members.map((member) => member.id));
      const vacations = (await list("vacations", vacationSchema)).filter((item) =>
        ids.has(item.member_id)
      );
      return {
        workspace: settings,
        features,
        projects,
        members,
        vacations,
        linkedTeams,
        canEdit,
        markers,
      };
    },
    async saveFeature(input: FeatureInput, id?: string) {
      validateFeature(input);
      if (!input.project_id) throw new Error(i18n.t("planning.validation.projectRequired"));
      const payload = { ...input, name: input.name.trim() };
      const query = id
        ? client.from("features").update(payload).eq("id", id)
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
      if (error)
        throw new Error(
          /features of this project/.test(error.message)
            ? i18n.t("projects.errors.hasFeatures")
            : error.message,
          { cause: error }
        );
    },
    async toggleBacklog(workspace: string, id: string, inBacklog: boolean) {
      return featureSchema.parse(
        await rpc("planner_toggle_backlog", { workspace, feature: id, included: inBacklog })
      );
    },
    async deleteFeature(id: string) {
      const { error, data } = await client
        .from("features")
        .delete()
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      if (!data) throw new Error(i18n.t("planning.errors.featureNotDeleted"));
    },
    async setStatus(id: string, status: FeatureStatus) {
      const { data, error } = await client
        .from("features")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message, { cause: error });
      return featureSchema.parse(data);
    },
    reorder: (workspace: string, ids: string[]) =>
      rpc("planner_reorder_features", { workspace, feature_ids: ids }),
    setVacations: (member: string, start: string, end: string, working: boolean) =>
      rpc("planner_set_vacations", { member, start_date: start, end_date: end, working }),
    async clearVacation(member: string, date: string) {
      const { error } = await client
        .from("vacations")
        .delete()
        .eq("member_id", member)
        .eq("date", date);
      if (error) throw new Error(error.message, { cause: error });
    },
    async loadVacationLink(token: string) {
      const [identity, members, vacations] = await Promise.all([
        rpc("planner_vacation_member", { token }),
        rpcList("planner_vacation_team_members", vacationMemberSchema, { token }),
        rpcList("planner_vacation_team_list", vacationSchema, { token }),
      ]);
      const member = z.array(vacationMemberSchema).parse(identity)[0];
      if (!member) throw new Error(i18n.t("vacationLink.errors.invalidLink"));
      if (!members.some((item) => item.id === member.id))
        throw new Error(i18n.t("vacationLink.errors.missingMember"));
      return { member, members, vacations };
    },
    saveVacationLink: (token: string, start: string, end: string, working: boolean) =>
      rpc("planner_vacation_save", { token, start_date: start, end_date: end, working }),
    clearVacationLink: (token: string, date: string) =>
      rpc("planner_vacation_clear", { token, day: date }),
  };
}
export type PlannerRepository = ReturnType<typeof createPlannerRepository>;
