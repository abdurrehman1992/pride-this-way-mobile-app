import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { searchPlaceSuggestions } from './mapboxSearch';

type Coordinates = {
  latitude?: number;
  longitude?: number;
};

export type FirebaseTag = {
  id: string;
  name: string;
  description?: string;
};

export type FirebasePlace = {
  id: string;
  name: string;
  address?: string;
  city_name?: string;
  country?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  mapbox_id?: string;
  points?: number;
  rating?: number;
  ratingCount?: number;
  source?: string;
  tag_ids?: string[];
  coordinates?: Coordinates;
};

export type FirebaseEvent = {
  id: string;
  title: string;
  description?: string;
  address?: string;
  city_name?: string;
  country?: string;
  category?: string;
  event_type?: string;
  coverImage?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  rating?: number;
  tag_ids?: string[];
  coordinates?: Coordinates;
};

export type RoutePlaceRef = {
  place_id: string;
  status?: string;
  tag_ids?: string[];
};

export type FirebaseRoute = {
  id: string;
  name: string;
  city_name?: string;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
  isScheduled?: boolean;
  totalStops?: number;
  tag_ids?: string[];
  event_ids?: string[];
  selected_places?: RoutePlaceRef[];
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
};

export type RecommendedRoute = {
  route: FirebaseRoute;
  places: FirebasePlace[];
  events: FirebaseEvent[];
  favoritePlace: FirebasePlace | null;
  favoritePlaces: FirebasePlace[];
  matchedTagCount: number;
};

export type LocationSuggestion = {
  id: string;
  label: string;
  city?: string;
  country?: string;
  coordinates?: [number, number];
};

export type SavedTourEventEntry = {
  order: number;
  event_id: string;
  place_id?: string;
  visited: boolean;
  visitedAt: string | null;
  pointsEarned: number;
  proofImageUri?: string | null;
  addedByUser?: boolean;
  event_progress?: {
    attended?: boolean;
    dismissed?: boolean;
    visitedAt?: string | null;
    proofImageUri?: string | null;
  };
};

export type SavedTourPlace = {
  order: number;
  place_id: string;
  event_id?: string;
  visited: boolean;
  visitedAt: string | null;
  pointsEarned: number;
  proofImageUri?: string | null;
  addedByUser?: boolean;
};

export type SavedTourItem = SavedTourPlace | SavedTourEventEntry;

/** Live navigable stop sequence (places + today's events) for admin route view. */
export type NavigableRouteEntry = {
  order: number;
  stop_id: string;
  kind: 'place' | 'event';
};

export type SavedTour = {
  id: string;
  title: string;
  user_id: string;
  route_id: string;
  city_name?: string;
  country?: string;
  status: 'active' | 'completed' | 'paused' | 'scheduled' | 'saved';
  scheduledDate?: string | null;
  isEdited: boolean;
  currentStopIndex: number;
  totalPoints: number;
  startedAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
  all_places: SavedTourItem[];
  event_ids: string[];
  navigable_route?: NavigableRouteEntry[];
  // persisted per-event progress (attended/dismissed timestamps)
  event_progress?: Record<
    string,
    {
      attended?: boolean;
      dismissed?: boolean;
      visitedAt?: string | null;
      proofImageUri?: string | null;
    }
  >;
};

export type RewardsSummary = {
  totalPoints: number;
  tours: Array<{
    id: string;
    title: string;
    date: string;
    points: number;
    totalLocations: number;
    places: Array<{
      id: string;
      name: string;
      points: number;
      visited: boolean;
    }>;
  }>;
};

const TAGS_COLLECTION = 'tags';
const PLACES_COLLECTION = 'places';
const ROUTES_COLLECTION = 'routes';
const EVENTS_COLLECTION = 'events';
const TOURS_COLLECTION = 'tours';
const USERS_COLLECTION = 'users';
const FAVORITES_SUBCOLLECTION = 'favorites';
// const FAVORITES_SUBCOLLECTION = 'favoritePlaces';


const rescheduleOtherActiveTours = async ({
  userId,
  excludeTourId,
  scheduledDate,
}: {
  userId: string;
  excludeTourId?: string | null;
  scheduledDate?: string;
}) => {
  const nextScheduledDate = scheduledDate || new Date().toISOString();
  const activeSnapshot = await firestore()
    .collection(TOURS_COLLECTION)
    .where('user_id', '==', userId)
    .where('status', '==', 'active')
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  const docsToUpdate = activeSnapshot.docs.filter(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      doc.id !== excludeTourId
  );
  if (docsToUpdate.length === 0) {
    return;
  }

  await Promise.all(
    docsToUpdate.map(async (doc) => {
      await firestore().collection(TOURS_COLLECTION).doc(doc.id).set({
        status: 'scheduled',
        scheduledDate: nextScheduledDate,
        completedAt: null,
        updatedAt: nextScheduledDate,
      }, { merge: true });
    })
  );
};

const toArray = <T,>(value: unknown): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as T[];
};

