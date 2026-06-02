import { useEffect, useState } from 'react';
import { useDrawerStatus } from '@react-navigation/drawer';

import { fetchRewardsSummary } from '../services/myTourService';

export type DrawerRewards = {
  rewardPoints: number;
  visitedPlacesCount: number;
};

export const useDrawerRewardsRefresh = (
  userId?: string | null
): DrawerRewards => {
  const drawerStatus = useDrawerStatus();
  const [rewardPoints, setRewardPoints] = useState(0);
  const [visitedPlacesCount, setVisitedPlacesCount] = useState(0);

  useEffect(() => {
    if (drawerStatus !== 'open' || !userId) return;
    let isMounted = true;

    fetchRewardsSummary(userId)
      .then((summary) => {
        if (!isMounted) return;
        const visited = summary.tours.reduce(
          (sum, tour) =>
            sum + tour.places.filter((place) => place.visited).length,
          0
        );
        setRewardPoints(summary.totalPoints);
        setVisitedPlacesCount(visited);
      })
      .catch(() => {
        // Preserve previous values on failure — do not zero out.
      });

    return () => {
      isMounted = false;
    };
  }, [drawerStatus, userId]);

  return { rewardPoints, visitedPlacesCount };
};
