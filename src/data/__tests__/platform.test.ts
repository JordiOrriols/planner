import { afterEach, expect, it, vi } from "vitest";
import { platformRepository } from "../platform";
import { EMPTY_FEATURE } from "@/types/planner";

afterEach(() => vi.unstubAllGlobals());
it("uses same-origin API queries and validates workspace data", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("[]"));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.workspaces()).toEqual([]);
  expect(fetcher).toHaveBeenCalledWith("/api/apps/planner/workspaces", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
});
it("preserves explicit authentication errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Cloudflare Access token required" }), {
        status: 401,
      })
    )
  );
  await expect(platformRepository.workspaces()).rejects.toThrow("Cloudflare Access token required");
});
it("invalid workspace IDs cannot trigger a request", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(platformRepository.roadmap("not-an-id")).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
const workspace = "11111111-1111-4111-8111-111111111111";
const proposal = "22222222-2222-4222-8222-222222222222";
const revision = "a".repeat(32);
const roadmap = { name: "Local", revision, startDate: "2026-02-02", markers: [], features: [] };
it("roadmap inclusion and start date use separate scoped operations", async () => {
  const feature = {
    ...EMPTY_FEATURE,
    id: proposal,
    project_id: workspace,
    name: "Task",
    priority: 1,
    in_backlog: true,
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(feature)))
    .mockResolvedValueOnce(new Response(JSON.stringify(roadmap)));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.toggleBacklog(workspace, proposal, true)).toEqual(feature);
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    `/api/planner/workspaces/${workspace}/features/${proposal}/inclusion`
  );
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({ included: true });
  expect(await platformRepository.setPlanStart(workspace, "2026-02-02")).toEqual(roadmap);
  expect(fetcher.mock.calls[1]?.[0]).toBe(`/api/planner/workspaces/${workspace}/start-date`);
});
it("invalid or unverified plan dates and feature IDs do not send requests", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(platformRepository.setPlanStart(workspace, "2026-02-30")).rejects.toThrow();
  await expect(platformRepository.setPlanStart(workspace, "2028-02-02")).rejects.toThrow();
  await expect(platformRepository.toggleBacklog(workspace, "bad", true)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("feature editing uses scoped API writes without allowing priority or inclusion changes", async () => {
  const input = {
    ...EMPTY_FEATURE,
    project_id: proposal,
    name: "Task",
    description: "Private",
    backend_devs: 1,
    backend_weeks: 2,
  };
  const feature = { ...input, id: workspace, in_backlog: false, priority: 0 };
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(feature))));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.saveFeature(workspace, feature, feature.id)).toEqual(feature);
  expect(fetcher).toHaveBeenLastCalledWith(
    `/api/planner/workspaces/${workspace}/features/${feature.id}`,
    {
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "PATCH",
      body: expect.any(String),
    }
  );
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual(input);
  expect(await platformRepository.saveFeature(workspace, input)).toEqual(feature);
  expect(fetcher.mock.calls[1]?.[1].method).toBe("POST");
  expect(await platformRepository.deleteFeature(workspace, feature.id)).toEqual(feature);
  expect(fetcher.mock.calls[2]?.[1].method).toBe("DELETE");
});
it("invalid feature estimates or IDs fail before sending requests", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const input = { ...EMPTY_FEATURE, project_id: proposal, name: "Task" };
  for (const invalid of [
    { ...input, backend_devs: 1 },
    { ...input, backend_devs: 1.5, backend_weeks: 2 },
    { ...input, name: "a".repeat(121) },
    { ...input, project_id: "bad" },
  ])
    await expect(platformRepository.saveFeature(workspace, invalid)).rejects.toThrow();
  await expect(platformRepository.deleteFeature(workspace, "bad")).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("official priority updates use a separate authenticated API operation with a revision", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(roadmap)));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.applyPriorities(workspace, [], revision)).toEqual(roadmap);
  expect(fetcher).toHaveBeenCalledWith(`/api/planner/workspaces/${workspace}/priorities`, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ featureIds: [], expectedRevision: revision }),
  });
});
it("official writes reject missing revisions and invalid IDs before fetching", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(platformRepository.applyPriorities("bad", [], revision)).rejects.toThrow();
  await expect(platformRepository.applyPriorities(workspace, ["bad"], revision)).rejects.toThrow();
  await expect(platformRepository.applyPriorities(workspace, [], "stale")).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("previews through the API without writing official priorities", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(roadmap)));
  vi.stubGlobal("fetch", fetcher);
  expect(
    await platformRepository.roadmap(workspace, { featureIds: [], expectedRevision: revision })
  ).toEqual(roadmap);
  expect(fetcher).toHaveBeenCalledWith(`/api/planner/workspaces/${workspace}/preview`, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ featureIds: [], expectedRevision: revision }),
  });
});
it("saves named proposals and restores only their reduced roadmap projection", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: proposal })))
    .mockResolvedValueOnce(new Response(JSON.stringify(roadmap)));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.saveProposal(workspace, "Alternative", [], revision)).toBe(
    proposal
  );
  expect(await platformRepository.roadmap(workspace, { proposal })).toEqual(roadmap);
  expect(fetcher).toHaveBeenLastCalledWith(
    `/api/planner/workspaces/${workspace}/proposals/${proposal}`,
    {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }
  );
});
it("invalid proposals, stale input shapes and blank names fail before fetching", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(platformRepository.roadmap(workspace, { proposal: "bad" })).rejects.toThrow();
  await expect(
    platformRepository.roadmap(workspace, { featureIds: [], proposal })
  ).rejects.toThrow();
  await expect(platformRepository.roadmap(workspace, { featureIds: [] })).rejects.toThrow();
  await expect(platformRepository.saveProposal(workspace, " ", [], revision)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("marker renames send only the name and keep date/identity unchanged", async () => {
  const marker = { id: proposal, workspace_id: workspace, name: "Release", date: "2026-02-04" };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(marker)));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.renameMarker(workspace, proposal, " Release ")).toEqual(marker);
  expect(fetcher).toHaveBeenCalledWith(`/api/planner/workspaces/${workspace}/markers/${proposal}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "PATCH",
    body: JSON.stringify({ name: "Release" }),
  });
});
it("invalid marker fields fail before writes and deletes use the workspace-scoped path", async () => {
  const marker = { id: proposal, workspace_id: workspace, name: "Release", date: "2026-02-04" };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(marker)));
  vi.stubGlobal("fetch", fetcher);
  await expect(platformRepository.createMarker(workspace, "", marker.date)).rejects.toThrow();
  await expect(
    platformRepository.createMarker(workspace, "Release", "2026-02-30")
  ).rejects.toThrow();
  await expect(platformRepository.renameMarker(workspace, "bad", "Release")).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  expect(await platformRepository.deleteMarker(workspace, proposal)).toEqual(marker);
  expect(fetcher).toHaveBeenCalledWith(`/api/planner/workspaces/${workspace}/markers/${proposal}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    method: "DELETE",
  });
});
it("project CRUD validates names and retains workspace identity", async () => {
  const project = { id: proposal, workspace_id: workspace, name: "Renamed", in_use: false };
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(project))));
  vi.stubGlobal("fetch", fetcher);
  expect(await platformRepository.createProject(workspace, " Renamed ")).toEqual(project);
  expect(await platformRepository.renameProject(workspace, proposal, " Renamed ")).toEqual(project);
  expect(fetcher).toHaveBeenLastCalledWith(
    `/api/planner/workspaces/${workspace}/projects/${proposal}`,
    {
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
    }
  );
  expect(await platformRepository.deleteProject(workspace, proposal)).toEqual(project);
  expect(fetcher).toHaveBeenLastCalledWith(
    `/api/planner/workspaces/${workspace}/projects/${proposal}`,
    {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      method: "DELETE",
    }
  );
});
it("invalid project operations cannot trigger requests", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(platformRepository.createProject(workspace, "")).rejects.toThrow();
  await expect(platformRepository.renameProject(workspace, "bad", "Project")).rejects.toThrow();
  await expect(platformRepository.deleteProject("bad", proposal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