const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .replace(/[,\-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTagId = (value?: string | null) => (value || '').trim();

const parsePlace = (
  id: string,
  data: Record<string, any> | undefined
): FirebasePlace => ({
  id,
  name: data?.name || '',
  address: data?.address || '',
  city_name: data?.city_name || '',
  country: data?.country || '',
  description: data?.description || '',
  imageUrl: data?.imageUrl || '',
  isActive: data?.isActive ?? true,
  mapbox_id: data?.mapbox_id || '',
  points: Number(data?.points || 0),
  rating: Number(data?.rating || 0),
  ratingCount: Number(data?.ratingCount || 0),
  source: data?.source || '',
  tag_ids: toArray<string>(data?.tag_ids),
  coordinates: data?.coordinates || {},
});

const parseEvent = (
  id: string,
  data: Record<string, any> | undefined
): FirebaseEvent => ({
  id,
  title: data?.title || '',
  description: data?.description || '',
  address: data?.address || '',
  city_name: data?.city_name || '',
  country: data?.country || '',
  category: data?.category || 'Event',
  event_type: data?.event_type || '',
  coverImage: data?.coverImage || '',
  startDate: data?.startDate || '',
  endDate: data?.endDate || '',
  startTime: data?.startTime || '',
  endTime: data?.endTime || '',
  isActive: data?.isActive ?? true,
  rating: Number(data?.rating || 0),
  tag_ids: toArray<string>(data?.tag_ids),
  coordinates: data?.coordinates || {},
});

const parseRoute = (
  id: string,
  data: Record<string, any> | undefined
): FirebaseRoute => ({
  id,
  name: data?.name || '',
  city_name: data?.city_name || '',
  country: data?.country || '',
  createdAt: data?.createdAt || '',
  updatedAt: data?.updatedAt || '',
  isScheduled: Boolean(data?.isScheduled),
  totalStops: Number(data?.totalStops || 0),
  tag_ids: toArray<string>(data?.tag_ids),
  event_ids: toArray<string>(data?.event_ids),
  selected_places: toArray<RoutePlaceRef>(data?.selected_places),
  dateRange: data?.dateRange || {},
});

const parseSavedTour = (
  id: string,
  data: Record<string, any> | undefined
): SavedTour => ({
  id,
  title: data?.title || '',
  user_id: data?.user_id || '',
  route_id: data?.route_id || '',
  city_name: data?.city_name || '',
  country: data?.country || '',
  status: (data?.status as SavedTour['status']) || 'active',
  scheduledDate: data?.scheduledDate || null,
  isEdited: Boolean(data?.isEdited),
  currentStopIndex: Number(data?.currentStopIndex || 0),
  totalPoints: Number(data?.totalPoints || 0),
  startedAt: data?.startedAt || '',
  completedAt: data?.completedAt || null,
  createdAt: data?.createdAt || '',
  updatedAt: data?.updatedAt || '',
  event_ids: toArray<string>(data?.event_ids),
  all_places: toArray<Record<string, any>>(data?.all_places).map((item, index) => {
    if (item.event_id) {
      return {
        order: Number(item.order || index + 1),
        event_id: String(item.event_id),
        visited: Boolean(item.visited || item.attended),
        visitedAt: item.visitedAt || null,
        pointsEarned: Number(item.pointsEarned || 0),
        proofImageUri: item.proofImageUri || null,
        addedByUser: Boolean(item.addedByUser),
        event_progress: item.event_progress
          ? {
              attended: item.event_progress.attended,
              dismissed: item.event_progress.dismissed,
              visitedAt: item.event_progress.visitedAt,
              proofImageUri: item.event_progress.proofImageUri,
            }
          : undefined,
      };
    }

    return {
      order: Number(item.order || index + 1),
      place_id: item.place_id || '',
      visited: Boolean(item.visited),
      visitedAt: item.visitedAt || null,
      pointsEarned: Number(item.pointsEarned || 0),
      proofImageUri: item.proofImageUri || null,
      addedByUser: Boolean(item.addedByUser),
    };
  }),
  navigable_route: toArray<Record<string, unknown>>(data?.navigable_route).map(
    (item, index) => ({
      order: Number(item.order || index + 1),
      stop_id: String(item.stop_id || ''),
      kind: item.kind === 'event' ? 'event' : 'place',
    })
  ),
  event_progress: (data?.event_progress || {}) as Record<string, {
    attended?: boolean;
    dismissed?: boolean;
    visitedAt?: string | null;
    proofImageUri?: string | null;
  }>,
});

const buildLocationLabel = (city?: string, country?: string) => {
  return [city, country].filter(Boolean).join(', ');
};

const locationMatches = (
  locationLabel: string,
  city?: string,
  country?: string
) => {
  const normalizedLocation = normalizeText(locationLabel);
  if (!normalizedLocation) {
    return true;
  }

  const normalizedCity = normalizeText(city);
  const normalizedCountry = normalizeText(country);
  const locationParts = new Set(
    normalizedLocation.split(' ').filter(Boolean)
  );

  if (normalizedCity && locationParts.has(normalizedCity)) {
    return true;
  }

  if (normalizedCountry && locationParts.has(normalizedCountry)) {
    return true;
  }

  if (normalizedCity && normalizedLocation.includes(normalizedCity)) {
    return true;
  }

  if (normalizedCountry && normalizedLocation.includes(normalizedCountry)) {
    return true;
  }

  return false;
};

const routeMatchesLocation = (
  locationLabel: string,
  route: FirebaseRoute,
  places: FirebasePlace[],
  events: FirebaseEvent[]
) => {
  const normalizedLocation = normalizeText(locationLabel);
  if (!normalizedLocation) {
    return true;
  }

  if (locationMatches(locationLabel, route.city_name, route.country)) {
    return true;
  }

  const routeCity = normalizeText(route.city_name);
  const addressParts = locationLabel
    .split(',')
    .map((part) => normalizeText(part))
    .filter(Boolean);
  const knownCityParts = new Set<string>(
    [
      route.city_name,
      ...places.map((place) => place.city_name),
      ...events.map((event) => event.city_name),
    ]
      .map((value) => normalizeText(value))
      .filter(Boolean)
  );

  if (routeCity && addressParts.includes(routeCity)) {
    return true;
  }

  if (
    addressParts.some((part) => knownCityParts.has(part))
  ) {
    return true;
  }

  const cityOnly = normalizeText(locationLabel.split(',')[0]);
  if (cityOnly) {
    if (routeCity === cityOnly) {
      return true;
    }

    if (
      places.some((place) =>
        addressParts.includes(normalizeText(place.city_name)) ||
        normalizeText(place.city_name) === cityOnly
      ) ||
      events.some((event) =>
        addressParts.includes(normalizeText(event.city_name)) ||
        normalizeText(event.city_name) === cityOnly
      )
    ) {
      return true;
    }
  }

  const routeHay = normalizeText(
    [
      route.city_name,
      route.country,
      ...places.map((place) => place.city_name),
      ...places.map((place) => place.country),
      ...events.map((event) => event.city_name),
      ...events.map((event) => event.country),
    ]
      .filter(Boolean)
      .join(' ')
  );

  return routeHay.includes(normalizedLocation);
};

const extractRouteTagIds = (
  route: FirebaseRoute,
  places: FirebasePlace[],
  events: FirebaseEvent[]
) => {
  const collected = new Set<string>();

  (route.tag_ids || []).forEach((tagId) => {
    const normalized = normalizeTagId(tagId);
    if (normalized) {
      collected.add(normalized);
    }
  });

  (route.selected_places || []).forEach((placeRef) => {
    (placeRef.tag_ids || []).forEach((tagId) => {
      const normalized = normalizeTagId(tagId);
      if (normalized) {
        collected.add(normalized);
      }
    });
  });

  places.forEach((place) => {
    (place.tag_ids || []).forEach((tagId) => {
      const normalized = normalizeTagId(tagId);
      if (normalized) {
        collected.add(normalized);
      }
    });
  });

  events.forEach((event) => {
    (event.tag_ids || []).forEach((tagId) => {
      const normalized = normalizeTagId(tagId);
      if (normalized) {
        collected.add(normalized);
      }
    });
  });

  return Array.from(collected);
};

const fetchAllPlacesMap = async (): Promise<Map<string, FirebasePlace>> => {
  const snapshot = await firestore()
    .collection(PLACES_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  const placesMap = new Map<string, FirebasePlace>();
  snapshot.docs.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    placesMap.set(doc.id, parsePlace(doc.id, doc.data()));
  });
  return placesMap;
};

const fetchAllEventsMap = async (): Promise<Map<string, FirebaseEvent>> => {
  const snapshot = await firestore()
    .collection(EVENTS_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  const eventsMap = new Map<string, FirebaseEvent>();
  snapshot.docs.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    eventsMap.set(doc.id, parseEvent(doc.id, doc.data()));
  });
  return eventsMap;
};

