# Planner

## Local Cloudflare Access migration branch

This isolated branch serves an authenticated, grant-scoped reduced roadmap at
`/planner/workspaces/:workspace/roadmap`. It uses browser paths, not hash routes,
and never imports Supabase or password flows from its active app entrypoint.
The roadmap renderer is extracted unchanged from the existing link page.
The NestJS image builds the actual Planner scheduler with `npm run build:scheduler`,
using a server-only translation instance, so dates/dependencies/UAT are not
reimplemented. Private scheduler inputs stay behind the API.

The shared local gateway serves both `/planner/` and `/shiplog/` on port 5320.
The individual Planner Docker web container is available on loopback port 5312 via the backend's
`web` profile. BuildKit installs GitHub Packages with a secret, not an image
environment variable. Local Vite uses port 5316 and proxies `/api` to port 5300.

Priority proposals reuse the existing component and domain validation with a
workspace-scoped API adapter. Drag pending/paused tasks after the locked
completed/in-progress prefix to recalculate without saving. Named snapshots
can be saved, restored, compared and tried against the current plan. Dependencies
and stale revisions are checked in the API; experiments never change official
priorities. Owners/editors can separately confirm **Apply priorities to official
plan** for a current experiment. A saved proposal must first be tried against the
current plan; applying it updates only official priorities, preserving the saved
snapshot. External/viewer users cannot apply priorities. Invalid or stale writes
show an error and keep the experiment; concurrent changes are rejected by the API.
Only people with explicit Planner access to the workspace can read or save
proposals. No anonymous link or app sign-in dialog is used by the active app.
Manual grants use the backend's local administrator command.

Owners/editors can manage markers through the same existing modal: create,
rename and delete via the API, preserving ID/date on rename. Viewers/external
users cannot edit; external users never receive the internal marker directory.
The existing project manager is also API-backed for owners/editors: create,
rename and delete with workspace-scoped permissions. Projects containing any
feature, even off-roadmap backlog tasks, cannot be deleted. Renaming preserves
the project ID and feature membership. The API returns only project
ID/workspace/name and an in-use flag, not raw feature details.
Internal roles now see the existing estimation view and cards, without a
duplicate UI. Owners/editors reuse the feature modal to create and edit names,
descriptions, status, project, whole-number estimates and multiple dependencies.
Viewers can read but not edit; external users never receive private task data.
New features start off-roadmap, and editing preserves inclusion and priority.
Cross-workspace IDs, invalid estimates, cycles, invalid dependency order and
deleting a prerequisite fail without partial writes. Delete confirmation errors
remain visible outside the closed dialog. Owners/editors can add existing tasks
using the same extracted add-feature modal and remove tasks from their cards.
Inclusion appends priorities; dependency ordering and prerequisite removal are
validated server-side. The start-date control uses the existing calendar rules
and refreshes the official forecast without changing saved proposals. Viewers
and external users cannot perform these writes. Vacation editing, capacity
configuration and the full internal navigation are not yet migrated.
Legacy share-token snapshots await reviewed migration.
This branch is not a production replacement and does not change
deployment workflows.

Workspace-based feature estimation, roadmap scheduling and team
availability. The copied Base44 layouts now use Supabase instead of Base44.
Feature creation and estimation editing use the shared modal's single content
scroll area, with Save and Discard kept outside it in the visible footer.
Marker management, add-feature selection and velocity calibration also use this
single modal scroll area; calibration actions remain in the modal footer.
Feature, marker and calibration fields reuse UI's `FormField`, `Input` and
`Textarea` from the registry package. Validation and planning rules stay in Planner.
The local error-boundary adapter delegates catching/logging to UI while retaining
Planner's localized component title and diagnostic message. Workspace failures
use UI's `ErrorState` with the existing retry and sign-out behavior.

Every estimated feature includes two calendar weeks of UAT after its last delivery
phase (including QA). This applies to existing and new features. UAT extends the
forecast end date but does not reserve team capacity or add person-weeks of effort.
Unestimated or incomplete features do not receive invented UAT dates.

### Team vacation timeline

