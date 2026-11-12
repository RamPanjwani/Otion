# Otion implementation memory

Last verified: 2026-11-13

This file records what exists, the contracts it exposes, and how it was verified. Deeper references:
[`Database.md`](./Database.md) (schema), [`API.md`](./API.md) (REST + Socket.IO), [`Phases.md`](./Phases.md)
(build history), [`Implementation-Plan.md`](./Implementation-Plan.md) (remaining roadmap).

## Delivered foundation

- [x] React 19 + Vite 8 + Tailwind 4 client with a responsive workspace shell (fixed 15 rem sidebar,
      collapsible to an icon rail on desktop, full-width drawer on mobile).
- [x] Express 5 API with Mongoose 9, Socket.IO 4, JWT/bcrypt authentication, Zod request validation,
      structured error envelope, Helmet, per-route rate limits, production CORS allowlist, and
      request logs with redacted authorization headers.
- [x] Registration with confirmation-password validation and optional invitation-token acceptance;
      bearer-token session handling with `INVALID_TOKEN` recovery on the client.
- [x] Account management: profile update, password change, JSON data export, password-confirmed
      account deletion with cascade cleanup and socket eviction.
- [x] Ordered MongoDB migration runner with 13 active migrations (`001`–`014`, `010` retired).
- [x] One personal workspace per account with owner/admin/member/guest memberships; workspace
      creation and switching are intentionally not exposed.
- [x] Demo seed script (`server/scripts/seed.js`, `npm run seed`) that is idempotent for its three
      demo accounts and creates a workspace, seven notes, shares across all roles, revisions,
      preferences, a comment with a mention, notifications, and a published public link.
- [x] Documentation set: PRD, Architecture, Database, API, Rules, Phases, Memory, Implementation
      Plan, plus root and per-package READMEs and env templates.

## Workspace, notes and navigation

- [x] `Workspace`, `WorkspaceMembership`, and `UserNotePreference` models; favorites, sidebar state
      and last-opened timestamps are per user.
- [x] Flat, user-specific ordering with drag handles and move controls, persisted through
      `PATCH /api/notes/reorder` and broadcast as `note-order`.
- [x] Notes are intentionally flat — no nesting, parent links, breadcrumbs or reparenting.
- [x] Owner-only multi-select archive with `PATCH /api/notes/archive-many`.
- [x] Trash view with restore, bulk restore, permanent delete, bulk delete and empty-trash
      (`/trash/restore-all`, `/trash/restore-many`, `/trash/delete-many`, `/trash/empty`); archiving
      affects only the selected notes.
- [x] Every note receives a default emoji; migration `013` backfilled existing notes and flattened
      legacy parent relationships.
- [x] Note covers were removed from the UI, persistence schema and revision snapshots by migration
      `014`.
- [x] Note duplication (backend contract plus editor action) into the caller's workspace.
- [x] Dashboard search across titles and block text with archived/favourite filters, debounced
      sidebar results and match previews.
- [x] Recently opened timestamps on dashboard cards and in the compact sidebar.

## Editor and collaboration

- [x] Stable-ID block editor with paragraphs, H1–H3, tasks, code, bullets, numbered lists, quote,
      callout and divider; external-URL image blocks. The validator also accepts `table` and `file`
      for forward compatibility, but the editor does not render them.
- [x] Conflict-safe inline formatting through native Yjs text attributes: bold, italic, underline,
      strike, inline code and links, with shortcuts, mark removal and safe URL rendering.
- [x] Slash commands, sanitized paste, heading shortcuts, emoji titles, 500 ms autosave, immediate
      manual save and `Ctrl/Cmd+S`.
- [x] Focus mode (`Ctrl/Cmd+Shift+F`), collapsed sidebar, small-text and full-width preferences,
      live word/character counts, and a scroll-aware table of contents.
- [x] Yjs incremental CRDT updates replace whole-document broadcasts; the server keeps a snapshot
      in `collaborationstates` plus an append-only `collaborationupdates` log (TTL 30 days) that is
      compacted into `notes.content`.
