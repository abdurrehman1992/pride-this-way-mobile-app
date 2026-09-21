import Geolocation from '@react-native-community/geolocation';
import axios from 'axios';
import Config from 'react-native-config';
import type { FirebasePlace } from '../services/myTourService';
import { distanceMetersBetween, type Coord } from './routeProgress';

export const getCurrentPositionAsync = (): Promise<Coord | null> =>
  new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) =>
        resolve([position.coords.longitude, position.coords.latitude]),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });

const placeCoordinate = (place: FirebasePlace): Coord | null => {
  const longitude = place.coordinates?.longitude;
  const latitude = place.coordinates?.latitude;
  if (longitude === undefined || latitude === undefined) {
    return null;
  }
  return [Number(longitude), Number(latitude)];
};

export const orderPlacesByNearest = (
  places: FirebasePlace[],
  startCoordinate: Coord | null
): FirebasePlace[] => {
  const withCoords = places.filter((place) => placeCoordinate(place));
  const withoutCoords = places.filter((place) => !placeCoordinate(place));
  if (withCoords.length <= 1) {
    return [...withCoords, ...withoutCoords];
  }

  const remaining = [...withCoords];
  const ordered: FirebasePlace[] = [];
  let cursor = startCoordinate || placeCoordinate(remaining[0])!;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = distanceMetersBetween(
      cursor,
      placeCoordinate(remaining[0])!
    );

    for (let index = 1; index < remaining.length; index += 1) {
      const candidateDistance = distanceMetersBetween(
        cursor,
        placeCoordinate(remaining[index])!
      );
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearestIndex = index;
      }
    }

    const [nextPlace] = remaining.splice(nearestIndex, 1);
    ordered.push(nextPlace);
    const nextCoord = placeCoordinate(nextPlace);
    if (nextCoord) {
      cursor = nextCoord;
    }
  }

  return [...ordered, ...withoutCoords];
};

/** Same Mapbox driving optimization used on the tour map, for persisting stop order. */
export const optimizePlacesForTour = async (
  places: FirebasePlace[],
  anchor?: Coord | null
): Promise<{ places: FirebasePlace[]; tourOrigin: Coord | null }> => {
  const withCoords = places.filter((place) => placeCoordinate(place));
  const withoutCoords = places.filter((place) => !placeCoordinate(place));
  const tourOrigin = anchor ?? (await getCurrentPositionAsync());

  if (withCoords.length <= 1) {
    return {
      places: [...orderPlacesByNearest(withCoords, tourOrigin), ...withoutCoords],
      tourOrigin,
    };
  }

  if (!tourOrigin) {
    return { places, tourOrigin: null };
  }

  if (!Config.MAPBOX_TOKEN) {
    return {
      places: [...orderPlacesByNearest(withCoords, tourOrigin), ...withoutCoords],
      tourOrigin,
    };
  }

  try {
    const coords = [tourOrigin, ...withCoords.map((place) => placeCoordinate(place)!)]
      .map((coordinate) => `${coordinate[0]},${coordinate[1]}`)
      .join(';');

    const { data } = await axios.get<{
      waypoints?: Array<{ waypoint_index: number }>;
    }>(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}`, {
      params: {
        access_token: Config.MAPBOX_TOKEN,
        source: 'first',
        roundtrip: false,
        overview: 'false',
      },
    });

    if (data.waypoints?.length) {
      const ordered = data.waypoints
        .map((waypoint, originalIndex) => ({
          originalIndex,
          order: waypoint.waypoint_index,
        }))
        .filter((entry) => entry.originalIndex > 0)
        .sort((a, b) => a.order - b.order)
        .map((entry) => withCoords[entry.originalIndex - 1])
        .filter((place): place is FirebasePlace => Boolean(place));

      return { places: [...ordered, ...withoutCoords], tourOrigin };
    }
  } catch {
    // Fall back to nearest-neighbor ordering.
  }

  return {
    places: [...orderPlacesByNearest(withCoords, tourOrigin), ...withoutCoords],
    tourOrigin,
  };
};
