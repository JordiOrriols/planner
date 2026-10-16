// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigratedDatabase } from "./support/migratedDatabase";

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
  db = await createMigratedDatabase([
    { id: owner, email: "owner@example.com" },
    { id: viewer, email: "viewer@example.com" },
    { id: stranger, email: "stranger@example.com" },
  ]);
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

describe("Registered-account workspace sharing", () => {
  it("persists sprint calibration for editors and denies viewers and outsiders", async () => {
    const history = [{ start_date: "2026-02-02", story_points: 50 }];
    await db.query(
      "update public.planner_workspaces set sprint_start_date=$2,sprint_history=$3 where id=$1",
      [workspace, "2026-02-02", JSON.stringify(history)]
    );
    await db.query("select public.planner_share_workspace($1,'viewer@example.com','viewer')", [
      workspace,
    ]);
    await login(viewer);
    expect(
      (
        await db.query("select sprint_history from public.planner_workspaces where id=$1", [
          workspace,
        ])
      ).rows
    ).toEqual([{ sprint_history: history }]);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set sprint_history='[]' where id=$1 returning id",
          [workspace]
        )
      ).rows
    ).toHaveLength(0);
    await login(owner);
    await db.query("select public.planner_update_workspace_share($1,$2,'editor')", [
      workspace,
      viewer,
    ]);
    await login(viewer);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set sprint_history='[]' where id=$1 returning sprint_history",
          [workspace]
        )
      ).rows
    ).toEqual([{ sprint_history: [] }]);
    await login(stranger);
    expect(
      (
        await db.query("select sprint_history from public.planner_workspaces where id=$1", [
          workspace,
        ])
      ).rows
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set sprint_history='[]' where id=$1 returning id",
          [workspace]
        )
      ).rows
    ).toHaveLength(0);
  });

  it("shares main projects with workspace editors and keeps features in their own workspace", async () => {
    const mainProject = (
      await db.query<{ id: string }>(
        "insert into public.projects(workspace_id,name) values($1,'Payments') returning id",
        [workspace]
      )
    ).rows[0]!.id;
    await expect(
      db.query("insert into public.projects(workspace_id,name) values($1,'payments')", [workspace])
    ).rejects.toThrow();
    for (const name of ["", " Padded", "x".repeat(81)])
      await expect(
        db.query("insert into public.projects(workspace_id,name) values($1,$2)", [workspace, name])
      ).rejects.toThrow();
    const feature = (
      await db.query<{ id: string }>(
        "insert into public.features(workspace_id,name,project_id) values($1,'Checkout',$2) returning id",
        [workspace, mainProject]
      )
    ).rows[0]!.id;
    const otherWorkspace = (
      await db.query<{ id: string }>(
        "select id from public.planner_create_linked_workspace('Other squad')"
      )
    ).rows[0]!.id;
    await expect(
      db.query("insert into public.features(workspace_id,name,project_id) values($1,'Leak',$2)", [
        otherWorkspace,
        mainProject,
      ])
    ).rejects.toThrow();

    await db.query("select public.planner_share_workspace($1,'viewer@example.com','viewer')", [
      workspace,
    ]);
    await login(viewer);
    expect(
      (await db.query("select name from public.projects where workspace_id=$1", [workspace])).rows
    ).toEqual([{ name: "Payments" }]);
    expect(
      (
        await db.query("update public.projects set name='Renamed' where id=$1 returning id", [
          mainProject,
        ])
      ).rows
    ).toHaveLength(0);
    await expect(
      db.query("insert into public.projects(workspace_id,name) values($1,'Viewer')", [workspace])
    ).rejects.toThrow();
    await login(stranger);
    expect((await db.query("select id from public.projects")).rows).toHaveLength(0);

    await login(owner);
    await db.query("select public.planner_update_workspace_share($1,$2,'editor')", [
      workspace,
      viewer,
    ]);
    await login(viewer);
    expect(
      (
        await db.query("update public.projects set name='Billing' where id=$1 returning name", [
          mainProject,
        ])
      ).rows
    ).toEqual([{ name: "Billing" }]);
    expect(
      (await db.query("delete from public.projects where id=$1 returning id", [mainProject])).rows
    ).toHaveLength(1);
    expect(
      (await db.query("select workspace_id,project_id from public.features where id=$1", [feature]))
        .rows
    ).toEqual([{ workspace_id: workspace, project_id: null }]);
  });

  it("rejects invalid, duplicate and off-cadence sprint results in PostgreSQL", async () => {
    await db.query(
      "update public.planner_workspaces set sprint_start_date='2026-02-02' where id=$1",
      [workspace]
    );
    for (const history of [
      {},
      [{}],
      [{ start_date: "2026-02-02", story_points: -1 }],
      [{ start_date: "2026-02-02", story_points: null }],
      [{ start_date: "2026-02-30", story_points: 2 }],
      [{ start_date: "2026-02-03", story_points: 2 }],
      [{ start_date: "2027-12-27", story_points: 2 }],
      [
        { start_date: "2026-02-02", story_points: 2 },
        { start_date: "2026-02-02", story_points: 5 },
      ],
    ])
      await expect(
        db.query("update public.planner_workspaces set sprint_history=$2 where id=$1", [
          workspace,
          JSON.stringify(history),
        ])
      ).rejects.toThrow();
  });

  it("preserves existing linked-team viewing after revoking an explicit editor share", async () => {
    await link();
    await db.query("select public.share_team_by_email($1,'viewer@example.com','viewer')", [team]);
    await db.query("select public.planner_share_workspace($1,'viewer@example.com','editor')", [
      workspace,
    ]);
    await db.query("select public.planner_remove_workspace_share($1,$2)", [workspace, viewer]);
    await login(viewer);
    expect(
      (
        await db.query(
          "select public.planner_has_access($1) as viewing,public.planner_can_edit_workspace($1) as editing",
          [workspace]
        )
      ).rows
    ).toEqual([{ viewing: true, editing: false }]);
  });

  it("shares by normalized email, changes permissions, and revokes workspace discovery", async () => {
    await link();
    await db.query("select public.planner_share_workspace($1,' VIEWER@example.com ','viewer')", [
      workspace,
    ]);
    expect(
      (await db.query("select * from public.planner_list_workspace_shares($1)", [workspace])).rows
    ).toEqual([{ user_id: viewer, email: "viewer@example.com", access_level: "viewer" }]);
    await login(viewer);
    expect((await db.exec("select id from public.planner_workspaces"))[0]!.rows).toEqual([
      { id: workspace },
    ]);
    expect(
      (await db.query("select * from public.planner_workspace_roster($1)", [workspace])).rows
    ).toEqual([expect.objectContaining({ id: member.id, can_edit: false, vacation_token: null })]);
    expect(
      (await db.query("select public.planner_can_edit_workspace($1) as allowed", [workspace])).rows
    ).toEqual([{ allowed: false }]);
    await login(owner);
    await db.query("select public.planner_update_workspace_share($1,$2,'editor')", [
      workspace,
      viewer,
    ]);
    await login(viewer);
    expect(
      (await db.query("select public.planner_can_edit_workspace($1) as allowed", [workspace])).rows
    ).toEqual([{ allowed: true }]);
    await login(owner);
    await db.query("select public.planner_update_workspace_share($1,$2,'viewer')", [
      workspace,
      viewer,
    ]);
    await login(viewer);
    expect(
      (await db.query("select public.planner_can_edit_workspace($1) as allowed", [workspace])).rows
    ).toEqual([{ allowed: false }]);
    await login(owner);
    await db.query("select public.planner_remove_workspace_share($1,$2)", [workspace, viewer]);
    await login(viewer);
    expect((await db.exec("select id from public.planner_workspaces"))[0]!.rows).toEqual([]);
    await expect(
      db.query("select * from public.planner_workspace_roster($1)", [workspace])
    ).rejects.toThrow(/access required/);
  });

  it("allows editors to manage features, schedule and start, not ownership, sharing or team data", async () => {
    await link();
    await db.query("select public.planner_share_workspace($1,'viewer@example.com','editor')", [
      workspace,
    ]);
    await login(viewer);
    const project = (
      await db.query<{ id: string }>(
        "insert into public.features(workspace_id,name) values($1,'Feature') returning id",
        [workspace]
      )
    ).rows[0]!.id;
    await db.query("select public.planner_toggle_backlog($1,$2,true)", [workspace, project]);
    await db.query("select public.planner_reorder_features($1,$2)", [workspace, [project]]);
    await db.query("update public.features set delivered=true,description='Updated' where id=$1", [
      project,
    ]);
    expect(
      (
        await db.query("select delivered,priority,description from public.features where id=$1", [
          project,
        ])
      ).rows
    ).toEqual([{ delivered: true, priority: 1, description: "Updated" }]);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set plan_start_date='2026-02-02' where id=$1 returning plan_start_date::text",
          [workspace]
        )
      ).rows
    ).toEqual([{ plan_start_date: "2026-02-02" }]);
    await expect(
      db.query("update public.planner_workspaces set owner_id=$2 where id=$1", [workspace, viewer])
    ).rejects.toThrow(/identity is immutable/);
    await expect(
      db.query("select public.planner_list_workspace_shares($1)", [workspace])
    ).rejects.toThrow(/owner access required/);
    await expect(
      db.query("select public.planner_share_workspace($1,'stranger@example.com','editor')", [
        workspace,
      ])
    ).rejects.toThrow(/owner access required/);
    await expect(
      db.query("select public.planner_set_workspace_teams($1,$2)", [workspace, []])
    ).rejects.toThrow(/owner/);
    await expect(
      db.query("select public.planner_update_planning_role($1,'frontend')", [member.id])
    ).rejects.toThrow(/Team edit access/);
    await expect(
      db.query("select public.planner_set_vacations($1,'2026-11-02','2026-11-02',false)", [
        member.id,
      ])
    ).rejects.toThrow(/Team edit access/);
    expect(
      (
        await db.query("delete from public.planner_workspaces where id=$1 returning id", [
          workspace,
        ])
      ).rows
    ).toEqual([]);
    expect(
      (await db.query("delete from public.features where id=$1 returning id", [project])).rows
    ).toEqual([{ id: project }]);
  });

  it("denies viewer writes, outsider reads and anonymous sharing", async () => {
    await db.query("select public.planner_share_workspace($1,'viewer@example.com','viewer')", [
      workspace,
    ]);
    const project = (
      await db.query<{ id: string }>(
        "insert into public.features(workspace_id,name) values($1,'Feature') returning id",
        [workspace]
      )
    ).rows[0]!.id;
    await login(viewer);
    await expect(
      db.query("insert into public.features(workspace_id,name) values($1,'Forbidden')", [workspace])
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await db.query("update public.features set delivered=true where id=$1 returning id", [
          project,
        ])
      ).rows
    ).toEqual([]);
    expect(
      (await db.query("delete from public.features where id=$1 returning id", [project])).rows
    ).toEqual([]);
    expect(
      (
        await db.query(
          "update public.planner_workspaces set plan_start_date='2026-02-02' where id=$1 returning id",
          [workspace]
        )
      ).rows
    ).toEqual([]);
    await expect(
      db.query("select public.planner_toggle_backlog($1,$2,true)", [workspace, project])
    ).rejects.toThrow(/edit access required/);
    await expect(
      db.query("select public.planner_reorder_features($1,$2)", [workspace, []])
    ).rejects.toThrow(/edit access required/);
    await login(stranger);
    expect((await db.exec("select id from public.features"))[0]!.rows).toEqual([]);
    expect((await db.exec("select id from public.planner_workspaces"))[0]!.rows).toEqual([]);
    await login(null, "anon");
    await expect(
      db.query("select public.planner_share_workspace($1,'viewer@example.com','viewer')", [
        workspace,
      ])
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects unknown/self accounts, invalid permissions, and non-owner share changes", async () => {
    for (const email of ["missing@example.com", "owner@example.com"])
      await expect(
        db.query("select public.planner_share_workspace($1,$2,'viewer')", [workspace, email])
      ).rejects.toThrow(/User not found/);
    for (const access of ["owner", null])
      await expect(
        db.query("select public.planner_share_workspace($1,'viewer@example.com',$2)", [
          workspace,
          access,
        ])
      ).rejects.toThrow(/Invalid access/);
    await db.query("select public.planner_share_workspace($1,'viewer@example.com','editor')", [
      workspace,
    ]);
    await db.query("select public.planner_share_workspace($1,'viewer@example.com','viewer')", [
      workspace,
    ]);
    expect(
      (await db.query("select * from public.planner_list_workspace_shares($1)", [workspace])).rows
    ).toHaveLength(1);
    await login(viewer);
    await expect(
      db.query("select public.planner_update_workspace_share($1,$2,'editor')", [workspace, viewer])
    ).rejects.toThrow(/owner access required/);
    await expect(
      db.query("select public.planner_remove_workspace_share($1,$2)", [workspace, viewer])
    ).rejects.toThrow(/owner access required/);
    await expect(db.exec("select * from public.planner_workspace_collaborators")).rejects.toThrow(
      /permission denied/
    );
  });
});

