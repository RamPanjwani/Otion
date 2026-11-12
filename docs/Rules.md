# Rules & Conventions — Otion

Binding conventions for anyone changing this repository. Product scope is in [`PRD.md`](./PRD.md),
the data model in [`Database.md`](./Database.md) and contracts in [`API.md`](./API.md).

## 1. Approved stack

Do not add a library when the existing stack already solves the problem. Approved versions are the
ones in `client/package.json` and `server/package.json`; `Vite 8`, `React 19`, `Tailwind 4`,
`Express 5`, `Mongoose 9`, `Socket.IO 4`, `Yjs 13` and `Zod` are the current majors. Upgrade majors
only with a migration note and a passing CI run.

| Need | Use | Do not use |
| --- | --- | --- |
| Client state | React Context + custom hooks | Redux, MobX, Zustand |
| Styling | Tailwind utilities + CSS tokens in `client/src/index.css` | CSS-in-JS, UI kits, second icon set |
| Icons | `lucide-react` | Duplicate icon libraries |
| Animation | `motion` | Raw keyframe libraries |
| HTTP | `client/src/services/api.js` (Axios instance) | Bare `fetch` in components |
| Realtime | `client/src/services/socket.js` + `useCollaborativeNote` | Per-component socket instances |
| Editor state | Yjs (`Y.Doc`, `Y.Text`, `Y.Array`) | Local undo stacks or polling |
| Validation | Zod schemas in `server/validation/schemas.js` | Hand-rolled body checks |
| Passwords / tokens | `bcryptjs`, `node:crypto` hashing | Plaintext storage, MD5/SHA-1 |
| Auth transport | JWT Bearer `Authorization` header | Cookies, query-string tokens |
| Dates | native `Date`, ISO strings over the API | Date libraries |

Adding a dependency requires: a concrete need, a maintained package, a production audit result that
does not raise the level beyond `critical`, and a note in the PR description.

## 2. Design tokens

Tokens are defined as Tailwind 4 CSS variables in `client/src/index.css` and used through utility
classes (`bg-canvas`, `text-ink`, `border-line`, …). Never hard-code hex values in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-canvas` | `#fbfbfa` | `#191919` | Page background |
| `--color-surface` | `#ffffff` | `#202020` | Cards, panels, popovers |
| `--color-elevated` | `#ffffff` | `#252525` | Menus, modals above surfaces |
| `--color-panel` | `#f1f1ef` | `#242424` | Sidebar, muted rows |
| `--color-ink` | `#2f3437` | `#f1f1ef` | Primary text |
| `--color-muted` | `#787774` | `#9b9a97` | Secondary text, placeholders |
| `--color-line` | `#e9e9e7` | `#30302f` | Borders and dividers |
| `--color-accent` | `#6d5dfc` | `#a89fff` | Active states, links, focus accents |
| `--color-accent-soft` | `#eeeaff` | `#28233f` | Selected rows, callout backgrounds |
| `--color-action` | `#2f3437` | `#f1f1ef` | Primary button background |
| `--color-action-hover` | `#202426` | `#ffffff` | Primary button hover |
| `--color-action-foreground` | `#ffffff` | `#202020` | Primary button label |
| `--color-focus` | `#8b7dfd` | `#a89fff` | Focus rings |
| `--radius-xl` | `0.75rem` | — | Cards, modals, menus |

Layout rules:

- Fixed sidebar `15rem` (`w-60`); content offset via `padding-left: 15rem` at `md` and above.
- Content column `max-w-3xl` with generous vertical rhythm; no full-bleed text.
- Radius: `rounded-lg`/`rounded-xl` only. Shadows stay subtle; borders do the separation.
- Typography: Inter first, system sans fallback; editor body 16 px with `1.75` line height.
- Motion: 120–200 ms transitions, transform/opacity only, disabled under `prefers-reduced-motion`.
- Touch targets at least 36 px; icon buttons carry `title` and `aria-label`.

## 3. Code conventions

### Client

- Function components with hooks only; no class components.
- Route components are lazy-loaded in `App.jsx`; protected routes use the shared auth guard.
- Context objects live in `context/*Instance.js` so component files export only components (React
  Fast Refresh). Import the context from the instance file, not from the provider file.
- Data access via hooks (`useNotes`, `useCollaborativeNote`, …) that call `services/api.js`.
- Keep JSX readable: extract subcomponents before a file passes ~300 lines; no nested ternaries in
  props.
- Comments explain intent only; `catch` blocks must either handle, rethrow or state why they are
  intentionally empty (ESLint `no-empty`).

### Server

- Keep the route → controller → service → model layering. Routes only wire middleware.
- Every protected route uses `protect`; every mutating route validates with Zod via `validate`.
- Authorization is explicit in the controller (`roleForNote`, owner checks). Never rely on the
  client to hide controls.
- Responses use the shared error envelope; never `res.status(500).send(error)`.
- Emit socket events after the database write succeeds, to the narrowest room that needs them.
- Reuse services (`workspaceService`, `revisionService`, `collaborationService`) instead of
  duplicating logic.

### Naming

- Files: `PascalCase.jsx` for components and pages, `camelCase.js` for hooks/utilities/services,
  `kebab-case.js` for migrations (`014-workspace-role-guests.js`).
- Collections: lowercase plural (`sharepermissions`, `collaborationupdates`); models `PascalCase`.
- API fields: `camelCase`; IDs always `_id`.

## 4. Data rules

- `Note._id` is the only identity; never accept a title as a key.
- Notes are flat. Ordering is per user in `UserNotePreference.sortOrder`, never on the note.
- Mutating a note increments `revisionCounter` and records a revision (automatic throttled to 5
  minutes, manual always).
- Archiving hides a note from collaborators and public links; only the owner can archive.
- CRDT snapshots and update logs are disposable caches of `Note.content`; they can be rebuilt.
- New collections and indexes ship as a numbered migration in `server/migrations/` and are applied
  with `npm run migrate`; never rely on `autoIndex` in production.

## 5. Security rules

- Secrets only from environment variables; never commit `.env` files. Client-exposed values must be
  prefixed `VITE_`.
- Passwords: bcrypt cost 12, never logged, never returned. Public-link passwords are bcrypt hashes.
- Store only hashes of public-link and invitation tokens; return raw tokens exactly once.
- Validate and escape all input; search terms are regex-escaped; JSON bodies capped at 1 MB.
- Authorize on every read and write, including each socket event. Return `404` for notes the caller
  cannot see.
- Never add a permissive CORS origin: extend `CLIENT_URLS` instead.
- Rate limit new public or auth-adjacent endpoints; keep limits per IP.

## 6. Git & review

- Branches: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Commits are imperative and scoped: `fix(editor): keep caret when toggling bold`.
- A pull request must pass `verify` (server tests, client lint/tests/build, audits) and `docker`.
- Update the relevant document in the same PR as the behaviour change: `API.md` for contracts,
  `Database.md` for schema, `Memory.md` for delivered features, this file for conventions.
- Never commit generated output (`client/dist`, logs) or dependency directories.

## 7. Local verification

```bash
cd server && npm run check && npm test && npm audit --omit=dev
cd ../client && npm run lint && npm test && npm run build && npm audit --omit=dev
```

Docker changes additionally require `docker compose config --quiet`, an image build for the touched
service and a health probe through the client container — CI's `docker` job performs all three.
