import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

type NativeLocationStatus = {
  type?: 'update' | 'unavailable';
  tracking?: boolean;
  locationEnabled?: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number;
  timestamp?: number;
  taskRemovedWhileTracking?: boolean;
  taskRemovedAt?: number;
  taskRemovedTourId?: string;
};

export type NativeLocationSample = Required<Pick<
  NativeLocationStatus,
  'latitude' | 'longitude' | 'accuracy' | 'speed' | 'timestamp'
>>;

const nativeModule = NativeModules.TourLocation;

export const isNativeTourLocationAvailable = Platform.OS === 'android' && Boolean(nativeModule);

export const startNativeTourLocation = async (
  tourId?: string | null,
): Promise<boolean> => {
  if (!isNativeTourLocationAvailable) return false;
  try {
    if (tourId && typeof nativeModule.setActiveTourId === 'function') {
      await nativeModule.setActiveTourId(tourId);
    }
    await nativeModule.startTracking();
    return true;
  } catch {
    return false;
  }
};

export const clearNativeTourTaskRemoval = async (): Promise<void> => {
  if (
    !isNativeTourLocationAvailable ||
    typeof nativeModule.clearTaskRemovalState !== 'function'
  ) {
    return;
  }
  try {
    await nativeModule.clearTaskRemovalState();
  } catch {
    // Reconciliation is idempotent and can safely run again next launch.
  }
};

export const stopNativeTourLocation = async (): Promise<void> => {
  if (!isNativeTourLocationAvailable) return;
  try {
    await nativeModule.stopTracking();
  } catch {
    // The service may already have stopped during process teardown.
  }
};

export const getNativeTourLocationStatus = async (): Promise<NativeLocationStatus | null> => {
  if (!isNativeTourLocationAvailable) return null;
  try {
    return await nativeModule.getStatus();
  } catch {
    return null;
  }
};

export const getNativeTourLocationSamples = async (
  sinceTimestamp: number,
): Promise<NativeLocationSample[]> => {
  if (!isNativeTourLocationAvailable || typeof nativeModule?.getRecentLocations !== 'function') return [];
  try {
    const samples = await nativeModule.getRecentLocations(sinceTimestamp);
    return Array.isArray(samples) ? samples : [];
  } catch {
    return [];
  }
};

export type NativeTrackingSession = {
  tourId: string;
  userId: string;
  sampleIntervalMs: number;
  sampleMinDistanceMeters: number;
  heartbeatIntervalMs: number;
  maxAccuracyMeters: number;
  backgroundGpsIntervalMs: number;
  backgroundGpsMinDistanceMeters: number;
};

// Firestore upload from the native service (TourTrackingUploader.kt). False on
// iOS and on Android builds made before the uploader existed.
export const isNativeTrackingAvailable =
  isNativeTourLocationAvailable && typeof nativeModule?.startTrackingSession === 'function';

export const startNativeTrackingSession = async (
  session: NativeTrackingSession,
): Promise<boolean> => {
  if (!isNativeTrackingAvailable) return false;
  try {
    await nativeModule.startTrackingSession(session);
    return true;
  } catch {
    return false;
  }
};

export const stopNativeTrackingSession = async (reason: string): Promise<void> => {
  if (!isNativeTrackingAvailable) return;
  try {
    await nativeModule.stopTrackingSession(reason);
  } catch {
    // Nothing to stop.
  }
};

export const subscribeToNativeTourLocation = (
  listener: (status: NativeLocationStatus) => void,
) => {
  if (!isNativeTourLocationAvailable) return { remove: () => undefined };
  return DeviceEventEmitter.addListener('TourLocationEvent', listener);
};
