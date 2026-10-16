// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createMigratedDatabase } from "./support/migratedDatabase";

const SHARED_WORKSPACES = "20261016180000_shared_workspaces.sql";
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
    await db.query("update public.planner_workspaces set name = 'Roadmap 2027' where id = $1", [
      planner,
    ]);

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
});
