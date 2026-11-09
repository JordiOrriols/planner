import { build } from "esbuild";
import { resolve } from "node:path";

await build({
  stdin: {
    contents:
      'export { buildPublicRoadmap } from "./src/lib/publicRoadmap"; export { hasHolidayCalendar } from "./src/lib/barcelonaHolidays"; export { validateSprintSettings } from "./src/lib/sprints";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: "dist-scheduler/roadmap.mjs",
  platform: "node",
  format: "esm",
  target: "node24",
  bundle: true,
  alias: {
    "@/i18n": resolve("src/lib/server-i18n.ts"),
    "@": resolve("src"),
  },
});
