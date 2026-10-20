import Geolocation from '@react-native-community/geolocation';

const MAX_FIX_AGE_MS = 15_000;
const MAX_ACCURACY_METERS = 100;

// A one-shot request can return the first coarse fix and stop. Keep listening
// briefly so a cold GPS has time to refine it, then always release the watch.
export const waitForVerificationLocation = (
  timeoutMs = 12_000,
): Promise<[number, number] | null> => new Promise((resolve) => {
  let watchId: number | null = null;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const finish = (coordinate: [number, number] | null) => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    if (watchId !== null) Geolocation.clearWatch(watchId);
    resolve(coordinate);
  };

  const acceptPosition = (position: { coords?: { latitude?: number; longitude?: number; accuracy?: number }; timestamp?: number }) => {
    const latitude = Number(position.coords?.latitude);
    const longitude = Number(position.coords?.longitude);
    const accuracy = Number(position.coords?.accuracy);
    const timestamp = Number(position.timestamp);
    const ageMs = Date.now() - timestamp;
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_ACCURACY_METERS ||
      (timestamp > 0 && (ageMs > MAX_FIX_AGE_MS || ageMs < -5_000))
    ) return;

    finish([longitude, latitude]);
  };
  const handleError = (error: { code?: number }) => {
    // Cold GPS can emit a temporary POSITION_UNAVAILABLE or TIMEOUT
    // before its next fix. Only a permission denial ends this attempt.
    if (Number(error?.code) === 1) finish(null);
  };
  const options = {
    enableHighAccuracy: true,
    maximumAge: 0,
    distanceFilter: 0,
    interval: 1000,
    fastestInterval: 500,
    timeout: timeoutMs,
  };

  timer = setTimeout(() => finish(null), timeoutMs);
  try {
    const id = Geolocation.watchPosition(acceptPosition, handleError, options);
    watchId = id;
    if (finished) {
      Geolocation.clearWatch(id);
    } else {
      // A fresh one-shot request also helps on devices whose existing watcher
      // suppresses stationary updates. Either source can complete the attempt.
      Geolocation.getCurrentPosition(acceptPosition, handleError, options);
    }
  } catch {
    finish(null);
  }
});
