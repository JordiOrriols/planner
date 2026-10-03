import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Evaluation,
  EvaluationInput,
  SharedTeamAccess,
  SmartGoal,
  SmartGoalInput,
  Team,
  TeamMember,
  TeamShare,
} from "@/types";
import type { MemberPatch, Repository } from "./repository";

export type MemberRow = {
  id: string;
  team_id: string;
  name: string;
  role: string | null;
  template_id: string | null;
  self_token: string;
  peer_token: string;
  view_token: string;
  view_enabled: boolean;
  created_at: string;
};

type TeamRow = {
  id: string;
  owner_id: string;
  name: string;
  is_default: boolean;
  access_level?: Team["access"];
  created_at: string;
  updated_at: string;
};

type TeamShareRow = {
  team_id: string;
  user_id: string;
  email: string;
  access_level: SharedTeamAccess;
  shared_at: string;
};

export type SmartGoalRow = {
  id: string;
  member_id: string;
  title: string;
  description: string;
  due_date: string | null;
  progress: number;
  comments: SmartGoal["comments"];
  created_at: string;
  updated_at: string;
};

export type EvaluationRow = {
  id: string;
  member_id: string;
  kind: Evaluation["kind"];
  status: Evaluation["status"];
  author_name: string | null;
  current_levels: Evaluation["currentLevels"];
  goal_levels: Evaluation["goalLevels"];
  comments: Evaluation["comments"];
  created_at: string;
};

const MEMBER_COLUMNS =
  "id,team_id,name,role,template_id,self_token,peer_token,view_token,view_enabled,created_at";
const TEAM_COLUMNS = "id,owner_id,name,is_default,created_at,updated_at";
const EVALUATION_COLUMNS =
  "id,member_id,kind,status,author_name,current_levels,goal_levels,comments,created_at";
const GOAL_COLUMNS =
  "id,member_id,title,description,due_date,progress,comments,created_at,updated_at";

const toMember = (row: MemberRow): TeamMember => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  role: row.role ?? "",
  templateId: row.template_id,
  selfToken: row.self_token,
  peerToken: row.peer_token,
  viewToken: row.view_token,
  viewEnabled: row.view_enabled,
  createdAt: row.created_at,
});

const toTeam = (row: TeamRow): Team => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  isDefault: row.is_default,
  access: row.access_level ?? "owner",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toTeamShare = (row: TeamShareRow): TeamShare => ({
  teamId: row.team_id,
  userId: row.user_id,
  email: row.email,
  access: row.access_level,
  sharedAt: row.shared_at,
});

