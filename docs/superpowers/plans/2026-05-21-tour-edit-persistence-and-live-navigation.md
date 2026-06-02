# Tour Edit Persistence + Live Navigation UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four connected issues in the tour creation/start flow: (1) deleted places reappearing on Start Tour map, (2) routes not strictly following roads, (3) no live route progress visualization, (4) stale drawer stats, and (5) unfriendly map UX during an active tour.

**Architecture:** Two new utility/hook files isolate the new logic (route-progress math + drawer rewards refresh hook). `MyTourStart.tsx` is modified in-place: load merge removed, walking profile, watchPosition, split rendering, follow-mode camera, recenter button. `CustomDrawer.tsx` swaps a one-shot effect for a drawer-open listener.

**Tech Stack:** React Native + TypeScript, `@rnmapbox/maps`, `@react-native-community/geolocation`, `@react-navigation/drawer` (`useDrawerStatus`), Mapbox Directions walking API, Firestore via `myTourService`, Jest preset `@react-native/jest-preset`.

**Spec reference:** [`docs/superpowers/specs/2026-05-21-tour-edit-persistence-and-live-navigation-design.md`](../specs/2026-05-21-tour-edit-persistence-and-live-navigation-design.md)

---

## File Structure

**New files:**
- `src/utils/routeProgress.ts` — pure functions: `projectPointOnPolyline`, `splitPolylineAt`, `distanceMetersBetween`. Keeps polyline math out of the screen component.
- `src/hooks/useDrawerRewardsRefresh.ts` — hook that re-fetches rewards summary whenever the drawer opens.
- `src/components/MyTourStart/RecenterButton.tsx` — floating recenter button with active/passive states.
- `src/components/MyTourStart/NextStopBanner.tsx` — floating banner: "Next: [name] · [dist]".
- `__tests__/utils/routeProgress.test.ts` — unit tests for polyline math.
- `__tests__/hooks/useDrawerRewardsRefresh.test.ts` — tests for the drawer hook.

**Modified files:**
- `src/screens/main/MyTourStart.tsx` — remove load merge, walking profile, route split state, watchPosition, follow mode, recenter button, next-stop framing, pulsing destination pin.
- `src/components/Drawer/CustomDrawer.tsx` — `useDrawerStatus` listener; preserve-on-error.
- Possibly `src/services/myTourService.ts` — only if a removal-persistence bug is observed (defensive task at the end).

**Out of scope (per spec):** offline support, photo upload to Storage, OpenAI recommendations, `Map.tsx` global map screen.

---

## Pre-flight

- [ ] **Step 0a: Create a worktree (if not already in one)**

If the user hasn't already moved this work into an isolated worktree, run the `superpowers:using-git-worktrees` skill before starting Task 1.

- [ ] **Step 0b: Confirm tooling works**

```bash
cd /Users/app/Desktop/pride-this-way-mobile-app
npx jest --listTests | head -5
```

Expected: lists at least `__tests__/App.test.tsx`. If `jest` errors, run `npm install` then retry.

---

## Task 1: Route Progress Math — `projectPointOnPolyline`

**Files:**
- Create: `src/utils/routeProgress.ts`
- Test: `__tests__/utils/routeProgress.test.ts`

Pure functions, no React, no Mapbox imports. Used by `MyTourStart` to compute the gray/red split point along a polyline given the user's GPS.

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/routeProgress.test.ts`:

```ts
import {
  distanceMetersBetween,
  projectPointOnPolyline,
  splitPolylineAt,
} from '../../src/utils/routeProgress';