export const fetchTourTags = async (): Promise<FirebaseTag[]> => {
  const snapshot = await firestore()
    .collection(TAGS_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  return snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data?.name || '',
        description: data?.description || '',
      };
    })
    .filter((tag: FirebaseTag) => tag.name)
    .sort((a: FirebaseTag, b: FirebaseTag) => a.name.localeCompare(b.name));
};

export const fetchMapEvents = async (): Promise<FirebaseEvent[]> => {
  const snapshot = await firestore()
    .collection(EVENTS_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  return snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseEvent(doc.id, doc.data())
    )
    .filter((event: FirebaseEvent) => event.isActive !== false)
    .filter(
      (event: FirebaseEvent) =>
        typeof event.coordinates?.latitude === 'number' &&
        typeof event.coordinates?.longitude === 'number'
    );
};

export const searchLocationSuggestions = async (
  query: string
): Promise<LocationSuggestion[]> => {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const suggestions = await searchPlaceSuggestions(trimmed, {
    limit: 10,
  });

  const seen = new Set<string>();

  return suggestions
    .map((item) => {
      const city = item.title;
      const country =
        item.country || item.subtitle.split(',').pop()?.trim() || '';
      const label = buildLocationLabel(city, country);

      return {
        id: item.id,
        label,
        city,
        country,
        coordinates: item.coordinates,
      };
    })
    .filter((item) => {
      if (!item.label || seen.has(item.label.toLowerCase())) {
        return false;
      }

      seen.add(item.label.toLowerCase());
      return true;
    });
};

export const fetchPlacesForLocation = async (
  locationLabel: string,
  searchText?: string,
  options?: {
    cityOnly?: boolean;
  }
): Promise<FirebasePlace[]> => {
  const snapshot = await firestore()
    .collection(PLACES_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  const normalizedSearch = normalizeText(searchText);
  const normalizedLocation = normalizeText(locationLabel);

  return snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parsePlace(doc.id, doc.data())
    )
    .filter((place: FirebasePlace) => place.isActive !== false)
    .filter((place: FirebasePlace) => {
      if (!options?.cityOnly) {
        return true;
      }

      return locationMatches(locationLabel, place.city_name, place.country);
    })
    .filter((place: FirebasePlace) => {
      if (!normalizedSearch) {
        return true;
      }

      const searchHay =
        `${place.name} ${place.address} ${place.description}`.toLowerCase();
      return searchHay.includes(normalizedSearch);
    })
    .sort((a: FirebasePlace, b: FirebasePlace) => {
      const aMatchesLocation = locationMatches(
        normalizedLocation,
        a.city_name,
        a.country
      );
      const bMatchesLocation = locationMatches(
        normalizedLocation,
        b.city_name,
        b.country
      );

      if (aMatchesLocation !== bMatchesLocation) {
        return aMatchesLocation ? -1 : 1;
      }

      return (b.rating || 0) - (a.rating || 0);
    });
};

export const fetchUpcomingEventSuggestions = async ({
  locationLabel,
  tagIds = [],
  limit = 20,
}: {
  locationLabel: string;
  tagIds?: string[];
  limit?: number;
}): Promise<FirebaseEvent[]> => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + 3);

  const normalizedLocation = normalizeText(locationLabel);
  const requestedTagIds = new Set(
    (tagIds || []).map((tagId) => normalizeTagId(tagId)).filter(Boolean)
  );

  const snapshot = await firestore()
    .collection(EVENTS_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  return snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseEvent(doc.id, doc.data())
    )
    .filter((event: FirebaseEvent) => event.isActive !== false)
    .filter((event: FirebaseEvent) => {
      if (!event.startDate) {
        return false;
      }

      const eventDate = event.startTime
        ? new Date(`${event.startDate}T${event.startTime}`)
        : new Date(`${event.startDate}T00:00`);

      return (
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= now &&
        eventDate <= cutoff
      );
    })
    .filter((event: FirebaseEvent) => {
      if (!normalizedLocation) {
        return true;
      }

      return locationMatches(locationLabel, event.city_name, event.country);
    })
    .map((event: FirebaseEvent) => ({
      event,
      matchingTags: (event.tag_ids || []).reduce(
        (count: number, tagId: string) => {
          return requestedTagIds.has(normalizeTagId(tagId)) ? count + 1 : count;
        },
        0
      ),
    }))
    .sort((a, b) => {
      if (b.matchingTags !== a.matchingTags) {
        return b.matchingTags - a.matchingTags;
      }

      const aDate = a.event.startTime
        ? new Date(`${a.event.startDate}T${a.event.startTime}`)
        : new Date(`${a.event.startDate}T00:00`);
      const bDate = b.event.startTime
        ? new Date(`${b.event.startDate}T${b.event.startTime}`)
        : new Date(`${b.event.startDate}T00:00`);

      return aDate.getTime() - bDate.getTime();
    })
    .slice(0, limit)
    .map((item) => item.event);
};

