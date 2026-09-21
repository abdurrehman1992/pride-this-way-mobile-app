import {
  buildLiveRoadGeometry,
  distanceMetersBetween,
  projectPointOnPolyline,
  splitPolylineAt,
} from '../../src/utils/routeProgress';

describe('live road access', () => {
  const road: [number, number][] = [[0, 0], [0, 0.01]];

  it('joins an indoor location to the exact remaining road start', () => {
    const location: [number, number] = [0.001, 0.002];
    const result = buildLiveRoadGeometry(road, location);
    expect(result.access).toEqual([[location, result.remaining[0]]]);
    expect(result.remaining[0]).toEqual([0, 0.002]);
    expect(result.remaining).not.toContainEqual(location);
  });

  it('moves the connector with the user and removes it on reaching the road', () => {
    const first = buildLiveRoadGeometry(road, [0.001, 0.002]);
    const next = buildLiveRoadGeometry(road, [0.0005, 0.003]);
    expect(next.access[0][0]).toEqual([0.0005, 0.003]);
    expect(next.remaining[0]).not.toEqual(first.remaining[0]);
    expect(buildLiveRoadGeometry(road, [0, 0.003]).access).toEqual([]);
    expect(buildLiveRoadGeometry(road, [0.00001, 0.003]).access).toEqual([]);
  });

  it('clamps access to road endpoints and tolerates missing geometry', () => {
    expect(buildLiveRoadGeometry(road, [0, -0.001]).access[0][1]).toEqual(road[0]);
    expect(buildLiveRoadGeometry(road, [0, 0.011]).access[0][1]).toEqual(road[1]);
    expect(buildLiveRoadGeometry([], [0, 0])).toEqual({ remaining: [], access: [] });
  });
});

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
