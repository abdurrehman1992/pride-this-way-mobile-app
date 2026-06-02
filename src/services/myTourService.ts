import firestore from '@react-native-firebase/firestore';
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

export type SavedTourPlace = {
  order: number;
  place_id: string;
  visited: boolean;
  visitedAt: string | null;
  pointsEarned: number;
  proofImageUri?: string | null;
  addedByUser?: boolean;
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
  all_places: SavedTourPlace[];
  event_ids: string[];
  // GPS anchor used for the Mapbox Optimization API. Persisted so the
  // stop order stays identical across pause/resume and app restarts.
  tourOrigin?: [number, number] | null;
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
    .get();

  const docsToUpdate = activeSnapshot.docs.filter((doc) => doc.id !== excludeTourId);
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
  all_places: toArray<Record<string, any>>(data?.all_places).map((item, index) => ({
    order: Number(item.order || index + 1),
    place_id: item.place_id || '',
    visited: Boolean(item.visited),
    visitedAt: item.visitedAt || null,
    pointsEarned: Number(item.pointsEarned || 0),
    proofImageUri: item.proofImageUri || null,
    addedByUser: Boolean(item.addedByUser),
  })),
  tourOrigin:
    Array.isArray(data?.tourOrigin) && data.tourOrigin.length === 2
      ? [Number(data.tourOrigin[0]), Number(data.tourOrigin[1])]
      : null,
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

  const hay = normalizeText([city, country].filter(Boolean).join(' '));
  return hay.includes(normalizedLocation);
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

const fetchAllPlacesMap = async () => {
  const snapshot = await firestore().collection(PLACES_COLLECTION).get();
  const placesMap = new Map<string, FirebasePlace>();
  snapshot.docs.forEach((doc) => {
    placesMap.set(doc.id, parsePlace(doc.id, doc.data()));
  });
  return placesMap;
};

const fetchAllEventsMap = async () => {
  const snapshot = await firestore().collection(EVENTS_COLLECTION).get();
  const eventsMap = new Map<string, FirebaseEvent>();
  snapshot.docs.forEach((doc) => {
    eventsMap.set(doc.id, parseEvent(doc.id, doc.data()));
  });
  return eventsMap;
};

export const fetchTourTags = async (): Promise<FirebaseTag[]> => {
  const snapshot = await firestore().collection(TAGS_COLLECTION).get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      name: doc.data().name || '',
      description: doc.data().description || '',
    }))
    .filter((tag) => tag.name)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const fetchMapEvents = async (): Promise<FirebaseEvent[]> => {
  const snapshot = await firestore().collection(EVENTS_COLLECTION).get();

  return snapshot.docs
    .map((doc) => parseEvent(doc.id, doc.data()))
    .filter((event) => event.isActive !== false)
    .filter(
      (event) =>
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
  const snapshot = await firestore().collection(PLACES_COLLECTION).get();
  const normalizedSearch = normalizeText(searchText);
  const normalizedLocation = normalizeText(locationLabel);

  return snapshot.docs
    .map((doc) => parsePlace(doc.id, doc.data()))
    .filter((place) => place.isActive !== false)
    .filter((place) => {
      if (!options?.cityOnly) {
        return true;
      }

      return locationMatches(locationLabel, place.city_name, place.country);
    })
    .filter((place) => {
      if (!normalizedSearch) {
        return true;
      }

      const searchHay =
        `${place.name} ${place.address} ${place.description}`.toLowerCase();
      return searchHay.includes(normalizedSearch);
    })
    .sort((a, b) => {
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

export const fetchUserFavoritePlaceIds = async (userId?: string) => {
  if (!userId) {
    return [];
  }

  const snapshot = await firestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(FAVORITES_SUBCOLLECTION)
    .get();

  return snapshot.docs
    .filter((doc) => doc.data().category !== 'Route')
    .map((doc) => doc.id);
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
      firestore().collection(ROUTES_COLLECTION).get(),
      fetchAllPlacesMap(),
      fetchAllEventsMap(),
      fetchUserFavoritePlaceIds(userId),
    ]);

  const allPlaces = Array.from(placesMap.values()).filter(
    (place) => place.isActive !== false
  );
  const favoritePlaceIdSet = new Set(favoritePlaceIds);
  const normalizedSelectedTagIds = Array.from(
    new Set(selectedTagIds.map((tagId) => normalizeTagId(tagId)).filter(Boolean))
  );
  const selectedTagIdSet = new Set(normalizedSelectedTagIds);

  const scoredRoutes = routesSnapshot.docs
    .map((doc) => parseRoute(doc.id, doc.data()))
    .filter((route) => route.name)
    .map((route) => {
      const places = (route.selected_places || [])
        .map((entry) => placesMap.get(entry.place_id))
        .filter((place): place is FirebasePlace => Boolean(place && place.isActive !== false));

      const events = (route.event_ids || [])
        .map((eventId) => eventsMap.get(eventId))
        .filter((event): event is FirebaseEvent => Boolean(event && event.isActive !== false));

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

  const events = (route.event_ids || [])
    .map((eventId) => eventsMap.get(eventId))
    .filter((event): event is FirebaseEvent => Boolean(event && event.isActive !== false));

  const selectedIds = new Set([...routePlaces, ...extraPlaces].map((place) => place.id));
  const favoritePlaceIdSet = new Set(favoritePlaceIds);
  const allPlaces = Array.from(placesMap.values()).filter(
    (place) => place.isActive !== false
  );

  const favoritePlaces = allPlaces
    .filter((place) => favoritePlaceIdSet.has(place.id))
    .filter((place) => locationMatches(buildLocationLabel(route.city_name, route.country), place.city_name, place.country))
    .filter((place) => !selectedIds.has(place.id))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const fallbackPlace =
    allPlaces
      .filter((place) => locationMatches(buildLocationLabel(route.city_name, route.country), place.city_name, place.country))
      .filter((place) => !selectedIds.has(place.id))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null;

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

export const fetchRoutesByIds = async (
  routeIds: string[]
): Promise<FirebaseRoute[]> => {
  if (routeIds.length === 0) return [];

  const snapshot = await firestore().collection(ROUTES_COLLECTION).get();
  const wanted = new Set(routeIds);
  return snapshot.docs
    .filter((doc) => wanted.has(doc.id))
    .map((doc) => parseRoute(doc.id, doc.data()));
};

export const fetchToursByIds = async (
  tourIds: string[]
): Promise<SavedTour[]> => {
  if (tourIds.length === 0) return [];

  const snapshot = await firestore().collection(TOURS_COLLECTION).get();
  const wanted = new Set(tourIds);
  return snapshot.docs
    .filter((doc) => wanted.has(doc.id))
    .map((doc) => parseSavedTour(doc.id, doc.data()));
};

export const fetchEventsByIds = async (
  eventIds: string[]
): Promise<FirebaseEvent[]> => {
  if (eventIds.length === 0) return [];

  const snapshot = await firestore().collection(EVENTS_COLLECTION).get();
  const wanted = new Set(eventIds);
  return snapshot.docs
    .filter((doc) => wanted.has(doc.id))
    .map((doc) => parseEvent(doc.id, doc.data()));
};

export const saveUserTour = async ({
  tourId,
  userId,
  route,
  title,
  places,
  events,
  placeProgress,
  currentStopIndex,
  isEdited,
  status,
  startedAt,
  completedAt,
  scheduledDate,
  tourOrigin,
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
  currentStopIndex: number;
  isEdited: boolean;
  status: 'active' | 'completed' | 'paused' | 'scheduled' | 'saved';
  startedAt?: string;
  completedAt?: string | null;
  scheduledDate?: string | null;
  tourOrigin?: [number, number] | null;
}) => {
  const now = new Date().toISOString();
  if (status === 'active') {
    await rescheduleOtherActiveTours({
      userId,
      excludeTourId: tourId,
      scheduledDate: now,
    });
  }

  const allPlaces = places.map((place, index) => {
    const progress = placeProgress[place.id];
    return {
      order: index + 1,
      place_id: place.id,
      visited: Boolean(progress?.visited),
      visitedAt: progress?.visitedAt || null,
      pointsEarned: Number(progress?.pointsEarned || 0),
      proofImageUri: progress?.proofImageUri || null,
      addedByUser: Boolean(progress?.addedByUser),
    };
  });
  const totalPoints = allPlaces.reduce(
    (sum, item) => sum + Number(item.pointsEarned || 0),
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
    all_places: allPlaces,
    event_ids: events.map((event) => event.id),
    tourOrigin: tourOrigin ?? null,
    updatedAt: now,
  };

  let savedId: string;
  if (tourId) {
    await firestore()
      .collection(TOURS_COLLECTION)
      .doc(tourId)
      .set(payload, { merge: true });
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

  await firestore().runTransaction(async (tx) => {
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
    .get();

  const doc = snapshot.docs
    .sort((a, b) => {
      const aTime = a.data().updatedAt || '';
      const bTime = b.data().updatedAt || '';
      return bTime.localeCompare(aTime);
    })[0];
  if (!doc) {
    return null;
  }

  return parseSavedTour(doc.id, doc.data());
};

export const fetchUserTourById = async (tourId?: string | null) => {
  if (!tourId) {
    return null;
  }

  const doc = await firestore().collection(TOURS_COLLECTION).doc(tourId).get();
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
    .get();

  return snapshot.docs
    .map((doc) => parseSavedTour(doc.id, doc.data()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};

export const getActiveTour = async (userId?: string): Promise<SavedTour | null> => {
  if (!userId) return null;

  const snapshot = await firestore()
    .collection(TOURS_COLLECTION)
    .where('user_id', '==', userId)
    .where('status', '==', 'active')
    .get();

  if (snapshot.empty) return null;

  const tours = snapshot.docs
    .map((doc) => parseSavedTour(doc.id, doc.data()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

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

export const deleteUserTour = async (tourId?: string | null) => {
  if (!tourId) {
    return;
  }

  await firestore().collection(TOURS_COLLECTION).doc(tourId).delete();
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
      .get(),
    fetchAllPlacesMap(),
  ]);

  const tours = snapshot.docs
    .map((doc) => parseSavedTour(doc.id, doc.data()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const rewardTours = tours.map((tour) => {
    const places = tour.all_places.map((item) => {
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
  }).filter((tour) => tour.points > 0 || tour.places.some((place) => place.visited));

  return {
    totalPoints: rewardTours.reduce((sum, tour) => sum + tour.points, 0),
    tours: rewardTours,
  };
};
