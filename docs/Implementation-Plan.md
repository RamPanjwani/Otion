# Otion Improvement Implementation Plan

## Implementation status — 2026-11-12

| Phase | Status | Delivered in this implementation |
| --- | --- | --- |
| 0 — Stabilization | Complete | Validation, security middleware, structured errors/logs, indexes, migrations, CI (verify, browser E2E, container smoke), API/socket integration tests, migration-runner and seed tests, clean audits. |
| 1 — Workspaces/preferences | Complete | Workspace models/UI/migration, membership discovery, personal favorites, recent-open timestamps. |
| 2 — CRDT collaboration | Complete | Yjs incremental updates, snapshots/update log, reconnect merge, stable block IDs, per-operation auth, JSON compatibility. |
| 3 — Version history | Complete | Automatic/manual revisions, timeline, protected restore, pre-restore preservation, undo/redo. |
| 4 — Rich editor | Substantially complete | Core block set, slash menu, sanitized paste, shortcuts, conflict-safe inline marks, links, and external-URL images. Object uploads are intentionally excluded; block drag/multi-block operations remain. |
| 5 — Organization/navigation | Complete (flat by decision) | Personal drag ordering, favourites and recents, archived/trash views with bulk actions, duplication. Nesting was delivered then removed in favour of a flat workspace; templates remain future work. |
| 6 — Advanced sharing | Partial | Immediate roles/revocation, commenter role, secure pending invitation tokens, hashed random public links, expiry, and password protection. Automated email delivery, groups, and audit log remain. |
| 7 — Comments/notifications | Partial | Page comments, mentions, resolve/reopen, realtime refresh, and in-app notifications. Threaded/block-targeted UI, email, and preferences remain. |
| 8 — Search | Core complete | Permission-scoped API, title/block search, workspace filter, previews, debounced UI, fallback index. Atlas Search deployment configuration remains. |
| 9 — UX/accessibility/accounts | Partial | Save status, responsive UI, confirmation password, dark mode, reduced motion, accessible modal focus handling, profile/password/data export/account deletion. Recovery, verification, active sessions, and full audit remain. |
| 10 — Production hardening | Substantially complete | CORS, Helmet, rate limits, redaction, CI (verify + browser E2E + container smoke + gated deploy probes and migration check), audits, indexes, compaction, graceful shutdown, health checks, route splitting, Docker/Nginx/Compose (validated in CI), a staging service with its own database, 30-minute uptime probes, and daily backups with an automated restore drill. Load/soak tests remain. |

This roadmap delivers the planned improvements incrementally. Every phase must remain deployable and pass authorization, API, realtime, and browser tests before the next phase begins.

## Phase 0 — Stabilization and test foundation

### Backend

- Add request-schema validation for every endpoint.
- Add Helmet, rate limiting, structured logging, and production CORS allowlists.
- Standardize API error codes and responses.
- Add MongoDB indexes for users, notes, permissions, and archive queries.
- Add a migration mechanism for schema changes, with automated coverage of the runner.

### Testing

- Add authentication registration and login tests.
- Test the owner/editor/viewer authorization matrix.
- Test note CRUD and the trash lifecycle.
- Test sharing and public-link privacy.
- Test Socket.io authentication, role changes, and revocation.
- Add Playwright smoke tests for primary user journeys. — **done**: `client/e2e/` covers sign-in, note autosave and public-link sharing against the seeded stack, and CI runs it as its own job.

### Infrastructure

- Add CI checks for server syntax, ESLint, client builds, tests, and dependency audits.
- Cover the migration runner and the demo seed script in the server suite so schema and fixture
  regressions fail CI.
- Separate development, staging, and production configuration.

### Exit criteria

- Critical APIs have automated coverage.
- No unauthorized read or write paths remain.
- CI blocks broken builds and failing tests.

## Phase 1 — Workspace and preference data model

### New models

#### `Workspace`

- Name
- Icon
- Owner
- Settings
- Timestamps

#### `WorkspaceMembership`

- Workspace
- User
- Role: owner, admin, member, or guest
- Status
- Joined date

#### `UserNotePreference`

- User
- Note
- Favorite status
- Last opened date
- Sidebar state

### Changes

- Associate every note with a workspace.
- Move favorites from `Note.isFavorite` to `UserNotePreference`.
- Add recently opened documents.
- Add workspace switching.
- Migrate existing notes into a default workspace.

### Exit criteria

- Favorites are personal to each user.
- Existing users retain all notes.
- Workspace membership controls document discovery.

## Phase 2 — Conflict-safe collaborative editor

