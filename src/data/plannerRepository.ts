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
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
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
const invitationSchema = z.object({ member_id: z.string().uuid(), workspace_name: z.string() });

export function createPlannerRepository(client: SupabaseClient) {
  async function rpc(name: string, args?: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message, { cause: error });
    return data;
  }
  async function list<T>(table: string, schema: z.ZodType<T>, workspace?: string): Promise<T[]> {
    // Supabase caps response sizes. Page instead of silently truncating capacity/history.
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = client
        .from(table)
        .select("*")
        .order(table === "planner_availability" ? "date" : "id")
        .range(offset, offset + 499);
      if (table === "planner_availability") query = query.order("member_id");
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
    listInvitations: async () =>
      z.array(invitationSchema).parse(await rpc("planner_list_invitations")),
    createWorkspace: async (name: string, memberName: string, role: Role) =>
      workspaceSchema.parse(
        await rpc("planner_create_workspace", {
          workspace_name: name,
          member_name: memberName,
          member_role: role,
        })
      ),
    acceptInvitation: (member: string) => rpc("planner_accept_invitation", { member }),
    inviteMember: (workspace: string, email: string, name: string, role: Role) =>
      rpc("planner_invite_member", {
        workspace,
        member_email: email,
        member_name: name,
        member_role: role,
      }),
    updateMember: (member: string, name: string, role: Role) =>
      rpc("planner_update_member", { member, member_name: name, member_role: role }),
    async loadWorkspace(workspace: string) {
      const [projects, members] = await Promise.all([
        list("planner_projects", projectSchema, workspace),
        list("planner_members", memberSchema, workspace),
      ]);
      const ids = new Set(members.map((member) => member.id));
      const availability = (await list("planner_availability", availabilitySchema)).filter((item) =>
        ids.has(item.member_id)
      );
      return { projects, members, availability };
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
      rpc("planner_set_availability", { member, start_date: start, end_date: end, working }),
    async clearAvailability(member: string, date: string) {
      const { error } = await client
        .from("planner_availability")
        .delete()
        .eq("member_id", member)
        .eq("date", date);
      if (error) throw new Error(error.message, { cause: error });
    },
    async deleteMember(id: string) {
      const { error } = await client
        .from("planner_members")
        .delete()
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw new Error(error.message, { cause: error });
    },
  };
}
export type PlannerRepository = ReturnType<typeof createPlannerRepository>;
