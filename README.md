# Engineering Ladders

A React application for managing team competency assessments, evaluation history, and professional growth tracks.

## Requirements

- Node.js 24+
- A Supabase project
- Docker Desktop only when running Supabase locally

## Application setup

```bash
npm install
cp .env.example .env
npm start
```

Set these values in `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is safe to use in the browser. Database access is protected by the Row Level Security policies in the migrations. Never put the service-role key in this application.

## Initialize Supabase

Creating a Supabase project does not create this application's tables. Apply both migrations before trying to save members or evaluations.

Authenticate the CLI and link this repository to the existing project:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Enter access tokens and database passwords directly in the terminal when prompted. Do not place them in `.env` or commit them.

For the currently configured URL, the project ref is the subdomain before `.supabase.co`.

The migrations run in filename order:

1. `supabase/migrations/0001_init.sql` creates tables, Row Level Security policies, permanent UUID share tokens, and public token RPCs.
2. `supabase/migrations/0002_editable_drafts.sql` enables draft autosave while keeping published evaluations immutable.

Alternatively, for a new empty project, paste and run those files in order in the Supabase Dashboard SQL Editor. Prefer `supabase db push` because it records migration history.

## Auth configuration

In Supabase Dashboard under **Authentication → URL Configuration**:

- Set the Site URL to the deployed application URL.
- Add `http://localhost:5173` and `http://127.0.0.1:5173` as redirect URLs for local development.
- Add the exact GitHub Pages base URL as a redirect URL for production.

Email/password authentication must be enabled. Password-reset emails redirect to the application base URL, where Supabase restores the PKCE recovery session.

To enable GitHub login:

1. Create a GitHub OAuth App.
2. Set its callback URL to `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard under **Authentication → Providers → GitHub**, enable GitHub and enter the OAuth App client ID and secret.
4. Keep the application base URL in Supabase's redirect allow-list.

## Local Supabase

To run the complete stack locally:

```bash
npx supabase start
npx supabase db reset
```

Then replace the `.env` values with the local API URL and publishable key printed by `npx supabase status`.

## Checks

```bash
npm run compile
npm run lint
npm run format:check
npm run test:coverage
npm run build
```
