# API Reference — Otion

Complete contract for the Otion HTTP API and realtime (Socket.IO) protocol. The data model is
documented in [`Database.md`](./Database.md); flows and architecture are in
[`Architecture.md`](./Architecture.md).

| Environment | Base URL |
| --- | --- |
| Production API | `https://otion-api.onrender.com/api` |
| Production WebSocket | `wss://otion-api.onrender.com` |
| Web app | `https://otion-nine.vercel.app` |
| Local API | `http://localhost:5000/api` |
| Local WebSocket | `http://localhost:5000` |
| Health probe | `GET /api/health` |

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Content type | `application/json` for every request body (max `1mb`) |
| Identifiers | 24-character hex `ObjectId` strings; malformed IDs return `400` (`404` where the note is concealed) |
| Auth header | `Authorization: Bearer <jwt>` |
| Timestamps | ISO-8601 UTC strings (`createdAt`, `updatedAt`) |
| Partial updates | `PATCH` for state toggles, `PUT` for note content/title/icon replacements |
| Idempotency | Publishing a note again rotates its public token; seeding is idempotent per demo account |

Secrets that only ever leave the server once: the account JWT, the public share token, and
invitation acceptance tokens. Everything else is a hash at rest.

## 2. Authentication

- `POST /api/auth/register` and `POST /api/auth/login` return `{ _id, name, email, avatarUrl, token }`.
- The JWT is signed with `JWT_SECRET` (`server/utils/generateToken.js`) and sent as a Bearer token.
- The web client stores it in `localStorage` (or `sessionStorage` when "remember me" is off) under
  `otion_token`, and `client/src/services/api.js` attaches the header automatically.
- Missing or invalid tokens return `401` with `error.code = "INVALID_TOKEN"`; the client clears the
  stored token and returns to `/login` on that code.
- Socket connections authenticate with `io(url, { auth: { token } })`. A failed handshake is
  rejected with `Authentication required`.

## 3. Errors

Every failure uses the same envelope:

```json
{
  "message": "You do not have permission to access this note",
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this note",
    "details": [{ "path": "email", "message": "Invalid email" }],
    "requestId": "req-7"
  }
}
```

`details` appears for `VALIDATION_ERROR`; `stack` appears only when `NODE_ENV=development`.

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` / `VALIDATION_ERROR` | Zod validation failure, invalid date, rule violation |
| 401 | `UNAUTHENTICATED` / `INVALID_TOKEN` | Missing, malformed or expired JWT |
| 401 | `PASSWORD_REQUIRED` | Public note protected by a password (body also carries this code) |
| 403 | `FORBIDDEN` / `ORIGIN_NOT_ALLOWED` | Authenticated but insufficient role; CORS rejected |
| 404 | `NOT_FOUND` | Missing record, or a note the caller may not see |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unhandled server error (message masked in production) |
| 503 | — | `GET /api/health` when the database is disconnected |

Validation errors list every failing field:

```json
{
  "message": "Request validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "path": "password", "message": "String must contain at least 8 character(s)" }
    ]
  }
}
```

## 4. Rate limits

Applied per IP with `express-rate-limit` (draft-8 headers, JSON 429 body). Limits are disabled when
`NODE_ENV=test`.

| Scope | Window | Limit |
| --- | --- | --- |
| All `/api` routes | 15 minutes | 500 requests |
| `POST /api/auth/register`, `POST /api/auth/login`, `PATCH /api/auth/password`, `DELETE /api/auth/account` | 15 minutes | 30 requests |
| `POST /api/public/:token/unlock` | 15 minutes | 20 requests |

## 5. Roles

`owner` is `Note.user`. Collaborators hold a `sharepermissions` role.

| Capability | owner | editor | commenter | viewer |
| --- | --- | --- | --- | --- |
| Read note, revisions, comments | ✅ | ✅ | ✅ | ✅ |
| `PUT /api/notes/:id`, realtime updates | ✅ | ✅ | ❌ | ❌ |
| Create / restore revisions | ✅ | ✅ | ❌ | ❌ |
| Create comments | ✅ | ✅ | ✅ | ✅ |
| Resolve comments | ✅ | ✅ | ❌ | ❌ |
| Favorite, reorder, preferences | ✅ | ✅ | ✅ | ✅ |
| Duplicate the note into own workspace | ✅ | ✅ | ✅ | ✅ |
| Archive, restore, delete | ✅ | ❌ | ❌ | ❌ |
| Invite, change roles, revoke, publish | ✅ | ❌ | ❌ | ❌ |

Archived notes are invisible to collaborators and public links regardless of role. Non-owners who
lack access receive `404` (not `403`) for note reads, revisions and comments, so existence is not leaked.

---

## 6. Endpoints

### 6.1 Health

`GET /api/health` — no auth.

```json
{ "status": "ok", "database": "connected" }
```

Returns `200` when Mongoose is connected (or `NODE_ENV=test`), otherwise `503` with
`{ "status": "degraded", "database": "disconnected" }`. Use this for platform health checks.

### 6.2 Authentication — `/api/auth`

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/register` | — | `{ name, email, password, invitationToken? }` |
| POST | `/login` | — | `{ email, password }` |
| GET | `/me` | Bearer | — |
| PATCH | `/profile` | Bearer | `{ name?, avatarUrl? }` |
| PATCH | `/password` | Bearer | `{ currentPassword, newPassword }` |
| GET | `/export` | Bearer | — |
| DELETE | `/account` | Bearer | `{ password }` |