Below the existing vacation calendar, a horizontal timeline shows all workspace
members (including members without a planning role), grouped by team. Select a
starting month or use the previous/next month icons to view the next 52 weeks.
Timeline is the default view. The header icon switches between calendar and
timeline with a localized shared tooltip, preserving both views' selections.
Only saved vacation days produce bars; weekends and holidays are not invented
as absences, and explicit working-day overrides are excluded. Contiguous dates
share a blue bar, alternating light and dark shades by member row (including
rows without vacations), with localized exact dates available on hover or keyboard focus.

The UI library's props-driven `TimelineCard` owns the card, scrolling, grouped
headers, guides and markers. The private/public roadmaps reuse the same component;
Planner retains only scheduling, vacation grouping and domain-specific row actions.
TimelineCard is supplied by UI `^0.3.25` from GitHub Packages.

### Public roadmap

Use workspace **Share** from any page: **Emails** opens by default for people
access; **Link** contains the public link controls. Only owners manage people and enable/revoke the public link;
Planner editors/viewers can inspect current-app access and copy/open an existing
link. Linked team access alone does not grant sharing access. The shared UI
`^0.3.21` provides these accessible tabs and larger, content-sized modals (up to 70dvh).
`20261030234000_workspace_sharing_directory.sql` has been applied to the shared
database with approval; the RPC enforces owner-only public-link writes and
app-scoped directory/token reads.
Anyone with the public link sees a standalone timeline, without official editing rights:
one overall bar per feature, including UAT, with no roles, effort or capacity details.
Project headings reuse the internal roadmap's pinned group headers. Consecutive
features in the same project share a heading; priority order remains unchanged.
Project names appear only in these headings, not repeated beneath each feature.
Names of roadmap features and their projects are public while sharing is enabled.
The official plan reloads every minute; revoking the link blocks subsequent reads.
Visitors see each feature's status, the Today line, light weekly lines with stronger
month boundaries, and can change the language. The footer stays visible.

Both the roadmap page and the public link share a display toolbar: **Full width**
removes the page's maximum width (keeping the page margins) and widens the
feature-name column; **Wrap titles** wraps long feature names instead of
truncating them. The choices are remembered in the browser.

### Important date markers

Use **Manage markers** on the roadmap to create, rename or delete named dates in a modal
list. The edit button renames a marker in place, preserving its ID and date.
Save/Cancel stay in the list; failed edits remain available for retry.
Markers are saved per workspace, sorted by date, and editable by workspace
editors only. Members see amber dashed date lines by default; public roadmap
visitors start with them hidden. **Show markers / Hide markers** changes only
the current browser tab's session (separate member and public preferences), not
the saved markers or anyone else's view. Dates outside the displayed timeline
remain in the list but do not extend the scheduling horizon.

Marker names and dates are included on enabled public roadmap links.
Apply `20261030170000_roadmap_markers.sql` before deploying the client, and redeploy
the `roadmap` Edge Function to include markers in the public projection.

The `roadmap` Supabase Edge Function reads a service-only, token-gated RPC, reuses
the exact scheduling engine from `src/lib/planning.ts`, and returns only feature
names, project names, dates, status, feature/dependency IDs and an opaque revision.
Staff, vacations and estimates
never reach the public client. Its Deno import map selects a server-only i18n
instance instead of React/browser initialization. No second scheduler is maintained.

Deployment requires the `20261019190000_public_roadmap.sql` migration and
`supabase functions deploy roadmap --project-ref <project-ref>`. The function uses
Supabase's server-provided URL and service-role key; never put that key in Vite
configuration. `verify_jwt = false` is intentional: a valid, revocable share token
is required instead. Do not grant anonymous access to `planner_roadmap_source`.

### Dependencies and priority proposals

Feature creation/editing offers multiple prerequisites across projects in the same
workspace. Prerequisites must be earlier on the roadmap; cycles, self-references,
foreign-workspace/missing features and removal of referenced prerequisites are
rejected by the database, including direct REST mutations. Bulk priority changes
are checked at transaction commit, not against an intermediate ordering.
Scheduling waits for every prerequisite to finish delivery **and UAT**, even when
other roles have unused capacity.

