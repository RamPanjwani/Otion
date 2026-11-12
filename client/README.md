# Otion client

React 19 + Vite 8 + Tailwind 4 single-page app for [Otion](../readme.md). It talks to the Express API
over REST (Axios) and Socket.IO, and edits notes as Yjs CRDT documents.

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api, VITE_SOCKET_URL=http://localhost:5000
npm run dev               # http://localhost:5173
npm run lint
npm test
npm run build             # emits dist/ for Vercel or the nginx Docker image
```

Environment:

| Variable | Default in dev | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` | REST base URL; `production` builds fall back to `/api` |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Socket origin; empty means same origin (nginx proxies `/socket.io/`) |

Structure and conventions are documented in [`docs/Architecture.md`](../docs/Architecture.md) and
[`docs/Rules.md`](../docs/Rules.md). API contracts: [`docs/API.md`](../docs/API.md).

Production: <https://otion-nine.vercel.app> (project root directory `client`, build `npm run build`,
output `dist`, `vercel.json` rewrites all paths to `index.html`).
