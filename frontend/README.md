# DigitalFred Studio Console

The complete application walkthrough is in [USER_GUIDE.md](./USER_GUIDE.md).

## Run locally

The frontend requires the repository backend to be running. From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). The API defaults to `http://localhost:3000/api/v1`. To use a different backend origin, set `NEXT_PUBLIC_API_URL` in `.env.local` (for example, `NEXT_PUBLIC_API_URL=http://localhost:3000`; do not include `/api/v1`).

Sign in with an account provisioned by the backend. Authentication tokens are held in memory, so a page reload requires signing in again.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
