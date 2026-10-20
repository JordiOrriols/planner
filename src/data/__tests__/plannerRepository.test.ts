import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createPlannerRepository } from "../plannerRepository";
import { EMPTY_FEATURE } from "@/types/planner";

const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  name: "Squad",
  plan_start_date: "2026-10-15",
  sprint_start_date: "2026-02-02",
  sprint_history: [],
};
function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = createClient("https://example.supabase.co", "public-test-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: `planner-test-${crypto.randomUUID()}`,
    },
    global: { fetch },
  });
  const response = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  return { fetch, response, repository: createPlannerRepository(client) };
}
describe("Planner repository", () => {
  it("saves sprint cadence and results atomically and validates them before requesting", async () => {
    const { fetch, response, repository } = setup();
    const history = [{ start_date: "2026-02-02", story_points: 50 }];
    fetch.mockResolvedValue(response({ ...workspace, sprint_history: history }));
    expect(await repository.setSprintCalibration(workspace.id, "2026-02-02", history)).toEqual({
      ...workspace,
      sprint_history: history,
    });
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      sprint_start_date: "2026-02-02",
      sprint_history: history,
    });
    expect(String(fetch.mock.calls[0]?.[0])).toContain(`id=eq.${workspace.id}`);
    fetch.mockClear();
    for (const invalid of [
      [{ start_date: "2026-02-03", story_points: 10 }],
      [{ start_date: "2026-02-02", story_points: -1 }],
      [...history, ...history],
    ])
      await expect(
        repository.setSprintCalibration(workspace.id, "2026-02-02", invalid)
      ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue(response({ message: "Edit access required" }, 403));
    await expect(
      repository.setSprintCalibration(workspace.id, "2026-02-02", history)
    ).rejects.toThrow("Edit access required");
  });

  it("saves the plan start on the workspace and validates dates before requesting", async () => {
    const { fetch, response, repository } = setup();
    for (const date of ["", "2026-02-30", "2028-01-01"])
      await expect(repository.setPlanStart(workspace.id, date)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue(response({ ...workspace, plan_start_date: "2026-02-02" }));
    expect(await repository.setPlanStart(workspace.id, "2026-02-02")).toEqual({
      ...workspace,
      plan_start_date: "2026-02-02",
    });
    expect(String(fetch.mock.calls[0]?.[0])).toContain(`/workspaces?id=eq.${workspace.id}`);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      plan_start_date: "2026-02-02",
    });
    fetch.mockResolvedValue(response({ message: "Only the owner can edit" }, 403));
    await expect(repository.setPlanStart(workspace.id, "2026-02-02")).rejects.toThrow(
      "Only the owner"
    );
    fetch.mockResolvedValue(response(null));
    await expect(repository.setPlanStart(workspace.id, "2026-02-02")).rejects.toThrow();
  });
  it("trims, scopes and validates project writes before requesting", async () => {
    const { fetch, response, repository } = setup();
    const project = {
      id: "33333333-3333-4333-8333-333333333333",
      workspace_id: workspace.id,
      name: "Payments",
    };
    for (const name of ["", "   ", "x".repeat(81)]) {
      await expect(repository.createProject(workspace.id, name)).rejects.toThrow();
      await expect(repository.renameProject(workspace.id, project.id, name)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockImplementation(async () => response(project));
    expect(await repository.createProject(workspace.id, "  Payments ")).toEqual(project);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      workspace_id: workspace.id,
      name: "Payments",
    });
    await repository.renameProject(workspace.id, project.id, " Billing ");
    expect(String(fetch.mock.calls[1]?.[0])).toContain(`id=eq.${project.id}`);
    expect(String(fetch.mock.calls[1]?.[0])).toContain(`workspace_id=eq.${workspace.id}`);
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ name: "Billing" });
    fetch.mockImplementation(async () => new Response(null, { status: 204 }));
    await repository.deleteProject(workspace.id, project.id);
    expect(fetch.mock.calls[2]?.[1]?.method).toBe("DELETE");
    expect(String(fetch.mock.calls[2]?.[0])).toContain(`workspace_id=eq.${workspace.id}`);
    fetch.mockImplementation(async () => response({ ...project, id: "not-a-uuid" }));
    await expect(repository.createProject(workspace.id, "Payments")).rejects.toThrow();
  });
  it("converts plain PostgREST failures into visible error messages", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () =>
      response({ message: "Only the owner can edit", code: "42501" }, 403)
    );
    await expect(repository.updatePlanningRole("member", "backend")).rejects.toThrow(
      "Only the owner can edit"
    );
  });
  it("persists status separately from estimates and scopes the write to the feature", async () => {
    const { fetch, response, repository } = setup();
    const feature = {
      ...EMPTY_FEATURE,
      id: workspace.owner_id,
      project_id: "33333333-3333-4333-8333-333333333333",
      name: "Feature",
      in_backlog: true,
      priority: 0,
      status: "done",
    };
    const row = feature;
    fetch.mockResolvedValue(response(row));
    expect(await repository.setStatus(feature.id, "done")).toEqual(feature);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rest/v1/features?");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ status: "done" });
    const url = String(fetch.mock.calls[0]?.[0]);
    expect(url).toContain(`id=eq.${feature.id}`);
    expect(url).not.toContain("workspace_id");
    fetch.mockResolvedValue(response({ ...row, status: "pending" }));
    expect((await repository.setStatus(feature.id, "pending")).status).toBe("pending");
    fetch.mockResolvedValue(response({ message: "Only the owner can edit", code: "42501" }, 403));
    await expect(repository.setStatus(feature.id, "paused")).rejects.toThrow(
      "Only the owner can edit"
    );
    fetch.mockResolvedValue(response(null));
    await expect(repository.setStatus(feature.id, "paused")).rejects.toThrow();
  });
  it("does not silently truncate more than one page of features", async () => {
    const { fetch, response, repository } = setup();
    const feature = {
      ...EMPTY_FEATURE,
      id: workspace.owner_id,
      name: "Checkout",
      project_id: "33333333-3333-4333-8333-333333333333",
      in_backlog: false,
      status: "pending",
      priority: 0,
    };
    fetch.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/workspaces?")) return response(workspace);
      if (path.includes("/features?"))
        return response(path.includes("offset=500") ? [feature] : Array(500).fill(feature));
      if (path.includes("planner_can_edit_workspace")) return response(true);
      return response([]);
    });
    expect((await repository.loadWorkspace(workspace.id)).features).toHaveLength(501);
  });
  it("rejects invalid database response shapes instead of showing empty success", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async (url) =>
      String(url).includes("/workspaces?")
        ? response({ id: "invalid", name: "Squad" })
        : response(String(url).includes("planner_can_edit_workspace") ? true : [])
    );
    await expect(repository.loadWorkspace(workspace.id)).rejects.toThrow();
  });
  it("creates teams through their RPC and keeps the planning-role RPC separate", async () => {
    const { fetch, response, repository } = setup();
    const team = { id: "00000000-0000-4000-8000-000000000009", name: "Core" };
    fetch.mockResolvedValueOnce(response(team)).mockResolvedValueOnce(response(null));
    await expect(repository.createTeam(workspace.id, "  Core ")).resolves.toEqual(team);
    await repository.updatePlanningRole("member", null);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rpc/create_team");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      p_name: "Core",
      p_workspace: workspace.id,
    });
    await expect(repository.createTeam(workspace.id, "   ")).rejects.toThrow(/Name the team/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      member: "member",
      member_role: null,
    });
  });
  it("delegates anonymous writes only through member-token RPCs", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () => response(null));
    await repository.saveVacationLink("token", "2026-11-02", "2026-11-03", false);
    await repository.clearVacationLink("token", "2026-11-02");
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rpc/planner_vacation_save");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      token: "token",
      start_date: "2026-11-02",
      end_date: "2026-11-03",
      working: false,
    });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      token: "token",
      day: "2026-11-02",
    });
  });
  it("does not treat an empty vacation-member response as successful", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () => response([]));
    await expect(repository.loadVacationLink("token")).rejects.toThrow("Invalid vacation link");
  });
  it("loads token identity, team names and scoped vacations through separate validated RPCs", async () => {
    const { fetch, response, repository } = setup();
    const member = { id: workspace.owner_id, name: "Ada", role: "backend" };
    const colleague = { id: workspace.id, name: "Grace", role: null };
    const vacations = [{ member_id: colleague.id, date: "2026-11-02", is_working: false }];
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("planner_vacation_team_members"))
        return response([member, colleague]);
      if (String(url).includes("planner_vacation_team_list")) return response(vacations);
      return response([member]);
    });
    expect(await repository.loadVacationLink("token")).toEqual({
      member,
      members: [member, colleague],
      vacations,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of fetch.mock.calls)
      expect(JSON.parse(String(call[1]?.body))).toEqual({ token: "token" });
  });

  it("paginates the team vacation list rather than hiding leave after the first page", async () => {
    const { fetch, response, repository } = setup();
    const member = { id: workspace.owner_id, name: "Ada", role: "backend" };
    const vacations = { member_id: member.id, date: "2026-11-02", is_working: false };
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("planner_vacation_team_list"))
        return response(
          String(url).includes("offset=500") ? [vacations] : Array(500).fill(vacations)
        );
      return response([member]);
    });
    expect((await repository.loadVacationLink("token")).vacations).toHaveLength(501);
  });

  it("surfaces team read errors and rejects inconsistent roster data", async () => {
    const { fetch, response, repository } = setup();
    const member = { id: workspace.owner_id, name: "Ada", role: "backend" };
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("planner_vacation_team_members"))
        return response({ message: "Team calendar unavailable" }, 500);
      return response([member]);
    });
    await expect(repository.loadVacationLink("token")).rejects.toThrow("Team calendar unavailable");
    fetch.mockImplementation(async (url) =>
      response(String(url).includes("planner_vacation_member") ? [member] : [])
    );
    await expect(repository.loadVacationLink("token")).rejects.toThrow(
      /did not include its member/
    );
  });
  it("validates estimates before a request and delegates ordering to the transactional RPC", async () => {
    const { fetch, response, repository } = setup();
    await expect(
      repository.saveFeature({ ...EMPTY_FEATURE, name: "Invalid", backend_devs: 1 })
    ).rejects.toThrow(/both/);
    await expect(repository.saveFeature({ ...EMPTY_FEATURE, name: "Orphan" })).rejects.toThrow(
      "Choose a project for this feature."
    );
    for (const role of ["backend", "frontend", "design", "qa"] as const) {
      for (const [people, weeks] of [
        [1.5, 1],
        [1, 1.5],
      ]) {
        await expect(
          repository.saveFeature({
            ...EMPTY_FEATURE,
            name: "Fractional",
            [`${role}_devs`]: people,
            [`${role}_weeks`]: weeks,
          })
        ).rejects.toThrow(/whole numbers/);
      }
    }
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue(response(null));
    await repository.reorder(workspace.id, ["one", "two"]);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rpc/planner_reorder_features");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      workspace: workspace.id,
      feature_ids: ["one", "two"],
    });
  });
  it("stores and reads a feature's project_id without a compatibility mapping", async () => {
    const { fetch, response, repository } = setup();
    const project = "33333333-3333-4333-8333-333333333333";
    const input = { ...EMPTY_FEATURE, name: " Checkout ", project_id: project };
    fetch.mockResolvedValue(
      response({
        ...input,
        name: "Checkout",
        project_id: project,
        id: workspace.owner_id,
        in_backlog: false,
        status: "pending",
        priority: 0,
      })
    );
    const saved = await repository.saveFeature(input);
    expect(saved).toMatchObject({ name: "Checkout", project_id: project });
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rest/v1/features?");
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ name: "Checkout", project_id: project });
    expect(body).not.toHaveProperty("workspace_id");
  });
  it("loads the workspace settings and its features through their project", async () => {
    const { fetch, response, repository } = setup();
    const project = "33333333-3333-4333-8333-333333333333";
    const feature = {
      ...EMPTY_FEATURE,
      id: workspace.owner_id,
      name: "Checkout",
      project_id: project,
      in_backlog: false,
      status: "pending",
      priority: 0,
      projects: { workspace_id: workspace.id },
    };
    fetch.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/rest/v1/workspaces?")) return response(workspace);
      if (path.includes("/rest/v1/features?")) return response([feature]);
      if (path.includes("planner_can_edit_workspace")) return response(true);
      return response([]);
    });
    const { workspace: settings, features } = await repository.loadWorkspace(workspace.id);
    expect(settings).toEqual(workspace);
    const { projects: _join, ...expected } = feature;
    expect(features).toEqual([expected]);
    const url = decodeURIComponent(
      String(fetch.mock.calls.find(([path]) => String(path).includes("/features?"))?.[0])
    );
    expect(url).toContain("select=*,projects!inner(workspace_id)");
    expect(url).toContain(`projects.workspace_id=eq.${workspace.id}`);
    expect(url).not.toMatch(/[?&]workspace_id=/);
  });
});
