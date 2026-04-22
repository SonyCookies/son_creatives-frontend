# Son Creatives Frontend

Next.js 16 App Router frontend for the Son Creatives outfit code lookup experience.

## What It Does

- Renders a premium landing page for TikTok outfit code traffic
- Accepts `HEC923` and `#HEC923`
- Calls the Laravel backend for outfit lookup
- Shows loading, not-found, and error states
- Displays the outfit image and clickable affiliate item cards

## Environment

Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Main Files

- `app/page.tsx`
- `components/outfit-lookup-experience.tsx`
- `components/code-search-form.tsx`
- `components/affiliate-item-card.tsx`
- `components/empty-state.tsx`
- `components/loading-skeleton.tsx`
- `lib/api.ts`
- `lib/outfit-code.ts`
- `types/outfit.ts`

## Verification

```bash
npm run lint
npm run build
```

Project-wide architecture, schema, API response examples, and setup are documented in the workspace root `README.md`.
