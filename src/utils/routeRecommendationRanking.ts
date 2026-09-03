export type RankedRouteCandidate = {
  matchedTagCount: number;
  locationCount: number;
  updatedAt?: string | number | null;
};

export const compareRouteRecommendationRanking = (
  a: RankedRouteCandidate,
  b: RankedRouteCandidate
) => {
  const tagMatchDiff = b.matchedTagCount - a.matchedTagCount;
  if (tagMatchDiff !== 0) {
    return tagMatchDiff;
  }

  const locationCountDiff = b.locationCount - a.locationCount;
  if (locationCountDiff !== 0) {
    return locationCountDiff;
  }

  const parseUpdatedAt = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numericValue = typeof value === 'number' ? value : new Date(value).getTime();
    return Number.isFinite(numericValue) ? numericValue : 0;
  };

  const aTime = parseUpdatedAt(a.updatedAt);
  const bTime = parseUpdatedAt(b.updatedAt);
  if (bTime !== aTime) {
    return bTime - aTime;
  }

  return 0;
};
