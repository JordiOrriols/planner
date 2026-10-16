import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrations = new URL("../../../../supabase/migrations/", import.meta.url);

export type TestAccount = { id: string; email: string };

/** PGlite with Supabase's auth stand-ins and every migration applied in order. */
export async function createMigratedDatabase(accounts: TestAccount[]) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  for (const account of accounts)
    await db.query("insert into auth.users values($1, $2, now())", [account.id, account.email]);
  const files = (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, migrations), "utf8");
    // PGlite provides core gen_random_uuid(), but not Supabase's pgcrypto extension.
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  }
  return db;
}
