// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const viewer = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let workspace: string;
let team: string;
let otherTeam: string;
let member: {
  id: string;
  vacation_token: string;
  self_token: string;
  peer_token: string;
  view_token: string;
};
async function login(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await db.exec(`set role ${role}`);
}
async function link(workspaceId = workspace, teams = [team]) {
  await db.query("select public.planner_set_workspace_teams($1,$2)", [workspaceId, teams]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values
      ('${owner}', 'owner@example.com', now()),
      ('${viewer}', 'viewer@example.com', now()),
      ('${stranger}', 'stranger@example.com', now());
  `);
  // PGlite provides core gen_random_uuid(), but not Supabase's pgcrypto extension.
  for (const file of [
    "0001_init.sql",
    "0002_editable_drafts.sql",
    "0003_teams_and_sharing.sql",
    "0004_create_team_rpc.sql",
  ]) {
    const sql = await readFile(
      new URL(`../../../../ladders/supabase/migrations/${file}`, import.meta.url),
      "utf8"
    );
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  }
  for (const file of [
    "20261003140000_planner_workspaces.sql",
    "20261003150000_planner_team_and_priority.sql",
    "20261003170000_planner_whole_estimates.sql",
    "20261003183000_planner_ladders_teams.sql",
  ]) {
    await db.exec(
      await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8")
    );
  }
});
beforeEach(async () => {
  await login(null, "postgres");
  await db.exec(
    "delete from public.planner_workspaces; delete from public.members; delete from public.team_collaborators"
  );
  await login(owner);
  const teams = await db.query<{ id: string }>(
    "select id from public.teams where owner_id = auth.uid() and is_default"
  );
  team = teams.rows[0]!.id;
  await login(stranger);
  otherTeam = (
    await db.query<{ id: string }>(
      "select id from public.teams where owner_id = auth.uid() and is_default"
    )
  ).rows[0]!.id;
  await login(owner);
  member = (
    await db.query<typeof member>(
      "insert into public.members(team_id,name,role,planning_role) values($1,'Ada','Senior Engineer','backend') returning id,vacation_token,self_token,peer_token,view_token",
      [team]
    )
  ).rows[0]!;
  workspace = (
    await db.query<{ id: string }>("select id from public.planner_create_linked_workspace('Squad')")
  ).rows[0]!.id;
});
afterAll(async () => {
  await db?.close();
});

describe("Shared Ladders roster and independent vacation token permissions", () => {
  it("uses several live Ladders teams and shares role without changing job title", async () => {
    const second = (await db.query<{ id: string }>("select id from public.create_team('Second')"))
      .rows[0]!.id;
    await db.query("insert into public.members(team_id,name) values($1,'Grace')", [second]);
    await link(workspace, [team, second]);
    expect(
      (await db.query("select * from public.planner_workspace_roster($1)", [workspace])).rows
    ).toHaveLength(2);
    await db.query("select public.planner_update_planning_role($1,'qa')", [member.id]);
    expect(
      (await db.query("select role,planning_role from public.members where id=$1", [member.id]))
        .rows
    ).toEqual([{ role: "Senior Engineer", planning_role: "qa" }]);
    await db.query("insert into public.members(team_id,name) values($1,'New joiner')", [team]);
    expect(
      (await db.query("select * from public.planner_workspace_roster($1)", [workspace])).rows
    ).toHaveLength(3);
    await expect(link(workspace, [team, team])).rejects.toThrow(/distinct/);
  });
  it("denies linking private or read-only teams and outsider workspace access", async () => {
    await expect(link(workspace, [otherTeam])).rejects.toThrow(/edit access/);
    await login(stranger);
    await db.query("select public.share_team_by_email($1,'owner@example.com','viewer')", [
      otherTeam,
    ]);
    await login(owner);
    await expect(link(workspace, [otherTeam])).rejects.toThrow(/edit access/);
    await link();
    await login(stranger);
    await expect(link()).rejects.toThrow(/workspace owner/);
    await expect(
      db.query("select * from public.planner_workspace_roster($1)", [workspace])
    ).rejects.toThrow(/access required/);
    expect((await db.query("select * from public.planner_team_availability")).rows).toHaveLength(0);
  });
  it("grants linked team viewers plan visibility but not editing or vacation capabilities", async () => {
    await link();
    await db.query("select public.share_team_by_email($1,'viewer@example.com','viewer')", [team]);
    await login(viewer);
    expect((await db.query("select id from public.planner_workspaces")).rows).toEqual([
      { id: workspace },
    ]);
    const roster = await db.query<{ can_edit: boolean; vacation_token: null }>(
      "select * from public.planner_workspace_roster($1)",
      [workspace]
    );
    expect(roster.rows[0]).toMatchObject({ can_edit: false, vacation_token: null });
    await expect(
      db.query("select public.planner_update_planning_role($1,'qa')", [member.id])
    ).rejects.toThrow(/edit access/);
    await expect(
      db.query("select public.planner_set_team_availability($1,'2026-11-02','2026-11-02',false)", [
        member.id,
      ])
    ).rejects.toThrow(/edit access/);
    await expect(
      db.query("insert into public.planner_team_availability values($1,'2026-11-02',false)", [
        member.id,
      ])
    ).rejects.toThrow(/row-level security/);
  });
  it("permits anonymous token save/list/reset only for its member and no direct table access", async () => {
    const otherMember = (
      await db.query<{ id: string }>(
        "insert into public.members(team_id,name) values($1,'Grace') returning id",
        [team]
      )
    ).rows[0]!.id;
    await db.query(
      "select public.planner_set_team_availability($1,'2026-11-02','2026-11-02',false)",
      [otherMember]
    );
    await login(null, "anon");
    await db.query("select public.planner_vacation_save($1,'2026-11-02','2026-11-03',false)", [
      member.vacation_token,
    ]);
    expect(
      (await db.query("select * from public.planner_vacation_member($1)", [member.vacation_token]))
        .rows
    ).toEqual([{ id: member.id, name: "Ada", role: "backend" }]);
    const availability = (
      await db.query("select * from public.planner_vacation_list($1)", [member.vacation_token])
    ).rows;
    expect(availability).toHaveLength(2);
    expect(availability.every((row) => row["member_id"] === member.id)).toBe(true);
    for (const table of [
      "planner_team_availability",
      "planner_workspace_teams",
      "members",
      "evaluations",
    ]) {
      await expect(db.exec(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
    await db.query("select public.planner_vacation_clear($1,'2026-11-02')", [
      member.vacation_token,
    ]);
    expect(
      (await db.query("select * from public.planner_vacation_list($1)", [member.vacation_token]))
        .rows
    ).toHaveLength(1);
    await login(owner);
    expect(
      (
        await db.query("select * from public.planner_team_availability where member_id=$1", [
          otherMember,
        ])
      ).rows
    ).toHaveLength(1);
  });
  it("does not grant vacation access to evaluation/view tokens and validates date ranges", async () => {
    await login(null, "anon");
    for (const token of [
      member.self_token,
      member.peer_token,
      member.view_token,
      crypto.randomUUID(),
    ]) {
      await expect(
        db.query("select * from public.planner_vacation_member($1)", [token])
      ).rejects.toThrow(/Invalid vacation link/);
      await expect(
        db.query("select public.planner_vacation_save($1,'2026-11-02','2026-11-02',false)", [token])
      ).rejects.toThrow(/Invalid vacation link/);
      await expect(
        db.query("select public.planner_vacation_clear($1,'2026-11-02')", [token])
      ).rejects.toThrow(/Invalid vacation link/);
    }
    for (const [start, end, working] of [
      ["2026-11-03", "2026-11-02", false],
      ["2026-01-01", "2027-01-02", false],
      ["2028-01-01", "2028-01-02", false],
      [null, "2026-11-02", false],
      ["2026-11-02", "2026-11-02", null],
    ]) {
      await expect(
        db.query("select public.planner_vacation_save($1,$2,$3,$4)", [
          member.vacation_token,
          start,
          end,
          working,
        ])
      ).rejects.toThrow(/verified date range/);
    }
  });
  it("keeps a vacation UUID immutable and leave shared across workspaces after unlinking", async () => {
    await expect(
      db.query("update public.members set vacation_token=gen_random_uuid() where id=$1", [
        member.id,
      ])
    ).rejects.toThrow(/immutable/);
    await link();
    const secondWorkspace = (
      await db.query<{ id: string }>(
        "select id from public.planner_create_linked_workspace('Another')"
      )
    ).rows[0]!.id;
    await link(secondWorkspace);
    await db.query("select public.planner_vacation_save($1,'2026-11-02','2026-11-02',false)", [
      member.vacation_token,
    ]);
    for (const id of [workspace, secondWorkspace]) {
      expect(
        (await db.query<{ id: string }>("select id from public.planner_workspace_roster($1)", [id]))
          .rows
      ).toEqual([{ id: member.id }]);
    }
    await link(workspace, []);
    expect((await db.query("select * from public.planner_team_availability")).rows).toHaveLength(1);
    expect(
      (await db.query("select * from public.planner_workspace_roster($1)", [workspace])).rows
    ).toHaveLength(0);
  });
  it("preserves legacy members and their availability without guessing identity mappings", async () => {
    const legacy = (
      await db.query<{ id: string }>(
        "select id from public.planner_create_workspace('Legacy','Ada','backend')"
      )
    ).rows[0]!.id;
    const legacyMember = (
      await db.query<{ id: string }>(
        "select id from public.planner_members where workspace_id=$1",
        [legacy]
      )
    ).rows[0]!.id;
    await db.query("select public.planner_set_availability($1,'2026-11-02','2026-11-02',false)", [
      legacyMember,
    ]);
    await link(legacy);
    expect((await db.query("select * from public.planner_availability")).rows).toHaveLength(1);
    expect((await db.query("select * from public.planner_team_availability")).rows).toHaveLength(0);
    expect(
      (
        await db.query<{ id: string }>("select id from public.planner_workspace_roster($1)", [
          legacy,
        ])
      ).rows
    ).toEqual([{ id: member.id }]);
  });
});
