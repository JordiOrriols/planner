# Cadence / Planner

Workspace-based feature estimation, rough backlog scheduling and team
availability. The copied Base44 layouts now use Supabase instead of Base44.

## Start locally

Use Node.js 24.21.0 (bundled npm 11.19.0, matching CI). The shared UI library is installed from GitHub Packages as
`@jordiorriols/ui`. Export a token with `read:packages` scope before installing;
`.npmrc` reads it from `GITHUB_TOKEN`:

```bash
export GITHUB_TOKEN=<token with read:packages>
npm install
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
Ladders teams and members provide the shared roster. Evaluation data and logic
remain in Ladders.

Both apps use UI's `WelcomeScreen` and `AppHeader`. Branding, translations and
auth callbacks remain app-owned. The header shares title/subtitle/icon sizes,
language and account controls; Planner's page navigation is a separate row below
it. Workspace selection stays in the page toolbar.

### Update shared UI

UI publishes a new patch version on every push to its `main` branch. Update with
`npm install @jordiorriols/ui@latest` and restart the development server.

Shared Tailwind tokens are imported by `index.css`; keep its `@source`
directives. Official Radix exports and the original UI Button are unchanged.

## Workspaces and access

The workspace dropdown and **Share** sit opposite the page tabs in the tab bar.
Choose an existing workspace or **New workspace** from the same dropdown.

- A verified signed-in user creates a workspace and links one or more existing
  Ladders teams on **Vacations**. Linking a new team requires team edit access.
- Workspace owners and explicitly shared editors manage feature estimates,
  backlog priorities, delivery status and the plan start date.
- Owners use **Share** beside the workspace selector to add a registered account
  by email with **View** or **Edit** access, change permissions or remove a share.
  This reuses the same UI package dialog and form hook as Ladders team sharing.
  Shared workspaces appear when collaborators sign in using their platform account.
  Only owners manage sharing, team links and workspace deletion.
  Removing a workspace share does not revoke any existing linked-team viewing access.
- Linked team collaborators can view plans. Existing Planner collaborators
  retain their workspace access, but new independent Planner invitations are
  no longer created.
- Team owners/editors set a member's shared planning role and availability.
  A workspace owner does not gain team edit rights by linking it.
- Planning roles are backend, frontend, design or QA, separate from Ladders job
  titles. Unassigned members are explicitly excluded from scheduling capacity.
- Team membership is live, not copied. Members are identified by Ladders UUID,
  so moving or renaming someone preserves their global vacations.
- Unlinking a team keeps its vacations; deleting a Ladders member deletes that
  member's shared availability.
- Workspace data is isolated by Row Level Security, including direct API calls.

The team Vacations page shows squad velocity first, then the vacation calendar.
Team linking and member planning roles are grouped under **Configuration** below them.
Use **Group by** to choose **Areas** (Backend, Frontend, Design, QA) or linked
**Teams**, then select which groups to show in the adjacent multi-select dropdown.
Several selected groups stack into one bar per week; one selected group uses a
single bar. Colors and the legend identify each group. Capacity still uses the
same vacations, working-day overrides, Barcelona holidays and verified horizon
as scheduling, and excludes members without planning roles.

### Personal vacation links

Copy **Vacations** from a Ladders member's share menu, or **Copy vacation link**
in Planner. The URL is `#/vacations/<vacation-token>` on the Planner application.
Configure Ladders' `VITE_PLANNER_URL` with Planner's full deployed base URL,
including any GitHub Pages subpath. Local Ladders development can use Planner
on `http://127.0.0.1:5176`; production has no guessed-host fallback.

