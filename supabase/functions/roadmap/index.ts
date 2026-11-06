import { createClient } from "@supabase/supabase-js";
import { buildPublicRoadmap } from "../../../src/lib/publicRoadmap.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  let token: unknown;
  let featureIds: unknown;
  let proposal: unknown;
  let expectedRevision: unknown;
  try {
    const body = await request.json();
    token = body.token;
    featureIds = body.featureIds;
    proposal = body.proposal;
    expectedRevision = body.expectedRevision;
  } catch {
    return response({ error: "Invalid roadmap link" }, 400);
  }
  if (
    typeof token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  )
    return response({ error: "Invalid roadmap link" }, 400);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    (proposal !== undefined && (typeof proposal !== "string" || !uuid.test(proposal))) ||
    (proposal !== undefined && featureIds !== undefined) ||
    (featureIds !== undefined &&
      (typeof expectedRevision !== "string" || !/^[a-f0-9]{32}$/.test(expectedRevision))) ||
    (featureIds !== undefined &&
      (!Array.isArray(featureIds) ||
        featureIds.some((id) => typeof id !== "string" || !uuid.test(id))))
  )
    return response({ error: "Invalid priority proposal" }, 400);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Roadmap service is missing Supabase configuration");
    return response({ error: "Roadmap service unavailable" }, 503);
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } =
    proposal === undefined
      ? await client.rpc("planner_roadmap_source", { token })
      : await client.rpc("planner_saved_proposal_source", { token, proposal });
  if (error) {
    if (error.code === "P0002") return response({ error: "Roadmap link unavailable" }, 404);
    console.error("Roadmap source failed", error.code, error.message);
    return response({ error: "Unable to load roadmap" }, 500);
  }
  let source = data;
  if (featureIds !== undefined) {
    const reordered = await client.rpc("planner_proposal_source", {
      source,
      feature_ids: featureIds,
      expected_revision: expectedRevision,
    });
    if (reordered.error) {
      if (reordered.error.code === "23514")
        return response({ error: reordered.error.message }, 409);
      console.error("Priority preview failed", reordered.error.code, reordered.error.message);
      return response({ error: "Unable to calculate priority proposal" }, 500);
    }
    source = reordered.data;
  }
  try {
    return response(buildPublicRoadmap(source));
  } catch (error) {
    console.error(
      "Roadmap calculation failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    return response({ error: "Unable to calculate roadmap" }, 500);
  }
});
