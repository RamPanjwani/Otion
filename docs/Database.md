# Database Schema — Otion

Otion stores all persistent state in a single MongoDB database accessed through Mongoose.
This document is the authoritative description of the collections, fields, indexes, lifecycle
rules and migration ledger. API shapes are documented separately in [`API.md`](./API.md);
architecture and flows are in [`Architecture.md`](./Architecture.md).

- **Database:** MongoDB (Atlas or `mongo:7` in Docker Compose)
- **ODM:** Mongoose 9
- **Connection:** `MONGO_URI` (`server/config/db.js`), default local URL `mongodb://127.0.0.1:27017/otion`
- **Migrations:** ordered runner in `server/migrations/runner.js`, ledger collection `_migrations`
- **Timestamps:** every schema sets `{ timestamps: true }`, producing `createdAt` / `updatedAt`

---

## 1. Entity relationship diagram

```text
                    +-----------+
                    |   users   |
                    +-----+-----+
                          | 1
        +-----------------+------------------+------------------+
        |                 |                  |                  |
        | N               | N                | N                | N
+-------v--------+  +-----v---------+  +-----v--------+  +------v-------+
|  workspaces    |  |     notes     |  |  comments    |  | notifications|
|  (owner)       |  |  (user)       |  |  (author)    |  |  (recipient / |
+-------+--------+  +---+-------+---+  +------+-------+  |   actor)      |
        | 1             |       | 1          | 1        +---------------+
        | N             | N     | N          |
+-------v--------+      |       |            |
| workspace      |      |       |            |
| memberships    |<-----+       |            |
+----------------+   (guest)    |            |
                                |            |
        +-----------------------+---------------------------+
        |            |            |             |             |
        | N          | 1          | 1           | 1           | N
+-------v-----+ +----v------+ +---v-------+ +---v-------+ +---v------------+
| share       | | public    | | note      | | collabora | | user note      |
| permissions | | shares    | | revisions | | tion      | | preferences    |
+-------------+ +-----------+ +-----------+ | state /   | +----------------+
                                            | updates   |
                                            +-----------+
        +-------------+
        | invitations |  (note, workspace, inviter, email)
        +-------------+
```

`invitations` references `notes`, `workspaces` and `users` (inviter), and is resolved into a
`sharepermissions` document when the invited email registers.

---

## 2. Conventions

| Convention | Rule |
| --- | --- |
| Primary keys | BSON `ObjectId` (`_id`), serialized to clients as strings |
| Ownership | `Note.user` is the owner. Share roles never include `owner` |
| Soft delete | `Note.isArchived`; archived notes are excluded from listing, search and realtime access |
| Hard delete | `DELETE /api/notes/:id` and trash bulk actions remove the note plus every dependent document |
| Public visibility | `Note.isPublished` plus an enabled `publicshares` record; document IDs are never public identifiers |
| Secrets at rest | Passwords, public-link tokens and invitation tokens are stored as bcrypt/SHA-256 hashes only |
| Per-user state | Favorites, ordering, last-opened timestamps and sidebar state live in `usernotepreferences`, never on the shared note |
| TTL data | `collaborationupdates` documents expire 30 days after creation |
| Schema versioning | `Note.contentSchemaVersion` (currently `1`), `CollaborationState.schemaVersion` (currently `2`) |

---

## 3. Collection reference

### 3.1 `users`

