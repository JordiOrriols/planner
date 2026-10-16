// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createMigratedDatabase } from "./support/migratedDatabase";

const SHARED_WORKSPACES = "20261016180000_shared_workspaces.sql";
const SETTINGS_ON_WORKSPACES = "20261016210000_planner_settings_live_on_workspaces.sql";
const WORKSPACE_COLLABORATORS = "20261016220000_workspace_collaborators.sql";
const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "33333333-3333-4333-8333-333333333333";
const accounts = [
  { id: owner, email: "owner@example.com" },
  { id: stranger, email: "stranger@example.com" },
];
let db: PGlite | undefined;

async function login(id: string | null, role = "authenticated") {
  await db!.exec("reset role");
  await db!.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await db!.exec(`set role ${role}`);
}
async function value<T>(sql: string, params: unknown[] = []) {
  return (await db!.query<{ value: T }>(sql, params)).rows[0]?.value;
}
async function createTeam(name: string) {
  return (await value<string>("select (public.create_team($1)).id as value", [name]))!;
}

afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("Shared workspaces migration", () => {
  it("keeps Planner workspace ids, moves their linked teams in and gives every other team its own", async () => {
    db = await createMigratedDatabase(accounts, { until: SHARED_WORKSPACES });
    await login(owner);
    const [backend, frontend, lead] = [
      await createTeam("Backend"),
      await createTeam("Frontend"),
      await createTeam("Lead"),
    ];
    const digital = (await value<string>(
      "select (public.planner_create_linked_workspace('Digital Team')).id as value"
    ))!;
    await db.query("select public.planner_set_workspace_teams($1,$2)", [
      digital,
      [backend, frontend],
    ]);
    await login(stranger);
    const strangerDefault = (await value<string>(
      "select id as value from public.teams where owner_id = auth.uid() and is_default"
    ))!;

    await login(null, "postgres");
    await applyMigrations(db, { from: SHARED_WORKSPACES });

    const teams = await db.query<{ id: string; workspace: string; owner: string }>(
      `select t.id, w.name as workspace, w.owner_id as owner
       from public.teams t join public.workspaces w on w.id = t.workspace_id`
    );
    const workspaceOf = new Map(teams.rows.map((team) => [team.id, team]));
    expect(workspaceOf.get(backend)).toMatchObject({ workspace: "Digital Team", owner });
    expect(workspaceOf.get(frontend)).toMatchObject({ workspace: "Digital Team", owner });
    expect(workspaceOf.get(lead)).toMatchObject({ workspace: "Lead", owner });
    expect(workspaceOf.get(strangerDefault)).toMatchObject({
      workspace: "Default Team",
      owner: stranger,
    });
    expect(
      await value<string>(
        "select t.workspace_id::text as value from public.teams t where t.id = $1",
        [backend]
      )
    ).toBe(digital);
    expect(
      await value<number>(
        "select count(*)::int as value from public.workspaces where name = 'Digital Team'"
      )
    ).toBe(1);
    await expect(
      db.query("update public.teams set workspace_id = null where id = $1", [lead])
    ).rejects.toThrow(/must live in a workspace/);
  });

  it("gives new teams and Planner workspaces a workspace that only their owner can read", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const team = await createTeam("Platform");
    const planner = (await value<string>(
      "select (public.planner_create_linked_workspace('Roadmap')).id as value"
    ))!;
    await db.query("update public.workspaces set name = 'Roadmap 2027' where id = $1", [planner]);

    const owned = await db.query<{ name: string }>(
      "select name from public.workspaces order by name"
    );
    expect(owned.rows.map((row) => row.name)).toEqual(["Default Team", "Platform", "Roadmap 2027"]);
    expect(
      await value<string>(
        "select w.name as value from public.teams t join public.workspaces w on w.id = t.workspace_id where t.id = $1",
        [team]
      )
    ).toBe("Platform");

    await login(stranger);
    expect((await db.query<{ name: string }>("select name from public.workspaces")).rows).toEqual([
      { name: "Default Team" },
    ]);
    await expect(db.query("insert into public.workspaces(name) values('Mine')")).rejects.toThrow(
      /permission denied/
    );
  });

  it("only lets a team move into a workspace owned by its own owner", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const team = await createTeam("Platform");
    const roadmap = (await value<string>(
      "select (public.planner_create_linked_workspace('Roadmap')).id as value"
    ))!;
    await db.query("update public.teams set workspace_id = $2 where id = $1", [team, roadmap]);
    expect(
      await value<string>("select workspace_id::text as value from public.teams where id = $1", [
        team,
      ])
    ).toBe(roadmap);

    await login(stranger);
    const foreign = (await value<string>(
      "select (public.planner_create_linked_workspace('Foreign')).id as value"
    ))!;
    await login(owner);
    await expect(
      db.query("update public.teams set workspace_id = $2 where id = $1", [team, foreign])
    ).rejects.toThrow(/workspace of their owner/);
    await expect(
      db.query("insert into public.teams(name, workspace_id) values('Sneaky', $1)", [foreign])
    ).rejects.toThrow(/workspace of their owner/);
  });

  it("moves chosen teams into a Planner workspace and gives released teams their own again", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const [backend, frontend] = [await createTeam("Backend"), await createTeam("Frontend")];
    const digital = (await value<string>(
      "select (public.planner_create_linked_workspace('Digital')).id as value"
    ))!;
    const workspaceNames = async () =>
      (
        await db!.query<{ name: string }>("select name from public.workspaces order by name")
      ).rows.map((row) => row.name);
    expect(await workspaceNames()).toEqual(["Backend", "Default Team", "Digital", "Frontend"]);

    await db.query("select public.planner_set_workspace_teams($1,$2)", [
      digital,
      [backend, frontend],
    ]);
    expect(
      (
        await db.query<{ name: string }>("select name from public.planner_linked_teams($1)", [
          digital,
        ])
      ).rows
    ).toEqual([{ name: "Backend" }, { name: "Frontend" }]);
    // The workspaces that only held the moved teams are gone.
    expect(await workspaceNames()).toEqual(["Default Team", "Digital"]);

    await db.query("select public.planner_set_workspace_teams($1,$2)", [digital, [frontend]]);
    expect(await workspaceNames()).toEqual(["Backend", "Default Team", "Digital"]);
    expect(
      await value<string>(
        "select w.name as value from public.teams t join public.workspaces w on w.id = t.workspace_id where t.id = $1",
        [backend]
      )
    ).toBe("Backend");

    // Emptying a Planner workspace keeps it, since it still holds the plan.
    await db.query("select public.planner_set_workspace_teams($1,$2)", [digital, []]);
    expect(await workspaceNames()).toEqual(["Backend", "Default Team", "Digital", "Frontend"]);

    await db.query("delete from public.teams where id = $1", [backend]);
    expect(await workspaceNames()).toEqual(["Default Team", "Digital", "Frontend"]);
  });

  it("carries Planner settings onto workspaces and marks the ones that only held a team", async () => {
    db = await createMigratedDatabase(accounts, { until: SETTINGS_ON_WORKSPACES });
    await login(owner);
    await createTeam("Lead");
    const roadmap = (await value<string>(
      "select (public.planner_create_linked_workspace('Roadmap')).id as value"
    ))!;
    await db.query(
      `update public.planner_workspaces set plan_start_date = '2026-03-02',
         sprint_start_date = '2026-02-02',
         sprint_history = '[{"start_date":"2026-02-16","story_points":30}]'
       where id = $1`,
      [roadmap]
    );

    await login(null, "postgres");
    await applyMigrations(db, { from: SETTINGS_ON_WORKSPACES });

    expect(
      (
        await db.query(
          `select name, plan_start_date::text, sprint_start_date::text, sprint_history,
             created_for_team from public.workspaces where owner_id = $1 order by name`,
          [owner]
        )
      ).rows
    ).toMatchObject([
      { name: "Default Team", created_for_team: true },
      { name: "Lead", created_for_team: true },
      {
        name: "Roadmap",
        plan_start_date: "2026-03-02",
        sprint_start_date: "2026-02-02",
        sprint_history: [{ start_date: "2026-02-16", story_points: 30 }],
        created_for_team: false,
      },
    ]);
    expect(
      await value<string | null>("select to_regclass('public.planner_workspaces')::text as value")
    ).toBeNull();
  });

  it("lists team workspaces for planning and keeps one that holds a plan after its team leaves", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const lead = await createTeam("Lead");
    const leadWorkspace = (await value<string>(
      "select workspace_id::text as value from public.teams where id = $1",
      [lead]
    ))!;
    await db.query("update public.workspaces set plan_start_date = '2026-03-02' where id = $1", [
      leadWorkspace,
    ]);
    await db.query("insert into public.features(workspace_id, name) values($1, 'Hiring')", [
      leadWorkspace,
    ]);
    const roadmap = (await value<string>(
      "select (public.planner_create_linked_workspace('Roadmap')).id as value"
    ))!;
    await db.query("select public.planner_set_workspace_teams($1,$2)", [roadmap, [lead]]);

    expect(
      (
        await db.query("select name, plan_start_date::text from public.workspaces where id = $1", [
          leadWorkspace,
        ])
      ).rows
    ).toEqual([{ name: "Lead", plan_start_date: "2026-03-02" }]);
    await expect(
      db.query("update public.workspaces set created_for_team = false where id = $1", [
        leadWorkspace,
      ])
    ).rejects.toThrow(/permission denied/);
  });

  it("moves the teams of a deleted workspace into workspaces of their own", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const [backend, frontend] = [await createTeam("Backend"), await createTeam("Frontend")];
    const digital = (await value<string>(
      "select (public.planner_create_linked_workspace('Digital')).id as value"
    ))!;
    await db.query("select public.planner_set_workspace_teams($1,$2)", [
      digital,
      [backend, frontend],
    ]);
    await db.query("insert into public.features(workspace_id, name) values($1, 'Checkout')", [
      digital,
    ]);

    expect(
      (await db.query("delete from public.workspaces where id = $1 returning id", [digital])).rows
    ).toEqual([{ id: digital }]);
    expect(
      (
        await db.query(
          `select t.name as team, w.name as workspace, w.created_for_team
           from public.teams t join public.workspaces w on w.id = t.workspace_id
           where t.id = any($1) order by t.name`,
          [[backend, frontend]]
        )
      ).rows
    ).toEqual([
      { team: "Backend", workspace: "Backend", created_for_team: true },
      { team: "Frontend", workspace: "Frontend", created_for_team: true },
    ]);
    expect((await db.query("select id from public.features")).rows).toEqual([]);

    await login(stranger);
    await expect(
      db.query("delete from public.workspaces where owner_id = $1 returning id", [owner])
    ).resolves.toMatchObject({ rows: [] });
  });

  it("carries Planner shares over to workspace collaborators for Planner", async () => {
    db = await createMigratedDatabase(accounts, { until: WORKSPACE_COLLABORATORS });
    await login(owner);
    const roadmap = (await value<string>(
      "select (public.planner_create_linked_workspace('Roadmap')).id as value"
    ))!;
    await db.query("select public.planner_share_workspace($1, 'stranger@example.com', 'editor')", [
      roadmap,
    ]);

    await login(null, "postgres");
    await applyMigrations(db, { from: WORKSPACE_COLLABORATORS });

    await login(owner);
    expect(
      (await db.query("select * from public.list_workspace_shares($1)", [roadmap])).rows
    ).toEqual([
      { user_id: stranger, email: "stranger@example.com", app: "planner", access_level: "editor" },
    ]);
    expect(
      await value<string | null>(
        "select to_regclass('public.planner_workspace_collaborators')::text as value"
      )
    ).toBeNull();
  });

  it("shares a workspace per app, so another app's share grants no Planner access", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const roadmap = (await value<string>(
      "select (public.planner_create_linked_workspace('Roadmap')).id as value"
    ))!;
    await db.query("select public.share_workspace($1, 'stranger@example.com', 'pulse', 'editor')", [
      roadmap,
    ]);
    await expect(
      db.query("select public.share_workspace($1, 'stranger@example.com', 'mail', 'viewer')", [
        roadmap,
      ])
    ).rejects.toThrow(/Invalid app/);

    await login(stranger);
    expect(await value<boolean>("select public.planner_has_access($1) as value", [roadmap])).toBe(
      false
    );
    await expect(db.query("select * from public.workspace_collaborators")).rejects.toThrow(
      /permission denied/
    );
    await expect(
      db.query("select public.share_workspace($1, 'owner@example.com', 'planner', 'viewer')", [
        roadmap,
      ])
    ).rejects.toThrow(/owner access required/);

    await login(owner);
    await db.query(
      "select public.share_workspace($1, 'stranger@example.com', 'planner', 'viewer')",
      [roadmap]
    );
    await db.query("select public.update_workspace_share($1, $2, 'pulse', 'viewer')", [
      roadmap,
      stranger,
    ]);
    expect(
      (await db.query("select app, access_level from public.list_workspace_shares($1)", [roadmap]))
        .rows
    ).toEqual([
      { app: "planner", access_level: "viewer" },
      { app: "pulse", access_level: "viewer" },
    ]);
    await login(stranger);
    expect(await value<boolean>("select public.planner_has_access($1) as value", [roadmap])).toBe(
      true
    );
    expect(
      await value<boolean>("select public.planner_can_edit_workspace($1) as value", [roadmap])
    ).toBe(false);

    await login(owner);
    await db.query("select public.remove_workspace_share($1, $2, 'planner')", [roadmap, stranger]);
    await expect(
      db.query("select public.remove_workspace_share($1, $2, 'planner')", [roadmap, stranger])
    ).rejects.toThrow(/share not found/);
    await login(stranger);
    expect(await value<boolean>("select public.planner_has_access($1) as value", [roadmap])).toBe(
      false
    );
  });
});