On a public link, drag a feature using the same grip as the private roadmap to
experiment without writing official priorities. The grip retains Arrow Up/Down
keyboard access without visible arrow buttons. Only pending/paused features **after the last done or
in-progress feature** can move; the whole earlier prefix is fixed. Dependencies
are checked before preview requests and again on the server. Preview computation
reuses the same scheduler; private capacity and vacation inputs stay server-side.
The separate draft is never silently reset by polling. A changed source revision
rejects stale previews/saves and requires returning to the official plan.

**Propose priority** saves a named snapshot after sign-in with a verified email;
workspace membership is not required, but the active link is. Anyone with that
link can view saved proposals and compare them with the official plan or another
proposal. Saved dates/inputs do not change with subsequent official edits.
Returning to the official plan starts a new experiment. **Try these priorities on
the current plan** recovers a proposal's order with current inputs, validates it
against today's dependencies/locked prefix, and recalculates without changing
the saved snapshot. Missing features or incompatible orders are rejected.
A manager applies any
agreed priorities through the normal authenticated roadmap, not through the link.
Snapshots belong to the share link: revoking it deletes its proposals. Saved
proposals count as workspace content; revoke the link to clear them before
deleting an otherwise empty workspace.

Apply backend `20261106233000_planner_dependencies_proposals.sql` **and redeploy
the roadmap Edge Function before releasing this client**. Both require explicit
deployment approval. No UI package publication is needed.

From the E2E repository, use
`APP_NAVIGATION_ROOT=<parent-of-planner-worktree> npx playwright test --config=planner-proposals.config.ts`.
Five browser scenarios simulate service responses, covering drag,
keyboard controls, protected rows, naming, recovery/comparison, stale errors and
all six languages on mobile. An additional live scenario creates only test-owned
data and verifies the deployed SQL/Edge Function, private-input redaction,
historical recovery/comparison, unchanged official priorities and anonymous
snapshot reads. It revokes its test link and removes its own data afterwards.
It needs the existing primary E2E account. Non-member authorization is also
covered by the backend database contracts. Real SQL constraints and scheduling
are tested in Backend and Planner respectively.

## Start locally

Use Node.js 26 LTS with npm 11.20.0, matching CI. Run `nvm install` and
`nvm use` to select the version in `.nvmrc`. The shared UI library is installed from GitHub Packages as
`@jordiorriols/ui`. Export a token with `read:packages` scope before installing;
`.npmrc` reads it from `GITHUB_TOKEN`:

UI `^0.3.33` includes Agents in the shared project switcher and supplies the shared timeline card and green Planner branding for header, project-menu
and login/welcome icons. `projectId` and `ProjectIcon` reuse the UI registry
without a local palette.

Form, role, vacation-member and velocity-grouping dropdowns use UI's shared
`SelectField` listbox, including inside modals. Workspace sharing uses the same
component. Account tooltips reuse UI's `getDisplayName` rather than full emails.

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
The authenticated page frame uses published UI `^0.3.31` `AppShell`, composing
the existing page, header, main and footer once. Its flex main keeps the footer
at the bottom on short pages; the roadmap retains its full-width override.
`AppNavigation` draws app-owned header tabs; workspace sharing and access rules
remain in Planner.
Header, tabs and `.panel` cards stay white (`bg-background`/`bg-card`), so
every project has the same layout.
Ladders teams and members provide the shared roster. Evaluation data and logic
remain in Ladders.

Both apps use UI's `WelcomeScreen` and `AppHeader`. Branding, translations and
auth callbacks remain app-owned. The header shares title/subtitle/icon sizes,
language and account controls; Planner's page navigation is a separate row below
it. Workspace selection stays in the page toolbar.
`AppAccountControls` owns login/sign-out state and auth errors; the welcome
adapter delegates to `AuthDialog`. Public roadmaps and personal vacation links
use `PublicAppShell`, with mobile language selection and one attribution footer,
without account controls or a project menu. Roadmaps stay read-only; vacation
tokens still edit only their own member's availability.

### Update shared UI

UI publishes a new patch version on every push to its `main` branch. Update with
`npm install @jordiorriols/ui@latest` and restart the development server.

Shared Tailwind tokens are imported by `index.css`; keep its `@source`
directives. Official Radix exports and the original UI Button are unchanged.

### Localization