This is the most important architectural upgrade.

### Editor protocol

- Introduce Yjs or an equivalent CRDT engine.
- Replace whole-document last-write-wins synchronization with incremental operations.
- Assign stable IDs to every block.
- Add a document schema version.
- Keep the existing block JSON as an export/read model during migration.

### Realtime collaboration

- Maintain one collaborative document per note.
- Authenticate all Socket.io/Yjs connections.
- Track awareness state for user identity, caret, text selection, pointer, and active/idle status.
- Revalidate permissions on every connection and role change.
- Replay missed updates after reconnection.

### Persistence

- Persist periodic CRDT snapshots.
- Compact incremental updates.
- Recover collaborative state after server restarts.
- Support offline editing and merge changes after reconnection.

### Migration

1. Convert existing JSON blocks into the collaborative format.
2. Temporarily support both old and new document formats.
3. Backfill existing notes.
4. Remove the legacy synchronization path after validation.

### Exit criteria

- Concurrent edits do not overwrite one another.
- Offline edits merge successfully.
- Revoked editors cannot submit further operations.
- Cursor and selection positions remain stable across screen sizes.

## Phase 3 — Version history and recovery

### New `NoteRevision` model

- Note
- Revision number
- Snapshot or CRDT state vector
- Author
- Reason
- Creation time

### Features

- Create automatic snapshots at sensible intervals.
- Support manually named versions.
- Add a revision timeline and preview.
- Restore an earlier version without deleting later history.
- Audit title, icon, and content changes.
- Add undo and redo for the active editing session.

### Exit criteria

- Users can inspect and restore revisions.
- Restore operations are permission-protected.
- Collaborative state remains valid after restoration.

## Phase 4 — Rich editor capabilities

### Block types

- Paragraph
- H1–H3 headings
- Bulleted and numbered lists
- Tasks
- Quote
- Callout
- Code block
- Divider
- Image
- Table

### Editing behavior

- Add bold, italic, underline, strike-through, links, and inline code.
- Add block drag-and-drop.
- Add duplicate, convert, move, and delete block actions.
- Add multi-block selection.
- Add keyboard shortcuts.
- Improve copy and paste from external editors.
- Add Markdown import and export.
- Improve the slash-command menu.
- Add a mobile formatting toolbar.

### Media

- Keep image blocks URL-based and validate safe HTTP(S) URLs.
- Add image captions, sizing, and removal without introducing object storage.

### Exit criteria

- All block types work with realtime collaboration.
- Paste and import cannot inject unsafe markup.
- External images render safely and remain editable in realtime.

## Phase 5 — Page organization and workspace navigation

Status: delivered as a deliberately flat workspace. Nested documents, breadcrumbs and reparenting
were built and then removed (migrations `013`/`014`); ordering is personal and stored in
`UserNotePreference.sortOrder`.

### Delivered

- Flat sidebar with Favorites and Recently Opened sections.
- Drag ordering and move controls, persisted per user and synchronized across tabs.
- Archived/trash views with bulk archive, bulk restore, bulk delete and empty trash.
- Document duplication and context menus.

### Future work

- Page templates.
- Workspace-level settings and member management.
- Optional grouping labels (not nesting) if users ask for it.

### Exit criteria (met)

- Ordering never mutates another user's sidebar.
- Archive and restore affect exactly the selected notes.
- Large workspaces stay responsive without hierarchy plumbing.

## Phase 6 — Advanced sharing and invitations

### New `Invitation` model

- Workspace or note
- Inviter
- Email
- Role
- Secure token hash
- Expiration
- Accepted/revoked state

### New `PublicShare` model

- Note
- Random token hash
- Expiration
- Optional password hash
- Enabled state
- Creator

### Features

- Invite people who do not yet have an Otion account.
- Deliver email invitations.
- Track pending invitations.
- Add a commenter permission.
- Share with workspace groups.
- Add expiring public links.
- Add password-protected public links.
- Regenerate and revoke public links.
- Stop exposing note IDs in public URLs.
- Add an access audit log.

### Exit criteria

- Public URLs use random tokens.
- Disabled and nonexistent links are indistinguishable.
- Invitations expire and can be revoked.
- Access changes immediately affect open sessions.

## Phase 7 — Comments, mentions, and notifications

### New `Comment` model

- Note and block
- Thread
- Author
- Content
- Mentions
- Resolved state

### New `Notification` model

- Recipient
- Type
- Actor
- Note or comment reference
- Read state

### Features

- Add block-level comments and threaded replies.
- Resolve and reopen threads.
- Add `@mention` autocomplete.
- Synchronize comments in realtime.
- Add an in-app notification center.
- Add optional email notifications.
- Add notification preferences.

