# Whiteboard Defense: System Architecture & Design Rationale

> **The Whiteboard Defense Standard**  
> *"I should be able to pull you aside at any moment and ask you to explain any customer-facing system you've shipped. You should be able to clearly explain how it works and defend the decisions you made. This is the benchmark for responsible engineering and AI usage."*  
>  
> *"If I ask 'Why did you do X instead of Y?', 'What happens if this actor behaves maliciously?', 'What data structure did you use here and why?', or 'Where does this fail?' you should be able to answer confidently."*

This document provides the exhaustive technical defense, architectural rationale, threat models, data structures, and edge-case failure modes for every customer-facing subsystem in **Otion**.

---

## Quick Navigation
1. [Subsystem 1: Authentication & Token Lifecycle](#1-authentication--token-lifecycle)
2. [Subsystem 2: Document Data Model & Editor Architecture](#2-document-data-model--editor-architecture)
3. [Subsystem 3: Real-Time Synchronization & Socket Handshake](#3-real-time-synchronization--socket-handshake)
4. [Subsystem 4: Authorization Matrix & Access Control](#4-authorization-matrix--access-control)
5. [Subsystem 5: Public Sharing & Secret Hashing](#5-public-sharing--secret-hashing)
6. [Subsystem 6: Notification Triggers & Lifetime Event Dispatch](#6-notification-triggers--lifetime-event-dispatch)
7. [Subsystem 7: Trash Lifecycle, Soft Deletes & Purging](#7-trash-lifecycle-soft-deletes--purging)
8. [Subsystem 8: Request Validation & Injection Defense](#8-request-validation--injection-defense)
9. [Subsystem 9: Containerization & Deployment Pipeline](#9-containerization--deployment-pipeline)

---

## 1. Authentication & Token Lifecycle

### How it works
Authentication in Otion uses signed JSON Web Tokens (JWT) using HMAC-SHA256 (`HS256`). When a user registers or logs in:
1. Passwords are submitted over HTTPS and verified against bcrypt hashes with a work factor of 10 (`bcrypt.compare`).
2. If valid, an ephemeral JWT is signed containing `{ id: user._id, version: user.tokenVersion }` with a 30-day expiration window.
3. Every authenticated request transmits this token in the `Authorization: Bearer <token>` HTTP header.
4. The `protect` middleware decodes the token, checks the signature against `JWT_SECRET`, loads the user from MongoDB, and asserts that the `tokenVersion` in the token matches the current `tokenVersion` in the database record.

### Why X instead of Y?
- **Why JWT with `tokenVersion` instead of server-side Redis sessions?**  
  Redis introduces a stateful cache dependency, requiring eviction policies, memory sizing, connection pooling, and separate high-availability failover. A JWT verified against a `tokenVersion` integer in the primary database gives us stateless token parsing for performance while preserving immediate, cluster-wide revocation capability.
- **Why `tokenVersion` instead of a token blocklist?**  
  A blocklist grows linearly with every logout and requires storage and lookup until expiration. In contrast, `tokenVersion` is a single integer field on the user document. Invalidating every active session (e.g., on password reset or account compromise) simply increments this integer (`$inc: { tokenVersion: 1 }`), rendering all previously minted tokens instantly invalid in $O(1)$ database time.
- **Why graceful email verification instead of hard lockout?**  
  Hard email gates at signup introduce immediate drop-off when emails hit spam filters or SMTP providers experience latency. Otion marks accounts `isEmailVerified: false`, allows immediate workspace onboarding, displays a non-intrusive banner with a resend button, and gates only sensitive account modification operations.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Credential Stuffing / Brute Force** | `authLimiter` restricts login attempts to 10 per 15 minutes per IP. |
| **Token Theft / Leakage** | Tokens are invalidated upon password reset or manual session revocation via `tokenVersion`. Sensitive actions require password re-entry. |
| **Replay Attacks** | Tokens have strict expiration (`30d`). Tokens transmitted over TLS only (`Strict-Transport-Security: max-age=31536000; includeSubDomains`). |
| **Timing Attacks on Passwords** | Bcrypt comparison runs in constant-time per work factor, preventing timing side-channel attacks on password length or matching prefixes. |

### Where does this fail?
- **MongoDB cluster disconnection**: If the primary database is completely unreachable, the `protect` middleware fails closed (500 internal server error or 401 unauthenticated) because it requires a live `User.findById` check to verify `tokenVersion` and user existence.
- **Clock Drift**: Significant NTP clock skew on client machines (> 30 days) can trigger premature token expiration errors.

---

## 2. Document Data Model & Editor Architecture

### How it works
Instead of storing documents as monolithic strings of arbitrary HTML or Markdown, Otion stores each document's content as a structured array of discrete JSON block objects:
```json
[
  {
    "id": "block-17945620",
    "type": "paragraph",
    "text": "Meeting notes for engineering sprint",
    "indent": 0
  },
  {
    "id": "block-17945621",
    "type": "task",
    "text": "Review pull requests",
    "checked": true,
    "indent": 1
  }
]
```
The editor renders blocks as distinct DOM nodes using controlled inputs. A unified reducer handles block splitting (Enter), block deletion (Backspace), indentation changes (Tab / Shift+Tab), and block type transformations via slash commands (`/h1`, `/task`, `/quote`, `/callout`, `/code`).

### Why X instead of Y?
- **Why discrete JSON blocks instead of raw HTML (`contenteditable` innerHTML)?**  
  Raw HTML storage creates an enormous XSS surface area. Browser-native `contenteditable` also injects wildly inconsistent markup across Chrome, Firefox, and Safari (nested `<div>`, `<p>`, or `<br>` tags). Discrete JSON blocks eliminate `dangerouslySetInnerHTML` entirely—every text node is rendered via React text primitives, guaranteeing XSS immunity by design.
- **Why custom block array instead of heavy frameworks (Slate.js, ProseMirror, Quill)?**  
  Slate and ProseMirror require complex nested schemas, substantial bundle sizes (> 150KB gzip), and tricky serialization logic. Otion's flat array with an `indent` attribute supports lists, headers, code, checklists, and quotes while keeping the bundle under 25KB, providing complete predictability during autosave, diffing, and export.
- **Why virtualized list windowing for large notes?**  
  Documents with 1,000+ blocks would create thousands of heavy DOM nodes, degrading input latency. The client calculates viewport bounds and renders only the visible window plus overscan buffer, keeping keystroke latency under 16ms (60 FPS) regardless of note size.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Stored XSS Injection** | Block text is strictly rendered as string children inside React JSX elements. HTML tags like `<script>alert(1)</script>` or `<img onerror=...>` are rendered as harmless literal text. |
| **Document Bombing / Payload Overload** | Zod backend schema restricts document content arrays: maximum 5,000 blocks per document, maximum 20,000 characters per block. Requests exceeding these bounds are rejected with `400 Bad Request`. |
| **NoSQL Operator Injection in Blocks** | Zod enforces each element in the content array is an object conforming to `{ id: string, type: enum, text: string, indent: number, checked: boolean }`. Mongo query operators (`$ne`, `$where`) cannot bypass schema parsing. |

### Where does this fail?
- **True Multi-column Canvas Layouts**: The linear block array represents a vertical stream with indentation. Arbitrary 2D layouts (like infinite whiteboards or complex nested tables) require specialized relational or tree schemas not covered by a linear array.
- **Concurrent Character Collisions**: If two users type into the exact same paragraph block simultaneously, last-write-wins at the block level occurs unless mediated by real-time presence indicators.

---

## 3. Real-Time Synchronization & Socket Handshake

### How it works
Real-time collaboration is powered by Socket.IO on top of the Express HTTP server:
1. **Authentication Handshake**: When connecting, the client passes the JWT token in `socket.handshake.auth.token`. Sockets without a valid token are rejected immediately during the handshake.
2. **Room Scoping**: Clients join note-specific rooms (`note:<noteId>`) and private user rooms (`user:<userId>`).
3. **Permission Check**: Before joining `note:<noteId>`, the server verifies the user's role against MongoDB (`Note` ownership or `SharePermission`).
4. **Presence Tracking**: Ephemeral collaborator presence (who is currently viewing, cursor positions, active editing block) is tracked in memory on the server and broadcasted to room participants.
5. **Revocation Ejection**: When an owner updates permissions or revokes a collaborator's access, the server broadcasts an ejection event (`kicked_from_note`) and removes the revoked socket from the room immediately.

### Why X instead of Y?
- **Why Socket.IO rooms + ephemeral presence instead of WebRTC mesh?**  
  WebRTC requires STUN/TURN infrastructure, complex peer connection state machines, and scales poorly ($O(N^2)$ connections) when more than 4 users view a document. Centralized Socket.IO rooms scale cleanly, allow the server to enforce authorization on every packet, and work reliably behind corporate firewalls and proxies.
- **Why ephemeral presence in server memory instead of database writes?**  
  Cursor movements and active block selections happen several times per second. Writing cursor coordinates to MongoDB would bottleneck the database with thousands of transient writes per minute. Storing presence ephemerally in Node memory ensures zero database load for presence.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Unauthorized Room Eavesdropping** | A socket attempting to emit `join_note` for a note they do not own or have permission for receives an `error` packet and is rejected. |
| **Zombie Connection on Access Revocation** | When permissions are downgraded to unauthorized, the server emits `kicked_from_note` and forcibly executes `socket.leave(room)`. |
| **Socket Connection Flooding** | Handshake validation drops unauthenticated connections before allocating socket resources. Reverse proxy rate limits WebSocket upgrade requests. |

### Where does this fail?
- **Horizontal Scaling without Redis Adapter**: If the backend is scaled across multiple Node.js instances behind a load balancer without the `@socket.io/redis-adapter`, sockets connected to Instance A will not receive broadcast events emitted on Instance B. (Currently single-instance container on Render; multi-instance cluster requires Redis Pub/Sub adapter).

---

## 4. Authorization Matrix & Access Control

### How it works
Otion enforces a strict Role-Based Access Control (RBAC) hierarchy across every document operation:

```
Owner > Editor > Commenter > Viewer
```

1. **Owner**: Full control. Can edit content, delete/archive document, duplicate, invite/remove collaborators, manage roles, configure public links, and view/restore revision history.
2. **Editor**: Can read and edit content, create revisions, leave comments, and view revision history. Cannot delete document or change collaborator permissions.
3. **Commenter**: Can read content and add/delete their own comments. Cannot modify document content or settings.
4. **Viewer**: Read-only access. Cannot modify content or post comments.

Every request runs through the `protect` middleware and evaluates permissions against the `Note` and `SharePermission` collections using indexed compound queries `{ noteId, userId }`.

### Why X instead of Y?
- **Why explicit `SharePermission` collection instead of embedding collaborator arrays inside `Note`?**  
  Embedding collaborators inside the `Note` document causes document bloat, requires complex array update operators (`$elemMatch`, `$pull`), and can trigger MongoDB 16MB document size limits or write contention when permissions change while content is being updated. A normalized `SharePermission` collection allows fast indexed lookups (`{ noteId: 1, userId: 1 }`), clean pagination, and independent auditing.
- **Why hierarchical enum role checking instead of arbitrary capability strings?**  
  Hierarchical roles (`VIEWER: 10, COMMENTER: 20, EDITOR: 30, OWNER: 40`) allow clean comparison operators (`userRole >= REQUIRED_ROLE`). It prevents role drift and guarantees that high-privilege operations cannot be performed by lower tiers.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Insecure Direct Object Reference (IDOR)** | Route parameters like `req.params.id` are never trusted blindly. Every controller checks `getNoteAccess(noteId, userId)`. If access is insufficient, it returns `403 Forbidden` (or `404 Not Found` to prevent resource enumeration). |
| **Privilege Escalation** | Only the document Owner can call `PATCH /api/share/:noteId/permissions`. Editors or Commenters attempting this receive `403 Forbidden`. |
| **Malicious Self-Promotion** | Users cannot grant themselves roles; all invitations and permissions must originate from the authenticated Owner. |

### Where does this fail?
- **Orphaned Permissions**: If a note were deleted using a low-level MongoDB driver bypass instead of the controller, associated `SharePermission` records would remain orphaned. To prevent this, Otion's `deleteNote` controller performs a transactional/cascading cleanup of `SharePermission`, `Comment`, `PublicShare`, and `NoteRevision` records.

---

## 5. Public Sharing & Secret Hashing

### How it works
Otion allows users to publish documents to the open web via revocable, tokenized links:
1. **Token Generation**: Instead of exposing the database `_id`, the server generates a high-entropy cryptographically secure token:
   ```javascript
   const token = crypto.randomBytes(32).toString('base64url');
   ```
2. **Password Protection**: Users can optionally protect the public link with a password. If supplied, the password is encrypted using `bcrypt.hash(password, 10)` before storage in the `PublicShare` collection.
3. **Time-Based Expiration**: Links can have an optional `expiresAt` date.
4. **Resolution Flow**:
   - `GET /api/public/:token`: Checks if public sharing is enabled and not expired. If password-protected and not unlocked, returns `{ isPasswordProtected: true, title: "Protected Document" }` without content.
   - `POST /api/public/:token/unlock`: Validates the submitted password using `bcrypt.compare`. If correct, returns a short-lived scoped read token allowing content retrieval.

### Why X instead of Y?
- **Why random crypto tokens instead of slugified titles?**  
  Slugified titles (`/public/my-secret-meeting`) are predictable, enumerable, and collide when different users choose identical titles. Cryptographically secure 256-bit random tokens provide 2048 bits of entropy, making URL brute-forcing mathematically impossible.
- **Why Bcrypt hashing for public share passwords instead of plain text or MD5?**  
  Even for public shares, users often reuse personal passwords. Storing plain text or weak hashes exposes users in the event of database leaks. Bcrypt ensures zero plaintext exposure and prevents rainbow-table lookups.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Public Token Guessing / Scraping** | 256-bit `base64url` token has $2^{256}$ combinations. Rate limiting rejects rapid scanning. |
| **Password Brute Forcing on Protected Note** | `publicUnlockLimiter` enforces a strict rate limit: maximum 5 unlock attempts per minute per IP. Exceeding this returns `429 Too Many Requests`. |
| **Data Leakage of Private Metadata** | The public endpoint strictly projects only `{ title, content, icon, updatedAt }`. Collaborator lists, revision histories, owner email, and internal `_id` are never included in public responses. |

### Where does this fail?
- **Shared Link Leakage by Authorized Viewers**: Once a public URL without password is sent to a third party, anyone with the link can view it until the owner clicks "Revoke Public Link" or the link hits its expiration timestamp.

---

## 6. Notification Triggers & Lifetime Event Dispatch

### How it works
Notifications provide a closed-loop audit and collaboration trail.
1. **Trigger Points**:
   - Collaborator added to a note $\rightarrow$ triggers notification for recipient.
   - Collaborator role modified $\rightarrow$ triggers notification for recipient.
   - Comment posted on a note $\rightarrow$ triggers notifications for note owner and active thread participants.
   - Note access revoked $\rightarrow$ triggers notification for recipient.
2. **Real-Time Push**: When a notification is saved to MongoDB, the server dispatches a real-time event to the user's private socket room (`user:<recipientId>`):
   ```javascript
   io.to(`user:${recipientId}`).emit('notification_received', notification);
   ```
3. **Unread Counter & Persistence**: Notifications are stored in MongoDB with `{ isRead: false, createdAt: Date }`. The client displays an unread counter badge that updates instantly upon receipt and clears when marked read.

### Why X instead of Y?
- **Why hybrid Socket.IO push + MongoDB persistence instead of pure WebSockets?**  
  Pure WebSockets drop messages if the user is offline or experiencing network reconnects. Persisting to MongoDB ensures that notifications survive app restarts and are delivered immediately whenever the user logs back in.
- **Why private user socket room (`user:<userId>`) instead of broadcasting?**  
  Broadcasting notifications globally and filtering on the client leaks sensitive workspace activity to unauthorized listeners. Scoping broadcasts to `user:<userId>` guarantees strict tenant isolation.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Notification Spamming via Comments** | Adding comments is restricted to authenticated Users with Editor or Commenter roles, protected by rate limiting. |
| **Cross-User Notification Reading** | `GET /api/notifications` strictly filters `{ userId: req.user._id }`. Users cannot view or acknowledge another user's notifications. |

### Where does this fail?
- **High-Velocity Document Collaboration**: A document with 100 simultaneous comments in 5 minutes could trigger 100 individual notification entries. A production optimization would introduce notification batching/digest aggregation (e.g., "Maya and 4 others commented on Design Specs").

---

## 7. Trash Lifecycle, Soft Deletes & Purging

### How it works
When a user deletes a note from their sidebar or editor:
1. **Soft Delete**: The note is not removed from MongoDB. Its `isArchived` flag is flipped to `true`, and `archivedAt` is stamped with the current UTC timestamp:
   ```javascript
   await Note.findByIdAndUpdate(noteId, { isArchived: true, archivedAt: new Date() });
   ```
2. **View Isolation**: The main dashboard and sidebar queries explicitly filter `{ isArchived: { $ne: true } }`.
3. **Trash Bin**: The Trash view queries `{ isArchived: true }`. Users can view deleted notes, restore them to the active workspace, or permanently delete them.
4. **Permanent Purge**: Clicking "Delete Forever" triggers a permanent deletion cascading across notes, comments, permissions, and revisions.

### Why X instead of Y?
- **Why soft delete instead of immediate `deleteOne`?**  
  Accidental deletions are the most common source of data loss in document management tools. Soft deletes provide zero-friction undo, allow restoring complex block structures, and protect against malicious or accidental bulk deletes.
- **Why explicit Trash view instead of hidden archive?**  
  Giving users explicit visibility into their Trash empowers self-service recovery without requiring database administrator intervention or backup restoration.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Unauthorized Trashing by Collaborator** | Only the document `Owner` is authorized to archive or delete a note. Editors receive `403 Forbidden` if attempting to archive. |
| **Permanent Deletion of Another User's Trash** | `DELETE /api/notes/:id` asserts ownership before executing deletion. |

### Where does this fail?
- **Storage Accumulation**: Soft-deleted documents continue to occupy database storage indefinitely until manually purged. (A scheduled TTL index or cron job can be enabled to auto-purge notes in trash older than 30 days).

---

## 8. Request Validation & Injection Defense

### How it works
Every incoming HTTP request in Otion passes through a declarative validation layer built with **Zod**:
1. Schemas define the exact allowable shape of `body`, `query`, and `params` for every endpoint in [server/validation/schemas.js](file:///home/ram/Documents/Projects/Otion/server/validation/schemas.js).
2. The `validate` middleware executes schema parsing before the controller is invoked:
   ```javascript
   router.post('/', protect, validate({ body: notes.create }), createNote);
   ```
3. If validation fails, the middleware immediately terminates the request with a structured `400 Bad Request` containing specific field-level error messages:
   ```json
   {
     "message": "Validation failed",
     "errors": [{ "field": "title", "message": "Title is required" }]
   }
   ```

### Why X instead of Y?
- **Why Zod instead of manual `if (!req.body.title)` checks?**  
  Manual validation is error-prone, inconsistent, and frequently misses edge cases (empty strings, unexpected types, array injection, overflow strings). Zod provides strict type coercion, regex validation, length bounds, and automated schema enforcement.
- **Why Zod instead of Joi or express-validator?**  
  Zod is TypeScript-first, zero-dependency, and allows schema sharing between backend and frontend logic, ensuring consistent validation logic across both tiers.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **NoSQL Operator Injection** (`{"$gt": ""}`) | Zod asserts that fields are primitive strings (`z.string()`). Objects containing MongoDB operators fail schema validation and are rejected with 400. |
| **Mass Assignment / Parameter Pollution** | Zod strips or rejects unexpected properties not declared in the schema, preventing attackers from injecting fields like `isAdmin: true` or `tokenVersion: 99`. |
| **Buffer Overflow / Memory Exhaustion** | All string fields enforce strict `.max()` limits (e.g., titles max 200 chars, block text max 20,000 chars, passwords max 128 chars). |

### Where does this fail?
- **Unvalidated Custom Query Parameters**: If a developer creates a new route and fails to attach the `validate` middleware, that route defaults to Express's native body parsing without schema enforcement.

---

## 9. Containerization & Deployment Pipeline

### How it works
The entire Otion ecosystem is containerized, distributed via Docker Hub, and deployed using container-first infrastructure:
1. **Multi-Stage Server Dockerfile**:
   - *Stage 1 (Builder)*: Installs production dependencies with `npm ci --omit=dev`.
   - *Stage 2 (Runtime)*: Uses lightweight `node:20-alpine`, creates a dedicated non-root user (`node`), copies minimal production artifacts, exposes port 5000, and defines a container health check against `/api/health`.
2. **Multi-Stage Client Dockerfile**:
   - *Stage 1 (Build)*: Runs `npm run build` using Vite.
   - *Stage 2 (Nginx)*: Serves static assets using `nginx:alpine` with gzip compression, security headers, and SPA fallback routing (`try_files $uri /index.html`).
3. **Container-First Deployment on Render**:
   - Render is configured via `render.yaml` with `runtime: image` pointing to `docker.io/rampanjwani/otion-server:latest`.
   - Instead of cloning Git and installing packages with `npm ci` on every deploy, Render pulls the pre-built, immutable image directly from Docker Hub.
4. **CI/CD Pipeline** ([.github/workflows/ci.yml](file:///home/ram/Documents/Projects/Otion/.github/workflows/ci.yml)):
   - **Job 1: Lint & Unit Tests**: Runs ESLint and Node test runners across client and server.
   - **Job 2: E2E Playwright Tests**: Boots isolated MongoDB, seeds test database, and runs full end-to-end browser workflows.
   - **Job 3: Container Build, Smoke & Push**: Builds Docker images, validates container networking through Nginx, and pushes release tags (`rampanjwani/otion-server:latest`, `rampanjwani/otion-client:latest`) to Docker Hub.
   - **Job 4: Automated Deployment**: Dispatches deploy triggers for zero-downtime container rolling restart on Render and edge deployment on Vercel.

### Why X instead of Y?
- **Why deploy through prebuilt Docker images instead of building from GitHub on the host?**  
  Deploying through Docker images provides **immutable, hermetic artifacts**. Building from Git directly on production servers suffers from "works on my machine" drift, slow build times (running `npm ci` and compiling dependencies on constrained server CPUs), potential npm registry outages, and exposed build-tool vulnerabilities in the runtime environment. Docker images ensure that the exact container binary tested and passed in CI is what runs in production.
- **Why multi-stage Docker builds instead of single-stage images?**  
  Single-stage builds leave compiler toolchains, package manager caches, and development dependencies in the final image, resulting in image sizes > 1 GB. Multi-stage builds produce ultra-lean images (~120 MB for server, ~25 MB for client), decreasing vulnerability attack surface and pull times.
- **Why non-root container user (`USER node`)?**  
  Running containers as `root` is a security risk. If an application vulnerability allows arbitrary code execution or container breakout, the attacker gains root host privileges. Running as `node` confines the attacker to an unprivileged user.

### Malicious Actor Threat Model
| Threat | Mitigation in Otion |
| :--- | :--- |
| **Container Escape / Privilege Escalation** | `USER node` ensures process runs without root capabilities. Read-only filesystem layers protect system binaries. |
| **DDoS on API Server** | Express rate limiting (`500 requests / 15 minutes` general, `10 requests / 15 minutes` auth) + reverse proxy throttling on Render. |
| **Supply Chain Vulnerability in Dependencies** | Lockfiles (`package-lock.json`) enforced via `npm ci`. Automated security scanning in GitHub Actions. |

### Where does this fail?
- **Ephemeral Container Storage**: Containers are stateless. Any file written to the container local filesystem is lost on restart or redeployment. Otion mitigates this by storing all persistent state in MongoDB Atlas and asset images via external CDNs/URLs.