export const fetchUserFavoritePlaceIds = async (userId?: string) => {
  if (!userId) {
    return [];
  }

  const snapshot = await firestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(FAVORITES_SUBCOLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  return snapshot.docs
    .filter(
      (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
        doc.data().category !== 'Route'
    )
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => doc.id);
};

export const fetchRecommendedRoutes = async ({
  locationLabel,
  selectedTagIds,
  userId,
}: {
  locationLabel: string;
  selectedTagIds: string[];
  userId?: string;
}): Promise<RecommendedRoute[]> => {
  const [routesSnapshot, placesMap, eventsMap, favoritePlaceIds] =
    await Promise.all([
      firestore()
        .collection(ROUTES_COLLECTION)
        .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
      fetchAllPlacesMap(),
      fetchAllEventsMap(),
      fetchUserFavoritePlaceIds(userId),
    ]);

  const allPlaces = Array.from(placesMap.values()).filter(
    (place: FirebasePlace) => place.isActive !== false
  );
  const favoritePlaceIdSet = new Set(favoritePlaceIds);
  const normalizedSelectedTagIds = Array.from(
    new Set(selectedTagIds.map((tagId) => normalizeTagId(tagId)).filter(Boolean))
  );
  const selectedTagIdSet = new Set(normalizedSelectedTagIds);

  const scoredRoutes = routesSnapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseRoute(doc.id, doc.data())
    )
    .filter((route) => route.name)
    .map((route) => {
      const places = (route.selected_places || [])
        .map((entry) => placesMap.get(entry.place_id))
        .filter((place): place is FirebasePlace => Boolean(place && place.isActive !== false));

      // const events = (route.event_ids || [])
      //   .map((eventId) => eventsMap.get(eventId))
      //   .filter((event): event is FirebaseEvent => Boolean(event && event.isActive !== false));
      const events: FirebaseEvent[] = [];
      const routeTagIds = extractRouteTagIds(route, places, events);
      const selectedIds = new Set(places.map((place) => place.id));
      const favoritePlaces = allPlaces
        .filter((place) => favoritePlaceIdSet.has(place.id))
        .filter((place) =>
          locationMatches(
            buildLocationLabel(route.city_name, route.country) || locationLabel,
            place.city_name,
            place.country
          )
        )
        .filter((place) => !selectedIds.has(place.id))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));

      const fallbackPlace =
        allPlaces
          .filter((place) =>
            locationMatches(
              buildLocationLabel(route.city_name, route.country) || locationLabel,
              place.city_name,
              place.country
            )
          )
          .filter((place) => !selectedIds.has(place.id))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null;

      const matchedTagCount = routeTagIds.filter((tagId) =>
        selectedTagIdSet.has(normalizeTagId(tagId))
      ).length;

      return {
        route,
        places,
        events,
        favoritePlace: favoritePlaces[0] || fallbackPlace,
        favoritePlaces,
        matchedTagCount,
        locationMatched: routeMatchesLocation(locationLabel, route, places, events),
      };
    });

  const cityMatchedRoutes = scoredRoutes.filter((item) => item.locationMatched);

  if (cityMatchedRoutes.length === 0) {
    return [];
  }

  const cityPool =
    normalizedSelectedTagIds.length > 0
      ? cityMatchedRoutes.filter((item) => item.matchedTagCount > 0)
      : cityMatchedRoutes;

  if (cityPool.length === 0) {
    return [];
  }

  const maxMatchedTags = cityPool.reduce(
    (max, item) => Math.max(max, item.matchedTagCount),
    0
  );

  const bestTagMatchedRoutes = cityPool.filter(
    (item) => item.matchedTagCount === maxMatchedTags
  );

  const sorted = bestTagMatchedRoutes
    .sort((a, b) => {
      const stopDiff = (b.route.totalStops || b.places.length || 0) - (a.route.totalStops || a.places.length || 0);
      if (stopDiff !== 0) {
        return stopDiff;
      }

      return b.places.length - a.places.length;
    })
    .map(({ locationMatched: _locationMatched, ...item }) => item);

  return sorted.slice(0, 1);
};