- [x] Restart recovery, reconnect state-vector merge, and JSON read-model compatibility for
      dashboard, search, revisions and public pages.
- [x] Socket JWT authentication, per-update permission checks, presence avatars, normalized moving
      pointers, block-relative selections and immediate role/revocation enforcement.
- [x] Session-local undo/redo.

## History, sharing and discovery

- [x] `NoteRevision` history with throttled automatic snapshots, named manual versions, timeline UI,
      protected restore and pre-restore preservation (restores are themselves versioned).
- [x] Sharing with editor/commenter/viewer roles, user search autocomplete, role changes, revocation
      and instant dashboard discovery.
- [x] Secure seven-day pending invitations for unregistered emails with hashed acceptance tokens,
      copyable links, registration-time acceptance and owner revocation.
- [x] Public access exists only after the owner publishes: 256-bit random tokens, SHA-256 hashes at
      rest, optional bcrypt password and expiry, token rotation on republish, and identical generic
      `404` responses for disabled/malformed/expired/unknown tokens.
- [x] A note ID can never substitute for a public token.
- [x] Page comments with collaborator `@email` mentions, resolve/reopen, realtime refresh via
      `comments-sync`, and share/comment/mention notifications with an in-app feed.

## Current API contracts

Authoritative detail, including payloads and status codes, is in [`API.md`](./API.md).

### Authentication and account — `/api/auth`

- `POST /register`, `POST /login`, `GET /me`
- `PATCH /profile`, `PATCH /password`, `GET /export`, `DELETE /account`

### Workspaces — `/api/workspaces`

- `GET /` (the only workspace route)

### Notes — `/api/notes`

- `GET /?archived=&workspaceId=`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `PATCH /:id/archive`, `PATCH /:id/restore`, `PATCH /:id/preferences`
- `POST /:id/duplicate`
- `PATCH /reorder`, `PATCH /archive-many`
- `DELETE /trash/empty`, `PATCH /trash/restore-all`, `DELETE /trash/delete-many`,
  `PATCH /trash/restore-many`
- `GET /:id/revisions`, `POST /:id/revisions`, `POST /:id/revisions/:revisionId/restore`

### Sharing and public reads

- `GET /api/share/users/search?q=`
- `POST /api/share/:noteId/invite`
- `GET /api/share/:noteId/collaborators`
- `PATCH|DELETE /api/share/:noteId/user/:userId`
- `DELETE /api/share/:noteId/invitation/:invitationId`
- `PATCH /api/share/:noteId/public`
- `GET /api/public/:token`, `POST /api/public/:token/unlock`

### Search, comments, notifications, health

- `GET /api/search?q=&workspaceId=&archived=&favorite=`
- `GET|POST /api/comments/note/:noteId`, `PATCH /api/comments/:id/resolve`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read` (`:id` may be `all`)
- `GET /api/health`

### Realtime protocol

- Room/access: `join-note`, `leave-note`, `permission-changed`, `access-revoked`
- CRDT: `collab-sync`, `collab-update`, `collab-error`
- Awareness: `presence-update`, `cursor-move`, `selection-change`
- Navigation/data: `note-sync`, `note-remove`, `note-order`, `document-saved`
- Social: `comments-sync`, `notification`, `account-deleted`

## Delivery and operations

- [x] GitHub Actions `verify` job: MongoDB service, server syntax check, server suite (API/socket
      integration, migration runner, demo seed), server audit, client lint, unit tests, production
      build and client audit.
- [x] GitHub Actions `docker` job: `docker compose config --quiet`, both image builds, stack boot
      (MongoDB + API + nginx-served client) and `/api/health` plus SPA smoke probes through nginx.
- [x] GitHub Actions `deploy` job on `main`: optional Render and Vercel deploy hooks, followed by a
      production `/api/health` wait loop.
- [x] `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile` and a client `nginx.conf` that
      serves the SPA with history fallback and proxies `/api/` and `/socket.io/` to `server:5000`.
- [x] Root `.env.example` documenting the compose `JWT_SECRET` and `CLIENT_URLS`.
- [x] `render.yaml` blueprint for the API (root `server`, `npm ci` / `npm start`, health
      `/api/health`, Node 22, `MONGO_URI` and `JWT_SECRET` declared `sync: false`).
- [x] `LICENSE` (MIT) and `CONTRIBUTING.md` (setup, test matrix, migration and PR workflow).
- [x] Render hosts the API and Vercel the client; `https://otion-api.onrender.com/api/health`
      reports `{"status":"ok","database":"connected"}` and `https://otion-nine.vercel.app` serves the app.
