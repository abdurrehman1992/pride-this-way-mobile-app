# OpenAI-Powered Recommendations & Location Suggestions

**Date:** 2026-05-19
**Status:** Approved design — ready for implementation planning
**Affects:** `src/screens/main/ForYou.tsx`, `src/components/Home/ForYouContent.tsx`, `src/components/modals/LocationModal.tsx`, new `functions/` Firebase project

## Goal

Replace the hardcoded static data in the ForYou (Recommendations) screen and the Location modal with OpenAI-generated, personalized suggestions. The OpenAI API key must never ship in the mobile app — it lives server-side in Firebase Cloud Functions.

## Architecture

```
[React Native App]
       │  httpsCallable (Firebase Auth token attached automatically)
       ▼
[Firebase Cloud Functions]  ← OPENAI_API_KEY lives here (functions secret)
       │
       ▼
[OpenAI API (chat completions, response_format=json_object)]
       │
       ▼
[Cloud Firestore: ai_cache collection]  ← responses cached per cache key
```

Two callable functions:

- `suggestLocations({ query })` — returns city/location suggestions
- `getRecommendations({ location, preferences })` — returns the two ForYou sections (Places Around You + Recommended For You)

Both functions check Firestore cache first; on miss they call OpenAI, persist the result, and return it.

The mobile app never sees the OpenAI key. Calls are authenticated via the existing Firebase Auth session — `@react-native-firebase/functions` attaches the user's ID token automatically.

## File Layout

### New files

- `functions/package.json` — Firebase Functions project (Node 20, TypeScript)
- `functions/tsconfig.json`
- `functions/src/index.ts` — exports `suggestLocations` and `getRecommendations`
- `functions/src/openai.ts` — OpenAI client + prompt builders + JSON parsing
- `functions/src/cache.ts` — Firestore-backed cache helpers (`getCached`, `setCached`, `cacheKey`)
- `functions/.env` — local-only; gitignored. Contains `OPENAI_API_KEY=...` for emulator runs.
- `functions/.gitignore` — ignores `.env`, `node_modules`, `lib/`
- `firebase.json` — adds the functions config block (if not already present)

- `src/services/aiService.ts` — client wrapper around `@react-native-firebase/functions`. Exposes:
  - `suggestLocations(query: string): Promise<string[]>`
  - `getRecommendations(location: string, prefs: string[]): Promise<AIRecommendations>`

### Modified files

- `src/screens/main/ForYou.tsx` — pass `selectedLocation` + `selectedPrefs` into `ForYouContent` as props
- `src/components/Home/ForYouContent.tsx` — remove static arrays; add `useEffect` to fetch from `aiService.getRecommendations`; render loader, empty, and error states
- `src/components/modals/LocationModal.tsx` — replace `DEFAULT_LOCATION_LIST` with state populated from `aiService.suggestLocations`; debounced 400ms on text input
- `package.json` — add `@react-native-firebase/functions` dependency

## Data Contracts

### `suggestLocations` response

```ts
type LocationSuggestionsResponse = {
  cities: string[]; // e.g. ["San Diego, CA", "Austin, TX", ...]
};
```

- Empty `query` → returns 8 popular US cities (a fixed, cached-forever list under cache key `loc:popular`).
- Non-empty `query` → OpenAI returns up to 8 matching cities, format `"City, State"` for US / `"City, Country"` otherwise.

### `getRecommendations` response

```ts
type AIRecommendations = {
  placesAroundYou: AIPlace[]; // horizontal scroll section
  recommendedForYou: AIPlace[]; // vertical list section
};

type AIPlace = {
  id: string; // stable hash from title — used as React key
  title: string;
  description: string; // 1 short sentence
  rating: string; // "4.5" — OpenAI fabricates this; documented as illustrative
  category: string; // e.g. "Food", "Music", "Adventure"
  imageKeyword: string; // 1-3 words for Unsplash search, e.g. "rooftop dining sunset"
};
```

- `placesAroundYou` returns 3 items (current static count).
- `recommendedForYou` returns 5 items (current static count).
- The app composes the image URL: `https://source.unsplash.com/600x400/?${encodeURIComponent(imageKeyword)}`.

## Data Flow

### ForYou recommendations

1. User taps **Add Location** → picks location in `LocationModal` → picks prefs in `PreferenceModal` → `handleApply` fires.
2. `ForYou` sets `isPreferencesSet = true` and renders `<ForYouContent location={selectedLocation} prefs={selectedPrefs} />`.
3. `ForYouContent` `useEffect` (dependency: `[location, prefs.sort().join(',')]`) calls `aiService.getRecommendations(location, prefs)`.
4. Cloud function computes `cacheKey = sha1("recs|" + location.toLowerCase() + "|" + prefs.sort().join(","))`.
5. Function reads `ai_cache/{cacheKey}` — if document exists and `expiresAt > now`, return its `payload`.
6. On miss: call OpenAI chat completions with `response_format: { type: "json_object" }`, parse, write `{ payload, createdAt, expiresAt: now + 7d }`, return payload.
7. App renders. For each `AIPlace`, image is `https://source.unsplash.com/600x400/?${imageKeyword}`.

