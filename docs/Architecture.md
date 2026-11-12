# Architecture & Application Flow — Otion

This document describes the deployed system, its modules and the main runtime flows. The data model
lives in [`Database.md`](./Database.md) and every HTTP/socket contract in [`API.md`](./API.md).

## 1. Deployment topology

```text
                    +----------------------------------+
                    |   Browser (desktop / mobile)     |
                    |   React 19 SPA, Yjs in-memory    |
                    +----------------+-----------------+
                                     |
                     HTTPS / WSS     |  VITE_API_URL, VITE_SOCKET_URL
                                     v
   +-----------------------------+      +-------------------------------+
   |  Vercel (static client)     |      |  Render (Node service)        |
   |  Vite build -> dist/        |      |  Express 5 + Socket.IO 4      |
   |  SPA rewrite -> index.html  |      |  Yjs server-side documents    |
   +-----------------------------+      +---------------+---------------+
                                                         | Mongoose 9
                                                         v
                                        +-------------------------------+
                                        |  MongoDB Atlas                |
                                        |  13 collections + _migrations |
                                        +-------------------------------+

   Staging (same code, separate data):
     Render  otion-api-staging  ->  Atlas  otion_staging   (Vercel previews of `staging`)

   Docker (local / self-hosted): docker compose up -> mongo + api + nginx(client)
   Docker (CI): images built and smoke-tested on every push
```

| Tier | Technology | Notes |
| --- | --- | --- |
| Client | React 19.2, Vite 8.2, Tailwind CSS 4.3, React Router 7, Axios, Motion, Yjs 13, Socket.IO client, Zod | Route-level code splitting; production `dist/` served by Vercel or nginx |
| API | Node.js 20+, Express 5.2, Socket.IO 4.8, JWT, bcryptjs, Helmet, express-rate-limit, pino-http, Zod | Single process hosts REST and WebSocket traffic |
| Data | MongoDB with Mongoose 9.9 | Hashed tokens, text index, TTL log, ordered migrations |
| Collaboration | Yjs CRDT | Updates over authenticated sockets, snapshots plus compacted update log |
| Delivery | GitHub Actions, Render, Vercel, Docker Compose | `verify`, `e2e`, `docker`, `deploy` jobs plus scheduled backup and uptime workflows |
| Operations | Render health checks, GitHub Actions cron, logical backups, Sentry (opt-in) | Health-gated restarts, 30-minute probes, daily restore drill, DSN-gated error reporting |

## 2. Request flows

### 2.1 Authentication

```text
[Login form] --POST /api/auth/login--> [authController]
                                            | bcrypt.compare
                                            v
[AuthContext] <-- {user, token} ----- JWT signed with JWT_SECRET
      |
      +--> token in localStorage/sessionStorage
      +--> axios interceptor adds Authorization: Bearer <token>
      +--> socket.io handshake auth: { token }
```

Registration creates the personal workspace and membership in the same request. A pending invitation
token passed to `/register` is verified by hash, converted into a share permission (plus a guest
workspace membership) and marked accepted.

### 2.2 Editing and autosave

```text
[Editor] --local edit--> Y.Doc (blocks array, Y.Text per block)
     |
     | doc update (origin = local, 500 ms autosave)
     +--> socket.emit('collab-update', { noteId, update })
     |         |
     |         v
     |    [collaborationService.applyUpdate]
     |         | Y.applyUpdate
     |         | $inc collaborationstates.lastSequence
     |         | append collaborationupdates document
     |         | 750 ms debounce -> compact()
     |         v
     |    notes.content replaced, snapshot written, old updates deleted
     |
     +--> PUT /api/notes/:id (title, icon, explicit save)
               | permission check (owner/editor)
               | recordRevision (throttled automatic, manual always)
               | 'document-saved' + 'note-sync' broadcasts
```

`Note.content` remains the JSON read model consumed by the dashboard, search, revisions and public
pages; the CRDT snapshot is the write-through source for concurrent editing.

### 2.3 Realtime join and permission enforcement

