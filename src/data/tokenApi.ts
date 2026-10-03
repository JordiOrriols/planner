import type { Evaluation, EvaluationInput, EvaluationStatus, SmartGoal } from "@/types";
import { supabase } from "./supabaseClient";
import { toEvaluation, toEvaluationPayload, toGoal } from "./supabaseRepository";
import type { EvaluationRow, SmartGoalRow } from "./supabaseRepository";

export type LinkKind = "self" | "peer" | "view";

export type TokenInfo = {
  linkKind: LinkKind;
  name: string;
  role: string;
  templateId: string | null;
};

type TokenInfoRow = {
  link_kind: LinkKind;
  member_name: string;
  member_role: string | null;
  template_id: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidToken = (token: string | undefined): token is string =>
  !!token && UUID_PATTERN.test(token);

function client() {
  if (!supabase) throw new Error("Sharing links require a configured backend");
  return supabase;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function resolveToken(token: string): Promise<TokenInfo | null> {
  if (!isValidToken(token)) return null;
  const rows = await rpc<TokenInfoRow[]>("resolve_token", { p_token: token });
  const row = rows[0];
  if (!row) return null;
  return {
    linkKind: row.link_kind,
    name: row.member_name,
    role: row.member_role ?? "",
    templateId: row.template_id,
  };
}

export async function listSelfEvaluations(token: string): Promise<Evaluation[]> {
  const rows = await rpc<EvaluationRow[]>("self_list", { p_token: token });
  return rows.map(toEvaluation);
}

export async function saveSelfEvaluation(
  token: string,
  input: EvaluationInput
): Promise<Evaluation> {
  const payload = toEvaluationPayload(input);
  const row = await rpc<EvaluationRow>("self_save", {
    p_token: token,
    p_status: payload.status,
    p_current: payload.current_levels,
    p_goal: payload.goal_levels,
    p_comments: payload.comments,
  });
  return toEvaluation(row);
}

export async function updateSelfEvaluationDraft(
  token: string,
  id: string,
  input: EvaluationInput
): Promise<Evaluation> {
  const payload = toEvaluationPayload(input);
  const row = await rpc<EvaluationRow>("self_update_draft", {
    p_token: token,
    p_id: id,
    p_status: payload.status,
    p_current: payload.current_levels,
    p_goal: payload.goal_levels,
    p_comments: payload.comments,
  });
  return toEvaluation(row);
}

export async function setSelfEvaluationStatus(token: string, id: string, status: EvaluationStatus) {
  await rpc<null>("self_set_status", { p_token: token, p_id: id, p_status: status });
}

export async function deleteSelfEvaluation(token: string, id: string) {
  await rpc<null>("self_delete", { p_token: token, p_id: id });
}

export async function submitPeerEvaluation(token: string, input: EvaluationInput) {
  const payload = toEvaluationPayload(input);
  await rpc<string>("peer_submit", {
    p_token: token,
    p_author: payload.author_name,
    p_current: payload.current_levels,
    p_goal: payload.goal_levels,
    p_comments: payload.comments,
  });
}

export async function getPublicView(token: string): Promise<Evaluation[]> {
  const rows = await rpc<EvaluationRow[]>("public_view", { p_token: token });
  return rows.map(toEvaluation);
}

export async function getViewSharingLinks(token: string) {
  const rows = await rpc<{ self_token: string; peer_token: string }[]>("view_sharing_links", {
    p_token: token,
  });
  const row = rows[0];
  if (!row) throw new Error("Invalid view link");
  return { selfToken: row.self_token, peerToken: row.peer_token };
}

export async function listTokenGoals(token: string): Promise<SmartGoal[]> {
  const rows = await rpc<SmartGoalRow[]>("token_goals_list", { p_token: token });
  return rows.map(toGoal);
}

export async function updateTokenGoalProgress(
  token: string,
  id: string,
  progress: number
): Promise<SmartGoal> {
  return toGoal(
    await rpc<SmartGoalRow>("view_goal_progress", {
      p_token: token,
      p_id: id,
      p_progress: progress,
    })
  );
}

export async function appendTokenGoalComment(
  token: string,
  id: string,
  text: string
): Promise<SmartGoal> {
  return toGoal(
    await rpc<SmartGoalRow>("append_goal_comment", { p_token: token, p_id: id, p_text: text })
  );
}
