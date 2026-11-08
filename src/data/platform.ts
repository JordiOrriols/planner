import { z } from "zod";
import type { PublicRoadmap } from "@/lib/publicRoadmap";
import { FEATURE_STATUSES } from "@/types/planner";
import i18n from "@/i18n";
import type { PriorityProposalRepository } from "@/components/organisms/priority-proposals";

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
const proposalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string().datetime({ offset: true }),
});
const markerSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  date: z.string().date(),
});
const prioritySchema = z.object({
  featureIds: z.array(z.string().uuid()),
  expectedRevision: z.string().regex(/^[a-f0-9]{32}$/),
});
function workspacePath(workspace: string) {
  return `planner/workspaces/${z.string().uuid().parse(workspace)}`;
}
async function request(
  path: string,
  body?: unknown,
  method?: "POST" | "PATCH" | "DELETE"
): Promise<unknown> {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined && method === undefined
      ? {}
      : {
          method: method ?? "POST",
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
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
  markers: async (workspace: string) =>
    z.array(markerSchema).parse(await request(`${workspacePath(workspace)}/markers`)),
  createMarker: async (workspace: string, name: string, date: string) =>
    markerSchema.parse(
      await request(`${workspacePath(workspace)}/markers`, {
        name: z.string().trim().min(1).max(80).parse(name),
        date: z.string().date().parse(date),
      })
    ),
  renameMarker: async (workspace: string, marker: string, name: string) =>
    markerSchema.parse(
      await request(
        `${workspacePath(workspace)}/markers/${z.string().uuid().parse(marker)}`,
        {
          name: z.string().trim().min(1).max(80).parse(name),
        },
        "PATCH"
      )
    ),
  deleteMarker: async (workspace: string, marker: string) =>
    markerSchema.parse(
      await request(
        `${workspacePath(workspace)}/markers/${z.string().uuid().parse(marker)}`,
        undefined,
        "DELETE"
      )
    ),
  roadmap: async (
    workspace: string,
    options: {
      featureIds?: string[];
      proposal?: string;
      expectedRevision?: string;
    } = {}
  ): Promise<PublicRoadmap> => {
    const path = workspacePath(workspace);
    if (options.proposal && options.featureIds) throw new Error(i18n.t("publicRoadmap.invalid"));
    if (options.proposal)
      return roadmapSchema.parse(
        await request(`${path}/proposals/${z.string().uuid().parse(options.proposal)}`)
      );
    if (options.featureIds)
      return roadmapSchema.parse(await request(`${path}/preview`, prioritySchema.parse(options)));
    return roadmapSchema.parse(await request(`${path}/roadmap`));
  },
  proposals: async (workspace: string) =>
    z.array(proposalSchema).parse(await request(`${workspacePath(workspace)}/proposals`)),
  saveProposal: async (
    workspace: string,
    name: string,
    featureIds: string[],
    expectedRevision: string
  ) =>
    z.object({ id: z.string().uuid() }).parse(
      await request(`${workspacePath(workspace)}/proposals`, {
        ...prioritySchema.parse({ featureIds, expectedRevision }),
        name: z.string().trim().min(1).max(120).parse(name),
      })
    ).id,
} satisfies PriorityProposalRepository & {
  workspaces: () => Promise<z.infer<typeof workspaceSchema>[]>;
  markers: (workspace: string) => Promise<z.infer<typeof markerSchema>[]>;
  createMarker: (
    workspace: string,
    name: string,
    date: string
  ) => Promise<z.infer<typeof markerSchema>>;
  renameMarker: (
    workspace: string,
    marker: string,
    name: string
  ) => Promise<z.infer<typeof markerSchema>>;
  deleteMarker: (workspace: string, marker: string) => Promise<z.infer<typeof markerSchema>>;
};