### Exit criteria

- Comments respect document permissions.
- Mentioned users receive notifications.
- Revoked users lose comment access immediately.

## Phase 8 — Scalable search

### Backend

- Add a dedicated search endpoint.
- Use MongoDB Atlas Search in production.
- Index title, block text, workspace, owner, collaborators, updated date, and archive state.
- Enforce permissions inside the search query.

### Frontend

- Highlight matching terms.
- Add workspace, owner, sharing, favorite, archive, and date filters.
- Add complete keyboard navigation.
- Add recent searches.
- Add result previews.

### Exit criteria

- Search never returns inaccessible documents.
- Results remain fast with large workspaces.
- Indexed changes appear shortly after saving.

## Phase 9 — UX, accessibility, and account management

### UX

- Add toast notifications.
- Replace browser prompts with designed dialogs and pickers.
- Add emoji and cover pickers.
- Add dark mode.
- Add offline and reconnecting indicators.
- Show explicit save status and last-saved time.
- Improve loading skeletons and retry states.
- Improve mobile editor and navigation behavior.

### Accessibility

- Support complete keyboard navigation.
- Add dialog focus trapping and restoration.
- Use semantic headings and controls.
- Add ARIA labels and announcements.
- Validate contrast.
- Respect reduced-motion preferences.
- Test with screen readers.

### Account features

- Add profile and avatar management.
- Add change-password flow.
- Add forgot/reset-password flow.
- Add email verification.
- Add active-session management.
- Add account deletion and data export.

### Exit criteria

- Core flows work without a mouse.
- Accessibility audits have no critical violations.
- Mobile workflows match desktop capabilities.

## Phase 10 — Production hardening and performance

### Security

- Add refresh-token rotation or secure HTTP-only sessions.
- Add password and login rate limits.
- Add security event logs.
- Document secret rotation.
- Add dependency scanning.
- Add file malware scanning where appropriate.
- Define data-retention and account-deletion policies.

### Performance

- Paginate note and collaborator lists.
- Lazy-load routes and editor code.
- Virtualize large sidebars and long documents.
- Batch and compact realtime updates.
- Cache safe workspace metadata.
- Monitor MongoDB query performance.

### Operations

- Docker Compose with API and nginx client images is delivered; CI validates the compose file, builds both images and smoke-tests the running stack. The Render service is described in `render.yaml` and matches the live settings.
- Staging is live: `otion-api-staging` on Render runs `main` against the `otion_staging` Atlas database, and Vercel previews of the `staging` branch build against it.
- Enforce HTTPS and WSS: both providers terminate TLS, and the client derives `wss://` from `VITE_SOCKET_URL`.
- Centralized logs: `pino-http` emits structured request logs to the Render log stream. Error tracking is wired through Sentry behind `SENTRY_DSN` and stays inert until a DSN exists, so today's exception alerting still rests on the uptime probe and provider notifications.
- Uptime checks: `uptime.yml` probes `/api/health` and the web app every 30 minutes and fails on any non-`ok` payload.
- Backups and restore drills: `backup.yml` dumps production daily, restores the archive into a scratch MongoDB, compares collection counts and keeps the artifact for seven days.
- Deployment and rollback procedures are documented in `readme.md` and `docs/Architecture.md`; Render keeps every previous deploy available for an instant rollback.

### Exit criteria

- Production load tests pass.
- Backup restoration is tested.
- Monitoring detects API, database, and realtime failures.

## Recommended execution order

1. Stabilization and automated tests
2. Workspace and preference model
3. CRDT collaboration
4. Version history
5. Rich editor features
6. Nested page navigation
7. Sharing and invitation improvements
8. Comments and notifications
9. Search
10. Accessibility, performance, and production hardening

## Delivery strategy

For every phase:

1. Define the database migration.
2. Add backend contracts and authorization tests.
3. Implement required realtime events.
4. Build frontend behavior behind a feature flag where appropriate.
5. Run unit, integration, and two-client browser tests.
6. Deploy to staging.
7. Validate migration and rollback procedures.
8. Enable the feature incrementally in production.
9. Update `docs/Memory.md`, API documentation, and architecture records.

## Definition of done

A phase is complete only when:

- Authorization is covered by tests.
- Async failures have user-facing handling.
- Realtime behavior works across two independent sessions.
- Mobile and desktop flows are verified.
- Lint, build, tests, and security checks pass.
- Database migrations are reversible or have a documented recovery path.
- Documentation and environment templates are updated.
