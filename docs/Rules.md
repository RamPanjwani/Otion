# AI Agent Rules & Guardrails — Otion Workspace

This document defines strict rules, technical constraints, error-handling conventions, and boundary limits for AI coding agents modifying or expanding the **Otion** codebase.

---

## 1. Approved & Forbidden Libraries

### Approved Tech Stack
* **Frontend:** React 18, Vite, Tailwind CSS, Lucide React (Icons), Axios, Socket.io-client
* **Backend:** Node.js, Express.js, Mongoose (MongoDB ORM), Socket.io, Jsonwebtoken (JWT), Bcryptjs, Express-Async-Handler

### Prohibited Dependencies (DO NOT INSTALL)
* **No Alternative State Managers:** Do NOT introduce Redux, Zustand, MobX, or Recoil. State must remain managed via standard React hooks and `AuthContext.jsx`.
* **No Heavy UI Component Libraries:** Do NOT install Material UI, Chakra UI, Ant Design, or Bootstrap. All styling must use Tailwind CSS and utility classes.
* **No External Rich-Text Engines without Request:** Do NOT add heavy third-party editor frameworks (e.g., Quill, Draft.js, CKEditor) unless explicitly instructed in a feature prompt.
* **No Additional HTTP Clients:** Stick to the pre-configured Axios instance in `client/src/services/api.js`. Do NOT use `fetch()` or install `got`/`superagent`.

---

## 2. Code Style & Architecture Boundaries

1. **Component Scaffolding Rules:**
   * Place view screens in `client/src/pages/`.
   * Place re-usable UI modules in `client/src/components/`.
   * Do NOT combine multiple large UI components into a single file. Keep components modular and under 250 lines where possible.

2. **Design System & Styling Tokens:**
   * **Canvas Background:** `#FCF9F8`
   * **Primary Text Color:** `#1C1B1B`
   * **Secondary Text Color:** `#444748`
   * **Border Color:** `#C4C7C7` / `#E9E9E9`
   * **Border Radius:** `rounded-xl` (`0.5rem` / 6px)
   * **Sidebar Geometry:** Fixed `240px` width layout drawer.

3. **Backend Controller Structure:**
   * Keep business logic inside `server/controllers/`.
   * Keep route routing declarations clean in `server/routes/`.
   * Mongoose queries must run exclusively within controllers, never inside middleware or route files.

---

## 3. Error Handling Standards

### Backend Error Conventions
* **Async Wrapper:** All Express controllers must be wrapped with `express-async-handler` or explicit `try-catch` blocks.
* **Global Handler Delegation:** Pass uncaught errors directly to `next(error)` so they are captured by `server/middleware/errorMiddleware.js`.
* **HTTP Status Codes:**
  * `400 Bad Request`: Missing payload fields or invalid data formats.
  * `401 Unauthorized`: Missing or invalid JWT token.
  * `403 Forbidden`: Authenticated user lacks ownership/permissions for target note.
  * `404 Not Found`: Target database record does not exist.
  * `500 Internal Error`: Unexpected server exception.

### Frontend Error Conventions
* **Network Failures:** Catch Axios errors in UI components and display user-friendly error messages or toast notifications.
* **Auth Fallback:** If API calls return `401 Unauthorized`, clear stored tokens from `AuthContext` and redirect the user to `/login`.

---

## 4. AI Agent Guardrails (DOs and DON'Ts)

### WHAT THE AI MUST DO:
* **DO** check for existing utility functions in `client/src/utils/` before writing redundant helpers.
* **DO** preserve JWT Bearer header injection inside `client/src/services/api.js`.
* **DO** sanitize user inputs on backend controllers before submitting write queries to MongoDB.
* **DO** write explicit Mongoose schema fields with default fallbacks.

### WHAT THE AI MUST NEVER DO:
* **NEVER** hardcode secret keys, ports, or MongoDB connection strings in code files. Always reference `process.env`.
* **NEVER** push unhashed passwords to the database.
* **NEVER** delete existing API routes or modify response interfaces without updating related frontend service calls (`services/api.js`).
* **NEVER** alter the folder hierarchy of `client/src` or `server/` without explicit authorization.
