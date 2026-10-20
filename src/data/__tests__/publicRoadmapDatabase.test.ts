// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDatabase } from "./support/migratedDatabase";
import { buildPublicRoadmap } from "@/lib/publicRoadmap";

const owner = "11111111-1111-4111-8111-111111111111";
const viewer = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let workspace: string;
let feature: string;
let member: string;
let token: string;
const login = async (id: string | null, role = "authenticated") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  await db.exec(`set role ${role}`);
};
async function value<T>(sql: string, args: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, args)).rows[0]!.value;
}
beforeAll(async () => {
  db = await createMigratedDatabase([
    { id: owner, email: "owner@example.com" },
    { id: viewer, email: "viewer@example.com" },
    { id: stranger, email: "stranger@example.com" },
  ]);
  await login(owner);
  workspace = await value("select id as value from public.create_workspace('Public team')");
  const team = await value<string>("select (public.create_team('Team',$1)).id as value", [
    workspace,
  ]);
  member = await value(
    "insert into public.members(team_id,name,planning_role) values($1,'Private person','backend') returning id as value",
    [team]
  );
  const project = await value<string>(
    "insert into public.projects(workspace_id,name) values($1,'Payments') returning id as value",
    [workspace]
  );
  feature = await value(
    "insert into public.features(project_id,name,description,backend_devs,backend_weeks,in_backlog) values($1,'Checkout','Private description',1,1,true) returning id as value",
    [project]
  );
  await db.query("update public.workspaces set plan_start_date='2026-02-02' where id=$1", [
    workspace,
  ]);
  token = await value("select public.planner_roadmap_share($1,true) as value", [workspace]);
  await db.query("select public.share_workspace($1,'viewer@example.com','planner','viewer')", [
    workspace,
  ]);
});
afterAll(async () => {
  await db?.close();
});

describe("live public roadmap", () => {
  it("lets editors retrieve a stable token while viewers and outsiders cannot create or revoke one", async () => {
    await login(owner);
    expect(await value("select public.planner_roadmap_share($1,true) as value", [workspace])).toBe(
      token
    );
    for (const account of [viewer, stranger]) {
      await login(account);
      for (const enabled of [true, false, null])
        await expect(
          db.query("select public.planner_roadmap_share($1,$2)", [workspace, enabled])
        ).rejects.toThrow(/edit access/);
    }
    await login(null, "anon");
    await expect(db.query("select * from public.roadmap_shares")).rejects.toThrow(
      /permission denied/
    );
    await expect(
      db.query("select public.planner_roadmap_share($1,true)", [workspace])
    ).rejects.toThrow(/permission denied/);
  });
  it("keeps all scheduling inputs behind a service-only RPC and projects only public fields", async () => {
    for (const role of ["anon", "authenticated"]) {
      await login(owner, role);
      await expect(db.query("select public.planner_roadmap_source($1)", [token])).rejects.toThrow(
        /permission denied/
      );
    }
    await login(null, "service_role");
    const source = await value("select public.planner_roadmap_source($1) as value", [token]);
    const result = buildPublicRoadmap(source);
    expect(result).toEqual({
      name: "Public team",
      startDate: "2026-02-02",
      features: [
        {
          name: "Checkout",
          project: "Payments",
          status: "pending",
          start: "2026-02-02",
          end: "2026-02-20",
          complete: true,
        },
      ],
    });
    const json = JSON.stringify(result);
    for (const secret of [
      "Private person",
      "Private description",
      "backend",
      "vacations",
      member,
      feature,
      workspace,
    ])
      expect(json).not.toContain(secret);
  });
  it("reflects changed estimates and vacations on the next read without republishing", async () => {
    await login(owner);
    await db.query("update public.features set backend_weeks=2 where id=$1", [feature]);
    await db.query("select public.planner_set_vacations($1,'2026-02-02','2026-02-02',false)", [
      member,
    ]);
    await login(null, "service_role");
    const result = buildPublicRoadmap(
      await value("select public.planner_roadmap_source($1) as value", [token])
    );
    expect(result.features[0]).toMatchObject({ start: "2026-02-03", end: "2026-03-02" });
  });
  it("invalidates a revoked token and creates a different one when sharing is enabled again", async () => {
    await login(owner);
    await db.query("select public.planner_roadmap_share($1,false)", [workspace]);
    await login(null, "service_role");
    await expect(db.query("select public.planner_roadmap_source($1)", [token])).rejects.toThrow(
      /unavailable/
    );
    await login(owner);
    const next = await value("select public.planner_roadmap_share($1,true) as value", [workspace]);
    expect(next).not.toBe(token);
  });
});