export const fetchRouteDetails = async ({
  routeId,
  userId,
  extraPlaceIds = [],
  removedPlaceIds = [],
}: {
  routeId: string;
  userId?: string;
  extraPlaceIds?: string[];
  removedPlaceIds?: string[];
}) => {
  const [routeDoc, placesMap, eventsMap, favoritePlaceIds] = await Promise.all([
    firestore().collection(ROUTES_COLLECTION).doc(routeId).get(),
    fetchAllPlacesMap(),
    fetchAllEventsMap(),
    fetchUserFavoritePlaceIds(userId),
  ]);

  if (!routeDoc.exists) {
    throw new Error('Route not found.');
  }

  const route = parseRoute(routeDoc.id, routeDoc.data());
  const removedPlaceIdSet = new Set(removedPlaceIds);
  const routePlaces = (route.selected_places || [])
    .map((entry) => placesMap.get(entry.place_id))
    .filter((place): place is FirebasePlace => Boolean(place && place.isActive !== false))
    .filter((place) => !removedPlaceIdSet.has(place.id));

  const extraPlaces = extraPlaceIds
    .map((placeId) => placesMap.get(placeId))
    .filter((place): place is FirebasePlace => Boolean(place && place.isActive !== false))
    .filter((place) => !routePlaces.some((item) => item.id === place.id));

  // const events = (route.event_ids || [])
  //   .map((eventId) => eventsMap.get(eventId))
  //   .filter((event): event is FirebaseEvent => Boolean(event && event.isActive !== false));
  const events: FirebaseEvent[] = [];
  const selectedIds = new Set([...routePlaces, ...extraPlaces].map((place) => place.id));
  const favoritePlaceIdSet = new Set(favoritePlaceIds);
  const allPlaces: FirebasePlace[] =
    Array.from(placesMap.values()) as FirebasePlace[];

  const favoritePlaces: FirebasePlace[] = allPlaces
    .filter((place: FirebasePlace) => favoritePlaceIdSet.has(place.id))
    .filter((place: FirebasePlace) =>
      locationMatches(
        buildLocationLabel(route.city_name, route.country),
        place.city_name,
        place.country
      )
    )
    .filter((place: FirebasePlace) => !selectedIds.has(place.id))
    .sort((a: FirebasePlace, b: FirebasePlace) =>
      (b.rating || 0) - (a.rating || 0)
    );

  const fallbackPlace =
    allPlaces
      .filter((place: FirebasePlace) =>
        locationMatches(
          buildLocationLabel(route.city_name, route.country),
          place.city_name,
          place.country
        )
      )
      .filter((place: FirebasePlace) => !selectedIds.has(place.id))
      .sort((a: FirebasePlace, b: FirebasePlace) =>
        (b.rating || 0) - (a.rating || 0)
      )[0] || null;

  return {
    route,
    places: [...routePlaces, ...extraPlaces],
    events,
    favoritePlace: favoritePlaces[0] || fallbackPlace,
    favoritePlaces,
    matchedTagCount: extractRouteTagIds(route, [...routePlaces, ...extraPlaces], events).length,
  };
};

export const fetchPlacesByIds = async (placeIds: string[]) => {
  if (placeIds.length === 0) {
    return [];
  }

  const placesMap = await fetchAllPlacesMap();
  const placeIdSet = new Set(placeIds);

  return Array.from(placesMap.values()).filter((place) => placeIdSet.has(place.id));
};