**POST /register** — `name` 1–100, `email` valid, `password` 8–128. Creates the account and its
personal workspace. When `invitationToken` is supplied, the pending invitation must match the email
and be unexpired; on success the note permission (and guest workspace membership) is created and the
invitation is marked `accepted`. Returns `201`:

```json
{
  "_id": "6710f5c2a9b1e2c3d4e5f601",
  "name": "Demo Owner",
  "email": "demo@otion.app",
  "avatarUrl": "",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Errors: `400` duplicate email, `400` invalid/expired invitation.

**POST /login** — returns the same shape (`200`). `401 Invalid email or password` on failure.

**GET /me** — `{ _id, name, email, avatarUrl }`.

**PATCH /profile** — at least one of `name`, `avatarUrl`; returns the updated user. `avatarUrl` must
be an absolute URL or `""`.

**PATCH /password** — `401` when `currentPassword` is wrong; on success
`{ "message": "Password changed successfully" }`.

**GET /export** — JSON download (`Content-Disposition: attachment`) containing `exportedAt`,
`profile`, `workspaces`, `memberships`, `notes`, `sharedPermissions`, `preferences`,
`authoredComments`.

**DELETE /account** — requires the password. Removes the account, owned workspaces/notes and all
dependent documents (see `Database.md` §5.2), notifies collaborators with `note-remove`, disconnects
the user's sockets with `account-deleted`, and returns `{ "message": "Account deleted" }`.

### 6.3 Workspaces — `/api/workspaces`

`GET /` — Bearer. Returns every workspace with an active membership, newest first:

```json
[
  {
    "_id": "6710f6...",
    "name": "Otion Demo",
    "icon": "◇",
    "owner": "6710f5...",
    "settings": { "allowMemberInvites": false, "defaultNoteRole": "viewer" },
    "createdAt": "2026-11-12T09:00:00.000Z",
    "updatedAt": "2026-11-12T09:00:00.000Z",
    "membershipRole": "owner"
  }
]
```

Workspace creation, renaming and switching are intentionally not exposed; each account has one
personal workspace created at registration.

### 6.4 Notes — `/api/notes`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/?archived=&workspaceId=` | any authenticated | List notes (owned + shared) |
| POST | `/` | workspace owner/admin/member | Create note |
| GET | `/:id` | any role | Read one note, stamps `lastOpenedAt` |
| PUT | `/:id` | owner, editor | Save title/content/icon |
| DELETE | `/:id` | owner | Permanently delete note |
| PATCH | `/:id/archive` | owner | Move to trash |
| PATCH | `/:id/restore` | owner | Restore from trash |
| PATCH | `/:id/preferences` | any role | Favorite, ordering, sidebar state |
| POST | `/:id/duplicate` | any role | Copy into caller's workspace |
| GET | `/:id/revisions` | any role | Version history (max 100) |
| POST | `/:id/revisions` | owner, editor | Create named version |
| POST | `/:id/revisions/:revisionId/restore` | owner, editor | Restore version |
| PATCH | `/reorder` | authenticated | Persist personal order |
| PATCH | `/archive-many` | owner of each note | Bulk move to trash |
| DELETE | `/trash/empty` | owner | Empty trash |
| PATCH | `/trash/restore-all` | owner | Restore every archived note |
| DELETE | `/trash/delete-many` | owner | Permanently delete archived notes |
| PATCH | `/trash/restore-many` | owner | Restore selected archived notes |

