# Otion

Otion is a full-stack collaborative notes workspace built with React 19, Express 5, MongoDB and
Socket.IO. It supports a flat workspace sidebar, a block editor with markdown shortcuts and inline
formatting, conflict-safe realtime editing with Yjs CRDTs, presence and live cursors, version
history, role-based sharing, tokenized public links, comments with mentions, notifications, search,
favorites, and a trash with restore.

## Live deployment

| Service | URL |
| --- | --- |
| Web app | <https://otion-nine.vercel.app> |
| API | <https://otion-api.onrender.com/api> |
| API health | <https://otion-api.onrender.com/api/health> |
| Realtime | `wss://otion-api.onrender.com` |
| Staging API | <https://otion-api-staging.onrender.com/api/health> |

The API runs on Render (Node), the client is a static Vite build on Vercel, and data lives in MongoDB
Atlas (`test` database, which is what a URI without a database path resolves to). CORS accepts
`otion-nine`-style Vercel origins, every `otion*.vercel.app` preview, `localhost`, and anything
listed in `CLIENT_URLS`. Staging is the same code on Render with an `otion_staging` database on the
same Atlas cluster, so preview work never touches production rows.

### Demo accounts

Running `npm run seed` in `server/` (see [Demo data](#demo-data)) creates:

| Email | Password | Role |
| --- | --- | --- |
| `demo@otion.app` | `OtionDemo123!` | Workspace and note owner |
| `maya@otion.app` | `OtionDemo123!` | Editor on shared notes, author of one shared note |
| `sam@otion.app` | `OtionDemo123!` | Viewer on one note, commenter on another |

The seed also publishes one note and prints its public link.

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Product scope, stack, data model summary, routes, rules |
| [`docs/Architecture.md`](docs/Architecture.md) | Runtime topology, request flows, module map, deployment |
| [`docs/Database.md`](docs/Database.md) | Every collection, field, index, cascade rule and migration |
| [`docs/API.md`](docs/API.md) | REST endpoints, payloads, errors, rate limits, Socket.IO protocol |
| [`docs/Phases.md`](docs/Phases.md) | Build phases and their as-built status |
| [`docs/Rules.md`](docs/Rules.md) | Approved libraries, design tokens, conventions for contributors |
| [`docs/Gaps.md`](docs/Gaps.md) | Consolidated register of every known engineering and product gap |
| [`docs/Memory.md`](docs/Memory.md) | Delivered feature log and verification record |
| [`docs/Implementation-Plan.md`](docs/Implementation-Plan.md) | Remaining roadmap and sequencing |

## Repository layout

```text
otion/
├── client/                 # React 19 + Vite 8 + Tailwind 4 single-page app
│   ├── src/components/     # Editor, Sidebar, Navbar, modals, command palette
│   ├── src/pages/          # Home, Login, Register, Dashboard, NoteEditor, Trash, Settings, PublicNote
│   ├── src/context/        # Auth, Theme, Toast providers
│   ├── src/hooks/          # useAuth, useTheme, useToast, useNotes, useCollaborativeNote, …
│   ├── src/services/       # Axios instance and Socket.IO client
│   ├── nginx.conf          # SPA fallback + /api and /socket.io proxying for Docker
│   └── Dockerfile
├── server/                 # Express 5 API + Socket.IO + Yjs persistence
│   ├── controllers/        # auth, account, note, share, public, search, comment, notification, workspace
│   ├── models/             # 13 Mongoose models
│   ├── routes/             # 8 routers
│   ├── services/           # workspace, revision and collaboration (CRDT) services
│   ├── migrations/         # Ordered migration runner and 13 migrations
│   ├── scripts/            # seed.js, truncateDb.js
│   ├── tests/              # node:test + supertest integration suite
│   └── Dockerfile
├── docs/                   # Product, architecture, database, API and process docs
├── docker-compose.yml      # MongoDB + API + nginx-served client
├── render.yaml             # Render blueprint for the API service
├── CONTRIBUTING.md         # Setup, tests, migration and PR workflow
├── LICENSE                 # MIT
└── .github/workflows/ci.yml
```

## Local setup

Requirements: Node.js 20+ and MongoDB 6+ (local or Atlas). If the local server enables
`security.authorization`, use an authenticated URI such as
`mongodb://<user>:<password>@127.0.0.1:27017/otion?authSource=admin`.

1. Configure the server:

```bash
cd server
cp .env.example .env      # set MONGO_URI and a long random JWT_SECRET
npm install
npm run migrate
npm run dev               # http://localhost:5000
```

2. Configure and start the client in another terminal:

```bash
cd client
cp .env.example .env      # defaults to http://localhost:5000
npm install
npm run dev               # http://localhost:5173
```

Environment variables:

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | server | API port (default `5000`) |
| `NODE_ENV` | server | `development` / `production` / `test` |
| `MONGO_URI` | server | MongoDB connection string |
| `JWT_SECRET` | server | JWT signing secret (required) |
| `CLIENT_URL` | server | Single allowed origin |
| `CLIENT_URLS` | server | Comma-separated allowed origins (takes precedence) |
| `TEST_MONGO_URI` | server | Isolated database for the integration suite |
| `SEED_PASSWORD` | server | Overrides the demo password used by the seed script |
| `VITE_API_URL` | client | REST base URL |
| `VITE_SOCKET_URL` | client | Socket.IO origin (empty = same origin) |

## Demo data

`server/scripts/seed.js` loads a repeatable demo workspace:

```bash
cd server
npm run seed        # or: SEED_PASSWORD='MyDemo123!' npm run seed
```

It removes any previous data for the three demo emails, then creates the accounts, an
`Otion Demo` workspace with guest memberships, seven notes (one archived, one published with a
public link), per-user favorites and ordering, revisions (including a named "Kickoff" version),
share permissions for all three roles, a comment with a mention, notifications, and a hashed public
token. The public link is printed at the end. Run it against a development database — it only
touches the demo accounts.

## Verification

```bash
cd server
npm test                        # integration tests (needs MongoDB; uses TEST_MONGO_URI)
npm run verify:backup -- --target mongodb://127.0.0.1:27017/otion_restore_check
npm run check                   # node --check server.js
npm audit --omit=dev

cd ../client
npm run lint
npm test                        # node:test unit tests
npm run test:e2e                # Playwright against a seeded database
npm run build
npm audit --omit=dev
```

`npm test` in `server/` uses `TEST_MONGO_URI` when configured and otherwise creates and drops a
uniquely named database on `MONGO_URI`. `npm run seed` and `npm run truncate` are the only scripts
that write to the configured database outside the test suite.

The suite auto-discovers `server/tests/*.test.js`: the API/socket integration file, plus coverage
for the migration runner (apply once, `--dry-run` writes nothing, `--check` fails while migrations
are pending, missing `MONGO_URI` fails), the demo seed (the documented graph, hashed public token,
and a second run that purges before rebuilding), the backup script (Extended JSON round trip that
preserves ObjectIds and dates, with `verify` comparing collection counts), and error tracking (inert
without a DSN, active with one, and a thrown Express error reaching a stand-in ingest endpoint).

`npm test` in `client/` runs the unit tests under `node --test`: markdown conversion, note statistics,
virtual-list windowing and browser error tracking (inert without a DSN, rejected malformed DSN, a
captured exception delivered to a stand-in ingest endpoint, and credentials scrubbed before sending).

`npm run test:e2e` in `client/` is a Playwright suite that drives a real browser against a real
stack: it migrates and seeds a dedicated `otion_e2e` database, starts the API on `:5000`, builds the
client and serves the production bundle on `:4173`. The specs cover the unauthenticated redirect,
demo sign-in, note creation plus autosave surviving a reload, and a password-protected public link
that renders read-only. Install Chromium once with `npx playwright install chromium`, and override
`E2E_MONGO_URI` when MongoDB needs credentials.

## Docker

The compose stack runs MongoDB, the API and an nginx-served client, with health-checked startup
ordering and `/api` + `/socket.io` proxying. Docker Compose v2+ is required (`docker compose`).

```bash
cp .env.example .env     # set JWT_SECRET (and CLIENT_URLS if needed)
docker compose up -d --build
docker compose exec server npm run migrate
docker compose exec -e CLIENT_URL=http://localhost:8080 server npm run seed   # optional demo data
```

Open <http://localhost:8080>. `docker compose down` stops the stack and keeps the Mongo volume.

The stack is verified locally: both images build, the health gates order startup mongo → server →
client, and the health probe, SPA deep links, login, Socket.IO handshake and public notes all work
through nginx. CI repeats the build and a smoke boot on every push (`.github/workflows/ci.yml`).

## Deployment

**API — Render**

- [`render.yaml`](render.yaml) declares the service: root directory `server`, region `singapore`,
  build `npm ci`, start `npm start`, health check `/api/health`, Node 22. The service already exists
  and deploys itself on every push to `main`, so the blueprint only matters if it has to be
  re-created; apply it with Render → Blueprints → New Blueprint Instance.
- Environment: `NODE_ENV=production`, `CLIENT_URLS=https://otion-nine.vercel.app`, plus `MONGO_URI`
  (Atlas) and `JWT_SECRET`. The secrets are `sync: false` in the blueprint, so Render prompts for
  them and they never enter the repository. `SENTRY_DSN` / `SENTRY_ENVIRONMENT` are optional and
  also `sync: false`. Because `render` v2.36 has no env-var command, variables are set in the
  dashboard or through the Render REST API (see *Operations → Error tracking*).
- Migrations are not run on boot. Production is at 13/13 (`MONGO_URI=... npm run migrate -- --check`
  exits 0); apply new ones with `npm run migrate` against the Atlas URI. The CI `deploy` job runs the
  `--check` gate so a release with a pending migration fails instead of serving a stale schema.
- The live service is configured exactly as the blueprint describes: `npm ci`, `npm start`, health
  check `/api/health`, region `singapore`, free plan. A health-check failure now triggers a Render
  restart instead of silently serving a half-broken instance.
- **Staging** is a second free Render service, `otion-api-staging`, tracking `main` with
  `MONGO_URI=.../otion_staging`, its own `JWT_SECRET`, and the same build/start/health settings. It
  sleeps when idle, so its first request after a pause takes up to a minute. Vercel preview builds
  from the `staging` branch use it through branch-scoped `VITE_API_URL` / `VITE_SOCKET_URL` values,
  while every other preview and production keep pointing at the production API.

**Client — Vercel**

- Root directory `client`, framework Vite, build `npm run build`, output `dist`.
- Production deploys come from the Vercel Git integration on pushes to `main`.
- Environment: `VITE_API_URL=https://otion-api.onrender.com/api`,
  `VITE_SOCKET_URL=https://otion-api.onrender.com`.
- Optional: `VITE_SENTRY_DSN` / `VITE_SENTRY_ENVIRONMENT` turn on browser error tracking (see
  *Operations → Error tracking*). Unset, the SDK is never downloaded.
- `client/vercel.json` rewrites every path to `index.html` for client-side routing.

## CI/CD

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull request:

1. **verify** — MongoDB service, server suite (API/socket integration, migration runner and seed
   script), server audit, client install, lint, unit tests, production build, client audit.
2. **e2e** — MongoDB service, Chromium via Playwright, then the browser suite against a freshly
   migrated and seeded stack; the report is uploaded when it fails.
3. **docker** — validates `docker-compose.yml`, builds both images, boots MongoDB + API + nginx and
   probes `/api/health` and the SPA through the client container.
4. **deploy** — on `main` only. Render and Vercel deploy the push themselves (Render `autoDeploy`
   plus the Vercel Git integration); Render redeploys only when the commit touches `server/`, while
   Vercel rebuilds on every `main` push. This job only fires the optional
   `RENDER_DEPLOY_HOOK_URL` / `VERCEL_DEPLOY_HOOK_URL` hooks — handy for re-deploying without a new
   commit — and then checks that the production API answers. When `PRODUCTION_MONGO_URI` exists it
   also runs `npm run migrate -- --check` against production, which fails the job if the deployed
   schema is behind the repository. Any absent secret makes its step log a skip instead of failing.

## Operations

**Uptime.** `.github/workflows/uptime.yml` probes `https://otion-api.onrender.com/api/health`
(asserting `status: ok` and `database: connected`) and the web app every 30 minutes. A failed probe
fails the run, which notifies the repository owner by email; the schedule also keeps the free Render
instance from sleeping through the working day. `/api/health` returns `503` whenever the database
disconnects, and Render restarts the service when its health check fails.

**Error tracking.** `server/config/monitoring.js` wraps Sentry and stays completely inert without
`SENTRY_DSN` — no account, no network calls, no events. Set the DSN and Express 5xx errors,
unhandled rejections and uncaught exceptions are reported, with `authorization`, `cookie`,
`set-cookie`, `x-api-key` and `x-csrf-token` headers stripped before sending and
`sendDefaultPii: false`.

Enable it in the Render dashboard (service → *Environment* → *Add Environment Variable*, for
[production](https://dashboard.render.com/web/srv-dbkpfrmk1f9s73dl9ne0/env) and staging), or script it
through the [Render REST API](https://api-docs.render.com/reference/update-env-var). The CLI cannot
do this — `render` v2.36 has no env-var subcommand, and `render services update` rejects
`--env-var`:

```bash
export RENDER_API_KEY='rnd_...'   # Account Settings → API Keys
SERVICE=srv-dbkpfrmk1f9s73dl9ne0  # srv-dbr1lptg1s2s73ap9kig for staging

curl -sS -X PUT "https://api.render.com/v1/services/$SERVICE/env-vars/SENTRY_DSN" \
  -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
  -d '{"value":"https://<key>@o<org>.ingest.sentry.io/<project>"}'

curl -sS -X PUT "https://api.render.com/v1/services/$SERVICE/env-vars/SENTRY_ENVIRONMENT" \
  -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
  -d '{"value":"production"}'   # "staging" on the staging service
```

Both return the stored `{key, value}`; `GET .../env-vars` lists what is set and `DELETE
.../env-vars/<KEY>` removes one. Any change triggers a redeploy, so the DSN takes effect once that
build finishes.

`SENTRY_RELEASE` tags events with a version, and `SENTRY_TRACES_SAMPLE_RATE` (default `0`) turns on
performance tracing. Tests stay silent even with a DSN exported, and a malformed DSN logs a warning
instead of stopping the API.

The browser is wired the same way. `client/src/services/monitoring.js` imports `@sentry/react` only
when `VITE_SENTRY_DSN` is set, so without a DSN the SDK is never downloaded — it stays in its own
lazy chunk and the entry bundle is unchanged (388.7 kB either way). `ErrorBoundary` reports render
errors and shows a reload screen instead of a blank page, and `beforeSend` strips
`authorization`/`cookie` headers and `token=`/`password=` query values before sending. Set the
variables in the Vercel project (Settings → Environment Variables) for production and previews; the
DSN is a public client key, so it is inlined into the bundle by design. Browser stack traces arrive
minified until source maps are uploaded — `@sentry/vite-plugin` with an auth token is the follow-up
if readable traces matter.

**Backups.** `.github/workflows/backup.yml` runs daily at 03:17 UTC (and on demand). It dumps every
production collection as Extended JSON, restores the archive into a scratch MongoDB service,
compares collection counts, and keeps the archive as a build artifact for seven days. There is no
dependency on `mongodump`:

```bash
cd server
MONGO_URI='<atlas uri>' npm run backup -- --out backups/otion.json.gz   # archive
npm run restore -- --in backups/otion.json.gz --target '<scratch uri>'  # replay it
npm run verify:backup -- --target '<scratch uri>'                       # dump, restore, compare
```

`restore` clears the target collections first, so it is repeatable, and `verify` exits non-zero on
any count mismatch — that is the restore drill. The dump preserves ObjectIds, dates and nested
types. Atlas' free tier has no point-in-time recovery, so this daily logical backup with seven-day
retention is the recovery story: anything older than a week is gone.

**Staging refresh.** `.github/workflows/staging-refresh.yml` runs weekly (and on demand) through
`npm run sync:staging`: it dumps production, rewrites emails, names, avatars, password hashes,
invitation tokens and public-share tokens, restores the result into staging (clearing its collections
first) and then checks that every collection still holds the same number of documents. Seeded demo
accounts keep their documented password so the demo login keeps working when they exist in the
source; every other account becomes `user-<id>@staging.otion.invalid` with the shared staging
password, and the run prints that address. Because production holds only real accounts, a refresh
leaves staging with generated logins and no `demo@otion.app` — run `npm run seed` against staging if
you want the demo graph back. The job needs a `STAGING_MONGO_URI` secret alongside
`PRODUCTION_MONGO_URI` and skips itself if either is missing.

```bash
cd server
PRODUCTION_MONGO_URI='<atlas uri>' STAGING_MONGO_URI='<staging uri>' npm run sync:staging
```

It refuses to run when source and target resolve to the same database, and it deletes both temporary
archives when it finishes (`--keep-archive` warns, because the first one is unscubbed). Note text is
copied as-is: staging holds real note content, only identities are rewritten.

**Load and soak testing.** `npm run loadtest` drives the real API with N virtual users. Each user
registers its own account, warms up with a few notes, then loops over list/get/create/update until
the deadline; the run reports throughput, p50/p95/p99 and the status mix, deletes the notes it created
(`--keep` to keep them) and exits non-zero when the error share exceeds `--max-error-rate`.

```bash
cd server
API_RATE_LIMIT=1000000 AUTH_RATE_LIMIT=100000 PORT=5050 npm start   # throwaway target
npm run loadtest -- --base http://127.0.0.1:5050 --users 10 --duration 20 --json load.json
```

Baseline measured on this machine (Node 26, one local `mongod`, throwaway `otion_load` database):

| Run | Requests | Throughput | p50 | p95 | p99 | Failures |
| --- | --- | --- | --- | --- | --- | --- |
| 20 s, fresh database | 4,631 | 231 req/s | 39.0 ms | 80.0 ms | 105.9 ms | 0 |
| 20 s, repeat | 4,913 | 245 req/s | 36.0 ms | 73.8 ms | 103.8 ms | 0 |
| 60 s soak | 10,568 | 176 req/s | 51.2 ms | 107.8 ms | 136.8 ms | 0 |

The soak run created notes faster than it read them, so its collection grew and its p95 rose; server
RSS moved 374 MB → 380 MB across those 10,568 requests, with no failure and no restart. That is a
laptop baseline, not a capacity plan — the free Render instance has a fraction of the CPU and sleeps
when idle. Defaults (500 API / 30 auth requests per 15 minutes) are the production ceilings; raise
`API_RATE_LIMIT` / `AUTH_RATE_LIMIT` on the target or the run measures the limiter rather than the API.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, the test matrix, the migration workflow and
the pull-request expectations. In short: add a numbered migration for schema changes, update
`docs/API.md` for contract changes, and keep `npm test`, lint, build and the audits green.

## License

[MIT](LICENSE) © 2026 Ram Panjwani.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `MONGO_URI and JWT_SECRET must be configured` | Copy `server/.env.example` to `server/.env` and set both |
| CORS error in the browser | Add the origin to `CLIENT_URLS` (comma-separated, no trailing slash) |
| Empty sidebar after cloning | Sign in and create a note, or run `npm run seed` |
| Socket connects then drops | The JWT expired or access was revoked; sign in again |
| `npm test` cannot reach MongoDB | Start MongoDB locally or set `TEST_MONGO_URI` |
