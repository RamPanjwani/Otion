# Build Phases — Otion Workspace

The phases that produced the current product, recorded as built. Each phase lists what shipped and
how it was verified. Schema details are in [`Database.md`](./Database.md), contracts in
[`API.md`](./API.md), and runtime structure in [`Architecture.md`](./Architecture.md).

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation, auth, design system | Complete |
| 2 | Workspace shell, notes API, flat navigation | Complete |
| 3 | Block editor and formatting | Complete |
| 4 | Realtime collaboration (Yjs) | Complete |
| 5 | Permissions, sharing, public links | Complete |
| 6 | Trash, search, revisions, comments, notifications | Complete |
| 7 | Delivery: seed, docs, CI containers, deploy hooks | Complete |

---

## Phase 1 — Foundation, infrastructure and authentication

**Delivered**

- `server/server.js` Express app with Helmet, CORS allowlist (`CLIENT_URLS`/`CLIENT_URL` plus the
  project's Vercel preview pattern and localhost), JSON body limit, rate limiters, request logging
  and the shared error middleware.
- `server/config/db.js` Mongoose connection; `User` model with bcrypt hashing and `select: false`
  password; `utils/generateToken.js`; `middleware/authMiddleware.js` (`protect`).
- `authController` and `/api/auth` routes: register (with optional invitation token), login, profile,
  password change, JSON export and account deletion.
- Zod validation for every auth body with field-level `details`.
- Client foundation: `services/api.js` axios instance with bearer header and `INVALID_TOKEN`
  recovery, `AuthContext` + `useAuth`, `Login` and `Register` pages with inline validation.
- Design system: Tailwind 4 semantic tokens (light/dark), Inter typography, Motion transitions with
  reduced-motion support, Lucide icon normalization.

**Verified by** auth integration tests, lint/build, and manual sign-in of the three seeded roles.

## Phase 2 — Workspace shell, notes API and flat navigation

**Delivered**

- `Note` model with `title`, `icon`, `content` (schema version 3), `revisionCounter`, `user`,
  `workspace`, `isArchived`, `isPublished`.
- `Workspace`, `WorkspaceMembership` and `UserNotePreference` models; personal workspace created on
  registration; memberships as `owner` plus `guest` rows for collaborators.
- `/api/notes` CRUD, archive/restore, per-user preferences and duplicate; `PATCH /reorder` for
  personal ordering; owner-only `PATCH /archive-many`.
- Fixed `Sidebar` (15 rem, collapsible rail) with favorite/recent sections, `Navbar`, `Dashboard`
  cards, `Trash` view and route-level code splitting.
- Flat information architecture: no nesting, breadcrumbs or parent relationships; ordering is a
  user preference.

**Verified by** flat-ordering and archive/restore integration tests plus dashboard manual checks.

## Phase 3 — Block editor

**Delivered**

- `components/Editor.jsx`: stable-ID blocks for paragraph, H1–H3, bullet, numbered, task, quote,
  callout, divider, code and external-URL images.
- Inline marks stored as Yjs text attributes: bold, italic, underline, strike, inline code and links,
  with keyboard shortcuts, mark removal and safe URL rendering.
- Slash command palette, sanitized paste, markdown-style heading shortcuts, task toggles, block
  insertion/deletion, and a scroll-aware table of contents.
- Autosave after 500 ms of idle typing, immediate manual save and `Ctrl/Cmd+S`, with save state shown
  in the header; focus mode, small-text and full-width preferences.
- Validator also accepts `table` and `file` blocks for forward compatibility; the editor does not
  render them.

**Verified by** client unit tests for block stats and manual editing passes in both themes.

## Phase 4 — Realtime collaboration

**Delivered**

- Socket.IO server with JWT handshake authentication, `user:<id>` and `note:<id>` rooms.
- `services/collaborationService.js`: server-side Yjs documents keyed by note, snapshot + update log
  persistence, debounced compaction into `notes.content`, restart recovery and reconnect merges via
  state vectors.
- Events: `join-note`, `leave-note`, `collab-sync`, `collab-update`, `collab-error`,
  `presence-update`, `cursor-move`, `selection-change`, `permission-changed`, `access-revoked`.
- Per-update authorization (owner/editor only), immediate revocation, presence avatar stack, live
  cursors and block-relative selections.
- Session-local undo/redo and caret preservation during remote updates.

**Verified by** concurrent-convergence integration tests and a two-session live revocation test.

## Phase 5 — Permissions, sharing and public links

**Delivered**

- `SharePermission` model with unique `(noteId, userId)` and roles `editor`, `commenter`, `viewer`;
  owner derived from `Note.user`.
- `/api/share`: user search, invite (existing account or pending `Invitation`), collaborator listing,
  role change, access revocation, invitation revocation and publish toggle.
- `Invitation` with SHA-256 token hash, seven-day expiry, acceptance at registration and owner
  revocation.
- `PublicShare` with 256-bit token, SHA-256 hash at rest, optional bcrypt password and expiry, token
  rotation on republish; `/api/public/:token` returns only `title`, `content`, `icon`, `updatedAt`
  for published, non-archived notes; identical `404` for every failure mode.
- Client `ShareModal` and `PublicNote` page with password unlock.

**Verified by** private-search concealment, public-token privacy, role-change and socket-revocation
integration tests.

## Phase 6 — Trash, search, history, comments and notifications

**Delivered**

- Trash lifecycle: archive/restore, bulk archive, trash listing, bulk restore, bulk delete, empty
  trash, and permanent delete cascading across permissions, preferences, CRDT state, revisions,
  public shares, comments, notifications and invitations.
- Revision history: throttled automatic snapshots, named manual versions, protected restore that
  rewrites the CRDT document, and pre-restore preservation.
- Search API (`/api/search`) over titles and block text with permission scoping, archived/favourite
  filters, previews and a 50-result cap; debounced sidebar search UI.
- Comments with mentions, resolve/reopen, realtime `comments-sync`; `Notification` model with feed,
  unread state and mention/share/comment events.
- Ordered migrations `001`–`014` (see `Database.md` §6).

**Verified by** trash/revision/search integration tests and manual checks of the feed.

## Phase 7 — Delivery and operations

**Delivered**

- `server/scripts/seed.js` + `npm run seed`: idempotent demo data for three accounts, seven notes,
  shares, revisions, a mention comment, notifications and a published public link.
- `docs/Database.md` and `docs/API.md`, with PRD, Architecture, Rules, Phases, Memory and the root
  README updated to match the implementation.
- CI: `verify` (server tests, audits, client lint/unit tests/build), `docker` (compose validation,
  both image builds, stack boot, health and SPA probes through nginx), and `deploy` (optional Render
  and Vercel hooks plus a production health wait).
- Root `.env.example` for compose; documented Render/Vercel environment variables and migration step.

**Verified by** a green local lint/unit/build run, syntax checks on both entry points and the seed
script, and the CI jobs defined in `.github/workflows/ci.yml`.

---

## Definition of done (applied per phase)

- Authorization covered by the integration suite, including the 404-for-concealed-reads rule.
- Async failures surface a user-facing toast with the API message.
- Realtime behaviour verified across two independent sessions.
- Lint, unit tests, production build and dependency audits pass in CI.
- Migrations are numbered, ordered and documented; destructive ones are paired with a cleanup path.
- Contracts and schema changes land in `API.md` / `Database.md` in the same change.
