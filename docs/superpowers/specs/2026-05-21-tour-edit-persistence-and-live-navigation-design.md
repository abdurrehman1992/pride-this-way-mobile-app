# Tour Edit Persistence + Live Navigation UX — Design

**Date:** 2026-05-21
**Status:** Approved (pending written-spec review)
**Scope:** Fix five connected issues in the tour creation, edit, and start flow.

---

## Problem Statement

Five user-reported issues in the tour creation / edit / start flow:

1. **Deleted places reappear on the Start Tour map.** User creates a tour from a suggested route (e.g. "Lahore route" with Punjab University + Mall Road), deletes Punjab University and adds Urdu Bazar, saves the tour. When the user starts that saved tour, the map shows Punjab University again — the deletion was silently undone.
2. **Routes don't strictly follow roads.** Between stops the polyline sometimes cuts through buildings / non-road areas instead of following pedestrian paths like a navigation app would.
3. **No live route progress.** As the user walks the tour, there's no visual distinction between completed and remaining route segments. The whole polyline stays one color.
4. **Drawer stats are stale.** Rewards Points and Places Visited in the side drawer don't update after a visit is confirmed — user has to logout and login again to see fresh numbers.
5. **Map UX during active tour is not user-friendly.** Map doesn't follow the user as they move, no recenter button, no heading-up rotation, no live framing of the next stop.

These are bundled into one spec because they all touch the same screens (`MyTourStart`, `TourSuggestion`, `CustomDrawer`) and the same tour data model.

---

## 1. Tour Edit Persistence (Issue 1)

### Rule

**The tour document on Firestore is the authoritative source of the user's places. Once a tour is saved, the route template is no longer consulted for place merging.**

User edits to a tour (add/remove places) affect ONLY that user's tour document — never the underlying route template, never other users' tours, never the suggested routes shown to anyone else.

### Data Model

`tours/{tourId}` document (existing collection):
- `all_places[]` — authoritative list of `{ place_id, visited, visitedAt, proofImageUri, pointsEarned, addedByUser }`. This is the single source of truth for which places belong to the tour.
- `route.id` — reference to the original route template (used for branding: name, image). Never used for merging place lists after initial creation.
- `isEdited: boolean` — set to `true` once the user adds or removes any place.

### Code Changes

**`MyTourStart.tsx` (the load merge bug):**

Current code at the saved-tour branch:
```ts
const mergedSavedPlaces = [
  ...savedPlaces,
  ...data.places.filter(
    (place) => !savedPlaces.some((savedPlace) => savedPlace.id === place.id)
  ),
];
```

This re-adds every place from the route template that the user already removed. Remove the merge — use `savedPlaces` directly:

```ts
nextDetails = {
  ...data,
  places: savedPlaces, // authoritative; do not re-merge from route template
};
```

The `data.places` from `fetchRouteDetails` is still used for **first-time creation** (when no saved tour exists yet) and for non-place data (route metadata, events).

**`TourSuggestion.tsx`:**

No code change required — `handleSave` already passes the local `places` state (which reflects user deletions and additions) to `saveUserTour`. The bug was downstream in `MyTourStart`, not here.

**`MyTourStart.tsx` (remove flow inside active tour):**

When user removes a place from an active tour (existing edit flow), continue to call `saveUserTour` with the new `places` list. This already works via `pendingEditSaveRef`. Verify the persisted `all_places` array reflects removals (not just additions). If removals are silently dropped at the service layer, fix `saveUserTour` to overwrite `all_places` with the full new list rather than merging.

### Acceptance Criteria

- Create tour from a suggested route with N places, delete one place, save → tour doc on Firestore has N-1 places in `all_places`.
- Open the saved tour and Start → map shows exactly the N-1 places, never the deleted one.
- Admin adds a new place to the original route template → existing user tours are unaffected (no new places appear).
- New tours created from that route after the admin change DO include the new place.

---

## 2. Strict Road-Following Routes + Live Progress Split (Issue 2 + 3)

### Routing Profile Change

Switch Mapbox Directions API profile from `driving` to `walking`:

File: `MyTourStart.tsx`, in `fetchRoadSegment`:
```
https://api.mapbox.com/directions/v5/mapbox/walking/{from};{to}
```

Reason: tours are city-scale (a few km between stops). Walking profile follows pedestrian paths, sidewalks, small roads that driving profile would skip or detour around. This produces visually tighter, road-hugging polylines.

### Remove Silent Straight-Line Fallback

Current code returns `[from, to]` (straight line) if the Directions API fails. Replace with explicit failure handling:

- Log the failure (`console.warn`).
- Show a toast: `"Could not find walking route between [A] and [B]"`.
- Return `null` for that segment — caller skips rendering it (no straight line through buildings).
- Other segments continue to render normally.

