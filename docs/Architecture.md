# Architecture & Application Flow — Otion Workspace

> Current implementation note (2026-11-03): collaborative content and inline formatting use incremental Yjs CRDT updates (`collab-sync`/`collab-update`) with persisted snapshots and an update log. The older `send-changes`/`receive-changes` diagrams later in this historical document are superseded. Public reads use hashed random tokens at `/api/public/:token`, never document IDs. Object uploads are intentionally unsupported; image blocks reference external HTTPS URLs. Current collections also include workspaces, workspace memberships, user note preferences, collaboration states/updates, note revisions, public shares, invitations, comments, and notifications. See `Memory.md` for the authoritative contract list.

## 1. High-Level Architecture Overview

Otion follows a decoupled client-server architecture utilizing a RESTful HTTP layer for CRUD persistence and dynamic WebSockets for low-latency real-time collaboration.

```text
  +-----------------------------------------------------------------+
  |                       CLIENT TIER (React 18)                     |
  |  +-------------------+   +-----------------+   +-------------+  |
  |  | Views & Pages     |   | Context & Hooks |   | WS Handler  |  |
  |  | (Editor/Dashboard)|   | (AuthContext)   |   | (socket.js) |  |
  +--+---------+---------+---+--------+--------+---+------+------+--+
               |                      |                   |
               | HTTP REST            | JWT Bearer        | WebSockets
               v                      v                   v
  +-----------------------------------------------------------------+
  |                       SERVER TIER (Node.js/Express)             |
  |  +-------------------+   +-----------------+   +-------------+  |
  |  | REST API Routes   |   | Auth Middleware |   | Socket.io   |  |
  |  | (/api/notes, etc) |   | (JWT Check)     |   | Server      |  |
  +--+---------+---------+---+--------+--------+---+------+------+--+
               |                      |                   |
               +----------------------+-------------------+
                                      | Mongoose ORM
                                      v
  +-----------------------------------------------------------------+
  |                        DATABASE TIER                            |
  |                       MongoDB Instance                          |
  +-----------------------------------------------------------------+

```

---

## 2. Technical Stack Specifications

### Frontend Layer

* **Framework:** React 18 (Vite build toolchain)
* **Styling & UI Components:** Tailwind CSS, Lucide React icons
* **HTTP Client:** Axios with centralized interceptors (`services/api.js`)
* **Real-time Engine:** Socket.io-client (`services/socket.js`)
* **State Management:** React Context API (`AuthContext.jsx`) and custom hooks (`useAuth.js`)

### Backend Layer

* **Runtime:** Node.js (v18+)
* **Framework:** Express.js (Modular router structure)
* **Authentication:** JSON Web Tokens (JWT) + `bcryptjs` password hashing
* **Real-time Server:** Socket.io integrated with Node `http.createServer`
* **Database Driver:** Mongoose ORM

### Database Layer

* **Storage Engine:** MongoDB (Document Store)
* **Collections:** `users`, `notes`, `sharepermissions`

---

## 3. Directory & File Structure

