import { useEffect, useState } from 'react';

import { fetchRewardsSummary } from '../services/myTourService';

export type DrawerRewards = {
  rewardPoints: number;
  visitedPlacesCount: number;
};

export const useDrawerRewardsRefresh = (
  userId: string | null | undefined,
  initialPoints: number,
  navigation: {
    addListener: (
      event: 'transitionEnd',
      listener: (event: { data?: { closing?: boolean } }) => void
    ) => () => void;
  }
): DrawerRewards => {
  const [rewardPoints, setRewardPoints] = useState(initialPoints);
  const [visitedPlacesCount, setVisitedPlacesCount] = useState(0);

  useEffect(() => {
    setRewardPoints(initialPoints);
  }, [initialPoints, userId]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    let requestId = 0;

    const refresh = () => {
      const currentRequest = ++requestId;
      fetchRewardsSummary(userId)
        .then((summary) => {
          if (!isMounted || currentRequest !== requestId) return;
          const visited = summary.tours.reduce(
            (sum, tour) =>
              sum + tour.places.filter((place) => place.visited).length,
            0
          );
          setRewardPoints(summary.totalPoints);
          setVisitedPlacesCount(visited);
        })
        .catch(() => {
          // Preserve previous values on failure.
        });
    };

    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data?.closing) refresh();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigation, userId]);

  return { rewardPoints, visitedPlacesCount };
};