/** Preserve tour / saved order when place docs are loaded by id. */
export const sortPlacesByIdOrder = (
  places: FirebasePlace[],
  orderedIds: string[]
): FirebasePlace[] => {
  if (orderedIds.length === 0) {
    return places;
  }
  const byId = new Map(places.map((place) => [place.id, place]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((place): place is FirebasePlace => Boolean(place));
  const seen = new Set(orderedIds);
  const remainder = places.filter((place) => !seen.has(place.id));
  return [...ordered, ...remainder];
};

export const buildNavigableRouteFromStops = (
  stops: Array<{
    id: string;
    kind?: 'place' | 'event';
    event?: unknown;
  }>
): NavigableRouteEntry[] =>
  stops.map((stop, index) => ({
    order: index + 1,
    stop_id: stop.id,
    kind: stop.kind === 'event' || stop.event ? 'event' : 'place',
  }));

export const fetchRoutesByIds = async (
  routeIds: string[]
): Promise<FirebaseRoute[]> => {
  if (routeIds.length === 0) return [];

  const snapshot = await firestore()
    .collection(ROUTES_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  const wanted = new Set(routeIds);
  return snapshot.docs
    .filter(
      (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
        wanted.has(doc.id)
    )
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseRoute(doc.id, doc.data())
    );
};

export const fetchToursByIds = async (
  tourIds: string[]
): Promise<SavedTour[]> => {
  if (tourIds.length === 0) return [];

  const snapshot = await firestore()
    .collection(TOURS_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  const wanted = new Set(tourIds);
  return snapshot.docs
    .filter(
      (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
        wanted.has(doc.id)
    )
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseSavedTour(doc.id, doc.data())
    );
};

export const fetchEventsByIds = async (
  eventIds: string[]
): Promise<FirebaseEvent[]> => {
  if (eventIds.length === 0) return [];

  const snapshot = await firestore()
    .collection(EVENTS_COLLECTION)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  const docsById = new Map<string, FirebaseFirestoreTypes.DocumentData>(
    snapshot.docs.map((doc) => [doc.id, doc.data()])
  );

  return eventIds
    .map((eventId) => {
      const data = docsById.get(eventId);
      if (!data) return null;
      return parseEvent(eventId, data);
    })
    .filter((event): event is FirebaseEvent => Boolean(event));
};

const startOfCalendarDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfCalendarDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const isEventScheduledOnDay = (event: FirebaseEvent, day: Date) => {
  if (!event.startDate) {
    return false;
  }

  const dayStart = startOfCalendarDay(day).getTime();
  const dayEnd = endOfCalendarDay(day).getTime();
  const eventStart = startOfCalendarDay(new Date(event.startDate)).getTime();
  const eventEnd = event.endDate
    ? endOfCalendarDay(new Date(event.endDate)).getTime()
    : endOfCalendarDay(new Date(event.startDate)).getTime();

  return eventStart <= dayEnd && eventEnd >= dayStart;
};

const isTodayEvent = (event: FirebaseEvent, now = new Date()) =>
  isEventScheduledOnDay(event, now);

export const saveUserTour = async ({
  tourId,
  userId,
  route,
  title,
  places,
  events,
  placeProgress,
  eventProgress,
  allPlacesAndEvents,
  navigableRoute,
  currentStopIndex,
  isEdited,
  status,
  startedAt,
  completedAt,
  scheduledDate,
}: {
  tourId?: string | null;
  userId: string;
  userName?: string;
  userEmail?: string;
  route: FirebaseRoute;
  title: string;
  places: FirebasePlace[];
  events: FirebaseEvent[];
  placeProgress: Record<
    string,
    {
      visited: boolean;
      visitedAt?: string | null;
      proofImageUri?: string | null;
      pointsEarned?: number;
      addedByUser?: boolean;
    }
  >;
  eventProgress?: Record<
    string,
    {
      attended?: boolean;
      dismissed?: boolean;
      visitedAt?: string | null;
      proofImageUri?: string | null;
    }
  >;
  allPlacesAndEvents?: Record<string, any>[];
  navigableRoute?: NavigableRouteEntry[];
  currentStopIndex: number;
  isEdited: boolean;
  status: 'active' | 'completed' | 'paused' | 'scheduled' | 'saved';
  startedAt?: string;
  completedAt?: string | null;
  scheduledDate?: string | null;
}) => {
  const now = new Date().toISOString();
  if (status === 'active') {
    await rescheduleOtherActiveTours({
      userId,
      excludeTourId: tourId,
      scheduledDate: now,
    });
  }

  const allPlaces = places.map((place) => {
    const progress = placeProgress[place.id];
    return {
      place_id: place.id,
      visited: Boolean(progress?.visited),
      visitedAt: progress?.visitedAt || null,
      pointsEarned: Number(progress?.pointsEarned || 0),
      proofImageUri: progress?.proofImageUri || null,
      addedByUser: Boolean(progress?.addedByUser),
    };
  });

  const eventCandidates = events || [];

  // Create event entries with same fields as place entries for consistency.
  // Persist all route events in all_places so saved tours preserve schedule
  // order, progress, and resume behavior correctly.
  const eventEntries = eventCandidates
    .map((event) => {
      const progress = (eventProgress && (eventProgress as any)[event.id]) || {};
      return {
        event_id: event.id,
        visited: Boolean(progress.visited || progress.attended),
        visitedAt: progress.visitedAt || null,
        pointsEarned: 0,
        proofImageUri: progress.proofImageUri || null,
        addedByUser: false,
      };
    })
    .sort((a, b) => {
      const eventA = eventCandidates.find((e) => e.id === a.event_id);
      const eventB = eventCandidates.find((e) => e.id === b.event_id);
      const dateCompare = (eventA?.startDate || '').localeCompare(
        eventB?.startDate || ''
      );
      if (dateCompare !== 0) return dateCompare;
      return (eventA?.startTime || '').localeCompare(eventB?.startTime || '');
    });

  console.log('DEBUG saveUserTour - events param:', events);
  console.log('DEBUG saveUserTour - eventEntries:', eventEntries);

  const placeEntriesById = new Map(
    allPlaces.map((item) => [item.place_id, item])
  );
  const eventEntriesById = new Map(
    eventEntries.map((item) => [item.event_id, item])
  );

  let allPlacesAndEventsFinal: Record<string, any>[] = [];

  if (Array.isArray(allPlacesAndEvents) && allPlacesAndEvents.length > 0) {
    // Use the explicit array provided by the caller, but overlay visit progress
    allPlacesAndEventsFinal = allPlacesAndEvents
      .map((item, index) => {
        if (item.place_id) {
          const progress = placeProgress[item.place_id] || {};
          return {
            place_id: item.place_id,
            visited: Boolean(progress.visited) || Boolean(item.visited),
            visitedAt: progress.visitedAt || item.visitedAt || null,
            pointsEarned: Number(progress.pointsEarned || item.pointsEarned || 0),
            proofImageUri: progress.proofImageUri || item.proofImageUri || null,
            addedByUser: Boolean(progress.addedByUser || item.addedByUser),
            order: index + 1,
          };
        }
        if (item.event_id) {
          const progress = (eventProgress && (eventProgress as any)[item.event_id]) || {};
          return {
            event_id: item.event_id,
            visited: Boolean(progress.visited || progress.attended) || Boolean(item.visited),
            visitedAt: progress.visitedAt || item.visitedAt || null,
            pointsEarned: Number(item.pointsEarned || 0),
            proofImageUri: progress.proofImageUri || item.proofImageUri || null,
            addedByUser: Boolean(item.addedByUser || false),
            order: index + 1,
          };
        }
        return null;
      })
      .filter(Boolean) as Record<string, any>[];
  } else if (Array.isArray(navigableRoute) && navigableRoute.length > 0) {
    console.log('DEBUG saveUserTour - navigableRoute param:', navigableRoute);
    const orderedStops = [...navigableRoute].sort((a, b) => a.order - b.order);
    const orderedEntries: Record<string, any>[] = orderedStops
      .map((entry) => {
        if (entry.kind === 'place') {
          const place = placeEntriesById.get(entry.stop_id);
          if (!place) return null;
          const progress = placeProgress[place.place_id] || {};
          return {
            ...place,
            visited: Boolean(progress.visited) || Boolean(place.visited),
            visitedAt: progress.visitedAt || place.visitedAt || null,
            pointsEarned: Number(progress.pointsEarned || place.pointsEarned || 0),
            proofImageUri: progress.proofImageUri || place.proofImageUri || null,
            addedByUser: Boolean(progress.addedByUser || place.addedByUser),
          };
        }
        if (entry.kind === 'event') {
          const event = eventEntriesById.get(entry.stop_id);
          if (!event) return null;
          const progress = (eventProgress && (eventProgress as any)[entry.stop_id]) || {};
          return {
            ...event,
            visited: Boolean(progress.visited || progress.attended) || Boolean(event.visited),
            visitedAt: progress.visitedAt || event.visitedAt || null,
            proofImageUri: progress.proofImageUri || event.proofImageUri || null,
          };
        }
        return null;
      })
      .filter(Boolean) as Record<string, any>[];

    const orderedIds = new Set(orderedEntries.map((entry) => entry.place_id || entry.event_id));
    const missingPlaces = allPlaces
      .filter((item) => !orderedIds.has(item.place_id))
      .map((item, index) => ({
        ...item,
        order: orderedEntries.length + index + 1,
      }));
    const missingEvents = eventEntries
      .filter((item) => !orderedIds.has(item.event_id))
      .map((item, index) => ({
        ...item,
        order: orderedEntries.length + missingPlaces.length + index + 1,
      }));
    console.log('DEBUG saveUserTour - orderedEntries (from navigableRoute):', orderedEntries);
    console.log('DEBUG saveUserTour - missingPlaces:', missingPlaces);
    console.log('DEBUG saveUserTour - missingEvents:', missingEvents);

    allPlacesAndEventsFinal = [
      ...orderedEntries.map((item, index) => ({ ...item, order: index + 1 })),
      ...missingPlaces,
      ...missingEvents,
    ];
  } else {
    // Fallback: combine allPlaces and eventEntries if not provided by caller
    allPlacesAndEventsFinal = [
      ...allPlaces.map((item, index) => ({ ...item, order: index + 1 })),
      ...eventEntries.map((item, index) => ({
        ...item,
        order: allPlaces.length + index + 1,
      })),
    ];
  }



  const totalPoints = allPlaces.reduce(
    (sum, item) => sum + Number((item as any).pointsEarned || 0),
    0
  );

  const payload = {
    title: title.trim() || route.name,
    user_id: userId,
    route_id: route.id,
    city_name: route.city_name || '',
    country: route.country || '',
    status,
    isEdited,
    currentStopIndex,
    totalPoints,
    startedAt: startedAt || now,
    completedAt: completedAt || null,
    scheduledDate: scheduledDate || null,
    event_ids: events.map((event) => event.id),
    all_places: allPlacesAndEventsFinal,
    updatedAt: now,
  };

  console.log('DEBUG saveUserTour - final all_places payload:', allPlacesAndEventsFinal.map(p=>p.place_id || p.event_id));

  let savedId: string;
  if (tourId) {
    await firestore()
      .collection(TOURS_COLLECTION)
      .doc(tourId)
      .set(
        {
          ...payload,
        },
        { merge: true }
      );
    savedId = tourId;
  } else {
    const docRef = await firestore()
      .collection(TOURS_COLLECTION)
      .add({
        ...payload,
        createdAt: now,
      });
    savedId = docRef.id;
  }

  await firestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .set(
      {
        tours: firestore.FieldValue.arrayUnion(savedId),
      },
      { merge: true }
    );

  return savedId;
};

export const addUserVisitPoints = async ({
  userId,
  tourId,
  placeId,
  pointsToAdd,
}: {
  userId: string;
  tourId: string;
  placeId: string;
  pointsToAdd: number;
}) => {
  if (!userId || !pointsToAdd) return;

  const visitKey = `${tourId}:${placeId}`;
  const userRef = firestore().collection(USERS_COLLECTION).doc(userId);

  await firestore().runTransaction(async (tx: FirebaseFirestoreTypes.Transaction) => {
    const snap = await tx.get(userRef);
    const data = snap.data() || {};
    const visited: string[] = Array.isArray(data.visitedKeys)
      ? data.visitedKeys
      : [];

    if (visited.includes(visitKey)) return;

    tx.set(
      userRef,
      {
        points: firestore.FieldValue.increment(pointsToAdd),
        visitedKeys: firestore.FieldValue.arrayUnion(visitKey),
        tours: firestore.FieldValue.arrayUnion(tourId),
      },
      { merge: true }
    );
  });
};

export const fetchLatestUserTourForRoute = async ({
  userId,
  routeId,
}: {
  userId?: string;
  routeId: string;
}) => {
  if (!userId) {
    return null;
  }

  const snapshot = await firestore()
    .collection(TOURS_COLLECTION)
    .where('user_id', '==', userId)
    .where('route_id', '==', routeId)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  const doc = snapshot.docs
    .sort(
      (
        a: FirebaseFirestoreTypes.QueryDocumentSnapshot,
        b: FirebaseFirestoreTypes.QueryDocumentSnapshot
      ) => {
        const aTime = a.data().updatedAt || '';
        const bTime = b.data().updatedAt || '';
        return bTime.localeCompare(aTime);
      }
    )[0];
  if (!doc) {
    return null;
  }

  return parseSavedTour(doc.id, doc.data());
};

export const fetchUserTourById = async (tourId?: string | null) => {
  if (!tourId) {
    return null;
  }

  const doc = await firestore()
    .collection(TOURS_COLLECTION)
    .doc(tourId)
    .get() as FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;
  if (!doc.exists) {
    return null;
  }

  return parseSavedTour(doc.id, doc.data());
};

export const fetchUserTours = async (userId?: string): Promise<SavedTour[]> => {
  if (!userId) {
    return [];
  }

  const snapshot = await firestore()
    .collection(TOURS_COLLECTION)
    .where('user_id', '==', userId)
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  return snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseSavedTour(doc.id, doc.data())
    )
    .sort((a: SavedTour, b: SavedTour) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
};

export const getActiveTour = async (userId?: string): Promise<SavedTour | null> => {
  if (!userId) return null;

  const snapshot = await firestore()
    .collection(TOURS_COLLECTION)
    .where('user_id', '==', userId)
    .where('status', '==', 'active')
    .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;

  if (snapshot.empty) return null;

  const tours = snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseSavedTour(doc.id, doc.data())
    )
    .sort((a: SavedTour, b: SavedTour) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );

  return tours[0];
};

export const scheduleOtherActiveTours = async ({
  userId,
  excludeTourId,
  scheduledDate,
}: {
  userId?: string;
  excludeTourId?: string | null;
  scheduledDate?: string;
}) => {
  if (!userId) {
    return;
  }

  await rescheduleOtherActiveTours({ userId, excludeTourId, scheduledDate });
};

const USER_FAVOURITE_PLACES_FIELD = 'favoritePlaces';
const USER_LEGACY_FAVORITES_FIELD = 'favorites';

/** Track place favorites made while on a tour so they can be cleaned up on delete. */
/** Remove a place from user favorites and tour-linked favorite tracking. */
export const removeTourPlaceFromUserAndRecord = async ({
  userId,
  tourId,
  placeId,
}: {
  userId: string;
  tourId?: string | null;
  placeId: string;
}) => {
  if (!userId || !placeId) {
    return;
  }

  await firestore()
    .collection('users')
    .doc(userId)
    .set(
      {
        [USER_FAVOURITE_PLACES_FIELD]: firestore.FieldValue.arrayRemove(placeId),
        [USER_LEGACY_FAVORITES_FIELD]: firestore.FieldValue.arrayRemove(placeId),
      },
      { merge: true }
    );

  if (tourId) {
    await firestore()
      .collection(TOURS_COLLECTION)
      .doc(tourId)
      .set(
        { favorited_place_ids: firestore.FieldValue.arrayRemove(placeId) },
        { merge: true }
      );
  }
};

export const recordTourFavoritedPlace = async (
  tourId: string,
  placeId: string
) => {
  if (!tourId || !placeId) {
    return;
  }

  await firestore()
    .collection(TOURS_COLLECTION)
    .doc(tourId)
    .set(
      { favorited_place_ids: firestore.FieldValue.arrayUnion(placeId) },
      { merge: true }
    );
};

export const clearUserFavoritesForDeletedTour = async ({
  userId,
  tourId,
  routeId,
  favoritedPlaceIds = [],
}: {
  userId: string;
  tourId: string;
  routeId?: string | null;
  favoritedPlaceIds?: string[];
}) => {
  const userRef = firestore().collection('users').doc(userId);
  const payload: Record<string, unknown> = {
    favoriteTours: firestore.FieldValue.arrayRemove(
      tourId,
      ...(routeId ? [routeId] : [])
    ),
  };

  const placeIds = [...new Set(favoritedPlaceIds.filter(Boolean))];
  if (placeIds.length > 0) {
    payload[USER_FAVOURITE_PLACES_FIELD] =
      firestore.FieldValue.arrayRemove(...placeIds);
    payload[USER_LEGACY_FAVORITES_FIELD] =
      firestore.FieldValue.arrayRemove(...placeIds);
  }

  await userRef.set(payload, { merge: true });
};

export const deleteUserTour = async (
  tourId?: string | null,
  options?: { userId?: string }
) => {
  if (!tourId) {
    return;
  }

  let routeId: string | null = null;
  let favoritedPlaceIds: string[] = [];

  const tourDoc = await firestore()
    .collection(TOURS_COLLECTION)
    .doc(tourId)
    .get();

  if (tourDoc.exists) {
    const data = tourDoc.data() || {};
    routeId = typeof data.route_id === 'string' ? data.route_id : null;
    favoritedPlaceIds = Array.isArray(data.favorited_place_ids)
      ? data.favorited_place_ids.filter(
          (id: unknown): id is string => typeof id === 'string' && Boolean(id)
        )
      : [];
  }

  await firestore().collection(TOURS_COLLECTION).doc(tourId).delete();

  // If a specific user initiated the delete, clean only their favorites.
  if (options?.userId) {
    await clearUserFavoritesForDeletedTour({
      userId: options.userId,
      tourId,
      routeId,
      favoritedPlaceIds,
    });
    return;
  }

  // Otherwise (admin/global delete): remove references from any user
  // who saved the tour or favorited places from this tour.
  try {
    const userIdsToClean = new Set<string>();

    // Users who have this tour in their `favoriteTours` list.
    const usersWithTour = await firestore()
      .collection('users')
      .where('favoriteTours', 'array-contains', tourId)
      .get();
    usersWithTour.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      if (d.id) userIdsToClean.add(d.id);
    });

    // Users who have any of the places from this tour in their favorite lists.
    const placeIds = favoritedPlaceIds.filter(Boolean);
    if (placeIds.length > 0) {
      const chunkSize = 10; // Firestore limits array-contains-any to 10 items
      for (let i = 0; i < placeIds.length; i += chunkSize) {
        const chunk = placeIds.slice(i, i + chunkSize);
        const snapshot = await firestore()
          .collection('users')
          .where(USER_FAVOURITE_PLACES_FIELD, 'array-contains-any', chunk)
          .get();
        snapshot.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          if (d.id) userIdsToClean.add(d.id);
        });
      }
    }

    // Perform removal for each affected user.
    await Promise.all(
      Array.from(userIdsToClean).map((uid) =>
        clearUserFavoritesForDeletedTour({
          userId: uid,
          tourId,
          routeId,
          favoritedPlaceIds,
        })
      )
    );
  } catch (err) {
    // Don't fail the overall deletion if cleanup errors occur; log if possible.
  }
};