### Location suggestions

1. `LocationModal` mounts → calls `suggestLocations("")` → returns 8 popular cities (cache key `loc:popular`, no expiry).
2. User types in the search input → 400ms debounce → calls `suggestLocations(query)`.
3. Cache key is `sha1("loc|" + query.toLowerCase().trim())`, TTL 30 days.
4. Results replace the displayed list. Existing `filteredLocations` filter logic in the modal is removed (server now does the filtering).

## Cache Strategy

- **Collection:** `ai_cache` (top-level Firestore)
- **Document shape:**
  ```ts
  {
    payload: object,          // the response sent back to the app
    createdAt: Timestamp,
    expiresAt: Timestamp,     // null = no expiry (used for popular cities)
    kind: 'recs' | 'loc'      // for debugging / manual cleanup
  }
  ```
- **TTLs:** 7 days for recs, 30 days for location queries, no expiry for popular cities.
- **Cache write is best-effort** — if Firestore write fails, log but still return the OpenAI result. The next request just re-fetches.
- **Manual flush:** user clears the `ai_cache` collection in Firebase Console. No admin UI in scope.

## Prompts (sketch)

### `getRecommendations`

```
System: You are a travel assistant. Return ONLY valid JSON matching the schema.
User: Generate place recommendations for a traveler in {location} interested
      in {prefs.join(', ')}.

      Return JSON with this exact shape:
      {
        "placesAroundYou": [3 items],
        "recommendedForYou": [5 items]
      }

      Each item: { id, title, description, rating, category, imageKeyword }
      - id: short kebab-case slug
      - description: one sentence, max 60 chars
      - rating: number string like "4.5", between 4.0 and 4.9
      - category: one of the user's preferences when possible
      - imageKeyword: 1-3 words for image search (no punctuation)

      Do not include any text outside the JSON.
```

Model: `gpt-4o-mini` (cheap, fast, json-mode supported).

### `suggestLocations`

```
System: You are a location autocomplete service. Return ONLY valid JSON.
User: Suggest up to 8 real cities matching "{query}".
      Format US cities as "City, State", others as "City, Country".
      Return JSON: { "cities": ["...", "..."] }
```

## Error Handling

| Failure | Function behavior | App behavior |
|---|---|---|
| OpenAI API error / timeout | Throw `HttpsError('internal', 'OpenAI failed')` | Show toast "Couldn't load recommendations" + retry button. No silent fallback to static data. |
| OpenAI returns malformed JSON | Same as above (with `response_format: json_object` this should be vanishingly rare) | Same |
| Firestore cache read fails | Treat as cache miss, continue to OpenAI | (transparent) |
| Firestore cache write fails | Log warning, still return payload | (transparent) |
| Network offline (mobile side) | n/a | `aiService` catches, shows offline toast |
| Auth missing | `HttpsError('unauthenticated')` | Should not happen — `ForYou` is behind auth gate |

## Where to Paste the OpenAI Key

Two environments, two locations:

**Local emulator runs** (when developing the function):

Create `functions/.env` and paste:
```
OPENAI_API_KEY=sk-...your-key-here...
```
This file is in `.gitignore`. The function reads it via `process.env.OPENAI_API_KEY` when running locally.

**Deployed production functions:**

Run once in the terminal:
```
cd functions
firebase functions:secrets:set OPENAI_API_KEY
```
Firebase prompts for the key, stores it in Google Secret Manager, and injects it into the function at runtime. Key never touches source code, source files, or git.

Functions declare the secret like:
```ts
export const getRecommendations = onCall(
  { secrets: ['OPENAI_API_KEY'] },
  async (request) => { ... }
);
```

## Testing

- **Functions:** unit tests in `functions/src/__tests__/` covering:
  - Cache hit returns cached payload, skips OpenAI
  - Cache miss calls OpenAI, writes cache
  - OpenAI failure throws `HttpsError('internal')`
  - Cache write failure does not fail the request
  - OpenAI is mocked; no live calls in tests
- **Mobile:** manual smoke test in simulator:
  - ForYou empty state → add location → pick prefs → see loader → see recommendations
  - Same flow with airplane mode on → see error toast + retry
  - Location modal opens → shows popular cities → typing filters via OpenAI
  - Second open of same location+prefs combo → instant (cache hit)

## Out of Scope (YAGNI)

- Streaming responses
- Per-user personalization beyond location + prefs (no learning from past behavior)
- Admin UI to flush the cache
- Migrating `AddLocations.tsx` to OpenAI (stays on Firestore as today)
- Replacing the existing `searchLocation.ts` / Mapbox geocoding utilities — Location modal flow is separate from those
- Rate limiting per user (Firebase Functions has built-in invocation limits; revisit if abuse appears)
- Internationalization of prompts (English-only for now)

## Open Questions

None — design approved by user.

## Dependencies Added

- `@react-native-firebase/functions` (app)
- `firebase-functions`, `firebase-admin`, `openai` (functions)
