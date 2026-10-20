import { z } from "zod";
import { FEATURE_STATUSES } from "@/types/planner";

export const publicRoadmapSchema = z.object({
  name: z.string(),
  startDate: z.string().date(),
  features: z.array(
    z.object({
      name: z.string(),
      project: z.string(),
      status: z.enum(FEATURE_STATUSES),
      start: z.string().date().nullable(),
      end: z.string().date().nullable(),
      complete: z.boolean(),
    })
  ),
});
