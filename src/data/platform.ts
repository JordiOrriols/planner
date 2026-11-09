import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";
import type { PublicRoadmap } from "@/lib/publicRoadmap";
import {
  FEATURE_STATUSES,
  ROLES,
  type FeatureInput,
  type Feature,
  type SprintResult,
  type Role,
} from "@/types/planner";
import { validateFeature, parseDate } from "@/lib/planning";
import { hasHolidayCalendar } from "@/lib/barcelonaHolidays";
import { featureSchema } from "./featureSchema";
import { validateSprintSettings } from "@/lib/sprints";
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
const projectSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  in_use: z.boolean(),
});
const prioritySchema = z.object({
  featureIds: z.array(z.string().uuid()),
  expectedRevision: z.string().regex(/^[a-f0-9]{32}$/),
});
const featureInputSchema = featureSchema
  .omit({ id: true, in_backlog: true, priority: true })
  .extend({
    name: z.string().trim().min(1).max(120),
  });
const calendarSchema = z.object({
  sprint_start_date: z.string().date(),
  sprint_history: z.array(
    z.object({ start_date: z.string().date(), story_points: z.number().finite().nonnegative() })
  ),
  members: z.array(
    z.object({
      id: z.string().uuid(),
      team_id: z.string().uuid(),
      name: z.string(),
      role: z.enum(ROLES).nullable(),
      can_edit: z.boolean(),
    })
  ),
  teams: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  vacations: z.array(
    z.object({ member_id: z.string().uuid(), date: z.string().date(), is_working: z.boolean() })
  ),
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
  calendar: async (workspace: string) =>
    calendarSchema.parse(await request(`${workspacePath(workspace)}/calendar`)),
  createTeam: async (workspace: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || Array.from(trimmed).length > 120)
      throw new Error(i18n.t("teamConfiguration.errors.teamNameRequired"));
    return calendarSchema.parse(
      await request(`${workspacePath(workspace)}/teams`, { name: trimmed })
    );
  },
  updatePlanningRole: async (workspace: string, member: string, role: Role | null) =>
    calendarSchema.parse(
      await request(
        `${workspacePath(workspace)}/members/${z.string().uuid().parse(member)}/planning-role`,
        { role: z.enum(ROLES).nullable().parse(role) },
        "PATCH"
      )
    ),
  setVacations: async (
    workspace: string,
    member: string,
    start: string,
    end: string,
    working: boolean
  ) => {
    const first = parseDate(start),
      last = parseDate(end);
    if (!hasHolidayCalendar(start) || !hasHolidayCalendar(end))
      throw new Error(i18n.t("vacationEditor.errors.unverifiedDates"));
    if (last < first || differenceInCalendarDays(last, first) > 365)
      throw new Error(i18n.t("vacationEditor.errors.rangeTooLong"));
    return calendarSchema.parse(
      await request(
        `${workspacePath(workspace)}/members/${z.string().uuid().parse(member)}/vacations`,
        { start, end, working: z.boolean().parse(working) }
      )
    );
  },
  setSprintCalibration: async (workspace: string, anchor: string, history: SprintResult[]) => {
    validateSprintSettings(anchor, history);
    return calendarSchema.parse(
      await request(`${workspacePath(workspace)}/calibration`, { anchor, history }, "PATCH")
    );
  },
  features: async (workspace: string) =>
    z.array(featureSchema).parse(await request(`${workspacePath(workspace)}/features`)),
  toggleBacklog: async (workspace: string, id: string, included: boolean) =>
    featureSchema.parse(
      await request(
        `${workspacePath(workspace)}/features/${z.string().uuid().parse(id)}/inclusion`,
        { included: z.boolean().parse(included) },
        "PATCH"
      )
    ),
  setPlanStart: async (workspace: string, date: string): Promise<PublicRoadmap> => {
    parseDate(date);
    if (!hasHolidayCalendar(date)) throw new Error(i18n.t("planning.validation.unverifiedStart"));
    return roadmapSchema.parse(
      await request(`${workspacePath(workspace)}/start-date`, { date }, "PATCH")
    );
  },
  saveFeature: async (workspace: string, input: FeatureInput, id?: string) => {
    validateFeature(input);
    const payload = featureInputSchema.parse(input);
    const path = `${workspacePath(workspace)}/features`;
    return featureSchema.parse(
      await request(
        id ? `${path}/${z.string().uuid().parse(id)}` : path,
        payload,
        id ? "PATCH" : "POST"
      )
    );
  },
  deleteFeature: async (workspace: string, id: string) =>
    featureSchema.parse(
      await request(
        `${workspacePath(workspace)}/features/${z.string().uuid().parse(id)}`,
        undefined,
        "DELETE"
      )
    ),
  projects: async (workspace: string) =>
    z.array(projectSchema).parse(await request(`${workspacePath(workspace)}/projects`)),
  createProject: async (workspace: string, name: string) =>
    projectSchema.parse(
      await request(`${workspacePath(workspace)}/projects`, {
        name: z.string().trim().min(1).max(80).parse(name),
      })
    ),
  renameProject: async (workspace: string, project: string, name: string) =>
    projectSchema.parse(
      await request(
        `${workspacePath(workspace)}/projects/${z.string().uuid().parse(project)}`,
        { name: z.string().trim().min(1).max(80).parse(name) },
        "PATCH"
      )
    ),
  deleteProject: async (workspace: string, project: string) =>
    projectSchema.parse(
      await request(
        `${workspacePath(workspace)}/projects/${z.string().uuid().parse(project)}`,
        undefined,
        "DELETE"
      )
    ),
  applyPriorities: async (
    workspace: string,
    featureIds: string[],
    expectedRevision: string
  ): Promise<PublicRoadmap> =>
    roadmapSchema.parse(
      await request(
        `${workspacePath(workspace)}/priorities`,
        prioritySchema.parse({ featureIds, expectedRevision })
      )
    ),
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
  createTeam: (workspace: string, name: string) => Promise<z.infer<typeof calendarSchema>>;
  updatePlanningRole: (
    workspace: string,
    member: string,
    role: Role | null
  ) => Promise<z.infer<typeof calendarSchema>>;
  calendar: (workspace: string) => Promise<z.infer<typeof calendarSchema>>;
  setVacations: (
    workspace: string,
    member: string,
    start: string,
    end: string,
    working: boolean
  ) => Promise<z.infer<typeof calendarSchema>>;
  setSprintCalibration: (
    workspace: string,
    anchor: string,
    history: SprintResult[]
  ) => Promise<z.infer<typeof calendarSchema>>;
  features: (workspace: string) => Promise<Feature[]>;
  toggleBacklog: (workspace: string, id: string, included: boolean) => Promise<Feature>;
  setPlanStart: (workspace: string, date: string) => Promise<PublicRoadmap>;
  saveFeature: (workspace: string, input: FeatureInput, id?: string) => Promise<Feature>;
  deleteFeature: (workspace: string, id: string) => Promise<Feature>;
  workspaces: () => Promise<z.infer<typeof workspaceSchema>[]>;
  applyPriorities: (workspace: string, ids: string[], revision: string) => Promise<PublicRoadmap>;
  projects: (workspace: string) => Promise<z.infer<typeof projectSchema>[]>;
  createProject: (workspace: string, name: string) => Promise<z.infer<typeof projectSchema>>;
  renameProject: (
    workspace: string,
    project: string,
    name: string
  ) => Promise<z.infer<typeof projectSchema>>;
  deleteProject: (workspace: string, project: string) => Promise<z.infer<typeof projectSchema>>;
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
