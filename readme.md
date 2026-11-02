# Otion

Otion is a full-stack collaborative workspace built with React, Express, MongoDB, Socket.io, and Yjs. It supports workspaces, nested rich-text block documents, conflict-safe realtime editing and formatting, presence, revision history, role-based sharing, private tokenized public links, search, favorites, and trash recovery.

## Local setup

Requirements: Node.js 20+ and MongoDB/Atlas.

1. Copy `server/.env.example` to `server/.env` and set `MONGO_URI` plus a long random `JWT_SECRET`.
2. Optionally copy/edit `client/.env.example` if the API is not at `http://localhost:5000`.
3. Install and migrate the server:

```powershell
cd server
npm install
npm run migrate
npm run dev
```

4. In another terminal, start the client:

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Verification

```powershell
cd server
npm test
npm audit --omit=dev

cd ../client
npm run lint
npm run build
npm audit --omit=dev
```

The integration suite uses `TEST_MONGO_URI` when configured, otherwise it creates and drops a uniquely named test database on `MONGO_URI`.

## Docker

Set a strong `JWT_SECRET`, then start the bundled MongoDB, API, and Nginx-served client:

```powershell
$env:JWT_SECRET = "replace-with-a-long-random-secret"
docker compose up --build
```

Open `http://localhost:8080`. Docker was not available in the implementation environment, so these definitions were authored but could not be executed there.

## Key architecture

- REST APIs handle authentication, workspaces, document metadata, revisions, sharing, public reads, and search.
- Yjs incremental updates travel over authenticated Socket.io rooms and are persisted as snapshots plus a compacted update log.
- Every HTTP and socket write revalidates the current role; revocation ejects active sessions immediately.
- Public links contain a 256-bit random token. Only its SHA-256 hash is stored.
- Image blocks accept external HTTPS image URLs; Otion does not store uploaded files or objects.
- `docs/Memory.md` contains the current contracts and verification record; `docs/Implementation-Plan.md` tracks the remaining roadmap.