- [x] Live Render settings corrected through the CLI: build `npm ci`, start `npm start`, health check
      `/api/health`, region `singapore`, plan free (`render services update`).
- [x] Staging: Render service `otion-api-staging` on `main` with the `otion_staging` Atlas database and
      its own JWT secret; Vercel branch-scoped preview variables keep production secrets untouched.
- [x] Backups: `server/scripts/backup.js` (Extended JSON archives, restore, verify) plus the daily
      `backup.yml` workflow, which restores its own archive into a scratch MongoDB before keeping it.
- [x] Uptime: `uptime.yml` probes the production API health and the web app every 30 minutes.
- [x] `PRODUCTION_MONGO_URI` is stored as a GitHub Actions secret so the deploy job can gate releases
      on pending migrations.

## Verification status (2026-11-12, local MongoDB 8.3 + Docker 29.9)

- Client ESLint: **passing, zero errors** after fixing six real violations (unused imports in
  `ShortcutsModal` and `PublicNote`, empty catch blocks in `useCollaborativeNote`, and the
  Fast-Refresh context split into `context/ToastContextInstance.js`).
- Client unit tests: **5 passing** (`node --test`).
- Client production build: **passing** on Vite 8 (~385 ms, route-level chunks).
- Server syntax checks: **passing** for `server.js` and `scripts/seed.js`.
- Migrations: all **13 active migrations applied** to a local authenticated MongoDB (`001`–`009`,
  `011`–`014`) with the `_migrations` ledger at 13 entries.
- Server integration suite: **4/4 passing** (~10.6 s) against a real MongoDB — security headers and
  validation, note authorization/sharing/public privacy/socket revocation, unauthenticated socket
  rejection, and profile/password/export/account deletion.
- Demo seed: **executed twice** against the local database. Each run removed the previous 3 demo
  accounts and 8 notes, then recreated them, proving idempotency. Verified through the API:
  7 visible notes in personal order (0–5 plus the shared note at 7), 1 archived, 1 published,
  3 users, 1 workspace, 3 memberships, 7 share permissions, 8 preferences, 9 revisions,
  1 comment with a mention, 2 notifications and 1 public share.
- Public link: seeded token returns `200` with `title`/`content`/`icon`/`updatedAt` only; an invalid
  token returns `404`; no note ID is accepted as a token.
- Docker: `docker compose config --quiet` passes, both images build (`server` 268 MB, `client`
  74.8 MB), and `docker compose up -d --build` booted mongo → server → client through the compose
  health gates. Migrations and the seed ran inside the server container; through nginx on `:8080`
  the health probe, SPA root and deep-link fallback, login, Socket.IO polling handshake (with a
  `websocket` upgrade advertised) and the public note all returned `200`, and the client container
  reported `healthy`. The stack was then torn down with `docker compose down`.
- Production smoke check: API health `200` with connected database; client root `200`.

## Verification status (2026-11-13)

- CI test-script fix: `node --test --test-concurrency=1 tests` failed on Node 20/22 with
  `MODULE_NOT_FOUND` (a directory argument is not supported there) while passing on Node 26. The
  script now relies on auto-discovery; the suite was re-run successfully on Node 20, 22 and 26.
