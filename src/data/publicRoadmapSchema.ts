import { z } from "zod";

export const publicRoadmapSchema = z.object({
  name: z.string(),
  startDate: z.string().date(),
  features: z.array(
    z.object({
      name: z.string(),
      project: z.string(),
      delivered: z.boolean(),
      start: z.string().date().nullable(),
      end: z.string().date().nullable(),
      complete: z.boolean(),
    })
  ),
});
