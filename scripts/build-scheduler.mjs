import { build } from "esbuild";
import { resolve } from "node:path";

await build({
  entryPoints: ["src/lib/publicRoadmap.ts"],
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