**GET /api/notes** — query `archived=true|false` (default `false`), optional `workspaceId`.
Returns notes the caller owns or collaborates on, each with per-user preference fields:

```json
[
  {
    "_id": "6710f7...",
    "title": "Welcome to Otion",
    "icon": "👋",
    "content": [{ "id": "welcome-callout", "type": "callout", "text": "…" }],
    "contentSchemaVersion": 3,
    "revisionCounter": 2,
    "user": { "_id": "6710f5...", "name": "Demo Owner", "email": "demo@otion.app", "avatarUrl": "" },
    "workspace": "6710f6...",
    "isArchived": false,
    "isPublished": false,
    "createdAt": "2026-11-12T09:00:00.000Z",
    "updatedAt": "2026-11-12T09:02:00.000Z",
    "isFavorite": true,
    "sortOrder": 0,
    "lastOpenedAt": "2026-11-12T09:02:00.000Z"
  }
]
```

Ordering: notes with a numeric `sortOrder` come after unordered ones (an unordered note sorts as `-1`, which is how a shared note the caller has never arranged reaches the top), then `updatedAt` descending. Favourites are not reordered by the API; the client groups them. Archived listings show owned notes only.

**POST /api/notes** — body `{ title?, icon?, content?, workspace? }`. `workspace` defaults to the
caller's personal workspace and the caller must be an `owner`, `admin` or `member` of it.
`title` 1–200, `icon` ≤ 16 chars, `content` ≤ 10 000 validated blocks. The new note is placed at
`sortOrder: 0`, its `initial` revision is recorded, and `note-sync` is emitted to the owner.
Returns `201` with the note plus `sortOrder: 0`.

**GET /api/notes/:id** — returns the full note with `accessRole` and `isFavorite`. Also updates
`lastOpenedAt` for the caller. Missing note or no access → `404`.

**PUT /api/notes/:id** — body `{ title?, content?, icon?, saveReason? }` (`saveReason`:
`autosave` | `manual`). Requires owner or editor. Saves, records a revision (`automatic` is
throttled to one per five minutes; `manual` always records), broadcasts `document-saved` and
`note-sync`, and returns the note document. `403` for commenters/viewers.

**DELETE /api/notes/:id** — owner only. Cascades permissions, preferences, CRDT state/updates,
revisions, public share, comments, notifications and invitations; emits `note-remove` to every
collaborator. Returns `{ "message": "Note permanently deleted" }`.

**PATCH /api/notes/:id/archive** and **`/restore`** — owner only, returns the updated note.

**PATCH /api/notes/:id/preferences** — any role. Body: `{ favorite?, lastOpenedAt?, sidebarExpanded? }`
(at least one). Returns `{ favorite, lastOpenedAt, sidebarExpanded }` and broadcasts `note-sync` so
favorites stay consistent across tabs. Preferences are per user, so viewers can favorite shared notes.

**POST /api/notes/:id/duplicate** — any role with workspace membership. Creates `<title> copy` owned
by the caller in the note's workspace, records an `initial` revision, returns `201`.

**PATCH /api/notes/reorder** — `{ noteIds: [id, …] }` (1–10 000, unique). Every ID must be an
unarchived note the caller owns or collaborates on (`404` otherwise). Writes `sortOrder` per user and
emits `note-order` to that user only.

