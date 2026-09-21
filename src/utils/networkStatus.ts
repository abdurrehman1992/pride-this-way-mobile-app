import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

NetInfo.configure({
  reachabilityUrl: 'https://clients3.google.com/generate_204',
  reachabilityTest: async (response) => response.status === 204,
  reachabilityLongTimeout: 60_000,
  reachabilityShortTimeout: 5_000,
  reachabilityRequestTimeout: 5_000,
  useNativeReachability: true,
  shouldFetchWiFiSSID: false,
});

const hasInternet = (state: NetInfoState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

export async function checkInternetConnection(): Promise<boolean> {
  try {
    // Refresh reads the native state at action time, so toggling data/Wi-Fi
    // immediately before Start or Resume cannot reuse an old polling result.
    const state = await NetInfo.refresh();
    return hasInternet(state);
  } catch (_error) {
    return false;
  }
}

export function useInternetConnectivity() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(hasInternet(state));
    });

    NetInfo.refresh()
      .then((state) => setIsOnline(hasInternet(state)))
      .catch(() => setIsOnline(false));

    return unsubscribe;
  }, []);

  return isOnline;
}