describe("Shared Ladders roster and independent vacation token permissions", () => {
  it.each(["authenticated", "token"])(
    "restores the default calendar over weekends and holidays through %s saves",
    async (mode) => {
      await link();
      const other = (
        await db.query<{ id: string }>(
          "insert into public.members(team_id,name) values($1,'Other') returning id",
          [team]
        )
      ).rows[0]!.id;
      await db.query("insert into public.vacations values($1,'2026-10-14',false)", [other]);
      async function save(working: boolean) {
        if (mode === "token") {
          await login(null, "anon");
          await db.query("select public.planner_vacation_save($1,'2026-10-05','2026-10-16',$2)", [
            member.vacation_token,
            working,
          ]);
        } else {
          await db.query("select public.planner_set_vacations($1,'2026-10-05','2026-10-16',$2)", [
            member.id,
            working,
          ]);
        }
      }
      await save(false);
      await login(owner);
      expect(
        (await db.query("select * from public.vacations where member_id=$1", [member.id])).rows
      ).toHaveLength(12);
      await save(true);
      await login(owner);
      expect(
        (await db.query("select * from public.vacations where member_id=$1", [member.id])).rows
      ).toEqual([]);
      expect(
        (await db.query("select * from public.vacations where member_id=$1", [other])).rows
      ).toHaveLength(1);
      const { isWorking, parseDate } = await import("@/lib/planning");
      expect(isWorking(member, parseDate("2026-10-10"), [])).toBe(false);
      expect(isWorking(member, parseDate("2026-10-11"), [])).toBe(false);
      expect(isWorking(member, parseDate("2026-10-12"), [])).toBe(false);
      expect(isWorking(member, parseDate("2026-10-13"), [])).toBe(true);
    }
  );

  it("exposes only current-team names and vacations, while keeping writes and tokens member-only", async () => {
    const grace = (
      await db.query<{ id: string; vacation_token: string }>(
        "insert into public.members(team_id,name,planning_role) values($1,'Grace','frontend') returning id,vacation_token",
        [team]
      )
    ).rows[0]!;
    const secondTeam = (
      await db.query<{ id: string }>("select id from public.create_team('Separate')")
    ).rows[0]!.id;
    const outsider = (
      await db.query<{ id: string }>(
        "insert into public.members(team_id,name) values($1,'Outside') returning id",
        [secondTeam]
      )
    ).rows[0]!;
    await link(workspace, [team, secondTeam]);
    await db.exec(`insert into public.vacations values
      ('${member.id}','2026-11-02',true),
      ('${grace.id}','2026-11-02',false),
      ('${grace.id}','2026-11-03',true),
      ('${outsider.id}','2026-11-02',false)`);
    await login(null, "anon");
    expect(
      (
        await db.query("select * from public.planner_vacation_team_members($1)", [
          member.vacation_token,
        ])
      ).rows
    ).toEqual([
      { id: member.id, name: "Ada", role: "backend" },
      { id: grace.id, name: "Grace", role: "frontend" },
    ]);
    expect(
      (
        await db.query("select * from public.planner_vacation_team_list($1)", [
          member.vacation_token,
        ])
      ).rows
    ).toEqual(
      expect.arrayContaining([
        { member_id: member.id, date: new Date("2026-11-02T00:00:00Z"), is_working: true },
        { member_id: grace.id, date: new Date("2026-11-02T00:00:00Z"), is_working: false },
      ])
    );
    expect(
      (
        await db.query("select * from public.planner_vacation_team_list($1)", [
          member.vacation_token,
        ])
      ).rows
    ).toHaveLength(2);
    await db.query("select public.planner_vacation_save($1,'2026-11-02','2026-11-02',false)", [
      member.vacation_token,
    ]);
    await db.query("select public.planner_vacation_clear($1,'2026-11-02')", [
      member.vacation_token,
    ]);
    await expect(
      db.query("select public.planner_set_vacations($1,'2026-11-02','2026-11-02',true)", [grace.id])
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("select * from public.members")).rejects.toThrow(/permission denied/);
    await login(owner);
    expect(
      (await db.query("select * from public.vacations where member_id=$1", [grace.id])).rows
    ).toHaveLength(2);
  });

  it("follows the token member's current team after a move and rejects invalid read capabilities", async () => {
    const grace = (
      await db.query<{ id: string }>(
        "insert into public.members(team_id,name) values($1,'Grace') returning id",
        [team]
      )
    ).rows[0]!.id;
    const secondTeam = (
      await db.query<{ id: string }>("select id from public.create_team('New team')")
    ).rows[0]!.id;
    const newColleague = (
      await db.query<{ id: string }>(
        "insert into public.members(team_id,name) values($1,'New colleague') returning id",
        [secondTeam]
      )
    ).rows[0]!.id;
    await db.exec(`insert into public.vacations values
      ('${grace}','2026-11-02',false), ('${newColleague}','2026-11-03',false)`);
    await db.query("update public.members set team_id=$1 where id=$2", [secondTeam, member.id]);
    await login(null, "anon");
    const roster = (
      await db.query<{ id: string }>("select * from public.planner_vacation_team_members($1)", [
        member.vacation_token,
      ])
    ).rows;
    expect(roster.map((row) => row.id)).toEqual([member.id, newColleague]);
    expect(
      (
        await db.query<{ member_id: string }>(
          "select * from public.planner_vacation_team_list($1)",
          [member.vacation_token]
        )
      ).rows.map((row) => row.member_id)
    ).toEqual([newColleague]);
    for (const token of [
      member.self_token,
      member.peer_token,
      member.view_token,
      crypto.randomUUID(),
      null,
    ]) {
      for (const fn of ["planner_vacation_team_members", "planner_vacation_team_list"]) {
        await expect(db.query(`select * from public.${fn}($1)`, [token])).rejects.toThrow(
          /Invalid vacation link/
        );
      }
    }
    await login(owner);
    await db.query("delete from public.members where id=$1", [member.id]);
    await login(null, "anon");
    await expect(
      db.query("select * from public.planner_vacation_team_members($1)", [member.vacation_token])
    ).rejects.toThrow(/Invalid vacation link/);
  });

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
  it("denies moving teams the owner does not own, even shared for editing, and outsider access", async () => {
    await expect(link(workspace, [otherTeam])).rejects.toThrow(/your own teams/);
    await login(stranger);
    await db.query("select public.share_team_by_email($1,'owner@example.com','editor')", [
      otherTeam,
    ]);
    await login(owner);
    await expect(link(workspace, [otherTeam])).rejects.toThrow(/your own teams/);
    await link();
    await login(stranger);
    await expect(link()).rejects.toThrow(/workspace owner/);
    await expect(
      db.query("select * from public.planner_workspace_roster($1)", [workspace])
    ).rejects.toThrow(/access required/);
    expect((await db.query("select * from public.vacations")).rows).toHaveLength(0);
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
      db.query("select public.planner_set_vacations($1,'2026-11-02','2026-11-02',false)", [
        member.id,
      ])
    ).rejects.toThrow(/edit access/);
    await expect(
      db.query("insert into public.vacations values($1,'2026-11-02',false)", [member.id])
    ).rejects.toThrow(/row-level security/);
  });
  it("permits anonymous token save/list/reset only for its member and no direct table access", async () => {
    const otherMember = (
      await db.query<{ id: string }>(
        "insert into public.members(team_id,name) values($1,'Grace') returning id",
        [team]
      )
    ).rows[0]!.id;
    await db.query("select public.planner_set_vacations($1,'2026-11-02','2026-11-02',false)", [
      otherMember,
    ]);
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
    for (const table of ["vacations", "teams", "members", "evaluations"]) {
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
      (await db.query("select * from public.vacations where member_id=$1", [otherMember])).rows
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
  it("keeps a vacation UUID immutable and leave with the member as its team moves between plans", async () => {
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
    await db.query("select public.planner_vacation_save($1,'2026-11-02','2026-11-02',false)", [
      member.vacation_token,
    ]);
    await link(secondWorkspace);
    const roster = async (id: string) =>
      (await db.query<{ id: string }>("select id from public.planner_workspace_roster($1)", [id]))
        .rows;
    expect(await roster(workspace)).toEqual([]);
    expect(await roster(secondWorkspace)).toEqual([{ id: member.id }]);
    await link(secondWorkspace, []);
    expect(await roster(secondWorkspace)).toEqual([]);
    expect((await db.query("select * from public.vacations")).rows).toHaveLength(1);
  });
  it("drops the legacy invitation members, their availability and RPCs", async () => {
    await login(null, "postgres");
    expect(
      (
        await db.query<{ members: string | null; availability: string | null }>(
          "select to_regclass('public.planner_members')::text as members, to_regclass('public.planner_availability')::text as availability"
        )
      ).rows
    ).toEqual([{ members: null, availability: null }]);
    expect(
      (
        await db.query("select proname from pg_proc where proname = any($1::text[])", [
          [
            "planner_create_workspace",
            "planner_invite_member",
            "planner_list_invitations",
            "planner_accept_invitation",
            "planner_update_member",
            "planner_set_availability",
            "planner_can_edit_availability",
          ],
        ])
      ).rows
    ).toEqual([]);
  });
});
