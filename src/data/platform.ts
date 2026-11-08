import { z } from "zod";
import type { PublicRoadmap } from "@/lib/publicRoadmap";
import { FEATURE_STATUSES } from "@/types/planner";

const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(["owner", "editor", "viewer", "external"]),
});
const roadmapSchema = z.object({
  name: z.string(),
  revision: z.string().optional(),
  startDate: z.string().date(),
  markers: z.array(z.object({ name: z.string(), date: z.string().date() })),
  features: z.array(
    z.object({
      id: z.string().uuid(),
      dependency_ids: z.array(z.string().uuid()),
      name: z.string(),
      project: z.string(),
      status: z.enum(FEATURE_STATUSES),
      start: z.string().date().nullable(),
      end: z.string().date().nullable(),
      complete: z.boolean(),
    })
  ),
});
async function request(path: string): Promise<unknown> {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body: unknown = await response.json();
    const error = z.object({ message: z.string() }).safeParse(body);
    throw new Error(error.success ? error.data.message : `API request failed (${response.status})`);
  }
  return response.json();
}
export const platformRepository = {
  workspaces: async () => z.array(workspaceSchema).parse(await request("apps/planner/workspaces")),
  roadmap: async (workspace: string): Promise<PublicRoadmap> =>
    roadmapSchema.parse(
      await request(`planner/workspaces/${z.string().uuid().parse(workspace)}/roadmap`)
    ),
};
