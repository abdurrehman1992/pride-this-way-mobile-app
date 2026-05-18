# Pride This Way — Product Documentation

## 1. Product Overview

**Pride This Way** is a travel and city-exploration mobile app that helps users discover places, events, and guided tour routes in cities around the world. The core loop is:

> Choose a city → Select interests → Get a matched route → Follow it on a map → Confirm visits → Earn points → Complete the tour.

The app is built around **structured discovery** — users don't create tours from scratch. Instead, the system recommends pre-built admin routes based on user preferences, and users can optionally customize them.

---

## 2. Data Architecture (Firebase Collections)

| Collection | Purpose | Created By |
|---|---|---|
| `routes` | Template tour routes (admin-created) | Admin panel |
| `tours` | User-specific journey records with progress | App (on user action) |
| `places` | All visitable locations/POIs | Admin panel |
| `events` | Events shown on the map | Admin panel |
| `tags` | Category/interest preference tags | Admin panel |
| `users` | User profiles | Auth / signup |
| `users/{uid}/favorites` | Saved favorite items per user | App (user action) |

### Key Data Relationships

```
routes
  └── selected_places[]  →  places (by place_id)
  └── event_ids[]        →  events (by event_id)
  └── tag_ids[]          →  tags (for matching)

places
  └── tag_ids[]          →  tags

events
  └── tag_ids[]          →  tags
  └── coordinates        →  shown as markers on global map

tours (user-specific)
  └── route_id           →  routes (source template)
  └── user_id            →  users
  └── all_places[]       →  place_id + visit progress (visited, points, photo proof)
  └── event_ids[]        →  events (copied from route at time of creation)
  └── status             →  active | paused | scheduled | completed
```

### Route vs Tour Distinction

| Condition | Result |
|---|---|
| User views route, no edits, no visits | Stays as a route template — no Firestore write |
| User edits (adds/removes places) | Becomes a user tour — saved to `tours` collection |
| User starts and visits at least one location | Saved to `tours` regardless of edits |
| User schedules for later | Immediately saved to `tours` as `status: 'scheduled'` |

---

## 3. Complete User Journeys

### 3.1 Tour Creation Flow

```
MyTour screen (empty state)
  → "Start A Tour" button
  → LocationModal
      • User types or picks a city
      • Powered by Mapbox suggestions
      • OR use current GPS location
  → PreferenceModal
      • Tags fetched from Firestore `tags` collection
      • User selects interests (e.g. Food, History, Adventure)
  → System calls fetchRecommendedRoutes()
      • Scores all routes by matched tag count
      • Filters by location if possible
      • Returns best 1 matching route
  → NameTourModal
      • Pre-fills with matched route name
      • User can edit the name
      • Confirm → ScheduleTourModal
  → ScheduleTourModal
      • "Start Now" → creates active tour card
      • "Schedule Tour" → pick Today/Tomorrow/+3 Days/Next Week
          → Saves immediately to Firestore as status: 'scheduled'
  → Tour card displayed on MyTour screen
```

### 3.2 Active Tour Flow (MyTourStart)

```
User taps "Start Tour" on a tour card
  → Navigate to MyTourStart screen
  → Load route details from Firestore
  → If saved tour exists: restore progress (visited stops, points, etc.)
  → Order all stops by nearest-neighbor algorithm from user's GPS location
  → Fetch and display road-following route via Mapbox Directions API
  → Show full route on map (dashed red line)
  → Blue markers = unvisited place stops
  → Gray markers = visited/completed stops
  → Blue markers = events (non-navigational, informational only)
  → User current location = gray dot marker

User taps a place marker
  → Detail card appears above the marker
  → Shows: image, title, description, rating, city, Open Now
  → Shows: Favorite toggle, "Confirm Visit" button, Delete button

User taps "Confirm Visit"
  → ScanVerifyModal opens (3-step)
  → Step 1: Live camera view, user takes photo
  → Step 2: Confirm or retake the photo
  → Step 3: Success screen with points earned
  → handleVisitVerification():
      • Gets current GPS coords
      • Checks distance <= 300m from stop
      • If too far: shows error, returns false (no progress saved)
      • If within range:
          - Marks stop as visited
          - Records visitedAt timestamp
          - Stores photo URI
          - Calculates points (place.points or default 10)
          - Persists progress to Firestore
          - Camera auto-advances to next nearest unvisited stop
  → If all stops done: Tour Completion Modal appears

Tour Completion Modal
  → Shows total earned points
  → "Back To My Tour" → navigates to MyTour screen
  → Tour shows in Completed tab

User taps an event marker
  → EventDetailModal opens (compact variant)
  → Shows event title, description, category, dates, location
  → No visit confirmation for events
```

