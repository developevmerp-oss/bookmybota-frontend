# API Production Checklist (RTK Query — no logic changes)

## API base URL behavior

In `src/services/api.ts`:

1. If `NEXT_PUBLIC_API_BASE_URL` is set → use it
2. Else `next dev` (development) → `http://localhost:5000/api`
3. Else production build → `https://bookmybota-backend.onrender.com/api`

Local file `frontend/.env.local` (gitignored) should point at localhost while developing:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

On Vercel production, either leave the var unset (code default) or set:

```env
NEXT_PUBLIC_API_BASE_URL=https://bookmybota-backend.onrender.com/api
```

## Backend CORS (required for localhost → Render)

Render currently only reflected `https://bookmybota-frontend.vercel.app`, so `http://localhost:3000` got CORS errors.

`backend/src/server.ts` now allows:

- `CORS_ORIGINS` / `APP_PUBLIC_URL` env values
- `https://bookmybota-frontend.vercel.app`
- any `http://localhost:<port>` / `http://127.0.0.1:<port>`

**You must redeploy the backend on Render** for this CORS fix to apply live.

On Render, set env if needed:

```env
CORS_ORIGINS=https://bookmybota-frontend.vercel.app,http://localhost:3000
APP_PUBLIC_URL=https://bookmybota-frontend.vercel.app
```

## Before deploy

1. Frontend production uses Render API URL (env or code default)
2. Backend CORS allows Vercel + localhost
3. Rebuild frontend after changing `NEXT_PUBLIC_*`
4. Redeploy backend after CORS changes

## Release note

Dev uses localhost API; production uses Render API. Backend CORS allows Vercel + localhost. RTK Query endpoint logic unchanged.
