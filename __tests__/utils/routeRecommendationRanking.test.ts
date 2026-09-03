import { compareRouteRecommendationRanking } from '../../src/utils/routeRecommendationRanking';

describe('compareRouteRecommendationRanking', () => {
  it('prioritizes the route with the most matching tags first', () => {
    const a = { matchedTagCount: 1, locationCount: 4, updatedAt: '2024-01-01' };
    const b = { matchedTagCount: 2, locationCount: 2, updatedAt: '2024-01-02' };

    expect(compareRouteRecommendationRanking(a, b)).toBeGreaterThan(0);
  });

  it('falls back to more locations when tag matches are equal', () => {
    const a = { matchedTagCount: 2, locationCount: 3, updatedAt: '2024-01-02' };
    const b = { matchedTagCount: 2, locationCount: 5, updatedAt: '2024-01-01' };

    expect(compareRouteRecommendationRanking(a, b)).toBeGreaterThan(0);
  });

  it('falls back to the latest route when tags and locations are equal', () => {
    const a = { matchedTagCount: 2, locationCount: 4, updatedAt: '2024-01-01' };
    const b = { matchedTagCount: 2, locationCount: 4, updatedAt: '2024-01-03' };

    expect(compareRouteRecommendationRanking(a, b)).toBeGreaterThan(0);
  });
});
