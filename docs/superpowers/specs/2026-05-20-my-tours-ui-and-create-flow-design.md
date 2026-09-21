# My Tours UI & Create-Tour Flow Redesign

**Date:** 2026-05-20
**Status:** Draft
**Scope:** `src/screens/main/MyTour.tsx`, new `CreateTour` screen, navigator and types updates.

## Problem

The My Tours screen has three issues affecting usability:

1. **UI polish.** The bottom "Create New Tour" button uses `position: 'absolute'` with manual offsets, which floats inconsistently over the tour list. The filter row has an "All" chip that duplicates the unfiltered view and adds noise.
2. **Create flow entry.** Tapping the bottom button opens the Location modal directly with no intro/context, unlike the empty state which presents a friendly "No Tours Yet → Create A Tour" screen with the map illustration.
3. **State management.** The screen maintains two parallel collections (`routeCards` and `savedTourCards`) that are merged and deduplicated on every render. New tours land in different buckets depending on `scheduledDate`, then a focus-effect refetch races with local state. This causes the list to flicker or temporarily double-render after creating a tour.

## Goals

- Route the bottom "Create New Tour" button through a dedicated intro screen that mirrors the empty-state experience.
- Remove the "All" filter chip; the screen always shows a filtered subset by status (default: Current).
- Consolidate to a single saved-tours collection. Persist every created tour immediately and reload from server on focus.
- Replace the absolute-positioned bottom button with a flex footer pinned by safe-area + tab-bar insets.

## Non-Goals

- No changes to the Location / Preference / Name modal contents themselves.
- No changes to tour-status semantics (`active`, `paused`, `scheduled`, `completed`) or to `MyTourStart`.
- No redesign of the tour card itself — only the surrounding layout.

## Design

### New screen: `CreateTour`

Path: `src/screens/main/CreateTour.tsx`

Renders the same visual as the existing `renderEmptyState()` in `MyTour.tsx`:

- `TopHeader title="Create New Tour"` (with back affordance — stack push provides it).
- `MapIconMain` illustration.
- "No Tours Yet" heading + descriptive paragraph.
- "Create A Tour" CTA button.

Hosts the Location → Preference → Name modal sequence directly. On final confirm (`handleFinalConfirm`), the tour is persisted via `saveUserTour` and the screen calls `navigation.goBack()` to return to `MyTour`. `MyTour`'s `useFocusEffect` reloads `savedTourCards` and the new tour appears in the list.

### Shared intro component

Path: `src/components/MyTour/TourIntro.tsx`

Extracts the icon-title-description-CTA block so both the empty state in `MyTour` and the new `CreateTour` screen render identically. Props:

```ts
type TourIntroProps = {
  onCreate: () => void;
  bottomInset?: number;
};
```

### Type and navigator updates

`src/types/types.ts`:

```ts
export type MyTourStackParamList = {
  CreateTour: undefined;
  AddLocations: { ... };
  MyTour: { ... } | undefined;
  MyTourStart: { ... } | undefined;
  RecommendationDetials: undefined;
};
```

`src/navigator/MyTourNavigator.tsx`: register `<Stack.Screen name="CreateTour" component={CreateTour} />`.

### MyTour.tsx changes

**Filter chip removal:**
- `TourFilter` becomes `'Current' | 'Paused' | 'Scheduled' | 'Favourite' | 'Completed'`.
- `activeFilter` initial state: `'Current'`.
- Remove `case 'All'` branch in `visibleCards`; the `default` falls through to the `Current` case.
- Remove `All` from the filter row map and from `messageMap` in `renderFilteredEmptyState`.

**State consolidation:**
- Delete the `routeCards` state and all its setters/effects/merges.
- `allCards` becomes a direct sort of `savedTourCards`.
- `handleFinalConfirm` and related create-flow code move to `CreateTour.tsx`.
- The `addedRouteId`/`addedPlaceId` effect (which currently mutates both lists) now updates only `savedTourCards` and additionally calls `loadSavedTours()` to refresh from server.
- `handleStartTour` no longer needs to demote sibling active tours in `routeCards`; the server-side `saveUserTour` already does this through `scheduleOtherActiveTours` semantics, and a single source means we don't have to mirror it locally.