All application-owned visible copy, accessible labels, tooltips and validation
messages use i18next. Keep translations in `src/locales/{en,es,ca,fr,de,it}.json`,
including complete interpolated sentences and plural forms rather than assembling
English fragments in components. Organize messages under the owning page or
component, for example `estimation`, `roadmap`, `gantt`, `featureForm`,
`featureCard`, `vacations`, `teamConfiguration`, `availabilityEditor`,
`vacationCalendar`, `vacationLink`, and `velocity`. Shared actions and units belong
under `common`; workspace flows, planning validation and holiday names have their
own `workspace`, `planning`, and `holidays` groups. Do not add a generic `copy`
bucket or use sentence fragments as key names.

Interpolation names describe their content: `{{featureName}}`, `{{memberName}}`,
`{{date}}`, `{{year}}`, `{{role}}`, or `{{roles}}`, never numbered `value`/`param`
variables. Use i18next's `{{count}}` for plural messages, keeping each plural family
in its owning group. Update all six catalogs and translation call sites together.

React views subscribe with `useTranslation`;
planning helpers translate roles, holiday names and errors when used, not at
module initialization. Dates, month names and weekdays follow the selected locale.
The document language updates with the language selector.

User-entered names/descriptions, URLs, identifiers and technical diagnostics are
not translation keys. Preserve original service errors for diagnosis rather than
silently replacing them. Locale parity/placeholder checks, six-language rendering
tests and an inline-copy source guard protect this convention.

The header icon opens UI's shared `ProjectSwitcher`. Project names, icons and
canonical URLs live in UI's `PROJECTS` registry; adding a project requires one
registry change, a UI release, and dependency updates/deployment in each app.
Authentication, workspace loading and route loading reuse UI's accessible
`AppSkeleton`, with reduced-motion-aware pulsing `Skeleton` blocks.

### Shared Supabase authentication redirects

Signup, OAuth and recovery explicitly use `?auth_app=planner` on the current
deployment's base URL. A callback addressed to another registered app is forwarded
before creating the Supabase client, so the correct origin exchanges the PKCE code.

In Supabase **Authentication → URL Configuration**, keep one Site URL as a default
and add these Redirect URLs:

- `https://planner.jordiorriols.cat/`
- `https://planner.jordiorriols.cat/?auth_app=planner`
- `https://ladders.jordiorriols.cat/`
- `https://ladders.jordiorriols.cat/?auth_app=ladders`
- Approved development URLs, including
  `http://127.0.0.1:5176/?auth_app=planner` and each Ladders development base URL
  with `?auth_app=ladders`.

For subpath deployments, include the complete pathname and query.
Keep verification/recovery email templates using `{{ .ConfirmationURL }}`;
custom templates must preserve the supplied `{{ .RedirectTo }}` instead of
hard-coding `{{ .SiteURL }}`. Reissue old emails without an app marker.
The allow-list must accept the tagged URLs: otherwise Supabase may fall back to
Site URL before the marker reaches either app. Dashboard settings are not changed
by deploying the apps.

## Workspaces and access

Accounts with no accessible workspace use UI's shared `WorkspaceSetup` inside
the app shell: explicitly create one or wait for an invitation. Waiting checks
for invitations automatically and retains language and sign-out controls.
The workspace menu lets owners delete only empty workspaces after confirmation.
The backend `delete_workspace` RPC checks content across all five apps, removes
empty teams/projects and preserves nonempty workspaces. Deploy the backend
lifecycle migration before enabling these controls.

The workspace dropdown and **Share** sit opposite the page tabs in the tab bar.
Both come from UI's shared `WorkspaceBar`, the same one Ladders and Pulse use. The
dropdown lists the workspaces shared with you for Planner (`list_workspaces`), and
**New workspace** sits in the same menu. Workspace settings (plan start and sprint
calibration) load with the selected workspace's data.

- A verified signed-in user creates a workspace; its owner adds teams to it in
  **Team configuration**. Teams stay in the workspace they are created in, and a
  workspace that still holds teams cannot be deleted.
- Workspace owners and explicitly shared editors manage feature estimates,
  roadmap priorities, feature status and the plan start date.
- Owners use **Share** beside the workspace selector to add a registered account
  by email with **View** or **Edit** access to Planner, Ladders or Pulse, change
  permissions or remove a share.
  This reuses the same UI package dialog and form hook as Ladders team sharing.
  Shared workspaces appear when collaborators sign in using their platform account.
  Only owners manage sharing, teams and workspace deletion.
  Removing a workspace share does not revoke viewing access granted through a Ladders share.
