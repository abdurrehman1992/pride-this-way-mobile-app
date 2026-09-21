import Mapbox from '@rnmapbox/maps';
import Config from 'react-native-config';

let mapboxInitialization: Promise<void> | null = null;

/** Initialize Mapbox once before any screen mounts a MapView. */
export const initializeMapbox = (): Promise<void> => {
  if (!Config.MAPBOX_TOKEN) {
    return Promise.reject(new Error('MAPBOX_TOKEN is missing'));
  }

  if (!mapboxInitialization) {
    mapboxInitialization = Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
      .then(() => undefined)
      .catch((error) => {
        // Allow a later screen/resume to retry a transient native init error.
        mapboxInitialization = null;
        throw error;
      });
  }

  return mapboxInitialization;
};
