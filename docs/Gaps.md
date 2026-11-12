# Otion Gap Register

Everything the project does **not** yet have, in one place — engineering and product — with the
evidence for each claim, the impact, and the fix. It complements
[`Memory.md`](Memory.md) (what was delivered) and [`Implementation-Plan.md`](Implementation-Plan.md)
(sequencing): this file is the honest list of what is missing.

**Verified against** commit `63a190e` on 13 November 2026, by reading the code and exercising the
running system (CI run `43306276723`, production live, staging refreshed). Every row states where to
look; none of it is inferred from documentation alone.

**Severity** — `P1` data loss, security exposure or broken core flow · `P2` functional or operational
weakness with a workaround · `P3` scale, polish or contributor friction.
**Effort** — `S` hours · `M` a day or two · `L` a week or more.

---

## 1. Engineering gaps

### Security and identity

| ID | Sev | Gap | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-01 | P1 | **No multi-document transactions.** Zero `startSession`/`withTransaction` in the server. | `grep -r withTransaction server/` → no matches | Account deletion (notes, permissions, comments, revisions, notifications, shares) and invite acceptance write across collections; a mid-flight failure leaves orphans or half-revoked access. | Wrap the cascade writes and invite acceptance in a `session` + `withTransaction`. Atlas M0 is a replica set, so transactions are available. | M |
| ENG-02 | P1 | **One 30-day bearer token, no rotation or revocation.** | `server/utils/generateToken.js:4` — `expiresIn: '30d'`; logout only deletes the token client-side (`client/src/services/socket.js:9`) | A leaked token works for 30 days. No "sign out everywhere", no device list, no way to invalidate a stolen session. Password change does not invalidate existing tokens. | Short-lived access token (~15 min) + rotating refresh token stored hashed per device, plus a `sessions` collection and revoke-all. | L |
| ENG-03 | P1 | **Atlas password hygiene.** The production database password was pasted in plaintext during setup and has not been rotated. | Conversation record; current credential still in Render env | Anyone with the transcript holds working database credentials. | Rotate in Atlas, update `MONGO_URI` on Render (staging and production), verify `/api/health`. | S |
| ENG-04 | P2 | **Rate limiting is per-process and in-memory.** | `server/middleware/security.js` — `express-rate-limit` with the default store; no `rate-limit-redis` dependency | Limits multiply with instance count and reset on every deploy/restart. Under the free single instance this is fine; the moment it scales, the ceiling is no longer real. | Add a shared store (Redis/Upstash) when the service goes multi-instance. | M |

### Data access and API

| ID | Sev | Gap | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-05 | P2 | **No server-side pagination.** Hard caps instead: notes `100`, search `50`, notifications `50`. | `server/controllers/noteController.js:209`, `searchController.js:22`, `notificationController.js:7` | An account with more than 100 notes silently loses the rest — no cursor, no "load more", no total count. | Cursor or `page`/`limit` with a max, and `total`/`nextCursor` in the response. | M |
| ENG-06 | P2 | **Search is an unindexed regex scan.** | `server/controllers/searchController.js:19` — `new RegExp(escapeRegex(q), 'i')` over `title` and `content.text` | No stemming, no typo tolerance, no ranking, and the scan grows with the corpus. Comments and block types are not searched. | Atlas Search index + `$search` aggregation with `fuzzy`/`autocomplete`; keep regex as a fallback. | L |
| ENG-07 | P2 | **No machine-readable API contract.** `docs/API.md` is hand-written. | 8 routers under `server/routes/`; no OpenAPI file, no generated client | Docs drift from code silently; consumers can't generate types. | Emit OpenAPI from the zod schemas (or `zod-to-openapi`) and diff it in CI. | M |
| ENG-08 | P3 | **Server has no type checking.** | `server/package.json` has no `type-check`; source is plain CommonJS | Refactors rely on tests and review only; the client is checked (`npm run type-check`) but the server is not. | `// @ts-check` + JSDoc gradually, or migrate to TypeScript. | L |

### Real-time and notifications

| ID | Sev | Gap | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-09 | P2 | **Socket events are not schema-validated.** HTTP is zod-checked end to end; socket payloads are destructured raw. | `server/server.js:144` — `socket.on('join-note', async ({ noteId }) => …)` | Malformed events reach service code. Access is still checked, so this is robustness, not an auth hole. | Reuse zod per event (`join-note`, `collab-*`, `cursor-*`) and disconnect on repeated invalid payloads. | S |
| ENG-10 | P2 | **Real-time is single-instance.** | No `@socket.io/redis-adapter`; `presence` is a process-local `Map` in `server/server.js:34` | Two instances would split rooms and presence — users on different instances stop seeing each other. | Redis adapter (+ shared presence) before scaling horizontally. | M |
| ENG-11 | P2 | **Notification triggers are incomplete.** | `server/controllers/commentController.js:42-45` — recipients are only the note owner and `@mentions` | A reply does **not** notify the parent comment's author; resolving a thread, changing a collaborator's role, or restoring a revision notifies nobody. | Add parent-author and thread-participant recipients; emit on resolve/role/revision events. | S |
| ENG-12 | P2 | **Notifications have no retention or pagination.** | `Notification` model has no TTL index; list caps at 50 | Old notifications accumulate forever, and rows past the newest 50 are unreachable. | Optional TTL (e.g. 90 days) and cursor pagination; a bulk "clear read". | S |

