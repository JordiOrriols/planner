# Cadence / Planner

Workspace-based microproject estimation, rough backlog scheduling and team
availability. The copied Base44 layouts now use Supabase instead of Base44.

## Start locally

Use Node.js 24+ and keep `ui` and `planner` as sibling folders:

```bash
cd ../ui
npm install
npm run build
cd ../planner
npm install --install-links
cp .env.example .env # Only when .env does not already exist
npm start
```

Open **http://127.0.0.1:5176**. The port is fixed to avoid accidentally opening
Ladders or a different app when another Vite server is running.

Planner uses the **same Supabase project and accounts as Ladders**. Configure
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with the same values.
Never put a service-role key, database password or test credentials in the app.
Without configuration the welcome page explicitly disables authentication;
there is no fake local persistence mode.

Authentication views and form/session hooks come from `@jordiorriols/ui`.
Planner does not duplicate login, signup, GitHub OAuth or password recovery.
Ladders' tables and business logic are not used.

### Refresh shared UI during development

The library is installed as a packed `file:../ui` dependency, not a symlink.
This avoids loading the library's development React alongside Planner's React.
When rebuilding UI without changing its package version, npm can keep the old
installed copy. Refresh it explicitly:

```bash
cd ../ui && npm run build
cd ../planner
npm uninstall @jordiorriols/ui --ignore-scripts
npm install ../ui --install-links --ignore-scripts
```

Shared Tailwind tokens are imported by `index.css`; keep its `@source`
directives. Official Radix exports and the original UI Button are unchanged.

## Workspaces and access

- A signed-in user can create a workspace, choose their role and invite teammates
  by email. Multiple workspaces can be selected independently.
- Owners manage estimates, backlog priorities, the roster and all availability.
- Members see the workspace plan and edit only their own availability.
- Invitations are accepted after signing in with the matching **verified email**.
  Invitations do not send email; give the teammate the Planner URL.
- Invited roster members count toward capacity even before accepting.
- Member identity uses UUIDs, not names; renaming someone preserves availability.
- Removing a member cascades their invitation and saved availability.
- Workspace data is isolated by Row Level Security, including direct API calls.

## Estimates and scheduling

For each microproject, enter people and weeks for backend, frontend, design and
QA. Both values must be positive for an active role (or both zero).

- **Effort** is the sum of `people × weeks` across roles.
- **Ideal duration** is the longest role estimate, assuming roles run concurrently.
- **Peak team** is the sum of requested people across roles.
- Only projects explicitly added to the backlog are scheduled.
- Daily available capacity is allocated by role and backlog priority.
- Different roles and projects can overlap when capacity allows. If only one
  backend person is available for a two-person estimate, completion takes longer.
- A person-week means five working days. Saved time off and Barcelona holidays
  extend dates; working-day overrides can restore a holiday or weekend.
- A missing role, zero effort or an unfinished forecast is shown explicitly,
  not presented as a successful completion date.
- The Gantt forecast covers up to 52 weeks and stops at the last verified
  calendar day, including partial boundary weeks. Start dates are editable;
  they are not persisted commitments.

The Barcelona calendar is verified for **2026 and 2027** against the
[City Council calendar](https://ajuntament.barcelona.cat/calendarifestius/en/index.html).
Update `src/lib/barcelonaHolidays.ts` before planning later years. Unknown
years are flagged instead of silently assuming there are no public holidays.
Calendar values are date-only local calendar days, not UTC timestamps.

## Supabase setup

The two additive Planner migrations have been applied to the configured shared
project with approval:

1. `20261003140000_planner_workspaces.sql`: workspace, member, project and daily
   availability tables, RLS, verified-email invitations and transactional actions.
2. `20261003150000_planner_team_and_priority.sql`: owner-controlled role editing
   and deterministic, serialized backlog insertion.

Only `planner_*` tables and functions are added; no Ladders table is modified.
The earlier numbered migrations are the shared project's copied Ladders migration
history, **not a separate Planner schema**.

For future changes, use the existing authenticated Supabase CLI and review first:

```bash
npx supabase db push --dry-run
# Proceed only when the list contains the intended new Planner migrations.
npx supabase db push
```

Do not reset the shared database or push authentication configuration blindly.
The local SQL tests use an isolated PostgreSQL instance via PGlite, not the live
database. Docker is not required for these tests.

### Authentication redirect configuration

In Supabase Authentication → URL Configuration, retain Ladders' Site URL and
existing redirect URLs. Ensure these additional Planner redirects are allowed:

- `http://127.0.0.1:5176`
- `http://localhost:5176`
- The exact deployed Planner base URL, including any GitHub Pages subpath.

Email/password sign-in uses the existing accounts. GitHub and emailed recovery
also require the Planner URL in that allow-list. Do not replace Ladders' Site URL
or OAuth provider configuration. No auth configuration was pushed by this work.

The copied Ladders Umami website ID has been removed; configure Planner's own
analytics identity before enabling its script.

## Checks

```bash
npm run compile
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
npm audit
```

The tests cover role scheduling, partial-week leave, holidays, capacity limits,
authentication composition, database permissions, invitations and repository
pagination/error handling.

Live end-to-end tests live in the sibling `e2e-tests` project:

```bash
cd ../e2e-tests
npx playwright test --project=planner-localhost --workers=1
```

Start Planner first and configure both existing Ladders test accounts through
the environment/keychain. Tests create unique workspaces and delete only their
own data afterward; they never reset Ladders data or send invitation emails.

## CI and deployment

The workflow checks out and builds the sibling UI source before installing
Planner. Set `UI_REF` to the shared UI revision to deploy; its local extraction
commits must be pushed separately before remote CI can consume them. For a
private UI repository, configure `UI_READ_TOKEN` with read access.

Set the Planner Supabase URL and publishable-key GitHub configuration values,
enable GitHub Pages, and add the deployed Planner URL to Supabase's redirect
allow-list before deploying. No repository was pushed and no package published
as part of preparing this app.
