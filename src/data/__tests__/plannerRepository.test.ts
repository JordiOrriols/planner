import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createPlannerRepository } from "../plannerRepository";
import { EMPTY_PROJECT } from "@/types/planner";

const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  name: "Squad",
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
  it("validates estimates before a request and delegates ordering to the transactional RPC", async () => {
    const { fetch, response, repository } = setup();
    await expect(
      repository.saveProject(workspace.id, { ...EMPTY_PROJECT, name: "Invalid", backend_devs: 1 })
    ).rejects.toThrow(/both/);
    for (const role of ["backend", "frontend", "design", "qa"] as const) {
      for (const [people, weeks] of [
        [1.5, 1],
        [1, 1.5],
      ]) {
        await expect(
          repository.saveProject(workspace.id, {
            ...EMPTY_PROJECT,
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
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/rpc/planner_reorder_projects");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      workspace: workspace.id,
      project_ids: ["one", "two"],
    });
  });
});
