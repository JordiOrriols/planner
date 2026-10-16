// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigratedDatabase } from "./support/migratedDatabase";

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
async function shareWithTeammate(access: "viewer" | "editor") {
  await db.query("select public.planner_share_workspace($1,'member@example.com',$2)", [
    workspace,
    access,
  ]);
}
beforeAll(async () => {
  db = await createMigratedDatabase([
    { id: owner, email: "owner@example.com" },
    { id: teammate, email: "member@example.com" },
    { id: stranger, email: "stranger@example.com" },
  ]);
});
beforeEach(async () => {
  await db.exec("reset role; delete from public.planner_workspaces");
  await login(owner);
  const created = await db.query<{ id: string }>(
    "select id from public.planner_create_linked_workspace('Squad')"
  );
  workspace = created.rows[0]!.id;
});
afterAll(async () => {
  await db?.close();
});

describe("Planner migration and real PostgreSQL permissions", () => {
  it("stores a default plan date and retains owner changes while denying viewer and outsider updates", async () => {
    expect(
      (
        await db.query<{ same_day: boolean }>(
          "select plan_start_date=current_date as same_day from public.planner_workspaces where id=$1",
          [workspace]
        )
      ).rows[0]!.same_day
    ).toBe(true);
    await db.query(
      "update public.planner_workspaces set plan_start_date='2026-02-02' where id=$1",
      [workspace]
    );
    await shareWithTeammate("viewer");
    await login(teammate);
    expect(
      (
        await db.query("select plan_start_date::text from public.planner_workspaces where id=$1", [
          workspace,
        ])
      ).rows
    ).toEqual([{ plan_start_date: "2026-02-02" }]);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set plan_start_date='2026-03-02' where id=$1 returning id",
          [workspace]
        )
      ).rows
    ).toHaveLength(0);
    await login(stranger);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set plan_start_date='2026-03-02' where id=$1 returning id",
          [workspace]
        )
      ).rows
    ).toHaveLength(0);
    await login(owner);
    expect(
      (
        await db.query("select plan_start_date::text from public.planner_workspaces where id=$1", [
          workspace,
        ])
      ).rows
    ).toEqual([{ plan_start_date: "2026-02-02" }]);
    await expect(
      db.query("update public.planner_workspaces set plan_start_date=null where id=$1", [workspace])
    ).rejects.toThrow(/null/);
  });
  it("defaults delivery to false and lets the owner, not viewers or outsiders, change it without changing estimates", async () => {
    const project = (
      await db.query<{ id: string; delivered: boolean }>(
        "insert into public.planner_projects(workspace_id,name,backend_devs,backend_weeks,in_backlog) values($1,'Feature',2,2,true) returning id,delivered",
        [workspace]
      )
    ).rows[0]!;
    expect(project.delivered).toBe(false);
    await db.query("update public.planner_projects set delivered=true where id=$1", [project.id]);
    expect(
      (
        await db.query(
          "select delivered,backend_devs,backend_weeks,in_backlog,priority from public.planner_projects where id=$1",
          [project.id]
        )
      ).rows[0]
    ).toEqual({
      delivered: true,
      backend_devs: "2",
      backend_weeks: "2",
      in_backlog: true,
      priority: 0,
    });
    await shareWithTeammate("viewer");
    await login(teammate);
    expect(
      (
        await db.query(
          "update public.planner_projects set delivered=false where id=$1 returning id",
          [project.id]
        )
      ).rows
    ).toHaveLength(0);
    await login(stranger);
    expect(
      (
        await db.query(
          "update public.planner_projects set delivered=false where id=$1 returning id",
          [project.id]
        )
      ).rows
    ).toHaveLength(0);
    await login(owner);
    expect(
      (await db.query("select delivered from public.planner_projects where id=$1", [project.id]))
        .rows
    ).toEqual([{ delivered: true }]);
    await db.query("update public.planner_projects set delivered=false where id=$1", [project.id]);
    expect(
      (await db.query("select delivered from public.planner_projects where id=$1", [project.id]))
        .rows
    ).toEqual([{ delivered: false }]);
  });
  it("rejects decimal people and weeks for every role at the database boundary", async () => {
    for (const role of ["backend", "frontend", "design", "qa"]) {
      for (const [people, weeks] of [
        [1.5, 1],
        [1, 1.5],
      ]) {
        await expect(
          db.query(
            `insert into public.planner_projects(workspace_id,name,${role}_devs,${role}_weeks)
           values($1,'Fractional',$2,$3)`,
            [workspace, people, weeks]
          )
        ).rejects.toThrow(/planner_projects_whole_estimates/);
      }
    }
    const saved = await db.query<{ id: string }>(
      "insert into public.planner_projects(workspace_id,name,backend_devs,backend_weeks) values($1,'Whole',1,2) returning id",
      [workspace]
    );
    await expect(
      db.query("update public.planner_projects set backend_weeks = 2.5 where id=$1", [
        saved.rows[0]!.id,
      ])
    ).rejects.toThrow(/planner_projects_whole_estimates/);
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
    await expect(
      db.query("select public.planner_list_workspace_shares($1)", [workspace])
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at = null where id=$1", [stranger]);
    await login(stranger);
    await expect(db.query("select public.planner_create_linked_workspace('Bad')")).rejects.toThrow(
      /verified email/
    );
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at = now() where id=$1", [stranger]);
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
  it("appends projects with deterministic priorities and denies outsiders backlog changes", async () => {
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
    await login(stranger);
    await expect(
      db.query("select public.planner_toggle_backlog($1,$2,true)", [
        workspace,
        projects.rows[0]!.id,
      ])
    ).rejects.toThrow(/Workspace edit access required/);
  });
});
