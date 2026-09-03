import { buildRecommendationQueryKey } from '../../src/utils/recommendationQuery';
import {
  isGenericRecommendationTitle,
  buildExactImageKeyword,
} from '../../src/utils/recommendationData';

describe('buildRecommendationQueryKey', () => {
  it('sorts and normalizes prefs so repeated toggles reuse the same query key', () => {
    expect(
      buildRecommendationQueryKey('Lahore, Pakistan', ['Food', 'Museum', 'Food'])
    ).toBe('lahore, pakistan|food,museum');
  });

  it('keeps location and prefs stable when none are selected', () => {
    expect(buildRecommendationQueryKey('', [])).toBe('');
  });
});

describe('recommendation data quality', () => {
  it('rejects generic fallback titles before they reach the UI', () => {
    expect(isGenericRecommendationTitle('City Food Spot')).toBe(true);
    expect(isGenericRecommendationTitle('Badshahi Mosque')).toBe(false);
  });

  it('builds a place-specific image keyword using title and location', () => {
    expect(
      buildExactImageKeyword('Bear Grill Cafe', 'Lahore, Pakistan', 'Cafe', 'cafe')
    ).toBe('Bear Grill Cafe Lahore, Pakistan');
  });
});