**PATCH /api/notes/archive-many** — `{ noteIds }` (1–500). Every note must be owned by the caller and
not archived.

**DELETE /api/notes/trash/empty** — `{ message, count }`; `{ message: "Trash is already empty", count: 0 }`
when there is nothing to delete.

**PATCH /api/notes/trash/restore-all** — `{ message, count }`.

**DELETE /api/notes/trash/delete-many** and **PATCH /api/notes/trash/restore-many** — `{ noteIds }`;
all IDs must be archived notes owned by the caller, otherwise `404`.

**GET /api/notes/:id/revisions** — newest first, max 100, author populated with `name avatarUrl`:

```json
[
  {
    "_id": "6710fa...",
    "note": "6710f7...",
    "revisionNumber": 2,
    "snapshot": { "title": "Welcome to Otion", "icon": "👋", "content": [] },
    "author": { "_id": "6710f5...", "name": "Demo Owner", "avatarUrl": "" },
    "reason": "manual",
    "name": "Kickoff",
    "createdAt": "2026-11-12T09:05:00.000Z"
  }
]
```

**POST /api/notes/:id/revisions** — `{ name? }` (≤ 120). Returns `201` with the revision.

**POST /api/notes/:id/revisions/:revisionId/restore** — records a "Before restore" manual revision,
replaces title/content/icon, rewrites the CRDT document, broadcasts `collab-update` and
`document-saved`, records a `restore` revision, and returns the note with `accessRole`.

### 6.5 Sharing — `/api/share`

All routes require the note owner.

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| GET | `/users/search?q=` | — | Find up to 8 accounts by name/email (q ≥ 2 chars) |
| POST | `/:noteId/invite` | `{ email, role }` | Grant access or create pending invitation |
| GET | `/:noteId/collaborators` | — | Owner, collaborators, pending invites, publish state |
| PATCH | `/:noteId/user/:userId` | `{ role }` | Change a collaborator's role |
| DELETE | `/:noteId/user/:userId` | — | Revoke access |
| DELETE | `/:noteId/invitation/:invitationId` | — | Revoke a pending invitation |
| PATCH | `/:noteId/public` | `{ isPublished, expiresAt?, password? }` | Publish or unpublish |

**GET /users/search** — returns `[{ _id, name, email, avatarUrl }]`, excluding the caller.

**POST /:noteId/invite** — `role` is `editor`, `commenter` or `viewer` (default `viewer`).
For an existing account: `201` with the populated `SharePermission` document, a `share`
notification and immediate `permission-changed`/`note-sync` to the invitee.
For an unknown email: `202` with

```json
{
  "pending": true,
  "invitation": { "_id": "…", "email": "new@otion.app", "role": "viewer", "expiresAt": "2026-11-19T09:00:00.000Z" },
  "invitationToken": "b7sQ…"
}
```

The token is shown once; deliver it as `https://otion-nine.vercel.app/register?invitation=<token>`.
Inviting the same email again replaces the pending invitation and rotates its token.
`400` when inviting yourself.

**GET /:noteId/collaborators**

```json
{
  "owner": { "_id": "…", "name": "Demo Owner", "email": "demo@otion.app", "avatarUrl": "" },
  "collaborators": [
    { "_id": "…", "noteId": "…", "userId": { "_id": "…", "name": "Maya Chen", "email": "maya@otion.app", "avatarUrl": "" }, "role": "editor" }
  ],
  "pendingInvitations": [
    { "_id": "…", "email": "new@otion.app", "role": "viewer", "expiresAt": "…", "createdAt": "…" }
  ],
  "isPublished": true
}
```

**PATCH /:noteId/user/:userId** — returns the updated permission; the collaborator's open socket
receives `permission-changed`, and write access is re-checked on their next update.

**DELETE /:noteId/user/:userId** — deletes the permission, emits `note-remove`, evicts the user from
the note room with `access-revoked`, drops the guest workspace membership when the user has no other
note access there, and returns `{ "message": "Access revoked" }`.

