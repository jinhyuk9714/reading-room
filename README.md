# Reading Room

Reading Room is a Next.js 16 personal reading OS for tracking a library, reading progress, reflections, recommendations, rankings, and reading insights. The production path is Vercel for the web app and Supabase for auth, database, and row-level security.

## Requirements

- Node.js `20.19.0` (see `.nvmrc`)
- npm
- Supabase CLI for database migration work
- A Supabase project
- A Google OAuth client for cloud sign-in
- A Vercel project linked to this repository

## Local Setup

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The app can render a setup/demo state without Supabase values. Cloud persistence requires Supabase, and Google sign-in becomes available after the OAuth setup below.

## Reading OS v2.1

The no-env demo and authenticated app are expected to cover the core reading OS routes:

- `/` home cockpit with active reading, quick progress logging, status workspaces, recent logs, and local insight counters.
- `/demo` production-safe no-login demo for trying the full reading loop before OAuth setup or sign-in.
- `/search` book search and manual add.
- `/library/[id]` book detail with metadata editing, status changes, reading log editing, archiving, and deletion.
- `/archive` archived books with restore and in-app confirmed delete actions.
- `/rankings` local or anonymous ranking fallback.
- `/recommendations` recommendation discovery with purpose switching, quick actions, hidden/saved/opened feedback signals, and dismiss/add regression coverage.
- `/insights` reading insight fallback for local demo data, including status totals, page totals, goals, pace, tags, moods, quotes, and reflections.
- `/settings` reader goals and recommendation preferences: daily page goal, weekly session goal, default log mode, favorite keywords, and blocked keywords.

Demo state is stored in `localStorage` under `reading-room-demo-v1`. OS v2 reading logs add:

- `quote: string | null`
- `tags: string[]`
- `mood: string | null`

Older seeded demo states that only include `note`, page progress, and `pagesRead` are normalized in the demo UI so existing localStorage fixtures keep working.

Reader preferences are stored in `reader_preferences` when Supabase is configured. Recommendation feedback is stored as append-only `recommendation_events` rows and is used only for personal ranking and exclusion; it is not mixed into public ranking output.

## Environment

Create `.env.local` for local development and configure the same runtime values in Vercel for preview and production.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Browser/server | Yes | Local: `http://localhost:3000`. Production: canonical `https://...` URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Yes | Supabase project API URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server | Yes | Supabase publishable anon key. Do not use the service role key in the app. |
| `GOOGLE_OAUTH_ENABLED` | Server | Yes for Google login | Set to `true` only after the Google provider is enabled in Supabase. Keep `false` while provider secrets are missing. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | No | Enables global anonymous rankings and server-side maintenance operations. Without it, rankings fall back to the current user's private reading data. Never expose to client code or prefix with `NEXT_PUBLIC_`. |
| `TYPESENSE_HOST` | Server | No | Managed Typesense Cloud host for the book search index. When omitted, search falls back to external providers directly. |
| `TYPESENSE_PORT` | Server | No | Defaults to `443` for Typesense Cloud. |
| `TYPESENSE_PROTOCOL` | Server | No | Defaults to `https`. |
| `TYPESENSE_API_KEY` | Server only | No | Typesense search/import key. Never expose to client code or prefix with `NEXT_PUBLIC_`. |
| `TYPESENSE_COLLECTION` | Server | No | Defaults to `books`. |
| `KAKAO_REST_API_KEY` | Server only | No | Enables Kakao Book Search, the primary Korean book metadata provider. |
| `NAVER_CLIENT_ID` | Server only | No | Enables Naver Book Search fallback for Korean metadata. |
| `NAVER_CLIENT_SECRET` | Server only | No | Required with `NAVER_CLIENT_ID`. |
| `GOOGLE_BOOKS_API_KEY` | Server | No | Enables keyed Google Books fallback requests. Google is used after Kakao/Naver/Open Library ranking signals. |
| `OPENAI_API_KEY` | Server | No | Optional. Adds AI-written recommendation reasons. Without it, recommendations use Korean catalog search and rule-based reasons. Never prefix with `NEXT_PUBLIC_`. |
| `OPENAI_RECOMMENDATIONS_MODEL` | Server | No | Required together with `OPENAI_API_KEY` before OpenAI is called. Leave empty to force catalog-only fallback recommendations. |

For GitHub Actions Vercel deployment workflows, store these repository secrets if/when deployment from CI is enabled:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

For Supabase CLI automation, store these separately from runtime env:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

## Supabase Setup

1. Create or select a Supabase project.
2. In Project Settings, copy the project URL and publishable anon key into `.env.local` and Vercel environment variables.
3. In Google Cloud Console, create an OAuth client for a web application.
4. Add Authorized JavaScript origins to the Google OAuth client:
   - Local: `http://localhost:3000`
   - Production: `https://<production-domain>`
   - Preview: each Vercel preview origin that should accept OAuth