```text
otion/
├── client/
│   ├── public/                 # Static public assets (icons, favicon)
│   ├── src/
│   │   ├── assets/             # Vector images and brand graphics
│   │   ├── components/         # Modular UI Components
│   │   │   ├── Editor.jsx      # Block-based WYSIWYG document canvas
│   │   │   ├── Loading.jsx     # Global spinner / skeleton UI loader
│   │   │   ├── Modal.jsx       # Generic modal overlay container
│   │   │   ├── Navbar.jsx      # Document top bar with presence & actions
│   │   │   ├── ShareModal.jsx  # Access control & link sharing dialog
│   │   │   └── Sidebar.jsx     # Navigation sidebar & document tree
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Global user authentication state
│   │   ├── hooks/
│   │   │   └── useAuth.js      # Hook exposing auth state & login/logout actions
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Main workspace overview & empty state
│   │   │   ├── Home.jsx        # Landing page view
│   │   │   ├── Login.jsx       # Authentication login form
│   │   │   ├── NoteEditor.jsx  # Page wrapper for document editing view
│   │   │   ├── Register.jsx    # User registration form
│   │   │   └── Trash.jsx       # Soft-deleted notes view
│   │   ├── services/
│   │   │   ├── api.js          # Pre-configured Axios instance with JWT headers
│   │   │   └── socket.js       # Socket.io connection instance & event emitters
│   │   ├── utils/              # Helper utility functions
│   │   ├── App.css             # Component-level custom styles
│   │   ├── App.jsx             # React Router routing configuration
│   │   ├── index.css           # Global Tailwind directives & theme tokens
│   │   └── main.jsx            # Application entry mount point
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── server/
    ├── config/
    │   └── db.js               # MongoDB connection initializer
    ├── controllers/
    │   ├── authController.js   # User registration, authentication, & session
    │   ├── noteController.js   # Document CRUD & archive lifecycle
    │   └── shareController.js  # Permission grant/revoke logic
    ├── middleware/
    │   ├── authMiddleware.js   # JWT token verification middleware
    │   └── errorMiddleware.js  # Global API exception & response handler
    ├── models/
    │   ├── Note.js             # Mongoose Document Schema
    │   ├── SharePermission.js  # Mongoose Granular Permission Schema
    │   └── User.js             # Mongoose Account Schema
    ├── routes/
    │   ├── authRoutes.js       # Endpoints for `/api/auth`
    │   ├── noteRoutes.js       # Endpoints for `/api/notes`
    │   └── shareRoutes.js      # Endpoints for `/api/share`
    ├── utils/
    │   └── generateToken.js    # JWT sign utility
    ├── .env                    # Environment variables (IGNORED BY GIT)
    ├── package.json
    └── server.js               # Server entry point & Socket server bind

```

---

## 4. Application Workflows & Data Flows

### 4.1 Authentication & Session Lifecycle

```text
[User Form] ---> (POST /api/auth/login) ---> [authController]
                                                    |
                                            Validate Password
                                                    |
[Auth Context] <--- (Return JWT + User) <-----------+
      |
      +---> Store token in LocalStorage
      +---> Set dynamic Axios authorization header: `Bearer <TOKEN>`

```

### 4.2 Document Creation & Retrieval Flow

```text
[User Action] ---> Click "New Page"
                        |
                        v
                 POST /api/notes (Headers: Authorization)
                        |
                        v
                 [authMiddleware] (Decodes User ID)
                        |
                        v
                 [noteController] ---> Mongoose `Note.create()` ---> [MongoDB]
                        |
                        v
[React State] <--- Returns Created Note Document JSON

```

### 4.3 Real-Time Collaborative Editing Flow

```text
[Client A (User 1)]                             [Express Server]                             [Client B (User 2)]
        |                                              |                                              |
        |--- emit('join-note', { noteId, user }) ----->|                                              |
        |                                              |--- emit('join-note', { noteId, user }) ----->|
        |                                              |                                              |
        |--- emit('send-changes', { content }) ------->|                                              |
        |                                              |--- broadcast.to(noteId)--------------------->|
        |                                              |    emit('receive-changes', content)          |
        |                                              |                                              |
        |--- emit('cursor-move', { x, y }) ----------->|                                              |
        |                                              |--- broadcast.to(noteId)--------------------->|
        |                                              |    emit('cursor-move', position)             |

```

### 4.4 Access Control Matrix

| User Role | Read Document | Write Content | Archive Document | Share Access |
| --- | --- | --- | --- | --- |
| **Owner** | Yes | Yes | Yes | Yes |
| **Editor** | Yes | Yes | No | No |
| **Viewer** | Yes | No | No | No |
| **Public User** | Yes (If Published) | No | No | No |

---

## 5. Security Architecture & Boundary Controls

1. **Authentication Guard:** Every API request under `/api/notes` and `/api/share` passes through `authMiddleware.js`, verifying JWT authenticity and extracting `req.user`.
2. **Resource Protection:** Controllers check note ownership (`note.user.equals(req.user._id)`) or query `SharePermission` records before returning sensitive document data.
3. **Transport Security:** Production deployments enforce TLS/HTTPS communication for REST endpoints and WSS for WebSocket synchronization.