**PATCH /:noteId/public** — `isPublished` is required; `expiresAt` (ISO datetime) must be in the
future; `password` 8–128 (bcrypt-hashed). Publishing rotates the token, so previous links stop
working. Response while published:

```json
{ "isPublished": true, "token": "Yl8k…" }
```

Share as `https://otion-nine.vercel.app/public/<token>`. Unpublishing returns
`{ "isPublished": false }`, disables the share record and revalidates every connected socket.

### 6.6 Public reads — `/api/public`

No authentication. Returns only `title`, `content`, `icon` and `updatedAt` for published,
non-archived notes.

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/:token` | — | `200` note, or `401 PASSWORD_REQUIRED` |
| POST | `/:token/unlock` | `{ password }` | `200` note, or `401` |

Disabled, expired, unknown and malformed tokens all return the same
`404 { "message": "Note not found" }`. Note IDs are never accepted as public identifiers.

```json
{ "title": "Public onboarding guide", "content": [], "icon": "🌍", "updatedAt": "2026-11-12T09:10:00.000Z" }
```

### 6.7 Search — `/api/search`

`GET /api/search?q=&workspaceId=&archived=&favorite=` — all parameters validated; `q` 1–200 chars is
required. Searches only notes the caller owns or collaborates on, plus `content.text`.

```json
[
  {
    "_id": "6710f7...",
    "title": "Design sync notes",
    "icon": "🎨",
    "isArchived": false,
    "isPublished": false,
    "isFavorite": false,
    "matchPreview": "…keep the new callout surface…",
    "updatedAt": "2026-11-12T09:03:00.000Z"
  }
]
```

Max 50 results, ordered by `updatedAt` descending. With `archived=true`, only the caller's archived
notes are searched. `favorite=true` restricts to the caller's favorites.

### 6.8 Comments — `/api/comments`

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| GET | `/note/:noteId` | any role | — |
| POST | `/note/:noteId` | any role | `{ content, blockId?, parentComment? }` |
| PATCH | `/:id/resolve` | owner, editor | `{ resolved }` |

`content` 1–5000 chars. `@user@example.com` mentions are resolved to accounts that already have
access to the note; mention and comment notifications are created for the owner and mentioned users,
and the room receives `comments-sync`. `parentComment` must belong to the same note.
Resolving sets `resolvedBy`/`resolvedAt` and broadcasts `comments-sync` with `action: "updated"`.

### 6.9 Notifications — `/api/notifications`

| Method | Path | Result |
| --- | --- | --- |
| GET | `/` | Up to 50 notifications, newest first |
| PATCH | `/:id/read` | Marks one notification read; `:id` may be `all` |

```json
[
  {
    "_id": "671102...",
    "recipient": "6710f5...",
    "type": "mention",
    "actor": { "_id": "…", "name": "Maya Chen", "avatarUrl": "" },
    "note": { "_id": "…", "title": "Design sync notes", "icon": "🎨" },
    "comment": "671101...",
    "readAt": null,
    "createdAt": "2026-11-12T09:06:00.000Z"
  }
]
```

Reads scoped to the recipient; marking someone else's notification is a no-op (`{ "ok": true }`).

---

## 7. Realtime protocol (Socket.IO)

Connect with `io("https://otion-api.onrender.com", { auth: { token } })` in production
(`http://localhost:5000` locally). The JWT is verified during the handshake; unauthenticated
connections are rejected with `Authentication required`. Each socket automatically joins
`user:<userId>` for personal events.

### 7.1 Rooms

| Room | Joined when | Receives |
| --- | --- | --- |
| `user:<userId>` | On connect | `note-sync`, `note-remove`, `note-order`, `notification`, `permission-changed`, `access-revoked`, `account-deleted` |
| `note:<noteId>` | `join-note` with access | `collab-update`, `presence-update`, `cursor-move`, `selection-change`, `comments-sync`, `document-saved`, `permission-changed`, `access-revoked` |

### 7.2 Client → server

