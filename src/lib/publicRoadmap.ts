import { format } from "date-fns";
import { z } from "zod";
import { computeSchedule, parseDate } from "@/lib/planning";
import {
  FEATURE_STATUSES,
  ROLES,
  type Feature,
  type FeatureStatus,
  type PlannerMember,
  type Vacation,
} from "@/types/planner";

export interface RoadmapSource {
  name: string;
  startDate: string;
  projects: { id: string; name: string }[];
  features: Feature[];
  members: Pick<PlannerMember, "id" | "role">[];
  vacations: Vacation[];
}

export interface PublicRoadmap {
  name: string;
  startDate: string;
  markers: { name: string; date: string }[];
  features: {
    name: string;
    project: string;
    status: FeatureStatus;
    start: string | null;
    end: string | null;
    complete: boolean;
  }[];
}

/** The only public projection: all technical inputs stay inside the Edge Function. */
const sourceSchema = z.object({
  name: z.string(),
  startDate: z.string().date(),
  markers: z.array(z.object({ name: z.string(), date: z.string().date() })).default([]),
  projects: z.array(z.object({ id: z.string(), name: z.string() })),
  features: z.array(
    z.object({
      id: z.string(),
      project_id: z.string(),
      name: z.string(),
      description: z.string(),
      in_backlog: z.boolean(),
      status: z.enum(FEATURE_STATUSES),
      priority: z.number(),
      backend_devs: z.number(),
      backend_weeks: z.number(),
      frontend_devs: z.number(),
      frontend_weeks: z.number(),
      design_devs: z.number(),
      design_weeks: z.number(),
      qa_devs: z.number(),
      qa_weeks: z.number(),
    })
  ),
  members: z.array(z.object({ id: z.string(), role: z.enum(ROLES).nullable() })),
  vacations: z.array(
    z.object({ member_id: z.string(), date: z.string().date(), is_working: z.boolean() })
  ),
});

export function buildPublicRoadmap(input: unknown): PublicRoadmap {
  const source = sourceSchema.parse(input);
  const members = source.members.map((member) => ({
    ...member,
    name: "",
    team_id: "",
    can_edit: false,
    vacation_token: null,
  }));
  const result = computeSchedule(
    source.features,
    members,
    source.vacations,
    parseDate(source.startDate)
  );
  const projects = new Map(source.projects.map((project) => [project.id, project.name]));
  return {
    name: source.name,
    startDate: source.startDate,
    markers: source.markers,
    features: result.schedule.map((item) => ({
      name: item.feature.name,
      project: projects.get(item.feature.project_id) ?? "",
      status: item.feature.status,
      start: item.start ? format(item.start, "yyyy-MM-dd") : null,
      end: item.end ? format(item.end, "yyyy-MM-dd") : null,
      complete: item.complete,
    })),
  };
}
