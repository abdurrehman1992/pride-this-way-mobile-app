export type RewardPointItem = {
  visited?: boolean;
  pointsEarned?: number | string | null;
};

export const getVisitedPointsForItem = (
  item?: RewardPointItem | null
): number => {
  if (!item || !item.visited) {
    return 0;
  }

  return Number(item.pointsEarned || 0);
};

export const sumVisitedPointsFromItems = (
  items: RewardPointItem[] = []
): number => items.reduce((sum, item) => sum + getVisitedPointsForItem(item), 0);
