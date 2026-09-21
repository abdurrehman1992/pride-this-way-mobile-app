import {
  distanceMetersBetween,
  projectPointOnPolyline,
  type Coord,
} from './routeProgress';

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

export const normalizeHeading = (heading: number): number =>
  ((heading % 360) + 360) % 360;

export const bearingBetween = (from: Coord, to: Coord): number | null => {
  if (distanceMetersBetween(from, to) < 5) {
    return null;
  }

  const fromLatitude = toRadians(from[1]);
  const toLatitude = toRadians(to[1]);
  const longitudeDelta = toRadians(to[0] - from[0]);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);

  return normalizeHeading(toDegrees(Math.atan2(y, x)));
};

/** Smooth across the 0/360 boundary by always taking the shortest turn. */
export const smoothHeading = (
  current: number,
  target: number,
  factor = 0.35,
): number => {
  const delta = ((normalizeHeading(target) - normalizeHeading(current) + 540) % 360) - 180;
  return normalizeHeading(current + delta * factor);
};

/**
 * Returns the direction of the route ahead of the user's nearest point.
 * Looking several metres forward avoids pointing at a noisy single vertex
 * and keeps the navigation camera aligned with the road being followed.
 */
export const bearingAlongPolyline = (
  position: Coord,
  polyline: Coord[],
  lookAheadMeters = 24,
): number | null => {
  if (polyline.length < 2) return null;

  const projection = projectPointOnPolyline(position, polyline);
  const start = projection.point;
  let previous = start;
  let travelled = 0;

  for (let index = projection.segmentIndex + 1; index < polyline.length; index += 1) {
    const next = polyline[index];
    const segmentDistance = distanceMetersBetween(previous, next);
    if (segmentDistance <= 0.1) {
      previous = next;
      continue;
    }

    if (travelled + segmentDistance >= lookAheadMeters) {
      const ratio = Math.min(1, Math.max(0, (lookAheadMeters - travelled) / segmentDistance));
      const target: Coord = [
        previous[0] + (next[0] - previous[0]) * ratio,
        previous[1] + (next[1] - previous[1]) * ratio,
      ];
      return bearingBetween(start, target);
    }

    travelled += segmentDistance;
    previous = next;
  }

  return bearingBetween(start, polyline[polyline.length - 1]);
};
