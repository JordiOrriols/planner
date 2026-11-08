import { afterEach, expect, it, vi } from "vitest";
import { platformRepository } from "../platform";

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
