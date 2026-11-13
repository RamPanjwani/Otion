# Otion — Project Presentation Slide Deck

A collaborative notes workspace built for speed, real-time collaboration, and conflict-safe teamwork.

---

## Slide 1: Title & Introduction
- **Project Name**: Otion
- **Tagline**: Notes and ideas in flow.
- **Presenter**: Ram Panjwani
- **Tech Stack**: React 19, Express 5, MongoDB Atlas, Socket.IO, Yjs CRDTs, Tailwind CSS, Docker.
- **Repository**: [github.com/RamPanjwani/Otion](https://github.com/RamPanjwani/Otion)
- **Live Deployment**: [otion-nine.vercel.app](https://otion-nine.vercel.app)

---

## Slide 2: Problem Statement & Motivation
- **Context Fragmentation**: Teams switch constantly between docs, chat apps, and issue trackers, losing thought flow.
- **Version & Overwrite Chaos**: Traditional REST APIs overwrite documents on concurrent edits (last-write-wins creates data loss).
- **Complex Setups vs. Bloat**: Existing solutions are either too heavy/slow or lack robust permission boundaries.
- **Our Solution**: A minimalist, high-performance workspace combining local-feeling editor speed with conflict-safe real-time CRDT synchronization.

---

## Slide 3: System Architecture
```
┌────────────────────────────────────────────────────────┐
│                   Vite + React 19                      │
│   (Tailwind CSS, Block Editor, Yjs Client, Socket.IO)  │
└───────────────▲────────────────────────▲───────────────┘
                │ HTTP REST              │ WebSockets (WSS)
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│                   Node.js / Express 5                  │
│       (JWT Auth, Rate Limiting, Pino Structured Logs)  │
└───────────────▲────────────────────────▲───────────────┘
                │ Mongoose               │ Multi-doc Transactions
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│                     MongoDB Atlas                      │
│ (12 Collections, Compound/Text Indexes, TTL Compaction)│
└────────────────────────────────────────────────────────┘
```

---

## Slide 4: Real-Time Synchronization Engine
- **Yjs CRDTs (Conflict-free Replicated Data Types)**: Enables simultaneous character-level and block-level edits with mathematical convergence.
- **Socket.IO Transport**: Bi-directional binary updates syncing documents instantly across connected clients.
- **Presence & Live Cursors**: Real-time awareness displays active collaborator avatars, names, and cursor positions.
- **Snapshot Compaction**: Background compaction collapses incremental updates into permanent document revisions to keep databases light and fast.

---

## Slide 5: Granular Security & Authorization
- **JWT Authentication**: Signed tokens with 30-day validity, protected routes, and instant socket revocation on access changes.
- **Role-Based Access Control (RBAC)**:
  - **Owner**: Full workspace & document governance, invitations, permanent deletion.
  - **Editor**: Real-time editing, formatting, content updates.
  - **Commenter**: Read-only document view with threaded commenting.
  - **Viewer**: Read-only access.
- **Existence Concealment**: Unauthorized requests return `404 Not Found` instead of `403 Forbidden` to prevent resource enumeration.

---

## Slide 6: Email Workflows & Data Integrity
- **Transactional Architecture**: Multi-document ACID transactions on MongoDB replica sets via `runTransaction.js` with standalone fallback.
- **Password Recovery**: Expiring SHA-256 tokens sent via Resend API (`POST /api/auth/forgot-password`).
- **Graceful Email Verification**: Users are never blocked from accessing notes; non-intrusive workspace banner allows one-click resend.
- **Collaborator Notifications**: Automated invitation emails and role update alerts dispatch directly to teammates.

---

## Slide 7: Containerization & DevOps
- **Multi-Stage Docker Architecture**:
  - `client/Dockerfile`: Multi-stage build (Node Alpine → Nginx 1.27) with reverse-proxied `/socket.io/` WebSocket upgrade headers.
  - `server/Dockerfile`: Minimalist Node 20 Alpine container running as non-privileged `node` user.
  - `docker-compose.yml`: Orchestrates `mongo`, `server`, and `client` with integrated health checks.
- **CI/CD Pipeline**: Automated GitHub Actions workflow testing, auditing, linting, and building on every push and PR.

---

## Slide 8: Live Demonstration Flow
1. **Sign-In & Seed Data**: Sign in as `alex@example.com` to explore seeded workspaces and product briefs.
2. **Real-Time Collaboration**: Open two browser windows side-by-side; observe instantaneous typing, block dragging, and live cursor movement.
3. **Sharing & Invitations**: Invite `sam@example.com` as an editor; view collaborator notifications.
4. **Offline Resilience & Reconnect**: Toggle network offline; continue typing; re-enable network to watch seamless CRDT auto-merge.
5. **Dark Mode & Responsive UI**: Toggle dark/light theme; test mobile drawer navigation.

---

## Slide 9: Results & Key Metrics
- **Test Pass Rate**: 100% (19/19 server integration tests passing).
- **Client Build Speed**: ~350ms static bundle generation.
- **Zero Vulnerabilities**: Clean dependencies audited and validated with Zod on every layer.

---

## Slide 10: Conclusion & Q&A
- **Summary**: Otion delivers a production-ready, highly responsive collaborative workspace built to modern industry standards.
- **Thank you!**
- **Q&A**: Open for questions and technical discussion.
