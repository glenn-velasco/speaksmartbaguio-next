# Speak Smart Baguio API v1

A production-ready API backend built with Next.js, Firebase Firestore, and TypeScript.

## Features

- 🔒 **Secure**: API key authentication with timing-safe comparison, CORS control, rate limiting
- 🚀 **Performant**: In-memory caching, cursor-based pagination
- 📝 **Validated**: Zod schema validation on all inputs
- 🪵 **Observable**: Structured JSON logging (production-ready for OnRender)
- ♻️ **DRY**: Generic CRUD factory — add new endpoints in ~10 lines
- 🏥 **Monitored**: Health check endpoint for uptime monitoring
- 🎵 **Audio Upload**: TTS audio file upload with S3/Firebase Storage, waveform preview, and auto cleanup

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Firebase Firestore
- **Validation**: Zod v4
- **Styling**: Tailwind CSS 4, Radix UI
- **Storage**: S3 (IDrive E2) + Firebase Storage
- **Deployment**: OnRender

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL`, `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` — Firebase Admin SDK credentials
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (from console)
- `NEXT_PUBLIC_API_KEY` — Your secret API key (generate with `openssl rand -base64 32`)
- `ALLOWED_ORIGINS` — Comma-separated CORS origins (`*` for dev only)

#### Optional: Audio Upload Configuration

For TTS audio upload with S3 (IDrive E2):
- `S3_ACCESS_KEY_ID`, `S3_ACCESS_KEY_SECRET` — S3 credentials
- `S3_BUCKET_NAME`, `S3_ENDPOINT` — S3 bucket configuration
- `STORAGE_BACKEND` — Storage preference: `s3`, `firebase`, or `auto`

See [Audio Upload Documentation](docs/AUDIO_UPLOAD.md) for complete setup guide.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the API dashboard.

## API Endpoints

All API requests require the `x-api-key` header.

### Dictionary
- `GET /api/v1/dictionary` — List with filtering & pagination
- `POST /api/v1/dictionary` — Create new word entry
- `PUT /api/v1/dictionary` — Update by ID
- `DELETE /api/v1/dictionary?id=...` — Delete by ID

### Phrasebook
- `GET /api/v1/phrasebook` — List with filtering & pagination
- `POST /api/v1/phrasebook` — Create new phrase entry
- `PUT /api/v1/phrasebook` — Update by ID
- `DELETE /api/v1/phrasebook?id=...` — Delete by ID

### Translations
- `GET /api/v1/translations` — List with filtering & pagination
- `POST /api/v1/translations` — Create new translation
- `PUT /api/v1/translations` — Update by ID
- `DELETE /api/v1/translations?id=...` — Delete by ID

### Health Check
- `GET /api/health` — Service health status (no auth required)

## Adding New Endpoints

Create a new folder under `app/api/v1/` with `route.ts` and `schema.ts`:

```ts
// app/api/v1/new-collection/route.ts
import { createCRUDHandler } from "@/lib/api-handler";
import { schema } from "./schema";

export const { GET, POST, PUT, DELETE } = createCRUDHandler({
  collection: "new-collection",
  createSchema: schema,
  updateSchema: schema.extend({ id: z.string() }),
  uniqueField: "name",
  filterableFields: ["field1", "field2"],
});
```

That's it — full CRUD with caching, pagination, validation, and logging.

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL` | Firebase admin service account email | Yes |
| `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` | Firebase admin private key | Yes |
| `FIREBASE_API_KEY` | Firebase client API key | Yes |
| `NEXT_PUBLIC_API_KEY` | Secret key for API authentication | Yes |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | Yes |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per IP per minute | No (default: 100) |
| `PROTECTED_PATHS` | Paths requiring API key (comma-separated) | No (default: /api) |
| `LOG_LEVEL` | Minimum log level: debug/info/warn/error | No (default: info) |

## Deployment

### OnRender

1. Connect your Git repository
2. Set build command: `npm run build`
3. Set start command: `npm start`
4. Add all environment variables from `.env.example`

### Health Check URL

Use `/api/health` for OnRender's health check monitoring.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── dictionary/         # Dictionary CRUD
│   │   │   ├── phrasebook/         # Phrasebook CRUD
│   │   │   ├── translations/       # Translations CRUD
│   │   │   └── upload/             # Audio upload endpoints
│   │   │       ├── route.ts        # Generate presigned URL
│   │   │       └── complete/       # Complete upload
│   │   └── health/                 # Health check
│   ├── dashboard/                  # Admin dashboard
│   ├── dictionary/                 # Dictionary pages
│   ├── phrasebook/                 # Phrasebook pages
│   ├── layout.tsx
│   ├── page.tsx                    # API dashboard
│   ├── error.tsx                   # Error boundary
│   └── loading.tsx                 # Loading state
├── components/
│   ├── AudioPlayButton.tsx         # Audio playback button
│   ├── AudioUploadInput.tsx        # Audio upload component
│   └── AudioPreview.tsx            # Audio preview with waveform
├── lib/
│   ├── api-handler.ts              # Generic CRUD factory
│   ├── audio-cleanup.ts            # Audio file cleanup
│   ├── audio-validation.ts         # Audio validation utilities
│   ├── cache.ts                    # In-memory caching
│   ├── firebase-admin.ts           # Firebase admin SDK
│   ├── firebase-storage.ts         # Firebase Storage client
│   ├── logger.ts                   # Structured logging
│   ├── pagination.ts               # Pagination utilities
│   ├── response.ts                 # Response helpers
│   ├── s3-client.ts                # S3 client (IDrive E2)
│   └── storage.ts                  # Unified storage abstraction
├── docs/
│   └── AUDIO_UPLOAD.md             # Audio upload documentation
├── proxy.ts                        # Middleware (CORS, auth, rate limit)
└── .env.example                    # Environment template
```

## License

Speak Smart Baguio © 2026
