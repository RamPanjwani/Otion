# Otion implementation memory

Last verified: 2026-11-03 (Asia/Calcutta)

## Delivered foundation

- [x] React/Vite/Tailwind client with responsive 240px workspace shell.
- [x] Express, Mongoose, Socket.io, JWT/bcrypt authentication, request validation, structured errors, Helmet, rate limits, production CORS allowlist, and redacted request logging.
- [x] Registration confirmation-password validation and bearer-token session handling.
- [x] CI workflow for server tests/audit and client lint/build/audit.
- [x] Ordered MongoDB migration runner; active migrations `001`–`009` and `011`–`014` applied to the configured database (retired asset migration `010` is superseded by cleanup migration `012`).
- [x] Luma-inspired UI/UX system adapted to Otion: ambient gradients, semantic light/dark tokens, glass/elevated surfaces, responsive application chrome, Motion transitions with reduced-motion support, Lucide icon normalization, and Zod-powered authentication validation.

## Workspace and notes

- [x] `Workspace`, `WorkspaceMembership`, and `UserNotePreference` models.
- [x] One personal workspace per user; workspace switching and additional workspace creation are intentionally unavailable.
- [x] Favorites are per-user; viewers can favorite notes without modifying shared note state.
- [x] Recently opened timestamps with dashboard cards and compact sidebar navigation, plus live note summaries.
- [x] Flat, user-specific note ordering with drag handles, move-up/move-down controls, realtime order synchronization, and no note hierarchy.
- [x] Owner-only multi-select on the dashboard with a validated bulk move-to-Trash API; shared notes cannot be bulk deleted by collaborators.
- [x] Collapsible desktop sidebar with a persisted icon-rail preference; mobile continues to use the full-width navigation drawer.
- [x] Every note receives a default emoji; migration `013` backfilled existing notes and flattened legacy parent relationships.
- [x] Note covers were removed from the UI, API contracts, persistence schema, revision snapshots, and existing Atlas data by migration `014`.
- [x] Archiving/restoring affects only the selected note; permanent deletion removes only that note.
- [x] Note duplication backend contract and editor action that copies the current in-memory note into the user's workspace.

## Editor and collaboration

- [x] Stable-ID block editor with paragraphs, H1–H3, tasks, code, bullets, numbered lists, quote, callout, divider, image URL, and table/TSV blocks.
- [x] Conflict-safe inline rich text using native Yjs text attributes: bold, italic, underline, strike, inline code, links, keyboard shortcuts, mark removal, safe URL rendering, and caret-preserving remote updates.
- [x] External-URL image blocks; managed object/file uploads are intentionally excluded from the product.
- [x] Slash commands, plain-text paste sanitization, heading shortcuts, emoji, 500 ms autosave, immediate manual save, and `Ctrl/Cmd+S`.
- [x] Distraction-free focus mode (`Ctrl/Cmd+Shift+F`), persisted small-text/full-width preferences, live word and character counts, and a scroll-aware H1–H3 table of contents.
- [x] Yjs incremental CRDT updates replace whole-document broadcasts.
- [x] Persisted snapshots plus incremental update log, restart recovery, compaction, reconnect state-vector merge, and JSON read-model compatibility.
- [x] Socket JWT authentication and permission validation on every collaborative update.
- [x] Presence avatars, normalized moving pointers, block-relative selections, and immediate role/revocation enforcement.
- [x] Session undo/redo.

## History, sharing, and discovery

- [x] `NoteRevision` history with automatic snapshots, named manual versions, timeline UI, protected restore, and pre-restore preservation.
- [x] Existing-user invite autocomplete, editor/commenter/viewer role changes, instant dashboard discovery, and live access revocation.
- [x] Secure seven-day pending invitations for unregistered emails, copyable acceptance links, registration-time acceptance, and owner revocation.
- [x] Public access exists only after the owner explicitly creates it.
- [x] Public URLs use 256-bit random bearer tokens; only SHA-256 hashes are stored. Links support optional bcrypt-protected passwords and expiration. Disabled, malformed, expired, and nonexistent tokens return the same generic 404.
- [x] Authenticated users cannot bypass the public token with a note ID.
- [x] Dedicated permission-scoped search API for title/block text plus debounced sidebar results.
- [x] Page comments, collaborator `@email` mentions, resolve/reopen, realtime refresh, share/comment/mention notifications, and an in-app notification feed.
- [x] Trash restore and permanent deletion.

## Current API contracts

### Authentication — `/api/auth`

- `POST /register`, `POST /login`, `GET /me`
- `PATCH /profile`, `PATCH /password`, `GET /export`, `DELETE /account`

### Workspaces — `/api/workspaces`

- `GET /`, `POST /`, `PATCH /:id`

### Notes — `/api/notes`

- `GET /?archived=&workspaceId=`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `PATCH /:id/archive`, `PATCH /:id/restore`, `PATCH /:id/preferences`
- `POST /:id/duplicate`
- `GET /:id/revisions`, `POST /:id/revisions`, `POST /:id/revisions/:revisionId/restore`

### Sharing and public reads

- `POST /api/share/:noteId/invite`
- `GET /api/share/:noteId/collaborators`
- `PATCH|DELETE /api/share/:noteId/user/:userId`
- `DELETE /api/share/:noteId/invitation/:invitationId`
- `PATCH /api/share/:noteId/public`
- `GET /api/public/:token`

### Search

- `GET /api/search?q=&workspaceId=&archived=&favorite=`

### Comments and notifications

- `GET|POST /api/comments/note/:noteId`
- `PATCH /api/comments/:id/resolve`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`

### Realtime protocol

- Room/access: `join-note`, `leave-note`, `permission-changed`, `access-revoked`
- CRDT: `collab-sync`, `collab-update`, `collab-error`
- Awareness: `presence-update`, `cursor-move`, `selection-change`
- Navigation: `note-sync`, `note-remove`, `document-saved`

## Verification status

- Server integration suite: passing, including auth validation, flat note ordering/archive/restore, owner/editor/viewer rules, private search concealment, tokenized public privacy, Yjs concurrent convergence, version restore, and live socket revocation.
- Client ESLint: passing with zero errors.
- Client production build: passing on Vite 8.
- Responsive visual QA: passing at desktop and 390 px mobile widths in light/dark themes; browser console clean.
- Route-level splitting: passing; the main production bundle is approximately 295 kB before gzip, with editor/settings/pages emitted as separate chunks.
- Production dependency audit: no known production vulnerabilities at the last audit.
- Docker/Nginx/Compose definitions: created; runtime validation remains pending because Docker is not installed in the implementation environment.
- Existing Atlas data retained across workspace/CRDT/revision/search migrations; migration `013` added default emojis to 7 existing notes and found no remaining nested notes, while migration `014` removed legacy cover data from 9 notes and 9 revisions.

## Remaining roadmap

The following larger roadmap items are not represented as complete: multi-block drag/selection; automated invitation email delivery; threaded/block-targeted comment UI and email notifications; forgot-password/email-verification/active-session management; full accessibility audit; pagination/virtualization; staging/monitoring/backups; and production load/restore drills. Complete inline rich-text marks are implemented. Object uploads are intentionally outside the product scope. See `Implementation-Plan.md` for sequencing.