These permanent, private bearer links let members update only their own
availability without signing in. They also show read-only names and vacation
dates for the member's current Ladders team, not other linked teams or workspaces.
Other members' working-day overrides and vacation tokens are not exposed.
They do not grant team management, workspace or evaluation access. Self, peer and view evaluation tokens cannot be used for
vacations. Keep links private: anyone possessing a vacation link can use it.
Saved vacations immediately affect all workspaces containing that member.
**Working Day** removes vacation overrides in the selected range instead of
inserting working-day overrides. Weekends and Barcelona holidays therefore
remain non-working. Existing intentional working-day overrides are preserved;
no historical data is rewritten.
On both vacation pages, select the first and last calendar day (or select a
single day), then click **Vacations** or **Working Day** to save immediately.
The highlighted selection stays visible after saving and across month navigation.
The calendar legend matches each member's name and initial to their vacation markers;
normal weekends and holidays are not shown as saved vacations.

Old `planner_members` and `planner_availability` rows are preserved as legacy
data, not used as the current capacity roster. No automatic matching by email
or name is attempted. Re-enter relevant leave against linked Ladders members,
or arrange an explicit UUID mapping before migrating old overrides.

## Estimates and scheduling

The app header is named **Planner**. **Roadmap** is the prioritized plan (the
existing `/backlog` route remains valid). Feature Estimation first shows features
on the roadmap in priority order, followed by **Backlog** / **Not prioritized
features** for ideas not yet on the roadmap. Use **Add feature** on Roadmap to
prioritize an estimate; removing it returns it to the unprioritized group.

For each feature, enter people and weeks for backend, frontend, design and
QA. People and weeks must be whole numbers. Both values must be positive for an
active role (or both zero). Decimal input is rejected by the form, repository and
database, never silently rounded. Existing fractional estimates are preserved
but must be edited to whole numbers before they can be scheduled.

- **Effort** is the sum of `people × weeks` across roles.
- **Ideal duration** is design weeks + the longer backend/frontend estimate + QA weeks.
- **Peak team** is the sum of requested people across roles.
- Only projects explicitly added to the backlog are scheduled.
- Add existing estimates on Backlog Plan using **Add projects**.
  Estimation has no backlog toggle; the picker links there when a new feature is needed.
- Reorder by dragging the project names on the left of the schedule. Keyboard
  users can focus a name and press Arrow Up / Arrow Down.
- Right-click anywhere on a schedule row, including its name or bar, for
  **Mark delivered** / **Undo delivery** and **Remove from schedule**.
  Keyboard users can focus the row and press Shift+F10 or the context menu key.
  Removal keeps the feature estimate. These menus use the UI package's Radix exports.
- Workspace owners and editors can mark a project **Delivered** (or undo it).
  This persists a delivery status and turns its entire existing bar green;
  it does not release capacity or change forecast dates or backlog priority.
- A blue **Today** line spans the chart at the current local calendar day, when
  that day is inside the displayed forecast. It updates automatically across midnight.
- Daily available capacity is allocated by role and backlog priority.
- Different roles and projects can overlap when capacity allows. If only one
  backend person is available for a two-person estimate, completion takes longer.
- Design finishes before development starts. Backend and frontend then start
  independently as their own role capacity becomes available. QA starts on a
  later working day after design and both development roles finish.
- A mixed project's calendar span can exceed its ideal duration when backend and
  frontend start at different times, even without vacations or overbooking.
- Each compact Gantt row has one continuous project bar from first work to last
  work. Inside it, backend uses the top half, frontend the bottom, and design/QA
  use full height. Subtle role shades connect across weeks and normal weekends
  or holidays. Missed working days appear as gray waiting/paused gaps, including
  pauses within a week. Hover for role dates, requested people and allocated effort.
- A person-week means five working days. Saved time off and Barcelona holidays
  extend dates; working-day overrides can restore a holiday or weekend.
- A missing role, zero effort or an unfinished forecast is shown explicitly,
  not presented as a successful completion date.
- The Gantt forecast covers up to 52 weeks and stops at the last verified
  calendar day, including partial boundary weeks. **Plan starts** is saved on
  the workspace whenever its owner or an editor changes it, so refreshes and other workspace
  viewers use the same date. Existing and new workspaces initially use the
  database's current date; this saved date is not a delivery commitment.