### 3.3 Tour Management (Pause / Resume / End)

| Action | Behavior |
|---|---|
| **Pause Tour** | Sets `tourStarted = false`, persists `status: 'paused'` to Firestore |
| **Resume Tour** | Sets `tourStarted = true`, re-saves as `status: 'active'` |
| **End Tour** | Deletes the tour document from Firestore, resets state, navigates back |

```
MyTour → filter "Paused" tab → Resume Tour button
  → Opens MyTourStart with existing tourId
  → Restores full progress from Firestore
  → Camera shows tour route, "Resume Tour" button active
```

```

### 3.5 For You (Recommendations) Flow

```
ForYou screen
  → Empty state shown initially
  → "Get Recommendations" / preference gate
  → LocationModal → PreferenceModal
  → Preferences confirmed → show recommendations content
  → Recommendation cards (currently static data)
  → Future: OpenAI-generated recommendations
  → Clicking a card → RecommendationDetails screen
```

### 3.6 Global Map Flow

```
Map screen
  → Globe/Mapbox view loads
  → "Explore By City" quick chips (New York, LA, London, Dubai, Toronto)
  → Search bar → Mapbox suggestions
  → Selecting a city → camera flies to that city
  → Red markers = Pride events from Firebase `events`
  → Blue markers = Podcast events (currently reusing same events collection)
  → Clicking any marker → compact EventDetailModal
  → Map Legend card fixed at bottom (always visible)
```

### 3.7 Favorites Flow

```
User taps heart icon on a place or tour
  → addToFavorites() writes to users/{uid}/favorites (Firestore)
  → Real-time onSnapshot listener updates favorites everywhere instantly
  → Favorites tab shows all saved items
  → Favorite places can influence route scoring (favoritePlaces in route matching)
```

### 3.8 Rewards Flow

```
Rewards screen (accessible from drawer)
  → fetchRewardsSummary(userId)
  → Shows total earned points across all completed tours
  → Expandable tour cards showing per-stop point breakdown
  → Progress bar (currently partial, needs dynamic calculation)
```

---

## 4. Route Matching Algorithm

```
fetchRecommendedRoutes({ locationLabel, selectedTagIds, userId })

1. Fetch all routes, all places, all events, user's favorite place IDs
2. For each route:
   a. Resolve place objects from route.selected_places[]
   b. Resolve event objects from route.event_ids[]
   c. Collect all tag_ids from route + places + events → routeTagIds[]
   d. Count how many of routeTagIds match the user's selectedTagIds → matchedTagCount
   e. Check if route location (city/country) matches user's locationLabel
3. Filter: keep routes where matchedTagCount > 0 (or no tags selected)
4. Prefer location-matched routes; fallback to any matched route if none match location
5. Sort by matchedTagCount DESC, then totalStops DESC
6. Return top 1 result
```

**Tag matching sources:**
- Route-level `tag_ids`
- Per-place `tag_ids` (from `selected_places` refs)
- Hydrated `places` objects `tag_ids`
- Linked `events` `tag_ids`

---

## 5. Visit Verification Logic

```
User presses "Confirm Visit"
→ ScanVerifyModal captures photo
→ onScanSuccess(imageUri) triggers handleVisitVerification()

handleVisitVerification:
  1. Get current GPS coords (enableHighAccuracy, timeout 10s)
  2. Calculate Haversine distance from user to stop.coordinate
  3. If distance > 300 meters:
     → showError("You need to be near this location")
     → return false (modal stays open, no progress saved)
  4. If within 300m:
     → Mark stop visited = true
     → Record visitedAt ISO timestamp
     → Store proofImageUri (local file URI — no cloud upload yet)
     → Set pointsEarned = place.points || 10
     → Update placeProgress state
     → saveUserTour() to Firestore (merge: true)
     → Auto-advance camera to next nearest unvisited stop
     → If all stops visited → show completion modal
     → return true
