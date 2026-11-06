import { z } from "zod";
import { FEATURE_STATUSES } from "@/types/planner";

export const publicRoadmapSchema = z.object({
  revision: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .optional(),
  name: z.string(),
  startDate: z.string().date(),
  markers: z.array(z.object({ name: z.string(), date: z.string().date() })).default([]),
  features: z.array(
    z.object({
      id: z.string().uuid().optional(),
      dependency_ids: z.array(z.string().uuid()).optional(),
      name: z.string(),
      project: z.string(),
      status: z.enum(FEATURE_STATUSES),
      start: z.string().date().nullable(),
      end: z.string().date().nullable(),
      complete: z.boolean(),
    })
  ),
});