The Barcelona calendar is verified for **2026 and 2027** against the
[City Council calendar](https://ajuntament.barcelona.cat/calendarifestius/en/index.html).
Update `src/lib/barcelonaHolidays.ts` before planning later years. Unknown
years are flagged instead of silently assuming there are no public holidays.
Calendar values are date-only local calendar days, not UTC timestamps.

## Supabase setup

The additive Planner migrations have been applied to the configured shared
project with approval:

1. `20261003140000_planner_workspaces.sql`: workspace, member, project and daily
   availability tables, RLS, verified-email invitations and transactional actions.
2. `20261003150000_planner_team_and_priority.sql`: owner-controlled role editing
   and deterministic, serialized backlog insertion.
3. `20261003170000_planner_whole_estimates.sql`: reject fractional people/weeks
   on new inserts/updates, without modifying any pre-existing estimates.
4. `20261003183000_planner_ladders_teams.sql`: workspace-to-Ladders-team links,
   global member availability and anonymous, member-scoped vacation RPCs.
   Adds nullable `members.planning_role` and immutable `members.vacation_token`.
5. `20261014223000_planner_vacation_team_calendar.sql`: read-only, token-scoped
   current-team names and vacations. Save/reset capabilities remain member-only.
6. `20261014224000_planner_project_delivery.sql`: persistent project delivery
   status, protected by the existing owner-only project write policy.
7. `20261014225000_planner_workspace_plan_start.sql`: saved workspace plan start
   date, protected by existing owner-only workspace update permissions.
8. `20261014230000_planner_workspace_sharing.sql`: owner-managed registered-account
   View/Edit shares, editor project/start-date permissions and immutable workspace
   identity. Supersedes owner-only project/start-date writes without changing
   linked-team editing permissions.
9. `20261016092000_planner_restore_working_calendar.sql`: changes Working Day
   saves to remove vacations while preserving the default calendar. Pending approval/application.

The fourth migration deliberately extends Ladders members; it does not alter
job titles, existing evaluation tokens or evaluations. Both apps must use this
same database schema before deploying the updated Ladders repository selectors.
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
analytics identity before enabling it with `loadUmami({ websiteId })` from
`@jordiorriols/ui` at boot (not a `<script>` tag), which skips automated
browsers so e2e runs never reach Umami.

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
authentication composition, linked team access, isolated token permissions,
legacy data preservation and repository pagination/error handling.

Live end-to-end tests live in the sibling `e2e-tests` project:

```bash
cd ../e2e-tests
npx playwright test --project=planner-localhost --workers=1
```

Start Planner first and configure both existing Ladders test accounts through
the environment/keychain. Tests create unique workspaces and delete only their
own data afterward; they never reset Ladders data or send invitation emails.

## CI and deployment

Pushes to `master` or `main`, as well as manual dispatch, run the same validation
and Pages deployment stages as Ladders. Database tests read the copied shared
migrations from this repository; a sibling Ladders checkout is not required.

CI pins Node.js 24.21.0 and uses `npm ci`; do not replace this with
`npm install` to work around lockfile errors. Older npm versions can omit
optional WASM peer dependencies that newer npm requires. When updating
dependencies, regenerate the lockfile with npm 11.19.0:

```bash
npx --yes --package=npm@11.19.0 npm install --package-lock-only --ignore-scripts
```

`npm ci` installs `@jordiorriols/ui` from GitHub Packages with the workflow token
(`packages: read`). Grant this repository read access in the package's
**Manage Actions access** settings, or set the `UI_READ_TOKEN` secret to a token
with `read:packages`.

Set the Planner Supabase URL and publishable-key GitHub configuration values,
enable GitHub Pages, and add the deployed Planner URL to Supabase's redirect
allow-list before deploying.