export const toGoal = (row: SmartGoalRow): SmartGoal => ({
  id: row.id,
  memberId: row.member_id,
  title: row.title,
  description: row.description,
  dueDate: row.due_date,
  progress: row.progress,
  comments: row.comments,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toGoalPayload = (input: SmartGoalInput) => ({
  title: input.title,
  description: input.description,
  due_date: input.dueDate,
  progress: input.progress,
});

export const toEvaluation = (row: EvaluationRow): Evaluation => ({
  id: row.id,
  memberId: row.member_id,
  kind: row.kind,
  status: row.status,
  authorName: row.author_name,
  currentLevels: row.current_levels ?? {},
  goalLevels: row.goal_levels ?? {},
  comments: row.comments ?? {},
  createdAt: row.created_at,
});

export const toEvaluationPayload = (input: EvaluationInput) => ({
  status: input.status,
  author_name: input.authorName,
  current_levels: input.currentLevels,
  goal_levels: input.goalLevels,
  comments: input.comments,
});

function toMemberPatch(patch: MemberPatch) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row["name"] = patch.name;
  if (patch.role !== undefined) row["role"] = patch.role;
  if (patch.templateId !== undefined) row["template_id"] = patch.templateId;
  if (patch.viewEnabled !== undefined) row["view_enabled"] = patch.viewEnabled;
  return row;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Empty response");
  return data;
}

export function createSupabaseRepository(client: SupabaseClient): Repository {
  return {
    kind: "remote",
    async listTeams() {
      const rows = unwrap<TeamRow[]>(await client.rpc("list_accessible_teams"));
      return rows.map(toTeam);
    },
    async createTeam(name) {
      const row = unwrap<TeamRow>(await client.rpc("create_team", { p_name: name }));
      return toTeam(row);
    },
    async updateTeam(id, name) {
      const row = unwrap<TeamRow>(
        await client
          .from("teams")
          .update({ name })
          .eq("id", id)
          .select(TEAM_COLUMNS)
          .single<TeamRow>()
      );
      return toTeam(row);
    },
    async deleteTeam(id) {
      const { error } = await client.from("teams").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async listTeamShares(teamId) {
      const rows = unwrap<TeamShareRow[]>(
        await client.rpc("list_team_shares", { p_team_id: teamId })
      );
      return rows.map(toTeamShare);
    },
    async shareTeamByEmail(teamId, email, access) {
      const { error } = await client.rpc("share_team_by_email", {
        p_team_id: teamId,
        p_email: email,
        p_access: access,
      });
      if (error) throw new Error(error.message);
    },
    async updateTeamShare(teamId, userId, access) {
      const { error } = await client.rpc("update_team_share", {
        p_team_id: teamId,
        p_user_id: userId,
        p_access: access,
      });
      if (error) throw new Error(error.message);
    },
    async removeTeamShare(teamId, userId) {
      const { error } = await client.rpc("remove_team_share", {
        p_team_id: teamId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
    },
    async moveMember(memberId, teamId) {
      const row = unwrap<MemberRow>(
        await client.rpc("move_member_to_team", {
          p_member_id: memberId,
          p_team_id: teamId,
        })
      );
      return toMember(row);
    },
    async listGoals(memberId) {
      const rows = unwrap<SmartGoalRow[]>(
        await client
          .from("smart_goals")
          .select(GOAL_COLUMNS)
          .eq("member_id", memberId)
          .order("created_at")
      );
      return rows.map(toGoal);
    },
    async createGoal(memberId, input) {
      const row = unwrap<SmartGoalRow>(
        await client
          .from("smart_goals")
          .insert({ ...toGoalPayload(input), member_id: memberId })
          .select(GOAL_COLUMNS)
          .single<SmartGoalRow>()
      );
      return toGoal(row);
    },
    async updateGoal(id, input) {
      const row = unwrap<SmartGoalRow>(
        await client
          .from("smart_goals")
          .update(toGoalPayload(input))
          .eq("id", id)
          .select(GOAL_COLUMNS)
          .single<SmartGoalRow>()
      );
      return toGoal(row);
    },
    async deleteGoal(id) {
      const { error } = await client.from("smart_goals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async appendGoalComment(id, text) {
      return toGoal(
        unwrap<SmartGoalRow>(await client.rpc("append_goal_comment", { p_id: id, p_text: text }))
      );
    },
    async listMembers(teamId) {
      let query = client.from("members").select(MEMBER_COLUMNS);
      if (teamId) query = query.eq("team_id", teamId);
      const rows = unwrap<MemberRow[]>(await query.order("created_at"));
      return rows.map(toMember);
    },
    async getMember(id) {
      const { data, error } = await client
        .from("members")
        .select(MEMBER_COLUMNS)
        .eq("id", id)
        .maybeSingle<MemberRow>();
      if (error) throw new Error(error.message);
      return data ? toMember(data) : null;
    },
    async createMember(profile, teamId) {
      const row = unwrap<MemberRow>(
        await client
          .from("members")
          .insert({
            name: profile.name,
            role: profile.role,
            template_id: profile.templateId,
            ...(teamId ? { team_id: teamId } : {}),
          })
          .select(MEMBER_COLUMNS)
          .single<MemberRow>()
      );
      return toMember(row);
    },
    async updateMember(id, patch) {
      const row = unwrap<MemberRow>(
        await client
          .from("members")
          .update(toMemberPatch(patch))
          .eq("id", id)
          .select(MEMBER_COLUMNS)
          .single<MemberRow>()
      );
      return toMember(row);
    },
    async deleteMember(id) {
      const { error } = await client.from("members").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async listEvaluations(memberId) {
      let query = client.from("evaluations").select(EVALUATION_COLUMNS);
      if (memberId) query = query.eq("member_id", memberId);
      const rows = unwrap<EvaluationRow[]>(await query.order("created_at", { ascending: false }));
      return rows.map(toEvaluation);
    },
    async createEvaluation(memberId, kind, input, createdAt) {
      const row = unwrap<EvaluationRow>(
        await client
          .from("evaluations")
          .insert({
            ...toEvaluationPayload(input),
            member_id: memberId,
            kind,
            ...(createdAt ? { created_at: createdAt } : {}),
          })
          .select(EVALUATION_COLUMNS)
          .single<EvaluationRow>()
      );
      return toEvaluation(row);
    },
    async updateEvaluationDraft(id, input) {
      const row = unwrap<EvaluationRow>(
        await client
          .from("evaluations")
          .update({
            status: input.status,
            current_levels: input.currentLevels,
            goal_levels: input.goalLevels,
            comments: input.comments,
          })
          .eq("id", id)
          .eq("status", "draft")
          .select(EVALUATION_COLUMNS)
          .single<EvaluationRow>()
      );
      return toEvaluation(row);
    },
    async setEvaluationStatus(id, status) {
      const { error } = await client.from("evaluations").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async deleteEvaluation(id) {
      const { error } = await client.from("evaluations").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
