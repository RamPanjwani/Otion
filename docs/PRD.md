# Product Requirements Document (PRD) — Otion

Status: implemented. This document describes the product as it exists in the repository and in
production. Data details live in [`Database.md`](./Database.md); endpoint contracts in
[`API.md`](./API.md); runtime structure in [`Architecture.md`](./Architecture.md).

Live product: <https://otion-nine.vercel.app> · API: <https://otion-api.onrender.com/api>

## 1. Vision

Otion is a focused notes workspace for people who want a fast, quiet document surface and real
collaboration without a heavyweight project-management tool. It combines a block editor with
markdown shortcuts, a flat searchable page list, conflict-safe realtime editing, and sharing that
ranges from per-person roles to revocable read-only public links.

## 2. Users and jobs

| Persona | Job to be done |
| --- | --- |
| Individual note-taker | Capture and organise pages quickly, favourite the important ones, search everything |
| Small team | Write the same page together in realtime, comment on drafts, restore an earlier version |
| Reviewer / stakeholder | Read a page as a viewer or through a public link without an account |
| Document owner | Control who can read, comment or edit; revoke access; publish read-only |

## 3. Scope

### 3.1 Implemented

- Email/password accounts with JWT sessions, profile editing, password change, JSON data export and
  account deletion.
- One personal workspace per account, with owner/admin/member/guest roles modelled in the data layer.
- Block editor: paragraph, heading 1–3, bullet, numbered, task, quote, callout, divider, code; inline
  bold/italic/underline/strikethrough/code/link; slash command menu; markdown shortcuts; undo/redo.
- Realtime co-editing with Yjs CRDTs, live cursors, selection highlights, presence avatars, and
  authorization re-checked on every update.
- Version history with automatic throttled revisions, named manual versions, and restore.
- Sharing: invite by email, roles (editor/commenter/viewer), role changes, revocation, pending
  invitations for unregistered emails, share notifications.
- Public links: per-note publish/unpublish, token rotation, optional password, optional expiry.
- Comments with @mentions, mention notifications, resolve/unresolve.
- Notifications feed with unread state.
- Notes management: create, rename, icon, save, duplicate, favourite, drag reorder, per-user sidebar
  state, archive, bulk archive, trash, restore, bulk restore, delete, empty trash.
- Dashboard search across titles and block text, filters for archived and favourites.
- Dark/light theme, focus mode, sidebar collapse, keyboard shortcut reference, responsive layout,
  reduced-motion support.
- Demo seed script, ordered migrations, integration tests, CI with container smoke tests and
  optional deploy hooks.

### 3.2 Out of scope (current)

- Nested pages / hierarchies — pages are intentionally flat, ordering is per user.
- Real-time collaborative workspaces beyond note sharing (workspace settings UI, member management).
- Email delivery of invitations and notifications (links are surfaced in the UI instead).
- File and image uploads (image blocks accept external HTTPS URLs; `file`/`table` blocks are validated
  but not rendered).
- Refresh-token rotation, session management UI, OAuth/SSO.
- Server-side pagination for large note collections.
- Mobile native apps; the web app is responsive.

## 4. Stack

| Layer | Choice | Version |
| --- | --- | --- |
| UI | React, React Router, Vite | 19.2, 7.x, 8.2 |
| Styling | Tailwind CSS 4 with CSS-first theme tokens | 4.3 |
| Icons / motion | lucide-react, Motion | current |
| Editor | Custom block editor over Yjs (`Y.Doc`, `Y.Text`, `Y.Array`) | Yjs 13.6 |
| HTTP client | Axios with interceptors | current |
| API | Node.js, Express | 20+ (Docker/CI), 5.2 |
| Realtime | Socket.IO | 4.8 |
| Data | MongoDB + Mongoose | 7+ / 9.9 |
| Auth | bcryptjs + jsonwebtoken | current |
| Validation | Zod | current |
| Tests | node:test + supertest (server), node:test (client) | — |
| Delivery | GitHub Actions, Render, Vercel, Docker/nginx | — |

No state-management library, no UI kit, no ORM beyond Mongoose, no upload service.

## 5. Data model (summary)

Full collections, indexes and cascades: [`Database.md`](./Database.md).

