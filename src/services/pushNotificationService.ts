import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

const USERS_COLLECTION = 'users';
// Read by the backend (functions/src/index.ts) to deliver tracking alerts.
const FCM_TOKENS_FIELD = 'fcmTokens';
export const TOUR_TRACKING_ALERT_TYPE = 'tour_tracking_unavailable';

const DELETE_TOKEN_TIMEOUT_MS = 3_000;

const saveToken = (userId: string, token: string) =>
  firestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .set(
      {
        [FCM_TOKENS_FIELD]: firestore.FieldValue.arrayUnion(token),
        fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

/** Stores this device's FCM token on the user document. Never prompts. */
export const registerPushToken = async (userId: string) => {
  const token = await messaging().getToken();
  if (token) {
    await saveToken(userId, token);
  }
};

export const subscribeToPushTokenRefresh = (userId: string) =>
  messaging().onTokenRefresh((token) => {
    saveToken(userId, token).catch(() => undefined);
  });

/**
 * Asks for permission to show notifications. Android 13+ is requested with
 * the tour location permissions (utils/location.ts), so only check it here.
 */
export const requestPushPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
};

/** Stops alerts for this device before sign-out. Must not block logout. */
export const unregisterPushToken = async (userId: string) => {
  const token = await messaging().getToken().catch(() => null);
  if (token) {
    // Not awaited: Firestore resolves only after a server ack, which never
    // comes while offline.
    firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .set({ [FCM_TOKENS_FIELD]: firestore.FieldValue.arrayRemove(token) }, { merge: true })
      .catch(() => undefined);
  }

  // Invalidates the token server-side as well, so the backend prunes it even
  // if the write above never reaches Firestore.
  await Promise.race([
    messaging().deleteToken(),
    new Promise<void>((resolve) => setTimeout(resolve, DELETE_TOKEN_TIMEOUT_MS)),
  ]).catch(() => undefined);
};

/**
 * The OS displays notification messages while the app is in the background or
 * closed. In the foreground they are delivered here instead.
 */
export const subscribeToTrackingAlerts = (
  onAlert: (title: string, body: string) => void
) =>
  messaging().onMessage(async (message) => {
    if (message.data?.type !== TOUR_TRACKING_ALERT_TYPE) return;
    onAlert(message.notification?.title || '', message.notification?.body || '');
  });
