# Project Execution Phases — Otion Workspace

This document outlines the sequential, incremental build phases for developing the **Otion Workspace**. Each phase is self-contained with clear deliverables to allow an AI coding agent or developer to build, test, and verify features step-by-step.

---

## Phase 1: Foundation, Infrastructure & Authentication

**Goal:** Establish project setup, database connections, global state, and complete user login/registration flows.

### Tasks & Deliverables
* **Backend Infrastructure:**
  * Initialize Node/Express server in `server/server.js`.
  * Configure MongoDB connection in `server/config/db.js`.
  * Build `User` model (`server/models/User.js`).
  * Implement auth controller (`authController.js`) and routes (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
  * Add JWT signing utility (`generateToken.js`) and protection middleware (`authMiddleware.js`).
* **Frontend Infrastructure:**
  * Configure Tailwind CSS tokens (`#FCF9F8` canvas background, `#1C1B1B` primary text).
  * Build centralized Axios client (`client/src/services/api.js`).
  * Build `AuthContext.jsx` and `useAuth.js` hook for session persistence.
  * Construct UI views: `Login.jsx` and `Register.jsx`.

---

## Phase 2: Core Workspace Architecture & Note CRUD

**Goal:** Build the persistent navigation layout, page hierarchy, and REST API for document creation and retrieval.

### Tasks & Deliverables
* **Backend Note API:**
  * Build `Note` model (`server/models/Note.js`) with fields for `title`, `content`, `icon`, `coverImage`, `parentDocument`, and `isArchived`.
  * Build `noteController.js` and routes for `GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`.
* **Frontend Navigation & Layout:**
  * Build fixed 240px `Sidebar.jsx` drawer with navigation items (Search, Trash, New Page).
  * Build `Dashboard.jsx` empty state with welcoming hero section and quick note creation.
  * Implement breadcrumb navigation bar (`Navbar.jsx`).

---

## Phase 3: Block-Based WYSIWYG Editor

**Goal:** Implement the interactive block document editor with formatting capabilities and media hooks.

### Tasks & Deliverables
* **Editor Component (`client/src/components/Editor.jsx`):**
  * Build structured block-level content editing surface.
  * Support inline rich-text formatting (bold, italic, inline code).
  * Implement task block checkboxes and dynamic block insertion.
  * Build slash-command (`/`) popup trigger menu for block selection.
* **Document Customization:**
  * Add emoji icon picker support to document headers.
  * Add dynamic cover image URL/picker triggers.
  * Implement debounced auto-saving to update note content via `PUT /api/notes/:id`.

---

## Phase 4: Real-Time Collaboration & Multi-User Presence

**Goal:** Integrate WebSocket communication for synchronized document state and real-time user cursor tracking.

### Tasks & Deliverables
* **Backend Socket Server:**
  * Initialize Socket.io server within `server/server.js`.
  * Implement WebSocket room management (`join-note`, `leave-note`).
  * Build broadcasting events (`send-changes` -> `receive-changes`, `cursor-move`).
* **Frontend Real-Time Integration:**
  * Configure Socket client client (`client/src/services/socket.js`).
  * Synchronize active editor changes between connected users without editor loops.
  * Render live collaborator avatar stacks in `Navbar.jsx`.
  * Render color-coded active multi-user cursors with name tags on the canvas.

---

## Phase 5: Access Control, Granular Sharing & Public Links

**Goal:** Provide secure permission management (Owner, Editor, Viewer) and public document publishing.

### Tasks & Deliverables
* **Backend Permission Engine:**
  * Build `SharePermission` schema (`server/models/SharePermission.js`).
  * Build `shareController.js` and routes (`/api/share/:noteId/invite`, `/collaborators`, `/public`).
* **Frontend Sharing Dialog:**
  * Construct elevated modal backdrop container (`Modal.jsx`).
  * Construct `ShareModal.jsx` with email invitation form, permission role selection dropdown, and active collaborator management list.
  * Build toggle for public read-only link generation.

---

## Phase 6: Soft-Delete Trash System & Final Polish

**Goal:** Add document recovery/purge functionality, perform UI refinement, and run end-to-end integration tests.

### Tasks & Deliverables
* **Trash Lifecycle:**
  * Add soft-deletion endpoints (`PATCH /api/notes/:id/archive`, `PATCH /api/notes/:id/restore`, `DELETE /api/notes/:id`).
  * Build `Trash.jsx` view to list archived pages, restore them to workspace hierarchy, or permanently delete them.
* **UI Polish & QA:**
  * Enforce 6px border radii (`rounded-xl`) and hairline border consistency.
  * Add loading skeletons (`Loading.jsx`) and graceful error fallbacks.
  * Validate build pipeline via `npm run build` in both `client` and `server`.