- Ladders collaborators of the workspace can view its plans. Existing Planner collaborators
  retain their workspace access, but new independent Planner invitations are
  no longer created.
- Team owners/editors set a member's shared planning role and availability.
- Planning roles are backend, frontend, design or QA, separate from Ladders job
  titles. Unassigned members are explicitly excluded from scheduling capacity.
- Team membership is live, not copied. Members are identified by Ladders UUID,
  so moving or renaming someone preserves their global vacations.
- Deleting a Ladders member deletes that member's shared availability.
- Workspace data is isolated by Row Level Security, including direct API calls.

The team Vacations page shows squad velocity first, then the vacation calendar.
The workspace teams and member planning roles are in the separate **Team configuration** tab.
Use **Group by** to choose **Areas** (Backend, Frontend, Design, QA) or linked
**Teams**, then select which groups to show in the adjacent multi-select dropdown.
Several selected groups stack into one bar per week; one selected group uses a
single bar. Colors and the legend identify each group. Capacity still uses the
same vacations, working-day overrides, Barcelona holidays and verified horizon
as scheduling, and excludes members without planning roles.

### Personal vacation links

Copy **Vacations** from a Ladders member's share menu, or **Copy vacation link**
in Planner. The URL is `#/vacations/<vacation-token>` on the Planner application.
Ladders uses the shared UI project registry for this URL, just like the header
project switcher. No separate environment variable is needed.

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

The Vacations tab contains sprint velocity and the shared vacation calendar.
Team linking, member planning roles and personal vacation links live in the
separate **Team configuration** tab, with the same owner/member permissions.

Squad velocity uses exact two-week sprints, anchored by a start date saved on the
workspace independently of the roadmap and calendar navigation. Use its gear
button to set the cadence and add, edit or remove completed sprint results
(start date and delivered story points). Results must follow the same 14-day
cadence; zero points is valid. Editors can save calibration; viewers can see it.

The shared calibration rate is **total delivered story points / total available
person-weeks** across the recorded sprints. Availability is recomputed from the
current linked roster, assigned roles, vacations, holidays and working overrides;
it is not a historical roster snapshot. Keep that calendar accurate. Each chart
segment is its team's or area's available person-weeks multiplied by this one
workspace rate. Changing filters does not recalibrate the average. Without
history the graph explicitly shows person-weeks, not invented story points.
The forecast includes the current sprint and the following seven, but excludes
any sprint extending beyond the verified holiday calendar. Changing vacation
calendar months does not move the sprint forecast.

Apply `20261016110000_planner_sprint_calibration.sql` before deploying this version.
It adds workspace sprint settings and validates recorded dates/points while
preserving existing workspace viewing/editing permissions.

The app header is named **Planner**. **Roadmap** is the prioritized plan (the
existing `/backlog` route remains valid). Feature Estimation first shows features
on the roadmap in priority order, followed by **Backlog** / **Not prioritized
features** for ideas not yet on the roadmap. Use **Add feature** on Roadmap to
prioritize an estimate; removing it returns it to the unprioritized group.
Squad size, Plan starts and Roadmap finishes reuse the same summary card, with
aligned labels and values and reserved space for the start-date edit action.
Owners/editors can reveal the start-date input with its edit button; successful
changes are saved to the workspace and return to the read-only card.

For each feature, enter people and weeks for backend, frontend, design and
QA. Estimation uses full-width feature cards: overall Peak team, Duration and Effort
appear first, followed by a vertical divider and a separate **Effort by role** group
for active roles. Role details are
collapsed by default; expanding them replaces the compact summary with people,
weeks and person-weeks for each area. Role columns stack on smaller screens;
unused areas show zero.
Role colors live in `src/config/roleColors.ts`, which uses the roadmap palette.
Estimation's role-colored effort titles, the feature form, the roadmap legend and
bars, and velocity charts all read from it.