Great-circle arc remains only for legs >200 km apart (`ROAD_ROUTE_MAX_METERS`), which never triggers for a city tour but is preserved for future cross-country tours.

### Endpoint Snapping

Mapbox snaps `from`/`to` to the nearest road, so the returned polyline starts/ends a few meters off the actual stop pin. Existing code prepends the original `from` and appends `to` — keep this so polylines visually connect to pins.

### Live Route Progress (Google-Maps-style)

The route between two stops gets split into two visual layers based on the user's current GPS position along the polyline:

**Completed portion** — behind the user along the route:
- Gray solid line (`#9AA3AF`, no dash pattern).
- Existing `completedRouteLineLayerStyle` already defines this.

**Remaining portion** — ahead of the user:
- Red dotted line (existing `COLORS.LOGOUT_TEXT`, `lineDasharray: [1.4, 1.6]`).
- Existing `routeLineLayerStyle` already defines this.

**How the split works:**

1. For each leg `(visited stop or tour origin) → (next pending stop)`, fetch the walking polyline once and cache it in state keyed by leg endpoints.
2. On each GPS update:
   - Find the nearest point on the polyline to `currentLocation` (linear projection across each segment of the polyline — pick the segment with smallest perpendicular distance).
   - Split the polyline at that projection point: `[0..proj]` = completed, `[proj..end]` = remaining.
3. Re-render both LineLayers with the split arrays. Mapbox's LineLayer handles smooth re-rendering.

**Cross-leg state:**
- Fully traversed legs (both endpoints visited): all gray solid, no split.
- Future legs (beyond the next pending stop): all red dotted, no split.
- Only the **active leg** (last visited or tour origin → nearest pending stop) gets the live split.

**Current destination highlight:**
- Next pending stop pin gets a pulsing red halo (red variant of existing `PulsingPin`).
- Floating banner above the map (top-center, below the header): `"Next: [stop name] · [distance] m/km"`. Distance updates live.

**Throttling:**
- Recalculate split at max 1 Hz even if GPS fires faster. Linear projection on ~50–200 points is cheap, so this is comfortable for perceived smoothness.

**Caching:**
- Keep fetched walking polylines in state per-leg (`Map<legKey, [number, number][]>`). Only re-fetch when stops change (add/remove).
- Leg key: `"${fromStopId}->${toStopId}"`.

### Acceptance Criteria

- Polyline between any two city stops follows actual walking paths (not straight lines, not through buildings).
- If a leg cannot be routed: toast shown, that leg renders nothing, other legs still render.
- As user walks along an active leg: gray portion grows, red dotted portion shrinks in real time.
- Visited legs show fully gray. Future legs show fully red dotted.
- Next pending stop is visually highlighted with pulsing red halo + distance banner.

---

## 3. Map UX During Active Tour (Issue 5)

### Continuous GPS Tracking

Replace the current one-shot `Geolocation.getCurrentPosition` calls during an active tour with `Geolocation.watchPosition`:

```ts
const watchId = Geolocation.watchPosition(
  (position) => { /* update currentLocation, route split, camera */ },
  (error) => { /* toast */ },
  { enableHighAccuracy: true, distanceFilter: 5, interval: 1000, fastestInterval: 500 }
);
```

- Started when `tourStarted` becomes `true`.
- Cleared on pause, completion, screen unmount, or tour end (`Geolocation.clearWatch(watchId)`).
- `distanceFilter: 5` = update only when user moves ≥5 m, prevents jittery noise.

### Follow-User Camera Mode

New state: `followMode: 'follow' | 'free'`. Default `'follow'` when tour starts.

- **`follow` mode:** on every GPS update, smoothly recenter camera on user:
  ```ts
  cameraRef.setCamera({
    centerCoordinate: currentLocation,
    zoomLevel: 16,
    animationDuration: 800,
    animationMode: 'easeTo',
  });
  ```
- **Break out:** if user pans/pinches the map, `onRegionDidChange` fires with `isUserInteraction: true` → set `followMode: 'free'`. Camera stops auto-following.
- **Resume:** tapping the recenter button → `followMode: 'follow'` + immediate snap to user.

### Heading-Up Rotation (Toggleable)