**Bottom button layout:**

```tsx
<View style={styles.mainContent}>
  <ScrollView style={{ flex: 1 }} ...>
    ...
  </ScrollView>
  <View style={[styles.footer, { paddingBottom: bottomHeight + insets.bottom + 10 }]}>
    <CustomButton title="Create New Tour" onPress={() => navigation.navigate('CreateTour')} />
  </View>
</View>
```

The `footer` style drops `position: 'absolute'`. The `ScrollView`'s `contentContainerStyle` no longer needs the `bottomHeight - 55` padding hack.

**Modal removal from MyTour:**
- Delete `LocationModal`, `PreferenceModal`, `NameTourModal` mounts and the modals state object.
- Delete the create-flow helpers (`handleOpenNameModal`, `handleNameConfirm`, `handleFinalConfirm`, `clearFlow`, `pendingRecommendations`, `tags`, `selectedPrefs`, `tourName`, `locationSearch`, `selectedLocation`, `locationSuggestions`, `loadingSuggestions`, `loadTags`, related effects).
- Keep `tags` loading only if needed for filtering (it isn't currently — drop it).

### Data flow

```
MyTour (list view)
  └─ tap "Create New Tour" bottom button
       │
       ▼
  CreateTour (intro screen)
  ├─ tap "Create A Tour"
  │    └─ LocationModal → PreferenceModal → NameTourModal
  │         └─ saveUserTour() → navigation.goBack()
  └─ tap back → navigation.goBack()
       │
       ▼
  MyTour (focus effect → loadSavedTours())
```

### Empty state

Continues to render inline within `MyTour` (no list yet → no need to navigate elsewhere). Uses the new `TourIntro` component. CTA: `navigation.navigate('CreateTour')` for consistency, **or** open modals inline. We pick `navigation.navigate('CreateTour')` so there is exactly one entry path into the create flow.

### Error handling

- `CreateTour` shows toast errors on `saveUserTour` failure (existing `showError` pattern).
- If the user backs out mid-flow, the screen's local modal state resets on unmount; no persistence.
- `MyTour` swallowing `loadSavedTours` errors is preserved.

## Testing

Manual flow checks (RN simulator):

1. **Empty state path:** Fresh user, no tours → "No Tours Yet" inline → tap "Create A Tour" → CreateTour pushes → complete flow → returns to MyTour with the new tour in the list.
2. **List-state path:** User with tours → tap "Create New Tour" footer → CreateTour pushes → complete flow → returns to MyTour with new tour appearing.
3. **Cancel mid-flow:** Open CreateTour → open Location modal → tap back / dismiss → return to MyTour with no spurious tour.
4. **Filter chips:** Confirm "All" no longer renders. Default landing on a list shows Current tours.
5. **Bottom button:** Scroll list to bottom; the last tour card is fully visible above the "Create New Tour" footer (no overlap, no gap larger than ~16px).
6. **State sanity:** Create a scheduled tour, navigate away and back, confirm it appears once (not duplicated).

## Risks

- **Modal flow duplication temptation:** Moving modals out of MyTour into CreateTour must be a *move*, not a copy. Verify MyTour has zero references to the create flow after the change.
- **Param backwards compatibility:** Other screens (e.g., `AddLocations`) navigate back to `MyTour` with `addedPlaceId` — that path is unaffected because it edits an existing tour, not create.
- **Saved-tour persistence on every create:** Today, `active` (no scheduled date) tours skip `saveUserTour` and only live in `routeCards`. After this change they will always be saved. Confirm `saveUserTour` accepts `status: 'active'` without `scheduledDate` (the existing `handleStartTour` already uses this pattern).