```text
socket.connect(auth.token) -> io.use(): verify JWT, load user, join user:<id>
socket.emit('join-note', {noteId})
      -> roleForNote(noteId, userId)                  // owner | editor | commenter | viewer | null
      -> null: 'access-revoked'
      -> role: join note:<id>, add to presence map
                emit 'permission-changed' {role}
                emit 'collab-sync' {update, stateVector, sequence}
                broadcast 'presence-update'
```

Every `collab-update` re-checks the role and that the socket has joined that note; only `owner` and
`editor` may write. Revoking access or unpublishing emits `access-revoked`, removes the socket from
the room and updates presence. Changing a role emits `permission-changed`, so a downgraded editor's
next update is rejected without a reconnect.

### 2.4 Public read

```text
GET /api/public/:token
   -> SHA-256(token) lookup in publicshares (enabled, unexpired)
   -> bcrypt password check when a password hash exists
   -> note read: isPublished && !isArchived
   -> {title, content, icon, updatedAt}
```

Tokens are 256-bit `base64url` values; only hashes are stored. Republishing rotates the token.

## 3. Client module map

```text
client/src
├── App.jsx                  Route table (lazy) + protected routes
├── main.jsx                 Providers: Auth, Theme, Toast; Router
├── components/              Editor, Sidebar, Navbar, Modal, ShareModal, SearchCommand,
│                            CommentsModal, VersionHistoryModal, NotificationsPopover,
│                            ShortcutsModal, PageStyleControls, NoteViewMenu, Loading, …
├── context/                 AuthContext, ThemeContext, ToastContext (+ *Instance.js value files)
├── hooks/                   useAuth, useTheme, useToast, useNotes, useCollaborativeNote,
│                            useVirtualList, useDebouncedEffect, useDocumentTitle
├── pages/                   Home, Login, Register, Dashboard, NoteEditor, Trash, Settings, PublicNote
├── services/api.js          Axios instance, token header, INVALID_TOKEN handling
├── services/socket.js       Socket.IO singleton
├── utils/                   Formatting and block helpers
└── index.css                Tailwind 4 theme tokens, shared component classes
```

State strategy: React Context for cross-cutting state (session, theme, toasts) and custom hooks for
feature state. No Redux/Zustand by design (`Rules.md`). `*Instance.js` files hold context objects so
component files export only components and stay Fast-Refresh compatible.

## 4. Server module map

```text
server
├── server.js                Express app, security middleware, routers, Socket.IO handlers
├── config/db.js             Mongoose connection
├── config/cors.js           CLIENT_URLS/CLIENT_URL allowlist + Vercel/localhost rules
├── middleware/              authMiddleware (protect, optionalAuth), validate (Zod),
│                            security (rate limiters), errorMiddleware (uniform envelope)
├── routes/                  auth, note, share, workspace, public, search, comment, notification
├── controllers/             Request handling and permission checks
├── services/                workspaceService, revisionService, collaborationService
├── models/                  13 Mongoose schemas
├── validation/schemas.js    Auth, note, revision and sharing Zod schemas
├── migrations/              runner.js + migrations 001–014 (010 retired)
├── scripts/                 seed.js, truncateDb.js
└── tests/                   api.integration.test.js (node:test + supertest)
```

Responsibilities are layered: routes only wire middleware and controllers; controllers own
authorization and persistence calls; services own cross-cutting domain logic (workspace creation,
revision numbering, CRDT lifecycle); models own schema and indexes.

## 5. Access control

```text
effective role = owner        when note.user == requester
               = share role   when a sharepermissions row exists
               = none         otherwise (404 on concealed reads, 403 on known-resource writes)
```

| Role | Read | Realtime write | REST write | Comment | Resolve | Share/archive |
| --- | --- | --- | --- | --- | --- | --- |
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Commenter | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Public token holder | ✅ read-only | ❌ | ❌ | ❌ | ❌ | ❌ |

