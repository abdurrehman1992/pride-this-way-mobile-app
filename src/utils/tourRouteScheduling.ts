import type { FirebaseEvent } from '../services/myTourService';
import { distanceMetersBetween, type Coord } from './routeProgress';

export type SchedulableTourStop = {
  id: string;
  coordinate: Coord;
  kind?: 'place' | 'event';
  sortTime?: number;
  event?: FirebaseEvent;
};

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
/** Start heading to the event when within this window before start. */
const EVENT_GO_WINDOW_MS = 25 * 60 * 1000;
/** If we would arrive earlier than this, visit other stops first. */
const EVENT_TOO_EARLY_MS = 40 * 60 * 1000;
const ESTIMATED_PLACE_VISIT_MS = 35 * 60 * 1000;
const ESTIMATED_EVENT_DURATION_MS = 60 * 60 * 1000;
/** City driving ~30 km/h */
const TRAVEL_SPEED_MPS = 8.3;

export const getEventStartMs = (event: FirebaseEvent): number => {
  if (!event.startDate) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = new Date(`${event.startDate}T${event.startTime || '00:00'}`).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const isEventStop = (stop: SchedulableTourStop): boolean =>
  stop.kind === 'event' || Boolean(stop.event);

const getStopSortTime = (stop: SchedulableTourStop): number => {
  if (stop.sortTime !== undefined) {
    return stop.sortTime;
  }
  if (stop.event) {
    return getEventStartMs(stop.event);
  }
  return Number.MAX_SAFE_INTEGER;
};

const estimateTravelMs = (from: Coord, to: Coord): number => {
  const meters = distanceMetersBetween(from, to);
  return Math.max((meters / TRAVEL_SPEED_MPS) * 1000, 3 * 60 * 1000);
};

const pickNearestStop = <T extends SchedulableTourStop>(
  candidates: T[],
  from: Coord
): T => {
  let nearest = candidates[0];
  let nearestDistance = distanceMetersBetween(from, nearest.coordinate);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const distance = distanceMetersBetween(from, candidate.coordinate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }

  return nearest;
};

/**
 * Reorders map-optimized stops so today's events are visited near their start time,
 * filling gaps (including 2+ hours before an event) with other places first.
 */
export function scheduleStopsWithEventTiming<T extends SchedulableTourStop>(
  stops: T[],
  isStopComplete: (stop: T) => boolean,
  anchorCoord: Coord | null,
  nowMs: number = Date.now()
): T[] {
  let remaining = stops.filter((stop) => !isStopComplete(stop));
  if (remaining.length <= 1) {
    return remaining;
  }

  const result: T[] = [];
  let cursorCoord: Coord =
    anchorCoord ?? remaining[0].coordinate;
  let cursorTimeMs = nowMs;

  while (remaining.length > 0) {
    const pendingPlaces = remaining.filter((stop) => !isEventStop(stop));
    const pendingEvents = remaining
      .filter((stop) => isEventStop(stop))
      .sort((a, b) => getStopSortTime(a) - getStopSortTime(b));
    const nextEvent = pendingEvents[0];

    if (nextEvent && pendingPlaces.length > 0) {
      const eventStartMs = getStopSortTime(nextEvent);
      const travelToEventMs = estimateTravelMs(cursorCoord, nextEvent.coordinate);
      const arrivalIfLeaveNowMs = cursorTimeMs + travelToEventMs;
      const timeUntilEventMs = eventStartMs - cursorTimeMs;
      const minutesEarly =
        eventStartMs - EVENT_GO_WINDOW_MS - arrivalIfLeaveNowMs;

      const shouldVisitPlacesFirst = timeUntilEventMs > THREE_HOURS_MS;

      if (shouldVisitPlacesFirst) {
        const nearestPlace = pickNearestStop(pendingPlaces, cursorCoord);
        result.push(nearestPlace);
        remaining = remaining.filter((stop) => stop.id !== nearestPlace.id);
        cursorTimeMs +=
          estimateTravelMs(cursorCoord, nearestPlace.coordinate) +
          ESTIMATED_PLACE_VISIT_MS;
        cursorCoord = nearestPlace.coordinate;
        continue;
      }
    }

    if (nextEvent) {
      const eventStartMs = getStopSortTime(nextEvent);
      const travelToEventMs = estimateTravelMs(cursorCoord, nextEvent.coordinate);
      const arrivalIfLeaveNowMs = cursorTimeMs + travelToEventMs;
      const noPlacesLeft = pendingPlaces.length === 0;
      const withinGoWindow =
        arrivalIfLeaveNowMs >= eventStartMs - EVENT_GO_WINDOW_MS;
      const pastGoTime = cursorTimeMs >= eventStartMs - EVENT_GO_WINDOW_MS;
      const eventIsImminent = eventStartMs - cursorTimeMs <= THREE_HOURS_MS;

      if (noPlacesLeft || eventIsImminent || withinGoWindow || pastGoTime) {
        result.push(nextEvent);
        remaining = remaining.filter((stop) => stop.id !== nextEvent.id);
        cursorTimeMs += travelToEventMs + ESTIMATED_EVENT_DURATION_MS;
        cursorCoord = nextEvent.coordinate;
        continue;
      }
    }

    if (pendingPlaces.length > 0) {
      const nearestPlace = pickNearestStop(pendingPlaces, cursorCoord);
      result.push(nearestPlace);
      remaining = remaining.filter((stop) => stop.id !== nearestPlace.id);
      cursorTimeMs +=
        estimateTravelMs(cursorCoord, nearestPlace.coordinate) +
        ESTIMATED_PLACE_VISIT_MS;
      cursorCoord = nearestPlace.coordinate;
      continue;
    }

    if (pendingEvents.length > 0) {
      const next = pendingEvents[0];
      result.push(next);
      remaining = remaining.filter((stop) => stop.id !== next.id);
      cursorTimeMs +=
        estimateTravelMs(cursorCoord, next.coordinate) + ESTIMATED_EVENT_DURATION_MS;
      cursorCoord = next.coordinate;
      continue;
    }

    break;
  }

  return result;
}