### Operations and observability

| ID | Sev | Gap | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-13 | P2 | **Error tracking is inert and has no source maps.** Both server and browser SDKs are wired but disabled until a DSN exists; no `@sentry/vite-plugin` upload. | `server/config/monitoring.js`, `client/src/services/monitoring.js`; `VITE_SENTRY_DSN` unset | Production exceptions are only visible in Render logs, which are ephemeral on the free plan. Once enabled, browser stack traces would be minified. | Create the Sentry project, set `SENTRY_DSN` on Render and `VITE_SENTRY_DSN` on Vercel, add source-map upload to the Vercel build. | S |
| ENG-14 | P2 | **Migrations are manual per release.** | `render.yaml` comment; free instance type cannot run `preDeployCommand` | A deploy can serve code that expects a schema the database does not have yet. | Upgrade the instance type and add `preDeployCommand: npm run migrate`, or gate the deploy job on a migration step. | S |
| ENG-15 | P2 | **No point-in-time recovery.** Daily logical dump only, 7-day retention on the free tier. | `.github/workflows/backup.yml` (03:17 UTC), Atlas M0 | Worst case loses up to 24 h of edits; restore is manual and has only been rehearsed locally. | Paid Atlas tier for continuous backup, or accept and document the RPO/RTO explicitly. | M |
| ENG-16 | P3 | **No metrics, tracing or alerting beyond an uptime ping.** | `.github/workflows/uptime.yml` (every 30 min) is the only monitor | Slow degradation, error-rate spikes and queue-less background failures go unnoticed. Render free instances also spin down, and the 30-minute ping is longer than the idle window. | Add Sentry performance/cron monitors or a hosted uptime + alerting service. | M |
| ENG-17 | P3 | **Performance baseline is a laptop, not a target.** The harness exists but has never run against staging or production. | `server/scripts/loadtest.js`; baseline table in `readme.md` (231 req/s, p95 80 ms locally) | Real capacity and cold-start cost are unknown; no regression gate in CI. | Run the harness against staging with a throwaway database, record numbers, then gate PRs on a smoke run. | S |
| ENG-18 | P3 | **Server image has no health check.** | `server/Dockerfile` has no `HEALTHCHECK` (the client image does) | Orchestrators relying on the image alone cannot detect an unhealthy API container. | Add `HEALTHCHECK … /api/health`. | S |
| ENG-19 | P3 | **Test coverage is thin on realtime and collaboration.** | `client/e2e/`: `auth`, `editor`, `sharing` only | Comments, notifications, socket reconnect, presence, revisions, search and trash flows are covered by server contract tests at most, never in a browser. | Add specs for comments/notifications and a two-page collaboration test. | M |
| ENG-20 | P3 | **Preview-origin trust is broader than the project.** | `server/config/cors.js:17` auto-allows any `https://otion*.vercel.app` origin in addition to `CLIENT_URLS` | Preview deploys work (good), but an unrelated project deployed under that naming pattern is silently trusted. Low risk because auth is a Bearer header, not a cookie. | Allow only this project's preview URL pattern, or add preview origins explicitly per PR. | S |

### Contributor experience

| ID | Sev | Gap | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-21 | P3 | **Local setup needs privileged cleanup.** | `~/.cache/otion-node-modules-root-owned`, root-owned `server/node_modules/.bin`, `mongod` data in `/tmp/otion-mongo-data` | A fresh clone can fail `npm ci` until files are removed with `sudo`, and the local database vanishes on reboot. | Document `sudo rm -rf` in the troubleshooting section and put local Mongo data under the project or a Docker volume. | S |
| ENG-22 | P3 | **Staging holds real note text.** The refresh scrubs identities only; after the last run staging also has no demo accounts. | `server/scripts/syncStaging.js`; run `43306045359` | Fine for a solo project, but staging is not shareable with outsiders as-is. | Add a body-text scrub mode (`--scrub-content`) when staging needs to be demoed publicly. | S |

---

## 2. Product gaps

