# Mini Project Evaluation & Demonstration Guide

> **Mini Project Evaluation Checklist**  
> *Students are expected to demonstrate and explain their implementation based on the following checklist (compulsory for all to complete):*  
> - **Frontend with Tailwind CSS**  
> - **React & State Management**  
> - **Backend REST API**  
> - **MongoDB & Mongoose**  
> - **Data Validation**  
> - **Authentication & Authorization**  
> - **Real-Time Features (Socket.IO)**  
> - **Docker**  
> - **DevOps & Deployment**  
> - **Live Walkthrough**: Demonstrating triggers, lifetime notifications, authentication, data validation, and core features.

---

## 1. Quick Reference & Live Links

| Resource | URL / Command | Notes |
| :--- | :--- | :--- |
| **Production Web App** | [https://otion-nine.vercel.app](https://otion-nine.vercel.app) | Deployed on Vercel Edge CDN |
| **Production API** | [https://otion-api.onrender.com/api/health](https://otion-api.onrender.com/api/health) | Deployed on Render Web Service |
| **Live Public Note** | [Public Onboarding Guide](https://otion-nine.vercel.app/public/7tBUfb590k4LsHG_W6qS7KSzpIWuxISiIsU1nuXmJd4) | Tokenized read-only link |
| **Demo Owner Account** | `demo@otion.app` / `OtionDemo123!` | Primary demo account |
| **Collaborator Account** | `maya@otion.app` / `OtionDemo123!` | Editor role for real-time testing |
| **Viewer Account** | `sam@otion.app` / `OtionDemo123!` | Viewer / Commenter role |
| **Docker Hub API** | [`rampanjwani/otion-server:latest`](https://hub.docker.com/r/rampanjwani/otion-server) | Multi-stage Node.js container deployed on Render |
| **Docker Hub Client** | [`rampanjwani/otion-client:latest`](https://hub.docker.com/r/rampanjwani/otion-client) | Multi-stage Nginx container image |
| **Cloud Deployment** | Vercel + Render (Docker Image) | **Zero local deployment**: 100% cloud-deployed |

---

## 2. Technical Checklist Verification

### 1. Frontend with Tailwind CSS
- **Framework**: Tailwind CSS v4 configured via `@tailwindcss/vite`.
- **Design System**: Monochromatic, high-contrast, minimalist theme (`#000000`, `#ffffff`, neutral grays).
- **Responsive Layout**: Fluid breakpoints (`sm`, `md`, `lg`, `xl`) supporting desktop, tablet, and mobile displays. Collapsible sidebar with drawer animation on mobile devices.
- **Accessibility**: Semantic HTML5 tags, full keyboard navigation, `aria-label` attributes, and WCAG AA contrast compliance.

### 2. React & State Management
- **React Version**: **React 19** (`react@^19.2.8` & `react-dom@^19.2.8`) bundled with **Vite 8**.
- **Routing**: `react-router-dom` v7 with code-split lazy routes (`Login`, `Register`, `Dashboard`, `Editor`, `Trash`, `Settings`, `PublicNote`).
- **State Management Architecture**:
  - `AuthContext`: Centralized authentication state managing JWT tokens, user profiles, verification status, and login/logout lifecycles.
  - `NotesContext` / `useNotes`: Document collection state with optimistic UI updates for instant typing, block reordering, and favoriting.
  - `useSocket`: Manages WebSocket lifecycle, room subscriptions, active presence cursors, and real-time collaboration events.
- **Performance Optimization**: Virtualized list windowing for large notes (> 500 blocks), debounced autosave (800ms), and memoized block rendering.

### 3. Backend REST API
- **Runtime & Framework**: Node.js v22+ with Express.js.
- **Clean Architecture**: Controller-Service-Repository pattern with isolated route handlers:
  - `/api/auth`: Register, login, forgot password, reset password, email verification.
  - `/api/notes`: CRUD operations, reordering, duplicate, archive, trash emptying.
  - `/api/share`: Collaborator management, role assignment, revocation.
  - `/api/public`: Tokenized public document resolution and password unlocking.
  - `/api/notifications`: Lifetime user notifications, unread count, read receipts.
  - `/api/comments`: Note-level discussions, threaded replies.
  - `/api/health`: Automated readiness and MongoDB connection probes.
- **Middleware Pipeline**: Security headers (`helmet`), CORS whitelisting, rate limiting (`express-rate-limit`), JSON body parsing, and centralized error handling.

### 4. MongoDB & Mongoose
- **Database Engine**: MongoDB 7.0 Atlas Cloud Database (Replica Set).
- **ODM**: Mongoose v8 with typed schemas and strict validation.
- **Collections & Data Models**:
  - `User`: Accounts, hashed credentials, verification flags, and session `tokenVersion`.
  - `Note`: Hierarchical block contents, owner references, timestamps, archive flags.
  - `SharePermission`: Normalized collaborator roles (`owner`, `editor`, `commenter`, `viewer`).
  - `PublicShare`: High-entropy 256-bit crypto tokens, expiration dates, bcrypt password hashes.
  - `Comment`: Collaborative note discussions with user associations.
  - `Notification`: Lifetime triggers, read status, and user linkages.
  - `NoteRevision`: Historical document snapshots for audit and point-in-time recovery.
- **Indexing Strategy**:
  - Compound indexes: `{ noteId: 1, userId: 1 }` on `SharePermission`.
  - Filter indexes: `{ userId: 1, isArchived: 1, isFavorite: 1 }` on `Note`.
  - Text search indexes: `{ title: 'text', 'content.text': 'text' }` for lightning-fast search.
- **Database Migrations**: Standalone migration runner (`npm run migrate`) with version tracking in `_migrations`.

### 5. Data Validation
- **Validation Engine**: Declarative schema validation using **Zod**.
- **Request Gatekeeper**: Express middleware parses `req.body`, `req.query`, and `req.params` against schemas before reaching controllers.
- **Schema Guarantees**:
  - Input sanitization preventing NoSQL operator injection (`$gt`, `$where`).
  - Bounds checking: String lengths (e.g. passwords $\le 128$, titles $\le 200$, block texts $\le 20,000$).
  - Type safety: Strict validation of UUIDs, ObjectIds, enums, and boolean flags.
  - Automatic error responses: Standardized `400 Bad Request` with field-by-field error mappings.

### 6. Authentication & Authorization
- **Password Security**: Bcrypt with salt rounds = 10; constant-time hash comparisons.
- **JWT Architecture**: HMAC-SHA256 signed tokens containing user ID and `tokenVersion`.
- **Instant Revocation**: Incrementing `tokenVersion` on password change or account compromise invalidates all active sessions without a stateful cache.
- **Role-Based Access Control (RBAC)**: Strict hierarchy (`Owner > Editor > Commenter > Viewer`). Protected route middleware guarantees unauthorized users cannot modify or view private documents.
- **Graceful Email Verification**: Seamless immediate sign-in with non-blocking verification alerts and protected security endpoints.

### 7. Real-Time Features (Socket.IO)
- **Engine**: Socket.IO with WebSocket transport and fallback polling.
- **Handshake Authentication**: Tokens validated during socket handshake; unauthenticated connections rejected immediately.
- **Room Scoping**: Multi-tenant isolation using `note:<noteId>` and private user rooms `user:<userId>`.
- **Presence Indicators**: Live collaborator avatars, active cursor blocks, and typing status.
- **Dynamic Access Revocation**: Immediate `kicked_from_note` broadcast ejecting users when permissions are revoked by an owner.

### 8. Docker & Containerization
- **Backend Container**: Multi-stage build based on `node:22-alpine`, non-root execution (`USER node`), health checks, image size ~120MB.
- **Frontend Container**: Multi-stage build using Vite and `nginx:alpine`, SPA routing (`try_files`), Brotli/Gzip compression, image size ~25MB.
- **Docker Hub Images**: Multi-platform container images published to Docker Hub at [`rampanjwani/otion-server:latest`](https://hub.docker.com/r/rampanjwani/otion-server) and [`rampanjwani/otion-client:latest`](https://hub.docker.com/r/rampanjwani/otion-client).
- **Cloud-Native Deployment**: We strictly use Docker images to deploy on cloud platforms (Render and Vercel). Local deployment has been removed.

### 9. DevOps & Deployment
- **Render Cloud Service (Docker Image)**: Render is configured with `runtime: image` in `render.yaml` to pull and run `docker.io/rampanjwani/otion-server:latest` directly from Docker Hub, providing full WebSocket and Express 5 support without build-step overhead.
- **Vercel Cloud Platform (Edge CDN)**: Vercel hosts the single-page application at [https://otion-nine.vercel.app](https://otion-nine.vercel.app) with global edge distribution, automatic TLS, and SPA rewrite rules.
- **MongoDB Atlas**: Managed cloud database replica set hosting all collections, indexes, and seeded demo accounts.
- **CI/CD Pipeline**: Automated GitHub Actions workflow ([.github/workflows/ci.yml](file:///home/ram/Documents/Projects/Otion/.github/workflows/ci.yml)) running 4 stages:
  1. *Lint & Test*: ESLint, client unit tests, server integration tests.
  2. *Browser E2E*: Playwright automated browser test suite against live MongoDB.
  3. *Docker Build, Smoke & Push*: Builds images, validates container networking through Nginx, and pushes latest release tags to Docker Hub.
  4. *Production Deploy*: Dispatches zero-downtime redeployment triggers to Render and Vercel.

---

## 3. Step-by-Step Live Demonstration Script

Follow this structured script during your evaluation presentation:

### Step 1: Authentication & JWT Verification
1. Open [https://otion-nine.vercel.app](https://otion-nine.vercel.app) in your primary browser.
2. Log in using `demo@otion.app` / `OtionDemo123!`.
3. Open Developer Tools $\rightarrow$ Application / Local Storage:
   - Point out the stored JWT `token` and `user` object.
   - Explain how the token includes `id` and `tokenVersion` for instantaneous session revocation.
4. Show the registration and forgot-password pages; demonstrate the graceful email verification banner.

### Step 2: Dashboard, Search & Document Organization
1. Showcase the workspace dashboard:
   - Pinned favorites ("Welcome to Otion", "Launch checklist").
   - Filter tabs: All Notes, Favorites, and Trash.
2. Demonstrate real-time search:
   - Type in the search box; show instant full-text filtering across note titles and block content.
3. Demonstrate document creation: Click "+ New Page" to instantiate a blank note with instant redirect.

### Step 3: Block Editor & Interaction
1. Open the "Welcome to Otion" note.
2. Demonstrate block editing:
   - Type text into a block. Show the "Saving..." $\rightarrow$ "Saved" debounced indicator.
   - Type `/` to open the Slash Command Menu: change block type to `Heading 1`, `Task List`, `Callout`, `Quote`, or `Code`.
   - Press `Tab` and `Shift+Tab` to adjust indentation levels.
   - Complete a task list item by checking the checkbox.
3. Show Note Statistics: Reveal the word count, character count, and reading time badge in the header.

### Step 4: Real-Time Collaboration & Presence (Dual Window)
1. Open a second browser (or Incognito window).
2. Log in with the second collaborator account: `maya@otion.app` / `OtionDemo123!`.
3. As `demo@otion.app`, open "Design sync notes" (which is shared with Maya).
4. As `maya@otion.app`, open the same note.
5. **Show Real-Time Presence**:
   - Point out Maya's avatar appearing in the top navigation header on Demo's screen.
   - Click a block as Maya; show the live colored cursor border appearing on Demo's screen.
   - Type text as Maya; observe instantaneous synchronization without page refreshes.

### Step 5: Notifications & Trigger Lifetimes
1. In Maya's window, navigate to the Comments sidebar on the document and post a comment: *"Looks great! Let's ship it."*
2. Look at Demo's window:
   - The Notification Bell icon immediately receives a live badge counter increment via Socket.IO (`user:<userId>` room).
   - Click the bell to reveal the notification dropdown showing: *"Maya Chen commented on Design sync notes"*.
   - Click the notification to mark it as read and jump directly to the comment thread.

### Step 6: Sharing, Permissions & Public Links
1. Click the "Share" button in the top right.
2. Show Collaborator Management:
   - Explain role hierarchy: Owner, Editor, Commenter, Viewer.
   - Demonstrate changing Maya's role or inviting a new email.
3. Show Public Link Publishing:
   - Toggle "Publish to web".
   - Show the generated URL: `https://otion-nine.vercel.app/public/7tBUfb590k4LsHG_W6qS7KSzpIWuxISiIsU1nuXmJd4`.
   - Explain how public sharing uses a 256-bit cryptographic token rather than exposing the document ID.
   - Open the public link in a separate private window with no login: show clean, read-only document rendering.

### Step 7: Trash Lifecycle & Data Recovery
1. Select a document and click "Move to Trash".
2. Show that it immediately disappears from the main sidebar and workspace.
3. Navigate to the "Trash" page in the sidebar:
   - Show the archived document with its deletion timestamp.
   - Click "Restore" $\rightarrow$ document immediately returns to the active workspace.
   - Show "Empty Trash" / "Delete Forever" and explain the cascading permanent delete process.

### Step 8: Cloud Container Deployment & CI/CD Pipeline
1. **Show Live Render Container Service**: Open `https://otion-api.onrender.com/api/health` and the Render Dashboard. Explain that Render runs the service using `runtime: image` pulling `docker.io/rampanjwani/otion-server:latest` directly from Docker Hub, eliminating server compilation and build-environment drift.
2. **Show Live Vercel Edge Deployment**: Open `https://otion-nine.vercel.app` and demonstrate fast edge routing, client-side caching, and secure proxying to the Render container API.
3. **Show Docker Hub Repositories**: Show public multi-stage production images [`rampanjwani/otion-server:latest`](https://hub.docker.com/r/rampanjwani/otion-server) and [`rampanjwani/otion-client:latest`](https://hub.docker.com/r/rampanjwani/otion-client).
4. **Show Non-Root Container Security**: Highlight that container images run as `USER node` on Alpine Linux rather than root for defense-in-depth against container breakout.
5. **Show GitHub Actions Automated CI/CD**: Open GitHub Actions tab: show that every push runs lint, tests, builds the Docker images, smoke-tests container networking, pushes to Docker Hub, and triggers cloud deployment on Render and Vercel.

---

## 4. Expected Evaluation Q&A

### Mandatory Questions

#### Q1: Have you applied JWT?
**Answer:**  
Yes. We use HMAC-SHA256 signed JSON Web Tokens (`jsonwebtoken` library) with a 30-day validity window. The token payload encodes the user's `id` and `tokenVersion`. Every private request passes this token in the `Authorization: Bearer <token>` header. Our `protect` middleware verifies the digital signature against `JWT_SECRET` and checks that the token's `tokenVersion` matches the current record in MongoDB. If a user resets their password or logs out of all devices, the server increments `tokenVersion`, instantly invalidating existing tokens across the entire cluster without needing a stateful Redis cache.

#### Q2: Are you doing data validation?
**Answer:**  
Yes, exhaustively on both frontend and backend using **Zod**. Every API route attaches a `validate` middleware that asserts strict schemas for `req.body`, `req.params`, and `req.query` before any controller execution. If the request contains invalid types, missing required fields, or characters exceeding defined limits (e.g., titles > 200 chars or malicious MongoDB operator objects like `{"$gt": ""}`), the middleware terminates the request immediately with a structured `400 Bad Request` listing the exact invalid fields.

#### Q3: Have you deployed it?
**Answer:**  
Yes. **We do not deploy locally; local deployment has been completely removed in favor of cloud-native production deployment on Vercel and Render using Docker container images:**
- **Backend API (Render Container Deployment)**: Render is configured with `runtime: image` in `render.yaml`, pulling the prebuilt container directly from `docker.io/rampanjwani/otion-server:latest` on Docker Hub. Render runs the container with WebSockets, health probes, and cloud connection to MongoDB Atlas.
- **Frontend SPA (Vercel Cloud Platform)**: Deployed to Vercel ([https://otion-nine.vercel.app](https://otion-nine.vercel.app)) with worldwide edge caching, automatic SSL, and rewrite rules. Also published as a container image on Docker Hub (`rampanjwani/otion-client:latest`).
- **Cloud Database (MongoDB Atlas)**: Hosted on a MongoDB 7.0 cloud replica set with all 13 migrations applied and pre-seeded demo accounts (`demo@otion.app`, `maya@otion.app`, `sam@otion.app`).
- **Continuous Deployment (GitHub Actions)**: Automated CI builds Docker images, validates container health, pushes to Docker Hub, and deploys to Render and Vercel.

#### Q4: Which React applications / version are you using?
**Answer:**  
We are using **React 19** (`19.2.8`) with `react-dom` bundled via **Vite 8**. We use `react-router-dom` v7 for client-side routing with lazy-loaded route chunks, and **Tailwind CSS v4** with `@tailwindcss/vite` for styling. State management uses React Context (`AuthContext`, `NotesContext`, `SocketContext`) coupled with custom hooks for optimistic updates, virtualized rendering for long documents, and WebSocket event synchronization.

---

### Additional Examiner Questions & Defenses

#### Q5: How do you prevent NoSQL injection in MongoDB?
**Answer:**  
NoSQL injection typically occurs when unvalidated user input contains MongoDB query operators like `{"$ne": null}` or `{"$gt": ""}`. We prevent this in two complementary ways:
1. **Zod Schema Validation**: Every query and body parameter is parsed against strict primitive schemas (e.g., `z.string()`). Any object passed where a string is expected is rejected with a 400 error.
2. **Mongoose Parameterized Casts**: Mongoose strictly casts schema fields according to their defined types (`ObjectId`, `String`, `Boolean`), stripping out arbitrary query operators.

#### Q6: What happens if two users edit the same document simultaneously?
**Answer:**  
Otion approaches concurrent editing through real-time presence awareness and block-level architecture:
1. **Live Presence Cursors**: Socket.IO broadcasts which block each user is currently focused on, rendering colored indicator borders so collaborators naturally avoid typing in the same paragraph.
2. **Block-Level Operations**: Edits are structured as discrete block operations rather than whole-document string replacements.
3. **Version Snapshots**: Every significant update automatically captures a historical `NoteRevision` snapshot, allowing users to restore previous versions if unintended edits occur.

#### Q7: How does your Role-Based Access Control (RBAC) work?
**Answer:**  
We enforce a 4-tier hierarchy: `Owner (40) > Editor (30) > Commenter (20) > Viewer (10)`.
- When a user accesses a note, the `getNoteAccess(noteId, userId)` helper queries the `Note` collection for ownership and the `SharePermission` collection for shared roles.
- The controller compares `userRole >= REQUIRED_ROLE`.
- If an Editor attempts to delete a note or modify permissions, they receive a `403 Forbidden`. If an unauthenticated user or unauthorized viewer requests a private note, the API returns `404 Not Found` to prevent resource enumeration.

#### Q8: What is the difference between soft delete and hard delete in Otion?
**Answer:**  
- **Soft Delete (Archive to Trash)**: Flips `isArchived: true` and sets `archivedAt: new Date()`. The note disappears from the main workspace and active searches, but remains recoverable in the Trash view.
- **Hard Delete (Permanent Purge)**: Triggered when a user clicks "Delete Forever" or "Empty Trash". This permanently executes a cascading delete across MongoDB, removing the `Note`, its `SharePermission` records, `Comment` threads, `PublicShare` links, and `NoteRevision` history.

#### Q9: Why use multi-stage Docker builds instead of a single Dockerfile?
**Answer:**  
Single-stage builds include development dependencies, build tools, package caches, and source code compilers in the final container image, inflating image sizes beyond 1 GB and leaving security vulnerabilities in production. Our multi-stage builds compile artifacts in an initial build container and copy only the compiled static files into `nginx:alpine` (for client, ~25MB) and production dependencies into `node:22-alpine` (for server, ~120MB). Furthermore, our server container runs as `USER node` rather than `root` to prevent container breakout vulnerabilities.

#### Q10: How do you prevent Cross-Site Scripting (XSS) in note content?
**Answer:**  
We deliberately avoid storing raw HTML or using `dangerouslySetInnerHTML`. Document content is stored as an array of structured JSON objects with a `text` string field. React automatically escapes strings rendered inside JSX primitives (`<span>`, `<p>`, `<div>`), rendering characters like `<script>` or `<img onerror=...>` as harmless literal text.

#### Q11: How do "lifetime notifications" work in your architecture?
**Answer:**  
Lifetime notifications provide a persistent audit trail of workspace collaboration:
1. **Triggers**: Events such as collaborator invitations, role updates, comments, and mentions trigger notification records in MongoDB.
2. **Real-Time Push**: The backend emits a socket event to the recipient's private channel (`user:<userId>`), instantly bumping the bell icon badge without polling.
3. **Persistence**: Because notifications are stored in MongoDB with `{ isRead: false, createdAt: Date }`, they survive browser restarts, offline periods, and app redeployments.

#### Q12: How do database migrations work without causing downtime?
**Answer:**  
We created a custom migration runner in [server/migrations/runner.js](file:///home/ram/Documents/Projects/Otion/server/migrations/runner.js). Each migration is an idempotent script with an `up` function. Applied migrations are recorded in a dedicated `_migrations` MongoDB collection. During deployment or CI, `npm run migrate` runs before the API server boots, applying pending migrations sequentially and guaranteeing that required indexes and schema changes exist without dropping existing user data.