| Event | Payload | Notes |
| --- | --- | --- |
| `join-note` | `{ noteId }` | Verifies access, joins the room, replies with `permission-changed` then `collab-sync`, and broadcasts `presence-update`. Without access the socket receives `access-revoked` |
| `leave-note` | `{ noteId }` | Leaves the room and updates presence |
| `collab-update` | `{ noteId, update: number[] }` | Yjs update (`Uint8Array` → array), ≤ 256 KB. Requires owner/editor and an active `join-note`. Acknowledged with `{ ok: true, sequence }`, `{ ok: false, code: "FORBIDDEN" }`, or `{ ok: false, code: "INVALID_UPDATE" }` |
| `cursor-move` | `{ noteId, position }` | Broadcast to the room; ignored unless the socket has joined that note |
| `selection-change` | `{ noteId, selection }` | Broadcast to the room with the sender's identity |

### 7.3 Server → client

| Event | Payload | Meaning |
| --- | --- | --- |
| `collab-sync` | `{ update: number[], stateVector: number[], schemaVersion: 2, sequence }` | Full CRDT state after joining; the client merges and returns any missing update |
| `collab-update` | `{ update: number[], sequence }` | Incremental remote change |
| `collab-error` | `{ message }` | Document could not be synchronized |
| `presence-update` | `[{ socketId, _id, name, avatarUrl }]` | Current participants in the note room |
| `cursor-move` | `{ socketId, user, position }` | Remote pointer |
| `selection-change` | `{ socketId, user, selection }` | Remote block selection |
| `comments-sync` | `{ action: "created" \| "updated", comment }` | Comment feed refresh |
| `document-saved` | `{ document: { title, icon, updatedAt, content? } }` | Metadata/title save from another client |
| `note-sync` | `{ note }` | Note summary changed (title, icon, favorite, archive state, ordering) |
| `note-remove` | `{ noteId }` | Note deleted or access removed from a shared note |
| `note-order` | `{ noteIds }` | Personal ordering changed in another tab |
| `notification` | `{ notificationId }` | Refresh the notification feed |
| `permission-changed` | `{ role }` | Caller's effective role changed |
| `access-revoked` | — | Caller lost access; leave the document immediately |
| `account-deleted` | — | Account deleted; sockets are disconnected |

Every HTTP and socket write re-checks the current role, so a revoked collaborator's next update is
rejected and their socket is evicted.

---

## 8. Worked example

```bash
API=https://otion-api.onrender.com/api

# 1. Sign in
TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@otion.app","password":"OtionDemo123!"}' | jq -r .token)

# 2. Create a note
NOTE=$(curl -sS -X POST "$API/notes" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Scratchpad","icon":"📝"}')
NOTE_ID=$(echo "$NOTE" | jq -r ._id)

# 3. Save content
curl -sS -X PUT "$API/notes/$NOTE_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Scratchpad","saveReason":"manual","content":[{"id":"b1","type":"paragraph","text":"Hello Otion"}]}'

# 4. Share with an existing account
curl -sS -X POST "$API/share/$NOTE_ID/invite" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"maya@otion.app","role":"editor"}'

# 5. Publish read-only
curl -sS -X PATCH "$API/share/$NOTE_ID/public" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"isPublished":true}'
# -> { "isPublished": true, "token": "…" }
# open https://otion-nine.vercel.app/public/<token>
```

## 9. Client integration

| Concern | Implementation |
| --- | --- |
| HTTP base URL | `VITE_API_URL` (default `/api` in production builds, `http://localhost:5000/api` in dev) |
| Socket URL | `VITE_SOCKET_URL` (empty means same origin; nginx proxies `/socket.io/` in Docker) |
| Token storage | `localStorage.otion_token` or `sessionStorage.otion_token`, read by `services/api.js` |
| Unauthorized handling | `error.code === "INVALID_TOKEN"` clears storage and dispatches `otion:unauthorized` |
| Public pages | `GET /public/:token` in `PublicNote.jsx`, optional password unlock, 5 s polling |
| Realtime | `lib0`-free Yjs client in `hooks/useCollaborativeNote.js` |
