# API / media host (local vs live)

## Behavior

Shared helper: `src/lib/apiBaseUrl.ts`

| Runtime | API base |
|---------|----------|
| Local (`next dev`, browser on localhost, local `next start`) | `http://localhost:5000/api` |
| Live (Vercel / non-local production host) | `https://bookmybota-backend.onrender.com/api` |
| Override | `NEXT_PUBLIC_API_BASE_URL` (legacy: `NEXT_PUBLIC_API_URL`) |

If a live deploy env accidentally points at localhost, code falls back to the production API and logs a warning.

## Wired through

- All RTK Query calls → `services/api.ts` → `getApiBaseUrl()`
- Uploaded images → stored as `/uploads/...` (host-stable)
- Display → `resolveMediaUrl()` / `getApiOrigin()` rewrites localhost/live upload URLs to the active API host
- Dining availability → RTK `checkAvailability` (no hardcoded localhost)

## Local `.env.local` (optional)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

## Vercel production

Leave unset, or:

```env
NEXT_PUBLIC_API_BASE_URL=https://bookmybota-backend.onrender.com/api
```

Never set localhost on the live frontend. Rebuild after changing `NEXT_PUBLIC_*`.

## Backend

- Upload route returns `/uploads/<file>` (not an absolute localhost URL)
- CORS allows Vercel + localhost ports (see `backend/src/server.ts`)
- On Render set `APP_PUBLIC_URL` to the live frontend URL for emails
