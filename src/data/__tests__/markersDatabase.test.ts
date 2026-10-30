// @vitest-environment node
import { expect, it } from "vitest";
import { createMigratedDatabase } from "./support/migratedDatabase";
import { buildPublicRoadmap } from "@/lib/publicRoadmap";

it("scopes markers to workspace access, editor writes and the token-gated public projection", async () => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const viewer = "22222222-2222-4222-8222-222222222222";
  const editor = "33333333-3333-4333-8333-333333333333";
  const stranger = "44444444-4444-4444-8444-444444444444";
  const db = await createMigratedDatabase(
    [owner, viewer, editor, stranger].map((id, i) => ({ id, email: `user${i}@example.com` }))
  );
  async function login(id: string, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
  }
  try {
    await login(owner);
    const {
      rows: [workspace],
    } = await db.query<{ id: string }>("select id from public.create_workspace('Markers')");
    const id = workspace!.id;
    await db.query("select public.share_workspace($1,'user1@example.com','planner','viewer')", [
      id,
    ]);
    await db.query("select public.share_workspace($1,'user2@example.com','planner','editor')", [
      id,
    ]);
    await db.query(
      "insert into public.roadmap_markers(workspace_id,name,date) values($1,'Launch','2026-02-04')",
      [id]
    );
    for (const [name, date] of [
      ["", "2026-02-04"],
      ["x".repeat(81), "2026-02-04"],
      ["Invalid", "2026-02-30"],
    ])
      await expect(
        db.query("insert into public.roadmap_markers(workspace_id,name,date) values($1,$2,$3)", [
          id,
          name,
          date,
        ])
      ).rejects.toThrow();
    await login(viewer);
    expect((await db.query("select * from public.roadmap_markers")).rows).toHaveLength(1);
    await expect(
      db.query(
        "insert into public.roadmap_markers(workspace_id,name,date) values($1,'Blocked','2026-02-05')",
        [id]
      )
    ).rejects.toThrow(/row-level security/);
    expect((await db.query("delete from public.roadmap_markers returning id")).rows).toHaveLength(
      0
    );
    await login(editor);
    await db.query(
      "insert into public.roadmap_markers(workspace_id,name,date) values($1,'Editor','2026-02-05')",
      [id]
    );
    expect(
      (await db.query("delete from public.roadmap_markers where name='Editor' returning id")).rows
    ).toHaveLength(1);
    await login(stranger);
    expect((await db.query("select * from public.roadmap_markers")).rows).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.roadmap_markers(workspace_id,name,date) values($1,'Blocked','2026-02-05')",
        [id]
      )
    ).rejects.toThrow();
    await login("", "anon");
    await expect(db.query("select * from public.roadmap_markers")).rejects.toThrow(
      /permission denied/
    );
    await login(owner);
    const {
      rows: [share],
    } = await db.query<{ token: string }>("select public.planner_roadmap_share($1,true) as token", [
      id,
    ]);
    await login("", "service_role");
    const {
      rows: [source],
    } = await db.query<{ source: unknown }>("select public.planner_roadmap_source($1) as source", [
      share!.token,
    ]);
    expect(buildPublicRoadmap(source!.source).markers).toEqual([
      { name: "Launch", date: "2026-02-04" },
    ]);
    await login(owner);
    await db.query("delete from public.workspaces where id=$1", [id]);
    expect((await db.query("select * from public.roadmap_markers")).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
});
