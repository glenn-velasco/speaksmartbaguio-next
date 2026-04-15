# Testing Guide — Speak Smart Baguio API

## Quick Start

### Prerequisites

1. Ensure your dev server is running:
   ```bash
   npm run dev
   ```

2. Ensure your `.env.local` is configured with valid Firebase credentials and an `NEXT_PUBLIC_API_KEY`.

---

## 1. Automated Tests (Vitest)

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run with Custom API Key

```bash
TEST_API_KEY=your-secret-key npm test
```

### Run Against a Different Base URL

```bash
TEST_BASE_URL=http://localhost:3000 TEST_API_KEY=your-key npm test
```

### What the Automated Tests Cover

- ✅ Health check endpoint (no auth required)
- ✅ API key authentication (valid, invalid, missing)
- ✅ Full CRUD for Dictionary, Phrasebook, Translations
- ✅ Duplicate entry detection (409 conflicts)
- ✅ Validation errors (missing fields, wrong Content-Type)
- ✅ Pagination and filtering
- ✅ CORS preflight and response headers
- ✅ Caching consistency
- ✅ Cleanup of test data after runs

---

## 2. Postman Collection

### Import

1. Open Postman
2. **Import** → Select `postman/collections/speak-smart-baguio-api.postman_collection.json`
3. **Import** → Select `postman/environments/local.postman_environment.json` (or `production`)

### Setup

1. Select the **Local** environment
2. Update the `api_key` variable with your `NEXT_PUBLIC_API_KEY` from `.env.local`
3. Update `base_url` if different from `http://localhost:3000`

### Run Collection

1. Open the collection
2. Click **Run** (Collection Runner)
3. Select your environment
4. Click **Run Speak Smart Baguio API v1**

### What the Postman Collection Tests

| Folder | Tests |
|--------|-------|
| **00 Health Check** | Status code, response shape, firebase service status |
| **01 Dictionary** | Create, duplicate detection, list, filter, update, 404, delete, validation, Content-Type check |
| **02 Phrasebook** | Create, list, update, delete |
| **03 Translations** | Create, list, filter, update, delete |
| **04 Security Tests** | Invalid key (403), missing key (403), CORS preflight |

---

## 3. Manual Testing Checklist

Use this checklist for QA before production deployment.

### 🔴 Critical (Must Pass)

#### Authentication
- [ ] Valid API key → 200 on all endpoints
- [ ] Invalid API key → 403 on `/api/v1/*`
- [ ] Missing API key → 403 on `/api/v1/*`
- [ ] `/api/health` works without API key

#### Dictionary CRUD
- [ ] POST creates entry → 201, returns ID
- [ ] POST duplicate `ilokanoWord` → 409
- [ ] GET returns paginated list → 200, includes `hasMore`, `total`
- [ ] GET `?category=test` → filters correctly
- [ ] PUT updates entry → 200
- [ ] PUT non-existent ID → 404
- [ ] DELETE removes entry → 200
- [ ] DELETE without `?id=` → 400

#### Phrasebook CRUD
- [ ] POST creates entry → 201
- [ ] GET returns list → 200
- [ ] PUT updates entry → 200
- [ ] DELETE removes entry → 200

#### Translations CRUD
- [ ] POST creates entry → 201
- [ ] GET returns list → 200
- [ ] GET `?ilokano=test` → filters correctly
- [ ] PUT updates entry → 200
- [ ] DELETE removes entry → 200

#### Validation
- [ ] Missing required fields → 400 with `BAD_REQUEST` code
- [ ] Invalid JSON body → 400
- [ ] Missing `Content-Type: application/json` → 400
- [ ] Zod error messages readable (not `{ error: ... }` format)

### 🟡 Important

#### CORS
- [ ] `OPTIONS` preflight → 204 with CORS headers
- [ ] Response includes `Access-Control-Allow-Origin`
- [ ] Response includes `Vary: Origin`
- [ ] `Access-Control-Max-Age` = `86400`

