// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { createMigratedDatabase } from "./support/migratedDatabase";

const owner = "11111111-1111-4111-8111-111111111111";
const teammate = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
const accounts = [
  { id: owner, email: "owner@example.com" },
  { id: teammate, email: "teammate@example.com" },
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
async function rows<T>(sql: string, params: unknown[] = []) {
  return (await db!.query<T>(sql, params)).rows;
}
async function createWorkspace(name: string) {
  return (await value<string>("select (public.create_workspace($1)).id as value", [name]))!;
}
async function createTeam(name: string, workspace: string) {
  return (await value<string>("select (public.create_team($1, $2)).id as value", [
    name,
    workspace,
  ]))!;
}
async function createProject(workspace: string, name = "Launch") {
  return (await value<string>(
    "insert into public.projects(workspace_id, name) values($1, $2) returning id as value",
    [workspace, name]
  ))!;
}
async function share(workspace: string, email: string, app: string, access: string) {
  await db!.query("select public.share_workspace($1, $2, $3, $4)", [workspace, email, app, access]);
}

afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("Listing and creating workspaces", () => {
  it("lists, per app, the workspaces the account owns or was given access to", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const digital = await createWorkspace("  Digital  ");
    const pulse = await createWorkspace("pulse only");
    await createTeam("Core", digital);
    await share(digital, "teammate@example.com", "ladders", "viewer");
    await share(pulse, "teammate@example.com", "pulse", "editor");

    expect(await rows("select name, access_level from public.list_workspaces('planner')")).toEqual(
      expect.arrayContaining([
        { name: "Digital", access_level: "owner" },
        { name: "pulse only", access_level: "owner" },
      ])
    );

    await login(teammate);
    expect(
      await rows(
        "select id, access_level from public.list_workspaces('ladders') where owner_id <> auth.uid()"
      )
    ).toEqual([{ id: digital, access_level: "viewer" }]);
    // Planner opens, read-only, the workspaces of the teams the account can view.
    expect(
      await rows(
        "select id, access_level from public.list_workspaces('planner') where owner_id <> auth.uid()"
      )
    ).toEqual([{ id: digital, access_level: "viewer" }]);
    expect(
      await rows(
        "select id, access_level from public.list_workspaces('pulse') where owner_id <> auth.uid()"
      )
    ).toEqual([{ id: pulse, access_level: "editor" }]);
    await expect(db.query("select * from public.list_workspaces('mail')")).rejects.toThrow(
      /Invalid app/
    );

    await login(stranger);
    expect(await rows("select id from public.list_workspaces('planner')")).toEqual(
      expect.not.arrayContaining([{ id: digital }, { id: pulse }])
    );
  });

  it("creates workspaces only for verified accounts with a sensible name", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    await expect(createWorkspace("   ")).rejects.toThrow(/between 1 and 120/);
    await expect(createWorkspace("x".repeat(121))).rejects.toThrow(/between 1 and 120/);
    const created = await rows<{ owner_id: string; created_for_team: boolean }>(
      "select owner_id, created_for_team from public.create_workspace('Squad')"
    );
    expect(created).toEqual([{ owner_id: owner, created_for_team: false }]);

    await login(null, "postgres");
    await db.query("update auth.users set email_confirmed_at = null where id = $1", [stranger]);
    await login(stranger);
    await expect(createWorkspace("Sneaky")).rejects.toThrow(/verified email/);
    await login(null, "anon");
    await expect(createWorkspace("Anonymous")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.list_workspaces('planner')")).rejects.toThrow(
      /permission denied/
    );
  });
});

describe("Teams stay in their workspace", () => {
  it("creates teams in a workspace of the caller and never moves them", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const digital = await createWorkspace("Digital");
    const other = await createWorkspace("Other");
    const team = await createTeam("Core", digital);
    expect(
      await value("select workspace_id as value from public.teams where id = $1", [team])
    ).toBe(digital);
    await expect(
      db.query("update public.teams set workspace_id = $2 where id = $1", [team, other])
    ).rejects.toThrow(/cannot move to another workspace/);
    await expect(
      db.query("select public.planner_set_workspace_teams($1, $2)", [other, [team]])
    ).rejects.toThrow(/does not exist/);

    await login(stranger);
    await expect(createTeam("Intruders", digital)).rejects.toThrow(/workspace owner/);
    await expect(
      db.query(
        "insert into public.teams(owner_id, name, workspace_id) values($1, 'Intruders', $2)",
        [stranger, digital]
      )
    ).rejects.toThrow(/workspace of their owner|row-level security/);

    // Editors of the workspace still cannot add teams: only its owner can.
    await login(owner);
    await share(digital, "teammate@example.com", "ladders", "editor");
    await login(teammate);
    await expect(createTeam("Guests", digital)).rejects.toThrow(/workspace owner/);
  });

  it("keeps a workspace with teams until its owner deletes the teams", async () => {
    db = await createMigratedDatabase(accounts);
    await login(owner);
    const digital = await createWorkspace("Digital");
    const team = await createTeam("Core", digital);
    await expect(
      db.query("delete from public.workspaces where id = $1", [digital])
    ).rejects.toThrow(/Delete the teams of this workspace first/);
    await db.query("delete from public.teams where id = $1", [team]);
    expect(
      await rows("delete from public.workspaces where id = $1 returning id", [digital])
    ).toEqual([{ id: digital }]);
  });
});
