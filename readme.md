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

The API runs on Render (Node), the client is a static Vite build on Vercel, and data lives in MongoDB
Atlas. CORS accepts `oton-nine`-style Vercel origins, `localhost`, and anything listed in
`CLIENT_URLS`.

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
are pending, missing `MONGO_URI` fails) and the demo seed (the documented graph, hashed public token,
and a second run that purges before rebuilding).

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
  (Atlas) and `JWT_SECRET`. The two secrets are `sync: false` in the blueprint, so Render prompts for
  them and they never enter the repository.
- Migrations are not run on boot. Run `npm run migrate` once against the production database (Render
  shell or locally with the Atlas URI); a `preDeployCommand` would automate it but needs a paid instance.

**Client — Vercel**

- Root directory `client`, framework Vite, build `npm run build`, output `dist`.
- Production deploys come from the Vercel Git integration on pushes to `main`.
- Environment: `VITE_API_URL=https://otion-api.onrender.com/api`,
  `VITE_SOCKET_URL=https://otion-api.onrender.com`.
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
