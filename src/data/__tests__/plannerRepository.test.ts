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
  it("uses registered-account sharing RPCs and validates returned permissions", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () => response(null));
    await repository.shareWorkspace(workspace.id, "ada@example.com", "editor");
    await repository.updateWorkspaceShare(workspace.id, workspace.owner_id, "viewer");
    await repository.removeWorkspaceShare(workspace.id, workspace.owner_id);
    expect(fetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))).toEqual([
      {
        workspace: workspace.id,
        account_email: "ada@example.com",
        app_name: "planner",
        access: "editor",
      },
      {
        workspace: workspace.id,
        account: workspace.owner_id,
        app_name: "planner",
        access: "viewer",
      },
      { workspace: workspace.id, account: workspace.owner_id, app_name: "planner" },
    ]);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rpc/share_workspace");
    expect(String(fetch.mock.calls[1]?.[0])).toContain("/rpc/update_workspace_share");
    expect(String(fetch.mock.calls[2]?.[0])).toContain("/rpc/remove_workspace_share");
    const share = {
      user_id: workspace.owner_id,
      email: "ada@example.com",
      app: "planner",
      access_level: "viewer",
    };
    // Shares for other apps on the same workspace stay out of Planner's list.
    fetch.mockResolvedValue(response([share, { ...share, app: "ladders" }]));
    expect(await repository.listWorkspaceShares(workspace.id)).toEqual([share]);
    fetch.mockResolvedValue(response([{ ...share, access_level: "owner" }]));
    await expect(repository.listWorkspaceShares(workspace.id)).rejects.toThrow();
    fetch.mockResolvedValue(response({ message: "Workspace owner access required" }, 403));
    await expect(
      repository.shareWorkspace(workspace.id, "ada@example.com", "viewer")
    ).rejects.toThrow("Workspace owner access required");
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
  it("trims, scopes and validates main project writes before requesting", async () => {
    const { fetch, response, repository } = setup();
    const mainProject = {
      id: "33333333-3333-4333-8333-333333333333",
      workspace_id: workspace.id,
      name: "Payments",
    };
    for (const name of ["", "   ", "x".repeat(81)]) {
      await expect(repository.createMainProject(workspace.id, name)).rejects.toThrow();
      await expect(
        repository.renameMainProject(workspace.id, mainProject.id, name)
      ).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockImplementation(async () => response(mainProject));
    expect(await repository.createMainProject(workspace.id, "  Payments ")).toEqual(mainProject);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      workspace_id: workspace.id,
      name: "Payments",
    });
    await repository.renameMainProject(workspace.id, mainProject.id, " Billing ");
    expect(String(fetch.mock.calls[1]?.[0])).toContain(`id=eq.${mainProject.id}`);
    expect(String(fetch.mock.calls[1]?.[0])).toContain(`workspace_id=eq.${workspace.id}`);
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ name: "Billing" });
    fetch.mockImplementation(async () => new Response(null, { status: 204 }));
    await repository.deleteMainProject(workspace.id, mainProject.id);
    expect(fetch.mock.calls[2]?.[1]?.method).toBe("DELETE");
    expect(String(fetch.mock.calls[2]?.[0])).toContain(`workspace_id=eq.${workspace.id}`);
    fetch.mockImplementation(async () => response({ ...mainProject, id: "not-a-uuid" }));
    await expect(repository.createMainProject(workspace.id, "Payments")).rejects.toThrow();
  });
  it("converts plain PostgREST failures into visible error messages", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () =>
      response({ message: "Only the owner can edit", code: "42501" }, 403)
    );
    await expect(repository.updatePlanningRole("member", "backend")).rejects.toThrow(
      "Only the owner can edit"
    );
    await expect(repository.listWorkspaces()).rejects.toThrow("Only the owner can edit");
  });
  it("persists delivery separately from estimates and scopes writes to both workspace and project", async () => {
    const { fetch, response, repository } = setup();
    const feature = {
      ...EMPTY_FEATURE,
      id: workspace.owner_id,
      workspace_id: workspace.id,
      name: "Feature",
      in_backlog: true,
      priority: 0,
      delivered: true,
    };
    const { main_project_id: projectId, ...estimates } = feature;
    const row = { ...estimates, project_id: projectId };
    fetch.mockResolvedValue(response(row));
    expect(await repository.setDelivered(workspace.id, feature.id, true)).toEqual(feature);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rest/v1/features?");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ delivered: true });
    const url = String(fetch.mock.calls[0]?.[0]);
    expect(url).toContain(`id=eq.${feature.id}`);
    expect(url).toContain(`workspace_id=eq.${workspace.id}`);
    fetch.mockResolvedValue(response({ ...row, delivered: false }));
    expect((await repository.setDelivered(workspace.id, feature.id, false)).delivered).toBe(false);
    fetch.mockResolvedValue(response({ message: "Only the owner can edit", code: "42501" }, 403));
    await expect(repository.setDelivered(workspace.id, feature.id, true)).rejects.toThrow(
      "Only the owner can edit"
    );
    fetch.mockResolvedValue(response(null));
    await expect(repository.setDelivered(workspace.id, feature.id, true)).rejects.toThrow();
  });
  it("does not silently truncate more than one page of workspaces", async () => {
    const { fetch, response, repository } = setup();
    const rows = Array.from({ length: 500 }, (_, index) => ({
      ...workspace,
      name: `Squad ${index}`,
    }));
    fetch.mockResolvedValueOnce(response(rows)).mockResolvedValueOnce(response([workspace]));
    expect(await repository.listWorkspaces()).toHaveLength(501);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]?.[0])).toContain("offset=500");
  });
  it("rejects invalid database response shapes instead of showing empty success", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockResolvedValue(response([{ id: "invalid", name: "Squad" }]));
    await expect(repository.listWorkspaces()).rejects.toThrow();
  });
  it("uses Ladders team linking and a separate global planning-role RPC", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () => response(null));
    await repository.setWorkspaceTeams(workspace.id, ["team-one", "team-two"]);
    await repository.updatePlanningRole("member", null);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rpc/planner_set_workspace_teams");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      workspace: workspace.id,
      team_ids: ["team-one", "team-two"],
    });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      member: "member",
      member_role: null,
    });
  });
  it("delegates anonymous writes only through member-token RPCs", async () => {
    const { fetch, response, repository } = setup();
    fetch.mockImplementation(async () => response(null));
    await repository.saveVacation("token", "2026-11-02", "2026-11-03", false);
    await repository.clearVacation("token", "2026-11-02");
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
    await expect(repository.loadVacation("token")).rejects.toThrow("Invalid vacation link");
  });
  it("loads token identity, team names and scoped availability through separate validated RPCs", async () => {
    const { fetch, response, repository } = setup();
    const member = { id: workspace.owner_id, name: "Ada", role: "backend" };
    const colleague = { id: workspace.id, name: "Grace", role: null };
    const availability = [{ member_id: colleague.id, date: "2026-11-02", is_working: false }];
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("planner_vacation_team_members"))
        return response([member, colleague]);
      if (String(url).includes("planner_vacation_team_list")) return response(availability);
      return response([member]);
    });
    expect(await repository.loadVacation("token")).toEqual({
      member,
      members: [member, colleague],
      availability,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of fetch.mock.calls)
      expect(JSON.parse(String(call[1]?.body))).toEqual({ token: "token" });
  });

  it("paginates the team vacation list rather than hiding leave after the first page", async () => {
    const { fetch, response, repository } = setup();
    const member = { id: workspace.owner_id, name: "Ada", role: "backend" };
    const availability = { member_id: member.id, date: "2026-11-02", is_working: false };
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("planner_vacation_team_list"))
        return response(
          String(url).includes("offset=500") ? [availability] : Array(500).fill(availability)
        );
      return response([member]);
    });
    expect((await repository.loadVacation("token")).availability).toHaveLength(501);
  });

  it("surfaces team read errors and rejects inconsistent roster data", async () => {
    const { fetch, response, repository } = setup();
    const member = { id: workspace.owner_id, name: "Ada", role: "backend" };
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("planner_vacation_team_members"))
        return response({ message: "Team calendar unavailable" }, 500);
      return response([member]);
    });
    await expect(repository.loadVacation("token")).rejects.toThrow("Team calendar unavailable");
    fetch.mockImplementation(async (url) =>
      response(String(url).includes("planner_vacation_member") ? [member] : [])
    );
    await expect(repository.loadVacation("token")).rejects.toThrow(/did not include its member/);
  });
  it("validates estimates before a request and delegates ordering to the transactional RPC", async () => {
    const { fetch, response, repository } = setup();
    await expect(
      repository.saveFeature(workspace.id, { ...EMPTY_FEATURE, name: "Invalid", backend_devs: 1 })
    ).rejects.toThrow(/both/);
    for (const role of ["backend", "frontend", "design", "qa"] as const) {
      for (const [people, weeks] of [
        [1.5, 1],
        [1, 1.5],
      ]) {
        await expect(
          repository.saveFeature(workspace.id, {
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
  it("stores a feature's project as project_id and reads it back as the app's main project", async () => {
    const { fetch, response, repository } = setup();
    const project = "33333333-3333-4333-8333-333333333333";
    const input = { ...EMPTY_FEATURE, name: " Checkout ", main_project_id: project };
    const { main_project_id: _, ...feature } = input;
    fetch.mockResolvedValue(
      response({
        ...feature,
        name: "Checkout",
        project_id: project,
        id: workspace.owner_id,
        workspace_id: workspace.id,
        in_backlog: false,
        delivered: false,
        priority: 0,
      })
    );
    const saved = await repository.saveFeature(workspace.id, input);
    expect(saved).toMatchObject({ name: "Checkout", main_project_id: project });
    expect(saved).not.toHaveProperty("project_id");
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rest/v1/features?");
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      name: "Checkout",
      project_id: project,
      workspace_id: workspace.id,
    });
    expect(body).not.toHaveProperty("main_project_id");
  });
});
