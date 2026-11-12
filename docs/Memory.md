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
- Server suite: **8/8 passing** locally (4 API/socket + 3 migration + 1 seed, ~14 s) against a real
  MongoDB; the API file was also re-run green after the Mongoose upgrade.
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
  remain unset and their CI steps only log a skip.

## Remaining roadmap

Not implemented: multi-block drag/selection; automated invitation and notification email delivery;
threaded/block-targeted comment UI; forgot-password, email verification and active-session
management; refresh-token rotation; full accessibility audit and screen-reader pass; server-side
pagination/virtualization; staging environment, monitoring, backups and load/restore drills; Atlas
Search deployment configuration. See `Implementation-Plan.md` for sequencing.