- Automated migration coverage: the runner applies every on-disk migration exactly once, writes a
  unique `_migrations` ledger with timestamps, skips already-applied migrations on a second run,
  records nothing under `--dry-run`, and exits non-zero with `MONGO_URI must be configured` when the
  variable is absent.
- Automated seed coverage: one run from an empty database produces the documented graph (3 accounts
  with hashed passwords, 1 workspace, 8 notes — 1 archived, 1 published, all `contentSchemaVersion`
  3 —, 3 memberships, 7 share permissions, 8 preferences at sort orders 0–7 with 2 favorites,
  9 revisions, 1 comment with a mention, 2 notifications, 1 enabled public share whose printed token
  hashes to the stored SHA-256 value). A second run reports `Removed previous demo data: 3 account(s),
  8 note(s)` and leaves exactly one workspace and the same counts.
- Server suite: **15/15 passing** locally (4 API/socket + 4 migration + 1 seed + 1 backup round trip
  + 5 monitoring, ~25 s) against a real MongoDB; the API file was also re-run green after the
  Mongoose upgrade.
- Dependency audit: `npm audit --omit=dev` is **clean** in both packages after bumping `mongoose` to
  `^9.12.1` (four advisories, including prototype pollution via `Schema.prototype.virtual()`).
- `render.yaml` parses as valid YAML; it now pins the live service's root (`server`), region
  (`singapore`), start command, free plan and Node 22, and proposes `npm ci` plus an `/api/health`
  health check that the dashboard does not have yet (it builds with `npm install` and has no health
  check path, so a Blueprint sync would tighten, not break, the service).
- Delivery verified end to end on the providers after pushing `06bd601`: CI run `43284354037` went
  green on all three jobs (server 8/8 and client 5/5 on Node 22, container smoke, deploy probe),
  Render deployed that commit (`dep-dbr0lt17lnhs73egi0k0`, `trigger: new_commit`) to `live` in 38 s,
  and Vercel built production deployment `otion-klgjdhers` (`Ready`, 7 s). Both platforms deploy
  themselves from the GitHub integration, so `RENDER_DEPLOY_HOOK_URL` / `VERCEL_DEPLOY_HOOK_URL`
  remain unset and their CI steps only log a skip. A docs-only follow-up (`f7bf38b`) correctly
  produced no Render deploy — the service's root directory is `server/`, so Render ignores commits
  outside it — while Vercel rebuilt it; CI stayed green (run `43286866630`).
- Browser coverage added: a Playwright suite in `client/e2e/` boots the stack itself (migrate + seed
  into `otion_e2e`, API on `:5000`, production client build on `:4173`) and exercises the
  unauthenticated redirect, demo sign-in, invalid credentials, note creation with autosave across a
  reload, and a password-protected public link that renders read-only. **5/5 passing locally**
  (~19 s); CI runs the same suite in a dedicated `e2e` job.
- Migration safety: the runner gained `--check`, a dry run that exits non-zero while migrations are
  pending, covered by a fourth migration test. The deploy job runs it against production whenever
  `PRODUCTION_MONGO_URI` is configured, so a release fails instead of serving an outdated schema.
- CI hygiene: `actions/checkout` and `actions/setup-node` moved to `v5`, clearing the Node 20
  deprecation annotation; the deploy job now checks out the repository so it can run the check.
- Production schema verified against Atlas: the app database is `test` (a URI with no database path
  resolves there), all **13 migrations** are recorded, and `npm run migrate -- --check` exits 0.
- Restore drill against real production data: **17 collections / 34 documents** dumped from Atlas,
  replayed into a scratch local database, and every collection count matched the source.
- Staging verified live: `https://otion-api-staging.onrender.com/api/health` returns
  `{"status":"ok","database":"connected"}` against `otion_staging`, which also carries all 13
  migrations. The production service reports build `npm ci` and health check `/api/health`.