5. Add the Supabase callback URL as the Google OAuth Authorized redirect URI:
   - Hosted Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Current hosted project: `https://jzoarxpkstoceluwhbed.supabase.co/auth/v1/callback`
6. In Supabase Authentication > Providers > Google, enter the Google client ID and secret and enable the provider.
7. In Supabase Authentication > URL Configuration, set the Site URL to production and add app callback URLs to Redirect URLs:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://<production-domain>/auth/callback`
   - Preview: each Vercel preview callback URL that should accept OAuth
8. Set `GOOGLE_OAUTH_ENABLED=true` in Vercel and redeploy.

For the current deployment, use:

- Site URL: `https://new-chat-2-two.vercel.app`
- Production redirect URL: `https://new-chat-2-two.vercel.app/auth/callback`
- Supabase Google callback URL: `https://jzoarxpkstoceluwhbed.supabase.co/auth/v1/callback`

## Database Migrations

Migrations live in `supabase/migrations`.

For a linked project:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

For a local migration smoke test:

```bash
supabase start
supabase db reset
supabase stop --no-backup
```

Before production deploys, confirm the latest migration has been applied to the target Supabase project and that Row Level Security policies are enabled.

## Book Search Setup

Search works without paid services, but the highest-quality setup uses Typesense Cloud plus Korean provider keys.

1. Create a Typesense Cloud cluster and add `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`, and `TYPESENSE_COLLECTION` to local and Vercel server env.
2. Create Kakao Developers and Naver Developers search credentials, then set `KAKAO_REST_API_KEY`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET`.
3. Run the app and search once for representative titles such as `1984` and `모순`; successful searches best-effort upsert normalized book documents into the Typesense collection.
4. Keep `OPENAI_API_KEY` separate from search. It is only needed for AI recommendation copy, not for finding or ranking books. Set `OPENAI_RECOMMENDATIONS_MODEL` explicitly when enabling it.

## Verification

Run the full local verification suite before merging:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
npm run db:test
```

Final demo/QA verification for OS v2 parity:

```bash
npm run typecheck
npx playwright test tests/e2e/demo-flow.spec.ts tests/e2e/local-demo-management.spec.ts tests/e2e/recommendations-discovery.spec.ts --project=chromium-desktop
npm run e2e
```

GitHub Actions runs the same checks on pull requests and pushes to `main`. CI installs the Supabase CLI, starts the local Supabase stack, runs `npm run db:test`, then stops the stack before the Next build. The e2e configuration intentionally runs with empty Supabase public values so unauthenticated setup/login and `/demo` flows remain testable in CI.

For a deployed preview or production smoke, set `PLAYWRIGHT_BASE_URL` and run:

```bash
PLAYWRIGHT_BASE_URL=https://<deployment-url> npm run e2e:staging
```

Authenticated staging smoke is optional because it needs a real test user session. When available, save Playwright storage state to `tests/.auth/storage-state.json`, set `PLAYWRIGHT_STORAGE_STATE=tests/.auth/storage-state.json`, and run `npm run e2e:staging` against the deployment URL. Cover `/`, `/search`, `/library`, `/recommendations`, `/insights`, and `/settings`.

Manual production smoke test:

1. Open the deployed site.
2. Sign in with Google.
3. Search for a book.
4. Add it to the library.
5. Update reading progress.
6. Add a reflection.
7. Sign out and sign back in to confirm persisted data.

## Vercel Deployment

Recommended path: use Vercel Git integration for previews and production.

1. Import the repository into Vercel.
2. Set Framework Preset to Next.js.
3. Set the install command to `npm ci`.
4. Set the build command to `npm run build`.
5. Set the output configuration to Vercel defaults.
6. Add all required environment variables to Preview and Production.
7. Deploy a preview, verify it, then promote or merge to production.

CLI deployment is also supported:

```bash
npm install -g vercel
vercel pull --yes --environment=preview
vercel build
vercel deploy --prebuilt
```

Production:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

## Rollback

Application rollback:

```bash
vercel rollback
```

or roll back to a specific deployment from the Vercel dashboard.

Database rollback is not automatic. Prefer forward-fix migrations. If a schema rollback is unavoidable:

1. Disable or pause the affected release path.
2. Restore from a Supabase backup or apply a reviewed down/repair migration.
3. Re-run `npm run build` and the manual smoke test against the restored target.
4. Record the incident, affected migration, Vercel deployment URL, and recovery steps.

## Operational Notes

- Keep public Supabase values public-only; never expose service role keys to Next.js client code.
- `NEXT_PUBLIC_` values are inlined during `next build`, so production values must be correct before building.
- OAuth callback URLs must match `NEXT_PUBLIC_SITE_URL` and Supabase auth redirect allowlists.
- Apply database migrations before promoting a deployment that depends on them.
