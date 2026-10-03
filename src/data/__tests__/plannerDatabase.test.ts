// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const teammate = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let workspace: string;
async function login(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
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
    grant usage on schema auth, public to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values
      ('${owner}', 'owner@example.com', now()),
      ('${teammate}', 'member@example.com', now()),
      ('${stranger}', 'stranger@example.com', now());
  `);
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261003140000_planner_workspaces.sql", import.meta.url),
    "utf8"
  );
  await db.exec(migration);
  const priorityMigration = await readFile(
    new URL(
      "../../../supabase/migrations/20261003150000_planner_team_and_priority.sql",
      import.meta.url
    ),
    "utf8"
  );
  await db.exec(priorityMigration);
});
beforeEach(async () => {
  await db.exec("reset role; delete from public.planner_workspaces");
  await login(owner);
  const created = await db.query<{ id: string }>(
    "select id from public.planner_create_workspace('Squad', 'Owner', 'backend')"
  );
  workspace = created.rows[0]!.id;
});
afterAll(async () => {
  await db?.close();
});

describe("Planner migration and real PostgreSQL permissions", () => {
  it("creates only prefixed tables and atomically registers the owner", async () => {
    const members = await db.query<{ user_id: string }>(
      "select user_id from public.planner_members"
    );
    expect(members.rows).toEqual([{ user_id: owner }]);
    await expect(db.exec("select * from public.teams")).rejects.toThrow();
  });
  it("keeps outsiders out of both workspaces and data", async () => {
    await db.query("insert into public.planner_projects(workspace_id,name) values($1,'Private')", [
      workspace,
    ]);
    await login(stranger);
    expect((await db.query("select * from public.planner_workspaces")).rows).toHaveLength(0);
    expect((await db.query("select * from public.planner_projects")).rows).toHaveLength(0);
    await expect(
      db.query("insert into public.planner_projects(workspace_id,name) values($1,'Bad')", [
        workspace,
      ])
    ).rejects.toThrow(/row-level security/);
  });
  it("denies anonymous access and refuses unverified workspace creation", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from public.planner_workspaces")).rejects.toThrow(
      /permission denied/
    );
    await expect(db.query("select public.planner_list_invitations()")).rejects.toThrow(
      /permission denied/
    );
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at = null where id=$1", [stranger]);
    await login(stranger);
    await expect(
      db.query("select public.planner_create_workspace('Bad','Unverified','qa')")
    ).rejects.toThrow(/verified email/);
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at = now() where id=$1", [stranger]);
  });
  it("lets only the invited verified email accept and read, without giving project write access", async () => {
    await db.query(
      "select public.planner_invite_member($1,'member@example.com','Member','frontend')",
      [workspace]
    );
    await login(stranger);
    expect((await db.query("select * from public.planner_list_invitations()")).rows).toHaveLength(
      0
    );
    await login(teammate);
    const invitations = await db.query<{ member_id: string }>(
      "select * from public.planner_list_invitations()"
    );
    const member = invitations.rows[0]!.member_id;
    await login(stranger);
    await expect(db.query("select public.planner_accept_invitation($1)", [member])).rejects.toThrow(
      /No invitation/
    );
    await login(teammate);
    await db.query("select public.planner_accept_invitation($1)", [member]);
    expect((await db.query("select * from public.planner_workspaces")).rows).toHaveLength(1);
    await expect(
      db.query("insert into public.planner_projects(workspace_id,name) values($1,'Bad')", [
        workspace,
      ])
    ).rejects.toThrow(/row-level security/);
  });
  it("allows members to edit only their own availability and restores defaults on delete", async () => {
    await db.query(
      "select public.planner_invite_member($1,'member@example.com','Member','frontend')",
      [workspace]
    );
    const ownerMember = (
      await db.query<{ id: string }>(
        "select id from public.planner_members where user_id = auth.uid()"
      )
    ).rows[0]!.id;
    await login(teammate);
    const member = (
      await db.query<{ member_id: string }>("select * from public.planner_list_invitations()")
    ).rows[0]!.member_id;
    await db.query("select public.planner_accept_invitation($1)", [member]);
    await db.query("select public.planner_set_availability($1,'2026-10-05','2026-10-07',false)", [
      member,
    ]);
    expect((await db.query("select * from public.planner_availability")).rows).toHaveLength(3);
    await db.query("select public.planner_set_availability($1,'2026-10-06','2026-10-06',true)", [
      member,
    ]);
    const overrides = await db.query<{ is_working: boolean }>(
      "select is_working from public.planner_availability where date = '2026-10-06'"
    );
    expect(overrides.rows[0]?.is_working).toBe(true);
    await expect(
      db.query("select public.planner_set_availability($1,'2026-10-05','2026-10-07',false)", [
        ownerMember,
      ])
    ).rejects.toThrow(/cannot change/);
    await db.query("delete from public.planner_availability where member_id=$1", [member]);
    expect((await db.query("select * from public.planner_availability")).rows).toHaveLength(0);
  });
  it("rejects inconsistent estimates and performs complete backlog reorder atomically", async () => {
    await expect(
      db.query(
        "insert into public.planner_projects(workspace_id,name,backend_devs) values($1,'Invalid',1)",
        [workspace]
      )
    ).rejects.toThrow(/check constraint/);
    const result = await db.query<{ id: string }>(
      "insert into public.planner_projects(workspace_id,name,in_backlog) values($1,'A',true),($1,'B',true) returning id",
      [workspace]
    );
    const ids = result.rows.map((row) => row.id).reverse();
    await db.query("select public.planner_reorder_projects($1,$2::uuid[])", [workspace, ids]);
    expect(
      (
        await db.query<{ id: string }>("select id from public.planner_projects order by priority")
      ).rows.map((row) => row.id)
    ).toEqual(ids);
    await expect(
      db.query("select public.planner_reorder_projects($1,$2::uuid[])", [workspace, [ids[0]]])
    ).rejects.toThrow(/Backlog changed/);
    await expect(
      db.query("select public.planner_reorder_projects($1,$2::uuid[])", [
        workspace,
        [ids[0], ids[0]],
      ])
    ).rejects.toThrow(/Backlog changed/);
  });
  it("cascades availability when the owner removes an invited team member", async () => {
    await db.query(
      "select public.planner_invite_member($1,'member@example.com','Member','frontend')",
      [workspace]
    );
    const member = (
      await db.query<{ id: string }>("select id from public.planner_members where user_id is null")
    ).rows[0]!.id;
    await db.query("select public.planner_set_availability($1,'2026-10-05','2026-10-05',false)", [
      member,
    ]);
    await db.query("delete from public.planner_members where id=$1", [member]);
    expect((await db.query("select * from public.planner_availability")).rows).toHaveLength(0);
  });
  it("appends projects with deterministic priorities and restricts team role changes", async () => {
    const projects = await db.query<{ id: string }>(
      "insert into public.planner_projects(workspace_id,name) values($1,'A'),($1,'B') returning id",
      [workspace]
    );
    for (const project of projects.rows)
      await db.query("select public.planner_toggle_backlog($1,$2,true)", [workspace, project.id]);
    expect(
      (
        await db.query<{ priority: number }>(
          "select priority from public.planner_projects order by priority"
        )
      ).rows.map((row) => row.priority)
    ).toEqual([1, 2]);
    const member = (await db.query<{ id: string }>("select id from public.planner_members"))
      .rows[0]!.id;
    await db.query("select public.planner_update_member($1,'Owner','design')", [member]);
    expect(
      (await db.query<{ role: string }>("select role from public.planner_members")).rows[0]?.role
    ).toBe("design");
    await login(stranger);
    await expect(
      db.query("select public.planner_update_member($1,'Bad','qa')", [member])
    ).rejects.toThrow(/Only the owner/);
    await expect(
      db.query("select public.planner_toggle_backlog($1,$2,true)", [
        workspace,
        projects.rows[0]!.id,
      ])
    ).rejects.toThrow(/Only the owner/);
  });
});