describe('distanceMetersBetween', () => {
  it('returns 0 for identical points', () => {
    expect(distanceMetersBetween([0, 0], [0, 0])).toBe(0);
  });

  it('returns ~111 km for 1 degree of latitude', () => {
    const d = distanceMetersBetween([0, 0], [0, 1]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('projectPointOnPolyline', () => {
  const polyline: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 1],
  ];

  it('projects onto the closest segment', () => {
    const result = projectPointOnPolyline([0, 0.5], polyline);
    expect(result.segmentIndex).toBe(0);
    expect(result.point[0]).toBeCloseTo(0, 5);
    expect(result.point[1]).toBeCloseTo(0.5, 5);
  });

  it('clamps to polyline start when point is before it', () => {
    const result = projectPointOnPolyline([-1, -1], polyline);
    expect(result.segmentIndex).toBe(0);
    expect(result.point).toEqual([0, 0]);
  });

  it('returns segment 1 when point is closer to the second segment', () => {
    const result = projectPointOnPolyline([0.5, 1], polyline);
    expect(result.segmentIndex).toBe(1);
    expect(result.point[0]).toBeCloseTo(0.5, 5);
    expect(result.point[1]).toBeCloseTo(1, 5);
  });
});

describe('splitPolylineAt', () => {
  const polyline: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 1],
  ];

  it('splits at a projection on the first segment', () => {
    const projection = { segmentIndex: 0, point: [0, 0.5] as [number, number] };
    const { completed, remaining } = splitPolylineAt(polyline, projection);
    expect(completed).toEqual([[0, 0], [0, 0.5]]);
    expect(remaining).toEqual([[0, 0.5], [0, 1], [1, 1]]);
  });

  it('splits at a projection on the second segment', () => {
    const projection = { segmentIndex: 1, point: [0.5, 1] as [number, number] };
    const { completed, remaining } = splitPolylineAt(polyline, projection);
    expect(completed).toEqual([[0, 0], [0, 1], [0.5, 1]]);
    expect(remaining).toEqual([[0.5, 1], [1, 1]]);
  });

  it('returns full remaining when projection is exactly at start', () => {
    const projection = { segmentIndex: 0, point: [0, 0] as [number, number] };
    const { completed, remaining } = splitPolylineAt(polyline, projection);
    expect(completed).toEqual([[0, 0]]);
    expect(remaining).toEqual(polyline);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/utils/routeProgress.test.ts
```

Expected: FAIL with "Cannot find module '../../src/utils/routeProgress'".

- [ ] **Step 3: Implement the module**

Create `src/utils/routeProgress.ts`:

```ts
export type Coord = [number, number]; // [longitude, latitude]

export type Projection = {
  segmentIndex: number; // index of the segment in the polyline (0-based)
  point: Coord;          // projected point on the polyline
};

const toRadians = (value: number) => (value * Math.PI) / 180;

export const distanceMetersBetween = (from: Coord, to: Coord): number => {
  const earthRadius = 6371000;
  const dLat = toRadians(to[1] - from[1]);
  const dLon = toRadians(to[0] - from[0]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from[1])) *
      Math.cos(toRadians(to[1])) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

// Project `point` onto segment a->b in 2D (lon/lat treated as a plane —
// fine for city-scale distances where great-circle curvature is negligible).
const projectOnSegment = (point: Coord, a: Coord, b: Coord): Coord => {
  const ax = a[0]; const ay = a[1];
  const bx = b[0]; const by = b[1];
  const px = point[0]; const py = point[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSquared = dx * dx + dy * dy;
  if (lenSquared === 0) return [ax, ay];
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSquared;
  t = Math.max(0, Math.min(1, t));
  return [ax + t * dx, ay + t * dy];
};

export const projectPointOnPolyline = (
  point: Coord,
  polyline: Coord[]
): Projection => {
  if (polyline.length < 2) {
    return { segmentIndex: 0, point: polyline[0] || point };
  }

  let bestIndex = 0;
  let bestPoint: Coord = polyline[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const candidate = projectOnSegment(point, polyline[i], polyline[i + 1]);
    const distance = distanceMetersBetween(point, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
      bestIndex = i;
    }
  }

  return { segmentIndex: bestIndex, point: bestPoint };
};

export const splitPolylineAt = (
  polyline: Coord[],
  projection: Projection
): { completed: Coord[]; remaining: Coord[] } => {
  if (polyline.length === 0) {
    return { completed: [], remaining: [] };
  }

  const completed: Coord[] = [
    ...polyline.slice(0, projection.segmentIndex + 1),
    projection.point,
  ];

  const remaining: Coord[] = [
    projection.point,
    ...polyline.slice(projection.segmentIndex + 1),
  ];

  return { completed, remaining };
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/utils/routeProgress.test.ts
```

Expected: PASS (all 8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/utils/routeProgress.ts __tests__/utils/routeProgress.test.ts
git commit -m "feat(utils): add routeProgress math for live navigation split"
```

---

## Task 2: Remove Load Merge in `MyTourStart` (Issue 1)

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx` (lines 525–540 — the saved-tour merge block)

Single, surgical change: when a saved tour exists, use its `savedPlaces` directly without merging in `data.places` from the route template. This fixes the "deleted places reappear" bug.

- [ ] **Step 1: Read the existing merge block**

Open `src/screens/main/MyTourStart.tsx` and locate the block starting:
```
if (savedTour) {
  const savedPlaces = await fetchPlacesByIds(
    savedTour.all_places.map((item) => item.place_id)
  );

  const mergedSavedPlaces = [
    ...savedPlaces,
    ...data.places.filter(
      (place) => !savedPlaces.some((savedPlace) => savedPlace.id === place.id)
    ),
  ];

  nextDetails = {
    ...data,
    places: mergedSavedPlaces,
  };
```

- [ ] **Step 2: Replace `mergedSavedPlaces` with `savedPlaces` directly**

Edit so the block reads:

```ts
if (savedTour) {
  const savedPlaces = await fetchPlacesByIds(
    savedTour.all_places.map((item) => item.place_id)
  );

  nextDetails = {
    ...data,
    // Saved tour is authoritative. Do NOT re-merge with route template
    // places — that would resurrect places the user deliberately removed.
    places: savedPlaces,
  };
```

(Delete the `const mergedSavedPlaces = ...` declaration entirely.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors from this file (pre-existing errors elsewhere are unrelated; if `MyTourStart.tsx` reports new errors, fix them — the only variable removed is `mergedSavedPlaces` which was only referenced in the line below).

- [ ] **Step 4: Manual smoke test plan (document in commit message)**

To verify after this commit:
1. Create a tour from a suggested route with 2+ places.
2. In TourSuggestion, delete one place, add a different place via "Add Locations".
3. Save the tour.
4. Open the saved tour and tap Start.
5. The map must show only the edited list — never the deleted place.

- [ ] **Step 5: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "fix(tour-start): treat saved tour places as authoritative

Stop re-merging route template places into a saved tour on load. The merge
silently resurrected places that the user deleted in TourSuggestion or
during an active tour edit. Tour doc all_places is now the single source
of truth once a tour exists.
"
```

---

## Task 3: Switch Mapbox Directions Profile to Walking (Issue 2 — base)

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx:385`

Tiny URL change. Tour stops are city-scale and users walk — driving profile sometimes detours to highways, walking profile follows pedestrian roads.

- [ ] **Step 1: Edit the Directions URL**

Locate the line at ~385:
```ts
`https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}`,
```

Change `driving` to `walking`:
```ts
`https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}`,
```

- [ ] **Step 2: Update the inline comment**

The comment two lines above currently says `// driving profile follows actual roads, not hiking trails`. Replace with:
```ts
// walking profile follows pedestrian roads/sidewalks — best for a city tour
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "fix(tour-start): use Mapbox walking profile for tour route lines

City tours are pedestrian. Walking profile follows sidewalks and small
roads that driving profile would detour around.
"
```

---

## Task 4: Remove Silent Straight-Line Fallback in `fetchRoadSegment`

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx` (the `fetchRoadSegment` callback, lines ~371–410)

When Mapbox fails, current code returns `[from, to]` — a straight line through buildings. We need explicit failure: log + toast + signal "no route" so the caller skips rendering that leg.

- [ ] **Step 1: Change the callback return type and failure paths**

Replace the existing `fetchRoadSegment` body so that:
- On API failure (catch block): show a toast, return `null`.
- On missing routedCoordinates: return `null`.
- On distances above `ROAD_ROUTE_MAX_METERS`: keep great-circle arc as before.
- On missing `MAPBOX_TOKEN`: return `null` (don't silently draw a straight line).

Full replacement for the callback:

```ts
const fetchRoadSegment = useCallback(
  async (from: [number, number], to: [number, number]): Promise<[number, number][] | null> => {
    const dist = distanceMetersBetween(from, to);
    if (dist > ROAD_ROUTE_MAX_METERS) {
      return greatCircleArc(from, to);
    }

    if (!Config.MAPBOX_TOKEN) {
      return null;
    }

    try {
      const { data } = await axios.get<DirectionsResponse>(
        // walking profile follows pedestrian roads/sidewalks — best for a city tour
        `https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}`,
        {
          params: {
            access_token: Config.MAPBOX_TOKEN,
            geometries: 'geojson',
            overview: 'full',
            steps: false,
          },
        }
      );

      const routedCoordinates = data.routes?.[0]?.geometry?.coordinates;
      if (routedCoordinates && routedCoordinates.length >= 2) {
        return [from, ...(routedCoordinates as [number, number][]), to];
      }
      return null;
    } catch (error) {
      showError('Route Unavailable', 'Could not find a walking route between two stops.');
      return null;
    }
  },
  []
);
```

Note: replace the existing `distanceInMeters` call with `distanceMetersBetween` from the new util (import below) to keep all distance math in one place. Or keep `distanceInMeters` — see Step 2.

- [ ] **Step 2: Add import for the util**

At the top of `MyTourStart.tsx`, add:
```ts
import { distanceMetersBetween } from '../../utils/routeProgress';
```

Then replace every call site of the local `distanceInMeters(...)` with `distanceMetersBetween(...)`. Delete the local `distanceInMeters` declaration (was around lines 132–149).

- [ ] **Step 3: Update `buildRouteSegments` to handle `null` returns**

Locate `buildRouteSegments` (lines ~412–455). Find:
```ts
const isAir = distanceInMeters(from as [number, number], to) > ROAD_ROUTE_MAX_METERS;
const pts = isAir
  ? greatCircleArc(from as [number, number], to)
  : await fetchRoadSegment(from as [number, number], to);
return { pts, isAir };
```

Replace with:
```ts
const isAir = distanceMetersBetween(from as [number, number], to) > ROAD_ROUTE_MAX_METERS;
const pts = isAir
  ? greatCircleArc(from as [number, number], to)
  : await fetchRoadSegment(from as [number, number], to);
return { pts, isAir };
```

(Same code, distance helper swapped.)

Below, where results are accumulated, filter out null `pts`:

```ts
for (const { pts, isAir } of results) {
  if (!pts) {
    // Routing failed for this leg — break the running road chain
    // so we don't connect across a gap with a straight line.
    if (currentRoad.length >= 2) road.push(currentRoad);
    currentRoad = [];
    continue;
  }
  if (isAir) {
    if (currentRoad.length >= 2) road.push(currentRoad);
    currentRoad = [];
    air.push(pts);
  } else {
    currentRoad =
      currentRoad.length === 0 ? [...pts] : [...currentRoad, ...pts.slice(1)];
  }
}
```

- [ ] **Step 4: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors in `MyTourStart.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "fix(tour-start): no straight-line fallback when routing fails

Mapbox walking failures now surface a toast and the leg renders nothing
instead of a misleading straight line through buildings. Centralize
distance math in utils/routeProgress.
"
```

---

## Task 5: Active-Leg State + Polyline Cache

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx`

Goal: track which leg is currently "active" (last visited or origin → nearest pending stop) and cache its walking polyline so we can split it on every GPS update without re-fetching.

- [ ] **Step 1: Add active-leg state and cache**

Near the existing state declarations in `MyTourStart`, add:

```ts
// Walking polyline cache keyed by `${fromStopId}->${toStopId}`.
const [legPolylines, setLegPolylines] = useState<Record<string, [number, number][]>>({});

// Active leg = last visited stop (or tour origin) → next pending stop.
type ActiveLeg = { key: string; from: [number, number]; to: [number, number]; toStopId: string } | null;
const [activeLeg, setActiveLeg] = useState<ActiveLeg>(null);
```

- [ ] **Step 2: Derive active leg from existing state**

Add a `useEffect` that recomputes `activeLeg` whenever `visitedStopsInVisitOrder`, `nearestPendingStop`, `tourOrigin`, or `currentLocation` changes:

```ts
useEffect(() => {
  if (!nearestPendingStop) {
    setActiveLeg(null);
    return;
  }
  const lastVisited = visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1];
  const fromCoord: [number, number] | null =
    lastVisited?.coordinate || tourOrigin || currentLocation;
  if (!fromCoord) {
    setActiveLeg(null);
    return;
  }
  const fromId = lastVisited?.id || 'origin';
  setActiveLeg({
    key: `${fromId}->${nearestPendingStop.id}`,
    from: fromCoord,
    to: nearestPendingStop.coordinate,
    toStopId: nearestPendingStop.id,
  });
}, [visitedStopsInVisitOrder, nearestPendingStop, tourOrigin, currentLocation]);
```

- [ ] **Step 3: Fetch and cache the active-leg polyline**

Add a `useEffect` that, whenever `activeLeg` changes and the polyline isn't cached, fetches it:

```ts
useEffect(() => {
  if (!activeLeg) return;
  if (legPolylines[activeLeg.key]) return;
  let cancelled = false;
  fetchRoadSegment(activeLeg.from, activeLeg.to).then((pts) => {
    if (cancelled || !pts) return;
    setLegPolylines((prev) => ({ ...prev, [activeLeg.key]: pts }));
  });
  return () => {
    cancelled = true;
  };
}, [activeLeg, fetchRoadSegment, legPolylines]);
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): cache active-leg walking polyline

Tracks the current leg (last visited -> next pending) and caches its
Mapbox walking polyline keyed by stop ids. Foundation for live progress
split rendering in the next task.
"
```

---

## Task 6: Continuous GPS via `watchPosition`

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx`

Replace the existing one-shot GPS calls with a `watchPosition` that runs while the tour is active.

- [ ] **Step 1: Add a watchId ref**

Near other refs in `MyTourStart`:
```ts
const watchIdRef = useRef<number | null>(null);
```

- [ ] **Step 2: Start/stop watch based on `tourStarted`**

Add a `useEffect`:

```ts
useEffect(() => {
  if (!tourStarted) {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    return;
  }

  watchIdRef.current = Geolocation.watchPosition(
    (position) => {
      const next: [number, number] = [
        position.coords.longitude,
        position.coords.latitude,
      ];
      setCurrentLocation(next);
    },
    () => {
      // Silently ignore transient GPS errors; keep last known location.
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 5,
      interval: 1000,
      fastestInterval: 500,
    }
  );

  return () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };
}, [tourStarted]);
```

- [ ] **Step 3: Ensure cleanup on unmount**

The effect's cleanup function already covers unmount. Verify no other place leaks a watch by grepping:

```bash
grep -n "watchPosition\|clearWatch" /Users/app/Desktop/pride-this-way-mobile-app/src/screens/main/MyTourStart.tsx
```

Expected: only the new code references these APIs.

- [ ] **Step 4: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): continuous GPS tracking via watchPosition

watchPosition runs only while a tour is active. distanceFilter:5 filters
noise; clearWatch on pause/complete/unmount.
"
```

---

## Task 7: Live Route Progress Split Rendering

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx`

Compute completed vs. remaining portions of the active leg on each GPS update, throttled to 1 Hz. Render them as two LineLayers.

- [ ] **Step 1: Import the math helpers**

Confirm at the top of `MyTourStart.tsx`:
```ts
import {
  distanceMetersBetween,
  projectPointOnPolyline,
  splitPolylineAt,
  type Coord,
} from '../../utils/routeProgress';
```

- [ ] **Step 2: Derive split arrays via `useMemo`**

Add (near other memos, after `nearestPendingStop`):

```ts
const activeLegPolyline = useMemo<Coord[] | null>(() => {
  if (!activeLeg) return null;
  return legPolylines[activeLeg.key] || null;
}, [activeLeg, legPolylines]);

const activeLegSplit = useMemo<{ completed: Coord[]; remaining: Coord[] } | null>(() => {
  if (!activeLegPolyline || !currentLocation) return null;
  const projection = projectPointOnPolyline(currentLocation, activeLegPolyline);
  return splitPolylineAt(activeLegPolyline, projection);
}, [activeLegPolyline, currentLocation]);
```

(Throttling: `setCurrentLocation` is already gated by `distanceFilter:5` and a 1 s `interval`, so a separate 1 Hz throttle isn't needed at this layer. If perf is later observed as a problem, add a `useMemo` debounce.)

- [ ] **Step 3: Build GeoJSON FeatureCollections for the two layers**

Add these memos:

```ts
const activeCompletedShape = useMemo<FeatureCollection<LineString>>(() => ({
  type: 'FeatureCollection',
  features: activeLegSplit && activeLegSplit.completed.length >= 2 ? [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: activeLegSplit.completed },
  }] : [],
}), [activeLegSplit]);

const activeRemainingShape = useMemo<FeatureCollection<LineString>>(() => ({
  type: 'FeatureCollection',
  features: activeLegSplit && activeLegSplit.remaining.length >= 2 ? [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: activeLegSplit.remaining },
  }] : [],
}), [activeLegSplit]);
```

- [ ] **Step 4: Render two new LineLayers inside the existing `<Mapbox.MapView>`**

Just before/after the existing `roadSegments`/`completedRoadSegments` LineLayers, add:

```tsx
<Mapbox.ShapeSource id="activeLegCompleted" shape={activeCompletedShape}>
  <Mapbox.LineLayer id="activeLegCompletedLine" style={completedRouteLineLayerStyle} />
</Mapbox.ShapeSource>
<Mapbox.ShapeSource id="activeLegRemaining" shape={activeRemainingShape}>
  <Mapbox.LineLayer id="activeLegRemainingLine" style={routeLineLayerStyle} />
</Mapbox.ShapeSource>
```

- [ ] **Step 5: Suppress the existing whole-leg render for the active leg**

The existing render loop draws all `roadSegments` (red dotted) for pending legs. Filter out the active leg so we don't draw a red dotted line behind the split:

Find where `roadSegments.map(...)` (or equivalent) is rendered. Add a guard:
```tsx
{roadSegments.map((segment, index) => {
  // Skip the active leg — it's rendered by the split layers above
  if (activeLeg && segmentBelongsToActiveLeg(segment, activeLeg)) return null;
  return /* existing render */;
})}
```

If the existing code does not track per-segment leg ownership, add a parallel state `legBySegmentIndex` populated in `buildRouteSegments`. If that requires more than a tiny tweak, skip this step and instead set the activeLeg's `roadSegments` entry to `[]` when populating segments — adjust `buildRouteSegments` to return `{ road, air, activeLegIndex }`.

**Simpler alternative (recommended):** in the existing `setRoadSegments`/`setAirSegments` calls inside `buildRouteSegments`, when building the array, omit the segment whose endpoints match `activeLeg.from`/`activeLeg.to`. The split layers above replace it.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): live route progress split rendering

Splits the active leg into completed (gray solid) and remaining (red
dotted) portions based on the user's projected position on the walking
polyline. Updates as GPS updates.
"
```

---

## Task 8: Next-Stop Banner Component

**Files:**
- Create: `src/components/MyTourStart/NextStopBanner.tsx`
- Modify: `src/screens/main/MyTourStart.tsx` (render the banner)

Floating banner under the top header: "Next: [stop name] · [distance]".

- [ ] **Step 1: Create the component**

`src/components/MyTourStart/NextStopBanner.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

type Props = {
  stopName: string;
  distanceMeters: number;
};

const NextStopBanner: React.FC<Props> = ({ stopName, distanceMeters }) => (
  <View style={styles.wrapper} pointerEvents="none">
    <View style={styles.pill}>
      <Text numberOfLines={1} style={styles.text}>
        Next: {stopName} · {formatDistance(distanceMeters)}
      </Text>
    </View>
  </View>
);

export default React.memo(NextStopBanner);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '92%',
  },
  text: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
```

- [ ] **Step 2: Render it from `MyTourStart`**

Inside the existing screen JSX, above the map's zoom controls, conditionally render:

```tsx
{tourStarted && nearestPendingStop && currentLocation ? (
  <NextStopBanner
    stopName={nearestPendingStop.title}
    distanceMeters={distanceMetersBetween(currentLocation, nearestPendingStop.coordinate)}
  />
) : null}
```

Add the import at the top:
```ts
import NextStopBanner from '../../components/MyTourStart/NextStopBanner';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MyTourStart/NextStopBanner.tsx src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): add next-stop distance banner during active tour"
```

---

## Task 9: Recenter Button + Follow Mode

**Files:**
- Create: `src/components/MyTourStart/RecenterButton.tsx`
- Modify: `src/screens/main/MyTourStart.tsx`

Floating button bottom-right; tap = recenter on user + enter follow mode; long-press = toggle heading-up.

- [ ] **Step 1: Create the button component**

`src/components/MyTourStart/RecenterButton.tsx`:

```tsx
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { LocationIcon } from '../../constants/icons';
import { COLORS } from '../../constants/colors';

type Props = {
  active: boolean;            // true = blue, free mode; false = gray, follow mode
  onPress: () => void;
  onLongPress?: () => void;
};

const RecenterButton: React.FC<Props> = ({ active, onPress, onLongPress }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={400}
    style={[styles.button, active ? styles.active : styles.inactive]}
  >
    <LocationIcon width={22} height={22} />
  </TouchableOpacity>
);

export default React.memo(RecenterButton);

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    bottom: 130, // above the existing zoom controls (~40 + buttons)
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  active: { backgroundColor: COLORS.BUTTON_COLOR },
  inactive: { backgroundColor: COLORS.WHITE },
});
```

- [ ] **Step 2: Add follow-mode state to `MyTourStart`**

```ts
const [followMode, setFollowMode] = useState<'follow' | 'free'>('follow');
const [headingUp, setHeadingUp] = useState(false);
```

- [ ] **Step 3: Camera follows user in follow mode**

Add a `useEffect`:
```ts
useEffect(() => {
  if (!tourStarted || followMode !== 'follow' || !currentLocation) return;
  cameraRef.current?.setCamera({
    centerCoordinate: currentLocation,
    zoomLevel: 16,
    heading: headingUp ? undefined : 0,
    animationDuration: 800,
    animationMode: 'easeTo',
  });
}, [currentLocation, followMode, headingUp, tourStarted]);
```

- [ ] **Step 4: Break out of follow on user pan**

In the existing `<Mapbox.MapView>` props, add:
```tsx
onRegionDidChange={(feature: any) => {
  if (feature?.properties?.isUserInteraction && followMode === 'follow') {
    setFollowMode('free');
  }
}}
```

(Mapbox's payload shape varies between native and JS SDKs; if `isUserInteraction` isn't present, fall back to `onTouchMove` on a wrapping `View` to flip follow mode. Test on device to confirm.)

- [ ] **Step 5: Render the button**

Import and render inside the existing map container, below the LineLayers, alongside zoom controls:

```tsx
import RecenterButton from '../../components/MyTourStart/RecenterButton';

{tourStarted ? (
  <RecenterButton
    active={followMode === 'free'}
    onPress={() => {
      if (currentLocation) {
        cameraRef.current?.setCamera({
          centerCoordinate: currentLocation,
          zoomLevel: 16,
          animationDuration: 700,
          animationMode: 'easeTo',
        });
      }
      setFollowMode('follow');
    }}
    onLongPress={() => setHeadingUp((prev) => !prev)}
  />
) : null}
```

- [ ] **Step 6: Apply heading from GPS**

Inside the `watchPosition` success callback in Task 6, also capture heading when meaningful:

```ts
const speed = position.coords.speed || 0;
if (headingUp && speed > 1 && typeof position.coords.heading === 'number') {
  cameraRef.current?.setCamera({
    heading: position.coords.heading,
    animationDuration: 400,
  });
}
```

Add `headingUp` to the effect's dependency array (the watch effect needs to read the latest value; use a `headingUpRef` updated on each render to avoid restarting the watch).

```ts
const headingUpRef = useRef(headingUp);
useEffect(() => { headingUpRef.current = headingUp; }, [headingUp]);
```

Then in the watch callback, read `headingUpRef.current` instead of `headingUp`.

- [ ] **Step 7: Commit**

```bash
git add src/components/MyTourStart/RecenterButton.tsx src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): follow-user camera with recenter button

Camera tracks user during active tour; pan/pinch breaks out to free
mode; recenter button restores follow. Long-press toggles heading-up
rotation. Heading only applied when moving (speed > 1 m/s).
"
```

---

## Task 10: Live Next-Stop Framing

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx`

When `nearestPendingStop` changes (user just completed one and the next is active), briefly fit-bounds on both user and next stop, then resume follow.

- [ ] **Step 1: Add an effect that fires on `nearestPendingStop` change**

```ts
const previousPendingStopIdRef = useRef<string | null>(null);

useEffect(() => {
  const nextId = nearestPendingStop?.id || null;
  const prevId = previousPendingStopIdRef.current;
  previousPendingStopIdRef.current = nextId;

  // Only fire on transitions (not on initial mount).
  if (!nextId || !prevId || nextId === prevId) return;
  if (!currentLocation || !nearestPendingStop) return;

  const lngs = [currentLocation[0], nearestPendingStop.coordinate[0]];
  const lats = [currentLocation[1], nearestPendingStop.coordinate[1]];
  cameraRef.current?.fitBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
    { paddingTop: 200, paddingBottom: 300, paddingLeft: 60, paddingRight: 60 },
    1400
  );

  // Resume follow after the bounds animation settles.
  const timer = setTimeout(() => setFollowMode('follow'), 1600);
  return () => clearTimeout(timer);
}, [nearestPendingStop, currentLocation]);
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): fit-bounds animation on next-stop transition"
```

---

## Task 11: Pulsing Red Halo on Next Pending Stop

**Files:**
- Modify: `src/screens/main/MyTourStart.tsx`

Reuse the existing `PulsingPin` pattern (currently blue, used for user). Add a red variant for the next pending stop.

- [ ] **Step 1: Add a red variant near the existing `PulsingPin`**

```tsx
const PulsingDestinationPin = () => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  const haloScale = scale.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });

  return (
    <View style={destinationPulseStyles.wrapper} pointerEvents="none">
      <Animated.View style={[destinationPulseStyles.halo, { opacity, transform: [{ scale: haloScale }] }]} />
      <View style={destinationPulseStyles.iconLayer}>
        <LocationIcon width={28} height={36} />
      </View>
    </View>
  );
};

