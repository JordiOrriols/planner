import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseRepository } from "../supabaseRepository";

type Response = { data: unknown; error: { message: string } | null };

/** Minimal chainable stand-in for the PostgREST query builder. */
function fakeClient(queue: Response[]) {
  const calls: unknown[][] = [];
  const rpc = vi.fn((name: string, args?: Record<string, unknown>) => {
    calls.push(["rpc", name, args]);
    return Promise.resolve(queue.shift() ?? { data: null, error: null });
  });
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "insert", "update", "delete", "eq", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([table, method, ...args]);
        return builder;
      };
    }
    builder["single"] = builder["maybeSingle"] = () => builder;
    builder["then"] = (resolve: (r: Response) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: null, error: null }).then(resolve, reject);
    return builder;
  });
  return { client: { from, rpc } as unknown as SupabaseClient, calls };
}

const memberRow = {
  id: "m1",
  team_id: "t1",
  name: "Ada",
  role: null,
  template_id: "D3",
  self_token: "s",
  peer_token: "p",
  view_token: "v",
  view_enabled: true,
  created_at: "2026-01-01",
};

const teamRow = {
  id: "t1",
  owner_id: "u1",
  name: "Platform",
  is_default: false,
  access_level: "owner",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

const evaluationRow = {
  id: "e1",
  member_id: "m1",
  kind: "manager",
  status: "draft",
  author_name: null,
  current_levels: { Technology: 2 },
  goal_levels: null,
  comments: {},
  created_at: "2026-01-02",
};

const goalRow = {
  id: "g1",
  member_id: "m1",
  title: "Lead a design review",
  description: "Facilitate the next architecture review.",
  due_date: "2026-12-01",
  progress: 40,
  comments: [],
  created_at: "2026-01-02",
  updated_at: "2026-01-03",
};

describe("supabaseRepository", () => {
  it("maps member rows to camelCase", async () => {
    const { client } = fakeClient([{ data: [memberRow], error: null }]);
    const [member] = await createSupabaseRepository(client).listMembers();
    expect(member).toMatchObject({
      id: "m1",
      teamId: "t1",
      role: "",
      templateId: "D3",
      selfToken: "s",
      viewEnabled: true,
    });
  });

  it("lists accessible teams and maps access", async () => {
    const { client, calls } = fakeClient([{ data: [teamRow], error: null }]);
    const teams = await createSupabaseRepository(client).listTeams();
    expect(teams[0]).toMatchObject({ id: "t1", ownerId: "u1", access: "owner" });
    expect(calls).toContainEqual(["rpc", "list_accessible_teams", undefined]);
  });

  it("creates teams through the authenticated RPC", async () => {
    const { client, calls } = fakeClient([{ data: teamRow, error: null }]);
    const team = await createSupabaseRepository(client).createTeam("Platform");
    expect(team).toMatchObject({ id: "t1", name: "Platform", access: "owner" });
    expect(calls).toContainEqual(["rpc", "create_team", { p_name: "Platform" }]);
  });

  it("shares teams and moves members through RPCs", async () => {
    const { client, calls } = fakeClient([
      { data: null, error: null },
      { data: null, error: null },
      { data: memberRow, error: null },
    ]);
    const repo = createSupabaseRepository(client);
    await repo.shareTeamByEmail("t1", "ada@example.com", "editor");
    await repo.updateTeamShare("t1", "u2", "viewer");
    const moved = await repo.moveMember("m1", "t1");
    expect(moved.teamId).toBe("t1");
    expect(calls).toContainEqual([
      "rpc",
      "share_team_by_email",
      { p_team_id: "t1", p_email: "ada@example.com", p_access: "editor" },
    ]);
    expect(calls).toContainEqual([
      "rpc",
      "update_team_share",
      { p_team_id: "t1", p_user_id: "u2", p_access: "viewer" },
    ]);
  });

  it("creates, lists, updates and deletes SMART goals", async () => {
    const { client, calls } = fakeClient([
      { data: goalRow, error: null },
      { data: [goalRow], error: null },
      { data: goalRow, error: null },
      { data: null, error: null },
    ]);
    const repo = createSupabaseRepository(client);
    const input = {
      title: goalRow.title,
      description: goalRow.description,
      dueDate: goalRow.due_date,
      progress: goalRow.progress,
    };
    expect(await repo.createGoal("m1", input)).toMatchObject({ memberId: "m1", progress: 40 });
    expect((await repo.listGoals("m1"))[0]?.title).toBe(goalRow.title);
    await repo.updateGoal("g1", { ...input, progress: 75 });
    await repo.deleteGoal("g1");
    expect(calls).toContainEqual([
      "smart_goals",
      "insert",
      {
        title: input.title,
        description: input.description,
        due_date: input.dueDate,
        progress: input.progress,
        member_id: "m1",
      },
    ]);
  });

  it("returns null for a missing member and throws on errors", async () => {
    const { client } = fakeClient([
      { data: null, error: null },
      { data: null, error: { message: "boom" } },
    ]);
    const repo = createSupabaseRepository(client);
    expect(await repo.getMember("x")).toBeNull();
    await expect(repo.getMember("x")).rejects.toThrow("boom");
  });

  it("creates and updates members with snake_case payloads", async () => {
    const { client, calls } = fakeClient([
      { data: memberRow, error: null },
      { data: memberRow, error: null },
    ]);
    const repo = createSupabaseRepository(client);
    await repo.createMember({ name: "Ada", role: "Dev", templateId: "D3" });
    await repo.updateMember("m1", { viewEnabled: false, templateId: null });
    expect(calls).toContainEqual([
      "members",
      "insert",
      { name: "Ada", role: "Dev", template_id: "D3" },
    ]);
    expect(calls).toContainEqual(["members", "update", { template_id: null, view_enabled: false }]);
  });

  it("creates, lists, updates and deletes evaluations", async () => {
    const { client, calls } = fakeClient([
      { data: evaluationRow, error: null },
      { data: [evaluationRow], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const repo = createSupabaseRepository(client);
    const created = await repo.createEvaluation(
      "m1",
      "manager",
      {
        status: "draft",
        authorName: null,
        currentLevels: { Technology: 2 },
        goalLevels: {},
        comments: {},
      },
      "2026-01-02"
    );
    expect(created.goalLevels).toEqual({});
    expect(await repo.listEvaluations("m1")).toHaveLength(1);
    await repo.setEvaluationStatus("e1", "published");
    await repo.deleteEvaluation("e1");
    await repo.deleteMember("m1");
    expect(calls).toContainEqual(["evaluations", "eq", "member_id", "m1"]);
    expect(calls).toContainEqual(["evaluations", "update", { status: "published" }]);
    expect(calls.find((c) => c[1] === "insert")?.[2]).toMatchObject({
      member_id: "m1",
      kind: "manager",
      created_at: "2026-01-02",
    });
  });

  it("updates draft content without changing its author", async () => {
    const updatedRow = {
      ...evaluationRow,
      status: "published",
      current_levels: { Technology: 4 },
    };
    const { client, calls } = fakeClient([{ data: updatedRow, error: null }]);
    const updated = await createSupabaseRepository(client).updateEvaluationDraft("e1", {
      status: "published",
      authorName: "not-sent",
      currentLevels: { Technology: 4 },
      goalLevels: {},
      comments: {},
    });

    expect(updated.id).toBe("e1");
    expect(calls).toContainEqual([
      "evaluations",
      "update",
      {
        status: "published",
        current_levels: { Technology: 4 },
        goal_levels: {},
        comments: {},
      },
    ]);
    expect(calls).toContainEqual(["evaluations", "eq", "status", "draft"]);
  });
});
