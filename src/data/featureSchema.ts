import { z } from "zod";
import { FEATURE_STATUSES } from "@/types/planner";

export const featureSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  project_id: z.string().uuid(),
  in_backlog: z.boolean(),
  status: z.enum(FEATURE_STATUSES),
  priority: z.number(),
  dependency_ids: z.array(z.string().uuid()).default([]),
  backend_devs: z.number(),
  backend_weeks: z.number(),
  frontend_devs: z.number(),
  frontend_weeks: z.number(),
  design_devs: z.number(),
  design_weeks: z.number(),
  qa_devs: z.number(),
  qa_weeks: z.number(),
});