const destinationPulseStyles = StyleSheet.create({
  wrapper: { width: 46, height: 56, alignItems: 'center', justifyContent: 'flex-end' },
  halo: { position: 'absolute', bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#E11D48' },
  iconLayer: { width: 28, height: 36 },
});
```

- [ ] **Step 2: Render the halo at the next pending stop**

Locate where existing stop markers are rendered. For the marker that matches `nearestPendingStop.id`, wrap or replace it with `<PulsingDestinationPin />`:

```tsx
{nearestPendingStop ? (
  <Mapbox.MarkerView
    id={`pending-${nearestPendingStop.id}`}
    coordinate={nearestPendingStop.coordinate}
    anchor={{ x: 0.5, y: 1 }}
  >
    <PulsingDestinationPin />
  </Mapbox.MarkerView>
) : null}
```

If the existing static marker for that stop would also render (causing two markers at the same coord), filter it out of the static-markers map by `id !== nearestPendingStop?.id`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/main/MyTourStart.tsx
git commit -m "feat(tour-start): pulsing red halo on the next pending stop"
```

---

## Task 12: Drawer Rewards Refresh Hook

**Files:**
- Create: `src/hooks/useDrawerRewardsRefresh.ts`
- Test: `__tests__/hooks/useDrawerRewardsRefresh.test.ts`

Encapsulate the fetch-on-drawer-open logic so `CustomDrawer` stays slim.

- [ ] **Step 1: Write the failing test**

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDrawerRewardsRefresh } from '../../src/hooks/useDrawerRewardsRefresh';