- Monitoring and backups are code, not dashboards: `uptime.yml` (30-minute probes) and `backup.yml`
  (daily dump plus restore comparison) run on GitHub Actions, because no error-tracking provider was
  available to integrate and Atlas' free tier keeps no snapshots. Both were dispatched manually and
  passed: uptime run `43296778996` (6 s), backup run `43296772570` (52 s, artifact uploaded).
- Staging was exercised through its public API: registration `201`, sign-in token issued, note create
  `201`, and the probe row appeared in `otion_staging` while production stayed untouched (the probe
  was then deleted). Render auto-deploys staging from `main` (`bf628d5` live); Vercel previews of the
  `staging` branch are behind deployment protection and build with the branch-scoped staging URLs.
- Error tracking is opt-in: `server/config/monitoring.js` initialises Sentry only when `SENTRY_DSN` is
  present (never under `NODE_ENV=test`), captures Express 5xx errors through `expressIntegration`,
  and scrubs `authorization`/`cookie`/`set-cookie`/`x-api-key`/`x-csrf-token` in `beforeSend`. Five
  tests cover the inert default, DSN activation, test silence, a malformed DSN and a real Express
  error delivered to a stand-in ingest endpoint. `render.yaml`, `server/.env.example` and the readme
  document the DSN; the live services do not have one yet, so nothing is reported today.
- Render environment variables cannot be set from the CLI: `render` v2.36 rejects `--env-var` and
  `render services update` only covers build/start/branch/plan settings. The supported paths are the
  dashboard and the REST API — `PUT /v1/services/<id>/env-vars/<KEY>` with `{"value": "..."}` returns
  `200` and the stored key, `DELETE` returns `204`. Both were exercised against staging with a
  throwaway key that was then removed, leaving `JWT_SECRET`, `MONGO_URI`, `CLIENT_URLS`, `NODE_ENV`;
  production holds `CLIENT_URL`, `JWT_SECRET`, `MONGO_URI`, `NODE_ENV`. An env-var write triggers a
  redeploy, so the docs point at the API rather than a flag that does not exist.
- The staging refresh has run against production: workflow run `43306045359` copied 34 documents in
  17 collections into `otion_staging`, scrubbed 3 accounts and verified the collection counts.
  Production contains no seeded demo accounts, so staging now has no `demo@otion.app` — only
  `user-<id>@staging.otion.invalid` logins with `OtionStaging123!`, which was confirmed by signing in
  to the staging API (`200`, token issued). Note text is copied as-is; only identities are rewritten.
- Browser error tracking mirrors the server: `client/src/services/monitoring.js` imports
  `@sentry/react` lazily and only when `VITE_SENTRY_DSN` is set, so without a DSN the SDK sits in an
  unused 454 kB chunk that is never requested (the entry bundle measures 388.7 kB either way). The
  browser SDK does not throw on a malformed DSN — it logs and keeps a disabled client — so the module
  validates the DSN shape itself and reports `false`, matching the server. Five client tests cover the
  inert default, rejection of a bad DSN, delivery of a captured exception to a local sink, and
  credential/token scrubbing. `components/ErrorBoundary.jsx` now catches render errors instead of
  leaving a blank page.
- CI after the operations work: run `43297308350` green on all four jobs (verify 1m5s, browser E2E
  1m21s, container smoke 46 s, deploy 12 s with the production migration check), and the remaining
  annotation is only GitHub's `ubuntu-latest` → Ubuntu 26 migration notice.

## Remaining roadmap

Not implemented: multi-block drag/selection; automated invitation and notification email delivery;
threaded/block-targeted comment UI; forgot-password, email verification and active-session
management; refresh-token rotation; full accessibility audit and screen-reader pass; server-side
pagination/virtualization; Atlas Search deployment configuration; point-in-time recovery (paid Atlas
tier). Staging, uptime monitoring, a daily restore drill, a load/soak harness with a recorded local
baseline and the weekly scrubbed staging refresh are now delivered.
See `Implementation-Plan.md` for sequencing.