```

---

## 6. MyTour Screen — Filter Tabs

| Tab | Shows |
|---|---|
| All | Every tour regardless of status |
| Current | `status === 'active'` |
| Paused | `status === 'paused'` |
| Scheduled | `status === 'scheduled'` |
| Favourite | Tours where `isFavorite(tourId \|\| route.id)` is true |
| Completed | `status === 'completed'` |

---

## 7. Product Gaps & Known Issues

### Critical Gaps

| # | Gap | Impact |
|---|---|---|
| 1 | `proofImageUri` stored as local file URI in Firestore | Photo proof lost if user reinstalls or switches device |
| 2 | No server-side proximity validation | GPS spoofing would allow fake visit confirmations |
| 3 | `fetchRecommendedRoutes` always returns max 1 route | Users see only one option even if many good matches exist |
| 4 | ForYou recommendations are fully static (hardcoded) | No personalization; doesn't use any real data |
| 5 | Rewards progress bar is hardcoded at 55% width | Doesn't reflect actual user progress |

### UX/Flow Gaps

| # | Gap | Impact |
|---|---|---|
| 6 | No way to restore route if user deletes it from MyTour | Deleted active tours are gone permanently |
| 7 | AddLocations params mismatch with TypeScript types | `routeName`, `tourName`, `extraPlaceIds` missing from type definition |
| 8 | `RecommendedForYou` always shows "Restaurant" category | Incorrect category display for all items |
| 9 | No offline support — all Firestore calls are online-only | Tour crashes if connectivity is lost mid-tour |
| 10 | ScanVerifyModal success screen hardcodes "+10 points" | Misleading when place has custom points value |
| 11 | Scheduled tour → date arrives → status stays 'scheduled' | No auto-transition to 'active' on scheduled date |

### Architecture Risks

| # | Risk | Severity |
|---|---|---|
| 12 | All routes and places fetched on every route match call | High — full collection scans on each tour creation |
| 13 | No Firestore indexes for compound queries | Will fail at scale beyond ~100 documents |
| 14 | `placeProgress` not stored in Redux — local state only | Lost on unmount if not persisted to Firestore in time |
| 15 | `handleCurrentLocation` used in useEffect before declaration | TypeScript hoisting risk (pre-existing bug) |
| 16 | Directions API called every time currentLocation changes | Expensive — can fire many times per minute during active tour |
| 17 | Base64 image blobs stored in Firestore documents | Firestore has 1MB document size limit — large photos will fail |

---

## 8. Suggested Improvements

### Short-term (no structural change needed)

1. **Upload photos to Firebase Storage** instead of storing URI strings in Firestore
2. **Show multiple route options** (top 3) instead of always top 1 — let users pick
3. **Fix ScanVerifyModal** to show actual `place.points` in the success message
4. **Auto-transition scheduled tours** — check `scheduledDate` on app open and flip status to 'active'
5. **Add Directions API debouncing** — only re-fetch when stops change, not on every GPS update

### Medium-term (moderate structural change)

6. **Cache route and place data** in Redux/AsyncStorage — avoid full Firestore scans
7. **Connect ForYou to real data** — use same `fetchRecommendedRoutes` logic for recommendation cards
8. **Add Firestore composite indexes** on `tours` collection (user_id + status, user_id + updatedAt)
9. **Fix AddLocations TypeScript types** — add missing params to `MyTourStackParamList.AddLocations`
10. **Add isActive filter** on routes and places at query level, not client-side

### Long-term (architectural investment)

11. **OpenAI recommendations** — integrate GPT to generate personalized itineraries from user preferences + location data
12. **Server-side proximity validation** — Cloud Function that verifies GPS + photo metadata before awarding points
13. **Offline support** — Firestore offline persistence + local queue for visit confirmations
14. **Live route progress** — real-time `onSnapshot` on tour document so multiple devices stay in sync
15. **Leaderboard / social layer** — compare points with friends, share completed tour routes

---

## 9. Tech Stack Reference

| Layer | Technology |
|---|---|
| Frontend | React Native (TypeScript) |
| Navigation | React Navigation (NativeStack + BottomTabs + Drawer) |
| Map | Mapbox (`@rnmapbox/maps`) — globe + street view |
| Backend | Firebase Firestore (NoSQL) + Firebase Auth |
| Camera | `react-native-vision-camera` v5 |
| Image Picker | `react-native-image-picker` |
| State (Auth) | Redux + redux-persist (AsyncStorage) |
| State (Features) | React component state + Context (FavoritesContext) |
| Geocoding | Mapbox Geocoding API + OpenStreetMap Nominatim fallback |
| Directions | Mapbox Directions API v5 (walking) |
| Toast | `react-native-toast-message` |

---

## 10. Current Screen Map

```
App
├── Auth Stack
│   ├── Login
│   ├── Signup
│   ├── ForgotPassword → EnterCode → CreateNewPassword
│
└── App (authenticated)
    └── Drawer
        ├── Bottom Tabs
        │   ├── MyTour
        │   │   ├── MyTour (list + filter tabs)
        │   │   ├── AddLocations
        │   │   ├── MyTourStart (active tour map)
        │   │   └── RecommendationDetails
        │   ├── Map (global globe map)
        │   ├── ForYou (recommendations)
        │   │   ├── ForYou (gate / preference)
        │   │   ├── Home (recommendations feed)
        │   │   └── RecommendationDetails
        │   └── Favorites
        ├── Profile → EditProfile / ChangePassword
        └── Rewards
```
