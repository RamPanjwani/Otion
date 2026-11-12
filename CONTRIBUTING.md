# Contributing to Otion

Thanks for helping improve Otion. This guide covers the local workflow and the checks CI enforces.
Read [`docs/Rules.md`](docs/Rules.md) before changing the data model, the API surface or the UI
system — it records the approved libraries and conventions.

## Prerequisites

- Node.js 20 or newer (CI and the Docker images use Node 22).
- MongoDB 6 or newer, local or Atlas. With authorization enabled use an authenticated URI such as
  `mongodb://<user>:<password>@127.0.0.1:27017/otion?authSource=admin`.
- Docker with Compose v2+ only if you are working on the container setup.

## Set up

```bash
cd server
cp .env.example .env      # set MONGO_URI and a long random JWT_SECRET
npm install
npm run migrate           # apply migrations to the configured database
npm run seed              # optional: demo accounts, notes, shares and a public link
npm run dev               # http://localhost:5000
```

```bash
cd client
cp .env.example .env      # VITE_API_URL / VITE_SOCKET_URL
npm install
npm run dev               # http://localhost:5173
```

`server/.env` is never committed. Keep `MONGO_URI` for development and point `TEST_MONGO_URI` at a
database you are willing to have dropped, because the suite deletes its own uniquely named databases.

## Tests

```bash
cd server
TEST_MONGO_URI='mongodb://127.0.0.1:27017' npm test   # node --test, auto-discovers tests/
```

The server suite contains four files:

| File | Covers |
| --- | --- |
| `tests/api.integration.test.js` | Registration/login, authorization matrix, sharing, public links, revisions, comments, sockets and account lifecycle |
| `tests/migrations.test.js` | The runner applies each migration once, `--dry-run` records nothing, and a missing `MONGO_URI` fails |
| `tests/seed.test.js` | The seeded graph matches the docs and a second run purges and rebuilds it without duplicates |
| `tests/*.test.js` | Discovered automatically — put new suites here so CI picks them up |

Client checks:

```bash
cd client
npm run lint
npm test          # node:test unit tests
npm run build
```

Both packages are also scanned in CI with `npm audit --omit=dev --audit-level=critical`. Fix
advisories by upgrading the dependency; do not lower the threshold.

## Database changes

Add a numbered file to `server/migrations/` (`015-your-change.js`) exporting `id`, `description` and
an `up({ mongoose, dryRun })` function, then run `npm run migrate`. Migrations run in filename order
and are recorded in the `_migrations` ledger, so never edit or renumber one that has shipped — write a
new one. Update [`docs/Database.md`](docs/Database.md) in the same change.

## API changes

Update [`docs/API.md`](docs/API.md) whenever a route, payload, status code, error code, rate limit or
Socket.IO event changes, and add or extend an assertion in `tests/api.integration.test.js`.

## Commit and pull request workflow

1. Branch from `main`.
2. Keep commits focused and use conventional subjects (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
3. Make sure `npm test` (server and client), `npm run lint`, `npm run build` and the audits pass.
4. Open a pull request describing the behavior change; CI runs `verify` and `docker` on every pull
   request, and `deploy` only on `main`.
5. Update `docs/Memory.md` when you complete or remove a documented feature.

## Containers

```bash
cp .env.example .env       # root env: JWT_SECRET and CLIENT_URLS for compose
docker compose up -d --build
docker compose exec server npm run migrate
docker compose logs -f server
docker compose down        # keeps the MongoDB volume
```

## Reporting security issues

Please do not open a public issue for a vulnerability. Contact the maintainer privately with the
affected route or component, reproduction steps and impact.