```text
User 1---* Workspace 1---* WorkspaceMembership *---1 User
User 1---* Note *---1 Workspace
Note 1---* SharePermission *---1 User        (unique noteId+userId)
Note 1---1 UserNotePreference *---1 User     (unique user+note)
Note 1---* NoteRevision
Note 1---1 PublicShare
Note 1---* Comment *---1 User                (+ parentComment for replies)
User 1---* Notification *---1 User           (recipient + actor)
Note 1---* Invitation
Note 1---1 CollaborationState  (Yjs snapshot, state vector, sequence)
Note 1---* CollaborationUpdate (TTL 30 days, compacted into the snapshot)
```

Key note fields: `title`, `icon`, `content` (validated block array, schema version 3),
`revisionCounter`, `user` (owner), `workspace`, `isArchived`, `isPublished`, timestamps.
Sharing state lives in `SharePermission` (role) and `PublicShare` (SHA-256 token hash, enabled,
optional bcrypt password hash and expiry). Tokens are never stored in plaintext.

## 6. API surface (summary)

Complete request/response reference: [`API.md`](./API.md).

| Group | Base | Highlights |
| --- | --- | --- |
| Auth & account | `/api/auth` | register (with invitation token), login, me, profile, password, export, delete account |
| Workspaces | `/api/workspaces` | list memberships (read-only) |
| Notes | `/api/notes` | list, create, read, save, delete, archive/restore, preferences, duplicate, reorder, bulk archive, trash empty/restore-all/restore-many/delete-many |
| Revisions | `/api/notes/:id/revisions` | list, create named version, restore |
| Sharing | `/api/share` | user search, invite, collaborators, role change, revoke access/invitation, publish |
| Public | `/api/public/:token` | anonymous read, optional unlock |
| Search | `/api/search` | title + block text, archived/favourite filters |
| Comments | `/api/comments` | list per note, create with mentions, resolve |
| Notifications | `/api/notifications` | list, mark read (single or all) |
| Health | `/api/health` | liveness and database readiness |

Authentication is `Authorization: Bearer <jwt>`; every error uses one envelope
(`{ message, error: { code, message, details?, requestId } }`). Role rules: owner and editor write,
commenter and viewer read and comment, only the owner manages sharing and archival. Non-owners
without access receive `404` rather than `403`.

## 7. Realtime protocol (summary)

Socket.IO with JWT handshake auth. Rooms: `note:<id>` and `user:<id>`. Client emits `join-note`,
`leave-note`, `collab-update` (Yjs update, owner/editor only), `cursor-move`, `selection-change`.
Server emits `collab-sync`, `collab-update`, `collab-error`, `presence-update`, `cursor-move`,
`selection-change`, `comments-sync`, `document-saved`, `note-sync`, `note-remove`, `note-order`,
`notification`, `permission-changed`, `access-revoked`, `account-deleted`. Exact payloads are in
[`API.md`](./API.md) §7.

## 8. Experience requirements

- First paint of the app shell under a second on a broadband connection; routes are code-split.
- Autosave after 500 ms of idle typing through the CRDT channel; explicit saves create a revision.
- Sidebar shows the flat page list with favourites first, then personal order; archive and trash are
  separate views.
- Document header holds title, icon, favourite, collaborators, publish state, version history, share.
- Editor keeps focus mode, dark mode and collapsed sidebar as per-device/user preferences.
- Public pages render read-only with a password gate when configured and never expose note IDs.
- Every destructive action is confirmed; failures surface a dismissible toast with the API message.

Design tokens, layout rules and approved libraries: [`Rules.md`](./Rules.md).

## 9. Non-functional requirements

| Concern | Requirement |
| --- | --- |
| Security | Hashed credentials and tokens at rest, CORS allowlist, Helmet, per-IP rate limits, Zod validation on every input, authorization re-checked on writes and socket events |
| Privacy | Public links revocable with token rotation and optional expiry; account export and deletion available |
| Reliability | CRDT updates persisted before compaction; restore is itself versioned; health endpoint reports database readiness |
| Performance | Debounced writes, compacted update log, indexed queries, search limited to 50 results, revisions capped at 100 |
| Operability | Ordered migrations run explicitly, structured request logs with redacted auth headers, CI with container smoke tests |
| Accessibility | Keyboard-first editing with documented shortcuts, visible focus rings, `prefers-reduced-motion` support, semantic buttons and labels |

## 10. Success criteria

- A new user can register, create a page, format text, share it and find it again by search without
  documentation.
- Two signed-in collaborators see each other's edits, cursors and presence within ~200 ms on
  broadband, with no lost keystrokes.
- Revoking access or archiving a note immediately stops edits from the affected collaborator.
- `npm test`, `npm run lint` and `npm run build` pass in CI together with the container smoke job.
