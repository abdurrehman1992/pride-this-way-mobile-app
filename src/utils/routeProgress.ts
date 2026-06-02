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

  const slicedCompleted = polyline.slice(0, projection.segmentIndex + 1);
  const lastSliced = slicedCompleted[slicedCompleted.length - 1];
  const projMatchesLast =
    lastSliced &&
    lastSliced[0] === projection.point[0] &&
    lastSliced[1] === projection.point[1];
  const completed: Coord[] = projMatchesLast
    ? slicedCompleted
    : [...slicedCompleted, projection.point];

  const remaining: Coord[] = [
    projection.point,
    ...polyline.slice(projection.segmentIndex + 1),
  ];

  return { completed, remaining };
};