- Read `heading` from `position.coords.heading` on each GPS fix.
- When `speed > 1 m/s` (user is actually moving): apply heading to camera via `setCamera({ heading })`.
- When standing still: keep last valid heading (don't spin to garbage values).
- **Toggle:** long-press the recenter button to switch between `north-up` (heading = 0) and `heading-up` modes. Default = north-up.

### Recenter Button

- Floating circular button, bottom-right, ~52px, above the existing zoom controls.
- Icon: location arrow.
- Visual state:
  - `follow` mode: gray icon (passive — already following).
  - `free` mode: blue icon (active — tap to recenter).
- Tap: `followMode: 'follow'` + `cameraRef.setCamera({ centerCoordinate: currentLocation, zoomLevel: 16 })`.
- Long-press: toggle heading-up vs. north-up.

### Live Next-Stop Framing

When `nearestPendingStop` changes (user just completed one, the next becomes active):
- One-shot `fitBounds(user, nextStop, padding={ top: 200, bottom: 300, left: 60, right: 60 })` animation for ~1.5 s.
- After the animation, resume `follow` mode (camera tracks user again).
- Separate from the existing intro animation; this fires on stop transitions during the tour.

### Throttling

- Camera updates throttled to ~1 Hz. Even if GPS fires every 500 ms, we coalesce into one camera move per second to avoid jittery animations stacking up.
- Route-split recalculation also throttled to 1 Hz (already covered in Section 2).

### Acceptance Criteria

- During an active tour, the map smoothly follows the user as they walk — no manual panning needed.
- Pinching/dragging the map exits follow mode; recenter button visibly activates (blue).
- Tapping recenter snaps back to user and resumes follow.
- Long-pressing recenter toggles between north-up and heading-up.
- When user completes a stop, the camera briefly frames both user and next stop, then resumes following the user.

---

## 4. Drawer Auto-Refresh (Issue 4)

### Trigger

Refresh `rewardPoints` and `visitedPlacesCount` **every time the drawer opens**.

### Implementation

Import `useDrawerStatus` from `@react-navigation/drawer`:

```ts
import { useDrawerStatus } from '@react-navigation/drawer';

const drawerStatus = useDrawerStatus(); // 'open' | 'closed'

useEffect(() => {
  if (drawerStatus !== 'open' || !user?.id) return;
  fetchRewardsSummary(user.id).then((summary) => {
    const visited = summary.tours.reduce(
      (sum, tour) => sum + tour.places.filter((p) => p.visited).length,
      0
    );
    setRewardPoints(summary.totalPoints);
    setVisitedPlacesCount(visited);
  }).catch(() => {
    // Keep last known values on failure — do not zero out.
  });
}, [drawerStatus, user?.id]);
```

### Loading Behavior

- While re-fetching, **keep showing previous values** — no spinner, no flash to zero. Numbers update silently when the fetch resolves.
- On error: leave previous values intact (current code zeros them out — change this).

### Initial Mount

The existing one-shot `useEffect([user?.id])` becomes redundant once `useDrawerStatus` is in place (the drawer opens on first render, firing the listener). Remove the old `useEffect` to avoid duplicate fetches.

### React.memo

Keep `React.memo` on `CustomDrawer` — it doesn't block internal `useEffect` re-runs, so it's compatible with the new approach.

### Acceptance Criteria

- User confirms a visit on Start Tour screen, awarding points → opens drawer → sees updated Rewards Points and Places Visited immediately.
- Drawer reopens fetch fresh data each time.
- If the fetch fails (e.g. offline), previous values stay visible; no flash to zero.
- No logout/login required to refresh stats.

---

## Files Touched

- `src/screens/main/MyTourStart.tsx` — load merge fix, walking profile, route split logic, watchPosition, follow mode, recenter button, heading-up, live framing, next-stop highlight + banner.
- `src/screens/main/TourSuggestion.tsx` — no code change expected (existing save flow already correct).
- `src/components/Drawer/CustomDrawer.tsx` — `useDrawerStatus` integration, remove one-shot effect, preserve-on-error.
- `src/services/myTourService.ts` — verify `saveUserTour` overwrites `all_places` rather than merging (only if a removal bug surfaces during testing).

## Out of Scope

- Offline support for tours (existing known gap).
- Photo upload to Firebase Storage for visit proof (existing known gap).
- AI/OpenAI recommendation logic (separate spec).
- Map.tsx global map screen — not affected by this work.

## Risk / Edge Cases

- **Mapbox walking profile may fail in regions with sparse OSM walking data.** Mitigation: explicit toast + skip the leg (no silent straight line).
- **GPS heading is noisy at low speeds.** Mitigation: only apply heading when `speed > 1 m/s`; keep last valid value otherwise.
- **watchPosition battery drain.** Mitigation: only active while tour is running; cleared on pause/complete/unmount.
- **Race between AddLocations return and saveUserTour persist.** Existing `pendingEditSaveRef` pattern handles this; verify it still works after the merge removal.
- **First-time tour creation (no saved tour yet) must still use route template places.** The merge removal only applies when `savedTour` exists. Initial creation path unchanged.
