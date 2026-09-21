import { useEffect, useRef } from 'react';
import { showInfo } from '../components/common/AppToast';
import { subscribeToActiveTourIds } from '../services/myTourService';
import {
  registerPushToken,
  subscribeToPushTokenRefresh,
  subscribeToTrackingAlerts,
} from '../services/pushNotificationService';
import {
  handleActiveTourIds,
  stopTourTrackingForSignOut,
} from '../services/tourTrackingService';
import { stopNativeTourLocation } from '../utils/nativeTourLocation';

/**
 * App-level side of tour location tracking for the signed-in user: FCM token
 * registration, tracking alerts received in the foreground, and stopping
 * tracking when the active tour ends outside the tour screen.
 */
export const useTourTrackingLifecycle = (userId?: string) => {
  const previousUserIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;

    if (!userId) {
      // Signed out without logoutUser (for example the account was removed).
      if (previousUserId) {
        stopTourTrackingForSignOut();
        stopNativeTourLocation();
      }
      return;
    }

    registerPushToken(userId).catch(() => undefined);
    const unsubscribeTokenRefresh = subscribeToPushTokenRefresh(userId);
    const unsubscribeAlerts = subscribeToTrackingAlerts((title, body) => {
      showInfo(title || 'Location tracking', body);
    });
    const unsubscribeActiveTours = subscribeToActiveTourIds(userId, handleActiveTourIds);

    return () => {
      unsubscribeTokenRefresh();
      unsubscribeAlerts();
      unsubscribeActiveTours();
    };
  }, [userId]);
};