export const fetchRewardsSummary = async (
  userId?: string
): Promise<RewardsSummary> => {
  if (!userId) {
    return { totalPoints: 0, tours: [] };
  }

  const [snapshot, placesMap] = await Promise.all([
    firestore()
      .collection(TOURS_COLLECTION)
      .where('user_id', '==', userId)
      .get() as FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
    fetchAllPlacesMap(),
  ]);

  const tours = snapshot.docs
    .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      parseSavedTour(doc.id, doc.data())
    )
    .sort((a: SavedTour, b: SavedTour) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
  const rewardTours = tours
    .map((tour: SavedTour) => {
      const places = tour.all_places.map((item: SavedTourPlace) => {
        const place = placesMap.get(item.place_id);
        return {
          id: item.place_id,
          name: place?.name || 'Location',
          points: item.pointsEarned || 0,
          visited: item.visited,
        };
      });

      return {
        id: tour.id,
        title: tour.title,
        date: tour.updatedAt || tour.startedAt || '',
        points: tour.totalPoints,
        totalLocations: tour.all_places.length,
        places,
      };
    })
    .filter(
      (tour: {
        points: number;
        places: Array<{ visited: boolean }>;
      }) => tour.points > 0 || tour.places.some((place) => place.visited)
    );

  return {
    totalPoints: rewardTours.reduce(
      (sum: number, tour: { points: number }) => sum + tour.points,
      0
    ),
    tours: rewardTours,
  };
};