Account identity and credentials (`server/models/User.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | PK | |
| `name` | String | required, trimmed | Display name |
| `email` | String | required, unique, lowercase, trimmed | Login identifier |
| `password` | String | required, min 8, `select: false` | bcrypt hash, cost 12, hashed in `pre('save')` |
| `avatarUrl` | String | default `''` | External image URL |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `email` (unique).

### 3.2 `workspaces`

Container for notes and members (`server/models/Workspace.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `name` | String | required, trimmed, max 100 | Default `"<User>'s Workspace"` from `ensurePersonalWorkspace` |
| `icon` | String | default `'◇'`, max 16 | |
| `owner` | ObjectId → `users` | required, indexed | |
| `settings.allowMemberInvites` | Boolean | default `false` | Reserved; invites currently require note ownership |
| `settings.defaultNoteRole` | String | enum `viewer`, `editor`; default `viewer` | Reserved |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `owner + createdAt`.

Each account receives exactly one personal workspace at registration. Workspace creation or
switching is intentionally not exposed by the API.

### 3.3 `workspacememberships`

Links users to workspaces with a workspace-level role (`server/models/WorkspaceMembership.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `workspace` | ObjectId → `workspaces` | required, indexed | |
| `user` | ObjectId → `users` | required, indexed | |
| `role` | String | enum `owner`, `admin`, `member`, `guest`; required | `admin`/`member` are reserved; guests are created when a note is shared |
| `status` | String | enum `active`, `suspended`; default `active` | Only `active` memberships are read |
| `joinedAt` | Date | default now | |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `workspace + user` (unique), `user + status + updatedAt`.

### 3.4 `notes`

Documents, their JSON read model and access flags (`server/models/Note.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `title` | String | default `'Untitled'`, trimmed | |
| `content` | `[Mixed]` | default `[]` | Block array, see §4 |
| `contentSchemaVersion` | Number | default `1` | JSON read-model version |
| `revisionCounter` | Number | default `0` | Monotonic counter used to number revisions atomically |
| `icon` | String | default `'📝'` | Emoji shown in sidebar, dashboard and public page |
| `user` | ObjectId → `users` | required, indexed | Owner |
| `workspace` | ObjectId → `workspaces` | default `null`, indexed | Flat structure; no parent note |
| `isArchived` | Boolean | default `false`, indexed | Trash |
| `isPublished` | Boolean | default `false` | Derived public state; the token lives in `publicshares` |
| `createdAt` / `updatedAt` | Date | auto | `updatedAt` drives list ordering |

**Indexes**

| Index | Purpose |
| --- | --- |
| `user + isArchived + updatedAt` (desc) | Owner dashboard and trash |
| `workspace + isArchived + updatedAt` (desc) | Workspace scoping |
| `isPublished + isArchived` | Public lookups |
| `title` + `content.text` text index `note_content_search` | Full-text fallback (API search uses escaped regex for prefix/substring matching) |

Notes are flat: legacy `parentDocument` and `coverImage` fields were removed by migrations
`013` and `014`.

### 3.5 `noterevisions`

Immutable snapshots used by version history (`server/models/NoteRevision.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `note` | ObjectId → `notes` | required, indexed | |
| `revisionNumber` | Number | required | Allocated with `$inc` on `notes.revisionCounter` |
| `snapshot.title` | String | default `'Untitled'` | |
| `snapshot.content` | `[Mixed]` | default `[]` | |
| `snapshot.icon` | String | default `''` | |
| `author` | ObjectId → `users` | required | |
| `reason` | String | enum `initial`, `automatic`, `manual`, `restore`; default `automatic` | |
| `name` | String | max 120, default `''` | User-supplied version label |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `note + revisionNumber` (unique), `note + createdAt` (desc).

`server/services/revisionService.js` records at most one `automatic` revision per note every
five minutes; `manual` and `initial` revisions are always written. Restoring a revision first
records a `manual` "Before restore" snapshot.

### 3.6 `sharepermissions`

Per-note collaborator roles (`server/models/SharePermission.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `noteId` | ObjectId → `notes` | required, indexed | |
| `userId` | ObjectId → `users` | required, indexed | Never the owner |
| `role` | String | enum `editor`, `commenter`, `viewer`; default `viewer` | |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `noteId + userId` (unique), `userId + updatedAt` (desc).

### 3.7 `usernotepreferences`

Per-user view state for a note, including shared notes (`server/models/UserNotePreference.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `user` | ObjectId → `users` | required, indexed | |
| `note` | ObjectId → `notes` | required, indexed | |
| `favorite` | Boolean | default `false` | |
| `sortOrder` | Number | default `null` | Lower first; `null` falls back to `updatedAt` |
| `lastOpenedAt` | Date | default `null` | Recently opened lists |
| `sidebarExpanded` | Boolean | default `false` | Per-note sidebar disclosure |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `user + note` (unique), `user + favorite + updatedAt` (desc), `user + sortOrder`,
`user + lastOpenedAt` (desc).

### 3.8 `publicshares`

Tokenized read-only publication (`server/models/PublicShare.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `note` | ObjectId → `notes` | required, unique | One share record per note |
| `tokenHash` | String | required, unique | SHA-256 of a 256-bit `base64url` token; plaintext is returned once |
| `enabled` | Boolean | default `true`, indexed | Disabling keeps the record for audit |
| `expiresAt` | Date | default `null`, indexed | Optional expiry |
| `passwordHash` | String | default `null`, `select: false` | bcrypt hash of the optional link password |
| `createdBy` | ObjectId → `users` | required | |
| `createdAt` / `updatedAt` | Date | auto | |

Publishing again rotates the token, immediately invalidating previously shared links.

### 3.9 `invitations`

Seven-day invitations for emails without an account (`server/models/Invitation.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `note` | ObjectId → `notes` | required, indexed | |
| `workspace` | ObjectId → `workspaces` | default `null`, indexed | Grants a `guest` membership on acceptance |
| `inviter` | ObjectId → `users` | required | |
| `email` | String | required, lowercase, indexed | Must match the registration email |
| `role` | String | enum `editor`, `commenter`, `viewer`; default `viewer` | |
| `tokenHash` | String | required, unique | SHA-256 hash of the acceptance token |
| `expiresAt` | Date | required, indexed | `now + 7 days` |
| `status` | String | enum `pending`, `accepted`, `revoked`; default `pending`, indexed | |
| `acceptedBy` | ObjectId → `users` | default `null` | |
| `acceptedAt` | Date | default `null` | |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `note + email + status`.

Inviting the same email again upserts the pending record and rotates its token.

### 3.10 `comments`

Page and block comments with mentions (`server/models/Comment.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `note` | ObjectId → `notes` | required, indexed | |
| `blockId` | String | default `null`, max 100 | Optional block anchor |
| `author` | ObjectId → `users` | required | |
| `parentComment` | ObjectId → `comments` | default `null`, indexed | Reserved for threads |
| `content` | String | required, trimmed, max 5000 | `@email` mentions are parsed server-side |
| `mentions` | `[ObjectId → users]` | default `[]` | Only users with note access |
| `resolved` | Boolean | default `false`, indexed | |
| `resolvedBy` | ObjectId → `users` | default `null` | |
| `resolvedAt` | Date | default `null` | |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `note + createdAt` (asc).

### 3.11 `notifications`

In-app feed entries (`server/models/Notification.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `recipient` | ObjectId → `users` | required, indexed | |
| `type` | String | enum `comment`, `mention`, `share`; required | |
| `actor` | ObjectId → `users` | required | |
| `note` | ObjectId → `notes` | required | |
| `comment` | ObjectId → `comments` | default `null` | Set for comment/mention notifications |
| `readAt` | Date | default `null`, indexed | `null` means unread |
| `createdAt` / `updatedAt` | Date | auto | |

**Indexes:** `recipient + readAt + createdAt` (desc).

### 3.12 `collaborationstates`

Current Yjs CRDT snapshot per note (`server/models/CollaborationState.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `note` | ObjectId → `notes` | required, unique | |
| `snapshot` | Buffer | required | `Y.encodeStateAsUpdate` output |
| `schemaVersion` | Number | default `2` | |
| `snapshotSequence` | Number | default `0` | Sequence covered by the snapshot |
| `lastSequence` | Number | default `0` | Highest applied update sequence |
| `createdAt` / `updatedAt` | Date | auto | |

### 3.13 `collaborationupdates`

Append-only log of incremental Yjs updates (`server/models/CollaborationUpdate.js`).

| Field | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `note` | ObjectId → `notes` | required, indexed | |
| `sequence` | Number | required | Monotonic per note |
| `update` | Buffer | required | Incremental Yjs update |
| `actor` | ObjectId → `users` | required | Author of the update |
| `createdAt` / `updatedAt` | Date | auto | TTL anchor |

**Indexes:** `note + sequence` (unique), `createdAt` TTL `expireAfterSeconds: 2592000` (30 days).

Updates older than the snapshot are compacted by `server/services/collaborationService.js`;
the TTL index bounds growth of the log even if compaction is delayed.

### 3.14 `_migrations`

Created and maintained by `server/migrations/runner.js`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | Migration identifier, unique |
| `appliedAt` | Date | When the migration ran |

---

## 4. Note content model

`Note.content` is an array of blocks. The server validates the envelope
(`server/validation/schemas.js`) and stores it verbatim; realtime edits travel as Yjs updates and
are written back to this array.

```json
{
  "id": "block-1",
  "type": "paragraph",
  "text": "Bold words and a link",
  "checked": false,
  "indent": 0,
  "marks": [
    { "from": 0, "to": 4, "attributes": { "bold": true } },
    { "from": 15, "to": 19, "attributes": { "link": "https://otion-nine.vercel.app" } }
  ]
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `id` | String | Required, 1–100 chars, stable for the block's lifetime |
| `type` | String | Required. Editor implements `paragraph`, `h1`, `h2`, `h3`, `task`, `bullet`, `numbered`, `quote`, `callout`, `code`, `divider`, `image`. The validator also accepts `file` and `table` for forward compatibility; the editor does not render them yet |
| `text` | String | Max 100 000 chars, default `''` |
| `checked` | Boolean | Task blocks only |
| `indent` | Number | List nesting depth (stored via Yjs, not validated server-side) |
| `marks` | Array | Max 10 000 entries, each `{ from, to, attributes }` with `to > from` |
| `marks[].attributes` | Object | Subset of `bold`, `italic`, `underline`, `strike`, `code`, `link` (URL ≤ 2048) |

Yjs stores block order in the `blocks` array of the note's document, each block as a `Y.Map`
containing `id`, `type`, `checked`, `indent` and a `Y.Text` named `text` carrying inline marks.

---

## 5. Role resolution and cascade rules

### 5.1 Effective role

```text
role = note.user == requester        -> "owner"
     : sharepermissions[note,user]   -> "editor" | "commenter" | "viewer"
     : otherwise                     -> no access (404 when the note is concealed, 403 otherwise)
```

| Capability | owner | editor | commenter | viewer |
| --- | --- | --- | --- | --- |
| Read note, revisions, comments | yes | yes | yes | yes |
| Realtime content updates | yes | yes | no | no |
| `PUT /api/notes/:id` | yes | yes | no | no |
| Create / restore revisions | yes | yes | no | no |
| Comment and resolve | yes | yes | create only | no |
| Favorite / reorder / preferences | yes | yes | yes | yes |
| Duplicate note into own workspace | yes | yes | yes | yes |
| Archive, restore, delete | yes | no | no | no |
| Invite, change roles, revoke, publish | yes | no | no | no |

Archived notes cannot be read, joined over sockets or opened through a public link, regardless of role.

### 5.2 Deletion cascades

Deleting a note (`DELETE /api/notes/:id`, trash bulk delete, empty trash) removes:

`sharepermissions`, `usernotepreferences`, `collaborationstates`, `collaborationupdates`,
`noterevisions`, `publicshares`, `comments`, `notifications`, `invitations` for that note.

Deleting an account (`DELETE /api/auth/account`) removes owned workspaces and notes plus every
dependent document listed above, all share permissions and preferences of the user, authored
comments, invitations for the user's email, and recipients' notifications referencing the deleted
notes. Collaborators receive `note-remove` before the data is removed, and active sockets are
disconnected with `account-deleted`.

Revoking a share removes the `sharepermissions` row, evicts live sockets, and deletes the
`guest` workspace membership when the user has no remaining access in that workspace.

---

## 6. Migration ledger

Run `npm run migrate` from `server/` (optionally `node migrations/runner.js --dry-run`).
Applied migrations are recorded in `_migrations`; a migration is never re-run.

| ID | Description |
| --- | --- |
| `001-note-indexes-and-favorites` | Note listing indexes and favorites groundwork |
| `002-workspaces-and-user-preferences` | Workspaces, memberships, per-user note preferences |
| `003-collaboration-state` | CRDT snapshot and update log collections |
| `004-note-revisions` | Version history collection and counter |
| `005-public-share-tokens` | Hashed public share tokens replace ID-based publication |
| `006-search-index` | Text index on note titles and block text |
| `007-comments-notifications` | Comments, mentions and notification feed |
| `008-advanced-sharing` | Commenter role and sharing indexes |
| `009-pending-invitations` | Seven-day invitation tokens |
| `010` | Retired object-upload migration, superseded by `012` |
| `011-rich-text-schema` | Inline mark schema (`marks`, attributes) |
| `012-remove-object-uploads` | Drops asset/upload remnants |
| `013-flat-notes-and-default-icons` | Flattens note hierarchy, backfills default emoji |
| `014-remove-note-covers` | Removes `coverImage` from notes and revisions |

---

## 7. Operational tasks

| Task | Command (from `server/`) |
| --- | --- |
| Apply pending migrations | `npm run migrate` |
| Preview migrations | `node migrations/runner.js --dry-run` |
| Clear every collection | `npm run truncate` |
| Load demo data | `npm run seed` |
| Integration tests (uses `TEST_MONGO_URI` or a unique temp database) | `npm test` |
| Connection/readiness probe | `GET /api/health` → `{ status, database }` |

`npm run seed` is idempotent for its demo accounts: it deletes any existing `demo@otion.app`,
`maya@otion.app` and `sam@otion.app` data, then recreates workspaces, notes, revisions, comments,
a public link and a notification. Production data outside those accounts is untouched.