| ID | Sev | Gap | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| PRD-01 | P1 | **No email delivery of any kind.** | No mail dependency in either `package.json`; invitations and shares are link-only | Invited people are never told; mentions never leave the app; no verification, no password reset, no digests. This is the single biggest product gap. | Transactional email provider + templates for invite, mention, share, reset. | M |
| PRD-02 | P2 | **No password reset or email verification.** | `server/routes/authRoutes.js` has register, login, me, profile, password, export, delete — nothing else | A user who forgets a password is locked out permanently; addresses are never proven. | Reset/verify token tables and the flows that consume them. | M |
| PRD-03 | P2 | **Comment threads are half-built.** The API accepts `parentComment`; the UI renders a flat list. | `Comment` model and `commentController.createComment` take `parentComment`; `CommentsModal.jsx` never references it | The data model promises replies the product cannot show or create — the seeded thread structure is invisible. | Render replies nested with a reply composer, or drop `parentComment` from the API until it is used. | M |
| PRD-04 | P2 | **Workspaces are a stub.** | `Workspace`/`WorkspaceMembership` models exist; `workspaceRoutes.js` exposes `GET /` only | No create/rename/invite/roles UI, so multi-workspace organisation is advertised by the schema but unreachable in the app. | Build the workspace management surface, or document workspaces as internal-only. | M |
| PRD-05 | P2 | **No accessibility audit.** | No `axe`/`pa11y` dependency or test; E2E runs desktop Chromium only | Keyboard traps, focus order in modals, contrast and screen-reader labels are unverified. | Add `@axe-core/playwright` assertions to the existing specs and fix what it finds. | M |
| PRD-06 | P3 | **Editor still lacks multi-block drag.** | Roadmap item, unbuilt | Reordering a long page means cut/paste per block. | Block drag handles with drop indicators, reusing the existing block array. | L |
| PRD-07 | P3 | **No offline or installable mode.** | No service worker/manifest; the API is required for every view | The app is unusable on a flaky connection and cannot be installed. | PWA shell with read-only cached notes. | L |
| PRD-08 | P3 | **Public sharing is view-only.** | `publicRoutes.js` and `PublicShare` support password + read-only rendering | Readers cannot comment or react on a shared page, limiting its use for review. | Optional comment-only public mode, reusing the existing comment API with a share token. | M |
| PRD-09 | P3 | **Mobile behaviour is unverified.** | Responsive Tailwind classes exist; no device project in `playwright.config.js` | Layout regressions on small screens are caught only by hand. | Add a Pixel/iPhone project to the E2E matrix. | S |

---

## 3. Blocked on an owner action

These cannot be closed from inside the repository.

| Item | What is needed | State |
| --- | --- | --- |
| Sentry error tracking (ENG-13) | A DSN. Then `SENTRY_DSN` + `SENTRY_ENVIRONMENT` on Render and `VITE_SENTRY_DSN` + `VITE_SENTRY_ENVIRONMENT` on Vercel | Both SDKs implemented, tested and inert |
| Atlas credential rotation (ENG-03) | Rotate in Atlas, update `MONGO_URI` for both services | Outstanding |
| Point-in-time recovery (ENG-15) | Paid Atlas tier | Deliberately deferred |
| Automatic migrations (ENG-14) | Paid Render instance type for `preDeployCommand` | Deliberately deferred |
| Email delivery (PRD-01/02) | A provider account and API key | Not started |

---

## 4. Verified working (not gaps)

Listed so the register is not read as "nothing works" — each was checked against the running system.

| Area | Verified behaviour |
| --- | --- |
| JWT auth | Sign-up, sign-in, `me`, profile, password change, export, delete account; 30-day token in an axios interceptor; Socket.IO handshake verifies the same token; 401 clears the session |
| Real-time | Socket.IO rooms per note, presence maps, cursor broadcast, Yjs CRDT updates persisted, targeted eviction on access revocation, personal `user:<id>` rooms |
| Real-time notifications | Emitted into the recipient's personal room, badge updates live, mark-one/all read, persisted across sessions |
| Validation | zod 4.6.7 on both sides; `validate({ body, params, query })` on every mutating HTTP route |
| Data layer | 13 Mongoose models, 14 idempotent migrations, compound indexes, EJSON round-trip backups verified |
| Containers | Multi-stage images, non-root server, nginx client with health check, compose with Mongo health checks, smoke-tested in CI |
| Deployment | CI (lint/test/build, browser E2E, containers, deploy) green; API live on Render, web on Vercel, `/api/health` reports database state; graceful `SIGTERM`; Vercel preview origins are accepted by CORS |
| Operations | Daily backup workflow, 30-minute uptime check, weekly staging refresh that scrubs identities and verifies counts |
| Quality gates | Server 17/17, client 10/10, browser 5/5, client lint clean, `npm audit` 0 vulnerabilities |

---

## 5. Suggested order

1. **ENG-03** rotate the exposed Atlas password (minutes, real risk).
2. **ENG-01** transactions around the destructive cascades (data loss is the only unrecoverable failure mode here).
3. **PRD-01 + PRD-02** email delivery, reset and verification — the largest product hole, and it unblocks invites.
4. **ENG-02** short-lived tokens with rotation, so a leak stops mattering.
5. **ENG-05 / ENG-06** pagination, then Atlas Search, before note counts make the current caps visible.
6. **ENG-13 + ENG-17 + ENG-19** enable Sentry with source maps, capture a staging load baseline, and extend browser coverage — the feedback loop that keeps the rest honest.