Every feature belongs to a **main project**, and features reach their workspace
through that project. Owners/editors use **Manage projects** on Estimation to
add, rename or delete the workspace's project list. Names must be unique
ignoring case, and a project can only be deleted once it has no features. The
feature form requires a project; choose **+ New project** to create one inline
while saving the feature. Estimation shows the project label before the feature
title. The Roadmap keeps strict priority order and inserts a project heading
whenever consecutive features belong to a different project.
Feature creation and editing share footer actions: a primary Create/Save button
beside Discard. Discard closes without saving; failed saves keep the draft open.
People and weeks must be whole numbers. Both values must be positive for an
active role (or both zero). Decimal input is rejected by the form, repository and
database, never silently rounded. Existing fractional estimates are preserved
but must be edited to whole numbers before they can be scheduled.

- **Effort** is the sum of `people × weeks` across roles.
- **Ideal duration** is design weeks + the longer backend/frontend estimate + QA weeks.
- **Peak team** is the sum of requested people across roles.
- Only features explicitly added to the roadmap are scheduled.
- Add existing estimates on Roadmap using **Add feature**.
  Estimation has no roadmap toggle; the picker links there when a new feature is needed.
- Each row label shows, in order: the drag handle, the priority number, the
  status dot and the feature name. Reorder by dragging the label; keyboard users
  can focus the handle and press Arrow Up / Arrow Down.
- Right-click anywhere on a schedule row, including its name or bar, to change
  the **status** or **Remove from roadmap**.
  Keyboard users can focus the row and press Shift+F10 or the context menu key.
  Removal keeps the feature estimate. These menus use the UI package's Radix exports.
- Every feature has a status: **Pending**, **In progress**, **Done** or **Paused**.
  Editors change it in the feature form on Estimation, or on the roadmap from the
  status dot or the row menu; viewers see it read-only. **Done** turns the
  entire bar green; **Paused** dims the row to half opacity. Status does not
  release capacity or change forecast dates or roadmap priority.
- A blue **Today** line spans the chart at the current local calendar day, when
  that day is inside the displayed forecast. It updates automatically across midnight.
- Daily available capacity is allocated by role and roadmap priority.
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

Planner shares one Supabase project with the other apps. Its migrations,
database tests, Auth email templates and Supabase configuration live in the
[backend](https://github.com/JordiOrriols/backend) repository; add and apply
schema changes there, before deploying a Planner change that needs them.

This repository keeps only the `roadmap` Edge Function (`supabase/functions`),
because it reuses Planner's scheduling code. Its tests that check the database
against Planner code (public roadmap, markers, shared vacations) load every
migration from the `@jordiorriols/backend` dev dependency into PGlite, so
Docker is not required. Update it with `npm install -D @jordiorriols/backend@latest`
after a backend change.

### Authentication redirect configuration

See **Shared Supabase authentication redirects** above for the complete
app-tagged redirect allow-list and email-template requirements. Preserve existing
Ladders URLs and the OAuth provider callback; the apps still use the same accounts.
No authentication dashboard configuration was pushed by this work.

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

Build and deployment run in separate jobs. Builds have only read permissions;
`UI_READ_TOKEN` is available only to dependency installation. Only the deployment
job receives Pages/OIDC permissions, on `main` or `master` and subject to the
`github-pages` environment's branch policy. Checkout credentials are not persisted.
Actions are pinned to commit SHAs and receive weekly Dependabot update PRs.

Pushes to `master` or `main`, as well as manual dispatch, run the same validation
and Pages deployment stages as Ladders. Database tests read the shared
migrations from the `@jordiorriols/backend` package.

CI selects Node.js 26 from `.nvmrc` and uses `npm ci`; do not replace this with
`npm install` to work around lockfile errors. Older npm versions can omit
optional WASM peer dependencies that newer npm requires. When updating
dependencies, regenerate the lockfile with npm 11.20.0:

```bash
npx --yes --package=npm@11.20.0 npm install --package-lock-only --ignore-scripts
```

`npm ci` installs `@jordiorriols/ui` from GitHub Packages with the workflow token
(`packages: read`). Grant this repository read access in the package's
**Manage Actions access** settings, or set the `UI_READ_TOKEN` secret to a token
with `read:packages`.

Set the Planner Supabase URL and publishable-key GitHub configuration values,
enable GitHub Pages, and add the deployed Planner URL to Supabase's redirect
allow-list before deploying.