Workspace roles (`owner`, `admin`, `member`, `guest`) gate note creation and membership. `admin` and
`member` are reserved for future collaborative workspaces; today registrations create an `owner`
membership and sharing adds `guest` memberships.

## 6. Security controls

1. **Transport & headers** — HTTPS/WSS in production, Helmet, `x-powered-by` disabled, `trust proxy`
   set on Render so rate limits see client IPs.
2. **CORS** — explicit allowlist from `CLIENT_URLS`/`CLIENT_URL`, wildcard subdomain support, plus
   the project's Vercel preview pattern and localhost.
3. **Authentication** — bcrypt (cost 12) with `select: false`, JWT verification on every protected
   route and socket handshake, generic `INVALID_TOKEN` responses.
4. **Authorization** — role resolution on every read and write, concealed `404`s for note reads,
   owner-only management routes, immediate eviction on revocation.
5. **Input validation** — Zod schemas for bodies, params and queries; 1 MB JSON limit; 256 KB cap on
   CRDT updates; 10 000-block and 100 000-char limits; regex-escaped search input.
6. **Secrets at rest** — public-link and invitation tokens stored as SHA-256 hashes, link passwords
   as bcrypt hashes, no object uploads (image blocks reference external HTTPS URLs).
7. **Abuse control** — per-IP limits on all routes, auth routes and public unlock; pino-http logs
   with authorization/cookie redaction and request IDs.
8. **Error hygiene** — one envelope, masked 5xx messages in production, no stack traces outside
   development.

## 7. Delivery pipeline

| Stage | What happens |
| --- | --- |
| Pull request | `verify`: server tests (API/socket, migrations, seed) + audit, client lint + unit tests + build + audit |
| Browser pass | `e2e`: Playwright runs the seeded stack in a real browser (sign-in, autosave, public link) |
| Image build | `docker`: compose config validation, both images built, stack booted, health + SPA smoke test |
| Merge to `main` | Render redeploys when the commit touches `server/`, Vercel rebuilds every push; the `deploy` job re-triggers optional hooks, probes production health and fails on pending production migrations |
| Runtime | API `/api/health` reports database readiness; Render restarts on a failed health check and serves the app |
| Backups | `backup.yml` dumps production daily, restores the archive into a scratch MongoDB, compares collection counts and keeps it for seven days |
| Uptime | `uptime.yml` probes the API health endpoint and the web app every 30 minutes and fails loudly |
| Errors | `config/monitoring.js` initialises Sentry only when `SENTRY_DSN` is set; Express 5xx errors, unhandled rejections and uncaught exceptions are reported with sensitive headers stripped |
| Staging | `otion-api-staging` runs `main` against the `otion_staging` database; Vercel previews from the `staging` branch point at it |

Migrations are applied explicitly (`npm run migrate`), never automatically on boot, so a deploy
cannot silently mutate production data. The API service itself is described in `render.yaml`
(root `server`, region `singapore`, `npm ci` / `npm start`, health `/api/health`, Node 22); `MONGO_URI`
and `JWT_SECRET` are declared `sync: false` so their values stay in the Render dashboard. The client
remains a Vercel static build described by `client/vercel.json`. Both providers watch `main`
themselves, so a push deploys without any CI credential.

## 8. Known limitations

- JWT-only sessions: no refresh-token rotation, server-side revocation list or active-session UI.
- Invitations are links; no transactional email delivery yet.
- Notes are listed without pagination or virtualization on the API side.
- Browser coverage is a five-spec Playwright smoke suite, not an exhaustive matrix of every editor or sharing path.
- Atlas' free tier offers no point-in-time recovery; recovery relies on the daily logical backup and its seven-day artifact retention.
- The staging API runs on the free plan, so it sleeps when idle and its first request can take a minute.
- No load or soak testing has been run against production.
- Error tracking depends on an external Sentry project; without `SENTRY_DSN` the API logs structured errors only.
- `table` and `file` block types are accepted by the validator but not rendered by the editor.
- Workspace roles beyond `owner`/`guest` are reserved and have no management API.
