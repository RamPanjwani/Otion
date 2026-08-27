# Product Requirements Document (PRD) — Otion Workspace

## 1. Context & Purpose
Otion is a full-stack, real-time collaborative Notion-like workspace. This document serves as the single source of truth for AI coding agents to implement, refactor, and extend the project codebase safely without breaking system boundaries.

---

## 2. Tech Stack Specification

* **Frontend:** React 18, Vite, Tailwind CSS, Lucide React (Icons)
* **Backend:** Node.js, Express.js
* **Database:** MongoDB with Mongoose ORM
* **Real-time Engine:** Socket.io (WebSockets)
* **Authentication:** JWT (JSON Web Tokens) with HTTP Authorization Headers
* **State Management:** React Context API (`AuthContext`) + Custom Hooks (`useAuth`)

---

## 3. Directory & File Architecture Map

```text
otion/
├── client/
│   ├── public/             # Static assets (favicons, SVGs)
│   ├── src/
│   │   ├── assets/         # App assets & images
│   │   ├── components/     # UI components (Editor, Sidebar, Navbar, Modal, ShareModal, Loading)
│   │   ├── context/        # AuthContext.jsx (global auth state)
│   │   ├── hooks/          # Custom hooks (useAuth.js)
│   │   ├── pages/          # Route views (Home, Login, Register, Dashboard, NoteEditor, Trash)
│   │   ├── services/       # Axios client (api.js) & Socket setup (socket.js)
│   │   ├── utils/          # Helper utilities & dynamic formatters
│   │   ├── App.jsx         # App router & layout routes
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   └── vite.config.js
└── server/
    ├── config/             # Database connection (db.js)
    ├── controllers/        # authController, noteController, shareController
    ├── middleware/         # authMiddleware (JWT check), errorMiddleware
    ├── models/             # Mongoose models (User, Note, SharePermission)
    ├── routes/             # authRoutes, noteRoutes, shareRoutes
    ├── utils/              # Token generation (generateToken.js)
    ├── .env                # Secret environment variables
    └── server.js           # Server listener & Socket.io server initialization

```

---

## 4. Data Schemas (Mongoose Models)

### `User.js`

* `name`: String (Required)
* `email`: String (Required, Unique)
* `password`: String (Required, Hashed with bcrypt)
* `avatarUrl`: String (Optional)
* `timestamps`: true

### `Note.js`

* `title`: String (Required, Default: "Untitled")
* `content`: Array / JSON Object (Block structure array or raw text)
* `icon`: String (Optional emoji identifier)
* `coverImage`: String (Optional URL)
* `user`: Schema.Types.ObjectId (Ref: 'User', Owner)
* `parentDocument`: Schema.Types.ObjectId (Ref: 'Note', Nullable for root notes)
* `isArchived`: Boolean (Default: false)
* `isPublished`: Boolean (Default: false)
* `timestamps`: true

### `SharePermission.js`

* `noteId`: Schema.Types.ObjectId (Ref: 'Note', Required)
* `userId`: Schema.Types.ObjectId (Ref: 'User', Required)
* `role`: String (Enum: `['editor', 'viewer']`, Default: `'viewer'`)
* `timestamps`: true

---

## 5. API Route Contracts

### Auth Routes (`/api/auth`)

* `POST /register`: Accepts `{ name, email, password }` -> Returns `{ _id, name, email, token }`
* `POST /login`: Accepts `{ email, password }` -> Returns `{ _id, name, email, token }`
* `GET /me`: Requires JWT header -> Returns current user data

### Note Routes (`/api/notes`)

* `GET /`: List all root non-archived notes created by or shared with the user
* `POST /`: Create a new note `{ title?, parentDocument? }`
* `GET /:id`: Fetch a specific note by ID (verifies ownership or permission)
* `PUT /:id`: Update note content, title, icon, cover image, or parent
* `PATCH /:id/archive`: Soft-delete note (sets `isArchived: true`)
* `PATCH /:id/restore`: Restore soft-deleted note (sets `isArchived: false`)
* `DELETE /:id`: Permanently remove note from database

### Share Routes (`/api/share`)

* `POST /:noteId/invite`: Accepts `{ email, role }` -> Assigns `SharePermission`
* `GET /:noteId/collaborators`: Retrieves list of allowed users and roles
* `DELETE /:noteId/user/:userId`: Revokes access for a specific user
* `PATCH /:noteId/public`: Toggles `isPublished` on target note

---

## 6. WebSocket Protocol Specifications (Socket.io)

* `join-note`: Payload `{ noteId, user }`. Joins dynamic room `note:${noteId}`.
* `leave-note`: Payload `{ noteId, user }`. Leaves dynamic room.
* `send-changes`: Payload `{ noteId, delta/content }`. Broadcasts content update to `note:${noteId}` excluding sender (`socket.broadcast.to`).
* `receive-changes`: Listener payload `{ delta/content }`. Applies incoming content changes to active local document state.
* `cursor-move`: Payload `{ noteId, user, range/position }`. Broadcasts real-time multi-user cursor coordinates.

---

## 7. AI Agent Execution Rules & Constraints

When implementing or modifying code in this codebase, adhere strictly to the following directives:

1. **State Isolation:** Keep authentication state strictly contained inside `AuthContext.jsx`. Do not store unencrypted auth tokens in local storage without proper fallback checks.
2. **Error Handling:** All Express backend controllers must handle async errors using `express-async-handler` or try-catch blocks delegating to `errorMiddleware.js`.
3. **Environment Security:** Never hardcode secrets, ports, or URIs. Always reference `process.env.MONGO_URI`, `process.env.JWT_SECRET`, and `process.env.PORT`.
4. **CSS Token Usage:** Preserve existing UI design tokens:
* Background: `#FCF9F8`
* Primary Text: `#1C1B1B`
* Card Radius: `rounded-xl` / `0.5rem` (6px)
* Sidebar Width: Fixed `240px`


5. **Component Scaffolding:** Maintain modular separation—do not inline complex child modals inside parent page components; place them in `client/src/components/`.