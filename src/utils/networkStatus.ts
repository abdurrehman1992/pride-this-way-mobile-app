import { useEffect, useState } from 'react';

export async function checkInternetConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    await fetch('https://www.google.com', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);
    return true;
  } catch (_error) {
    return false;
  }
}

export function useInternetConnectivity() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncStatus = async () => {
      const nextState = await checkInternetConnection();
      if (isMounted) {
        setIsOnline(nextState);
      }
    };

    syncStatus();
    const interval = setInterval(syncStatus, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}