jest.mock('@react-navigation/drawer', () => ({
  useDrawerStatus: jest.fn(),
}));
jest.mock('../../src/services/myTourService', () => ({
  fetchRewardsSummary: jest.fn(),
}));

const { useDrawerStatus } = jest.requireMock('@react-navigation/drawer');
const { fetchRewardsSummary } = jest.requireMock('../../src/services/myTourService');

describe('useDrawerRewardsRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 / 0 before any fetch resolves', () => {
    useDrawerStatus.mockReturnValue('closed');
    fetchRewardsSummary.mockResolvedValue({ totalPoints: 0, tours: [] });
    const { result } = renderHook(() => useDrawerRewardsRefresh('user-1'));
    expect(result.current.rewardPoints).toBe(0);
    expect(result.current.visitedPlacesCount).toBe(0);
  });

  it('fetches when drawer opens', async () => {
    useDrawerStatus.mockReturnValue('open');
    fetchRewardsSummary.mockResolvedValue({
      totalPoints: 42,
      tours: [{ places: [{ visited: true }, { visited: false }] }],
    });
    const { result } = renderHook(() => useDrawerRewardsRefresh('user-1'));
    await waitFor(() => expect(result.current.rewardPoints).toBe(42));
    expect(result.current.visitedPlacesCount).toBe(1);
  });

  it('preserves previous values on error', async () => {
    useDrawerStatus.mockReturnValue('open');
    fetchRewardsSummary.mockResolvedValueOnce({
      totalPoints: 10,
      tours: [{ places: [{ visited: true }] }],
    });
    const { result, rerender } = renderHook(({ uid }) => useDrawerRewardsRefresh(uid), {
      initialProps: { uid: 'user-1' },
    });
    await waitFor(() => expect(result.current.rewardPoints).toBe(10));

    fetchRewardsSummary.mockRejectedValueOnce(new Error('network'));
    rerender({ uid: 'user-1' });
    // Simulate a fresh drawer-open cycle by toggling status
    act(() => { useDrawerStatus.mockReturnValue('closed'); });
    rerender({ uid: 'user-1' });
    act(() => { useDrawerStatus.mockReturnValue('open'); });
    rerender({ uid: 'user-1' });
    await waitFor(() => expect(fetchRewardsSummary).toHaveBeenCalledTimes(2));
    expect(result.current.rewardPoints).toBe(10);
    expect(result.current.visitedPlacesCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/hooks/useDrawerRewardsRefresh.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useDrawerRewardsRefresh.ts`:

```ts
import { useEffect, useState } from 'react';
import { useDrawerStatus } from '@react-navigation/drawer';

import { fetchRewardsSummary } from '../services/myTourService';

export type DrawerRewards = {
  rewardPoints: number;
  visitedPlacesCount: number;
};

export const useDrawerRewardsRefresh = (
  userId?: string | null
): DrawerRewards => {
  const drawerStatus = useDrawerStatus();
  const [rewardPoints, setRewardPoints] = useState(0);
  const [visitedPlacesCount, setVisitedPlacesCount] = useState(0);

  useEffect(() => {
    if (drawerStatus !== 'open' || !userId) return;
    let isMounted = true;

    fetchRewardsSummary(userId)
      .then((summary) => {
        if (!isMounted) return;
        const visited = summary.tours.reduce(
          (sum, tour) =>
            sum + tour.places.filter((place) => place.visited).length,
          0
        );
        setRewardPoints(summary.totalPoints);
        setVisitedPlacesCount(visited);
      })
      .catch(() => {
        // Preserve previous values on failure — do not zero out.
      });

    return () => {
      isMounted = false;
    };
  }, [drawerStatus, userId]);

  return { rewardPoints, visitedPlacesCount };
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/hooks/useDrawerRewardsRefresh.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDrawerRewardsRefresh.ts __tests__/hooks/useDrawerRewardsRefresh.test.ts
git commit -m "feat(hooks): useDrawerRewardsRefresh refetches on drawer open"
```

---

## Task 13: Use the Hook in `CustomDrawer`

**Files:**
- Modify: `src/components/Drawer/CustomDrawer.tsx`

Swap the one-shot `useEffect` for the new hook.

- [ ] **Step 1: Remove the existing fetch effect**

Delete the entire block:
```ts
const [visitedPlacesCount, setVisitedPlacesCount] = useState(0);
const [rewardPoints, setRewardPoints] = useState(0);
...
useEffect(() => {
  let isMounted = true;
  fetchRewardsSummary(user?.id) ... ;
  return () => { isMounted = false; };
}, [user?.id]);
```

- [ ] **Step 2: Replace with the hook**

Near other hooks at the top of the component body:
```ts
const { rewardPoints, visitedPlacesCount } = useDrawerRewardsRefresh(user?.id);
```

Add the import:
```ts
import { useDrawerRewardsRefresh } from '../../hooks/useDrawerRewardsRefresh';
```

Remove the now-unused import of `fetchRewardsSummary` from `myTourService` if no other code in this file uses it.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors in `CustomDrawer.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Drawer/CustomDrawer.tsx
git commit -m "fix(drawer): refresh rewards stats every time the drawer opens

Replaces the one-shot useEffect with useDrawerRewardsRefresh hook so
points and visited counts update without requiring logout/login.
"
```

---

## Task 14: Smoke-Test on Device

Not a code task — manual verification before declaring the work done.

- [ ] **Step 1: Run the app**

```bash
cd /Users/app/Desktop/pride-this-way-mobile-app
npm start
```

In a second terminal:
```bash
npx react-native run-android  # or run-ios
```

- [ ] **Step 2: Verify Issue 1 (deleted places)**

1. Pick the Lahore suggested route in TourSuggestion.
2. Delete Punjab University; add Urdu Bazar.
3. Save Tour.
4. Open the saved tour → Start.
5. Map should show Mall Road + Urdu Bazar. Punjab University should NOT appear anywhere on the map or stop list.

- [ ] **Step 3: Verify Issue 2 + 3 (walking + live split)**

1. Start a tour with 2+ stops in the same city.
2. Visually confirm the polyline follows actual streets (no straight lines through buildings).
3. Walk (or use a GPS simulator) along the route. The portion behind you should turn gray; the portion ahead should remain red dotted.

- [ ] **Step 4: Verify Issue 4 (drawer stats)**

1. Start a tour and confirm one visit (camera proof flow).
2. Note current Rewards Points / Places Visited in the drawer.
3. Open the drawer again — values should now reflect the new visit without logging out.

- [ ] **Step 5: Verify Issue 5 (map UX)**

1. While walking, the map should follow your position.
2. Pan the map manually — recenter button turns blue.
3. Tap recenter — map snaps back, button returns to gray.
4. Long-press recenter — map switches to heading-up rotation.
5. After completing a stop, briefly observe the fit-bounds animation framing both user and next stop.

- [ ] **Step 6: Record verification in the commit log**

```bash
git commit --allow-empty -m "chore: manual smoke test passed on device

- Issue 1: deleted places do not reappear
- Issue 2: walking routes follow streets
- Issue 3: live red/gray progress split works
- Issue 4: drawer stats refresh on open
- Issue 5: follow mode, recenter, heading-up all functional
"
```

---

## Self-Review

(performed during plan writing)

**1. Spec coverage:**
- Issue 1 (deleted places) → Task 2 ✓
- Issue 2 (walking + no straight-line fallback) → Tasks 3 + 4 ✓
- Issue 3 (live progress split) → Tasks 1, 5, 7, 11 ✓
- Issue 4 (drawer refresh) → Tasks 12 + 13 ✓
- Issue 5 (follow user, recenter, heading-up, banner, next-stop framing) → Tasks 6, 8, 9, 10 ✓
- Acceptance criteria from spec cross-checked → all covered by Task 14 smoke checks.

**2. Placeholder scan:** No TBD/TODO/"similar to" markers. Every code block is concrete.

**3. Type consistency:**
- `Coord = [number, number]` defined in `routeProgress.ts`, used consistently in Tasks 5, 7.
- `Projection` type matches between math util and consumer.
- `DrawerRewards` type used in both hook and tests.
- `ActiveLeg` type defined inline in Task 5, only used in Task 5/7 — kept local.

**4. Known follow-up (not blocking):**
- The Mapbox SDK's `onRegionDidChange` event payload differs between iOS/Android. Task 9 Step 4 includes a fallback note. If the property is not present at runtime, switch to a wrapping `View` with `onTouchMove` to detect interaction.
