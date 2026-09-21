import type { FirebaseEvent } from '../services/myTourService';

export const isPodcastEvent = (
  event: Pick<FirebaseEvent, 'event_type'> | null | undefined
) => (event?.event_type || '').toLowerCase().trim() === 'podcast_event';

export const isPrideEvent = (
  event: Pick<FirebaseEvent, 'event_type'> | null | undefined
) => !isPodcastEvent(event);