#### Pagination
- [ ] `?limit=3` returns max 3 items
- [ ] Response includes `hasMore: true/false`
- [ ] `nextCursor` present when more data available
- [ ] Invalid cursor → error (not crash)

#### Caching
- [ ] First GET hits Firestore (slower)
- [ ] Second identical GET returns cached data (faster)
- [ ] POST/PUT/DELETE invalidates cache
- [ ] Next GET after mutation returns fresh data

#### Health Check
- [ ] `GET /api/health` → 200 with `status: "ok"`
- [ ] Response includes `services.firebase: "connected"`
- [ ] If Firebase down → 503 with `status: "degraded"`

#### Logging
- [ ] `NODE_ENV=development` → human-readable logs
- [ ] `NODE_ENV=production` → JSON structured logs
- [ ] Invalid API key attempts logged with IP
- [ ] CRUD operations logged

### 🟢 Edge Cases

- [ ] GET with no matching filters → returns `[]` (not 404)
- [ ] Unicode/special characters in Ilokano words work
- [ ] Rapid sequential POSTs don't create duplicates
- [ ] Rate limiting triggers 429 after exceeding limit
- [ ] App fails gracefully if `NEXT_PUBLIC_API_KEY` missing
- [ ] App fails gracefully if Firebase credentials invalid

---

## 4. Load Testing (Optional)

### Using autocannon

```bash
npm install -g autocannon

# Test GET endpoint with 100 concurrent requests
autocannon -c 100 -d 10 -H "x-api-key: your-key" http://localhost:3000/api/v1/dictionary

# Test POST endpoint
autocannon -c 50 -d 10 -m POST -H "x-api-key: your-key" -H "Content-Type: application/json" -b '{"ilokanoWord":"load_test","englishTranslation":"load","tagalogTranslation":"load","partOfSpeech":"noun","category":"test","tts_url":"https://example.com"}' http://localhost:3000/api/v1/dictionary
```

### Using k6

```bash
# Install k6: https://k6.io/docs/getting-started/installation/

k6 run - <<EOF
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3000/api/v1/dictionary?limit=5', {
    headers: { 'x-api-key': 'your-key' },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has data': (r) => JSON.parse(r.body).data !== undefined,
  });
  sleep(0.1);
}
EOF
```

---

## 5. Behavior Changes from Previous Version

⚠️ **Be aware of these changes when testing:**

| Old Behavior | New Behavior |
|---|---|
| GET with no results → 404 | GET with no results → `[]` with 200 |
| Response: `{ data: [...] }` | Response: `{ data: [...], total, hasMore, nextCursor }` |
| Inconsistent error format | Standardized: `{ error, code?, details? }` |
| No caching | In-memory cache (60s TTL) on GET requests |
| No rate limiting | 100 req/min per IP (configurable) |
| Plain string API key comparison | Timing-safe comparison (prevents timing attacks) |

---

## 6. CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test
        env:
          TEST_BASE_URL: http://localhost:3000
          TEST_API_KEY: ${{ secrets.NEXT_PUBLIC_API_KEY }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
          NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL: ${{ secrets.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL }}
          NEXT_PUBLIC_FIREBASE_PRIVATE_KEY: ${{ secrets.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY }}
```

---

## Troubleshooting

### Tests fail with "connect ECONNREFUSED"
- Ensure `npm run dev` is running on the correct port

### Tests fail with 403 on all endpoints
- Verify `TEST_API_KEY` matches `NEXT_PUBLIC_API_KEY` in `.env.local`

### Health check returns `status: "degraded"`
- Check Firebase credentials in `.env.local`
- Verify Firestore is enabled in your Firebase project

### Rate limit errors (429) during testing
- Increase `RATE_LIMIT_MAX_REQUESTS` in `.env.local`
- Or wait 60 seconds for the rate limit window to reset
