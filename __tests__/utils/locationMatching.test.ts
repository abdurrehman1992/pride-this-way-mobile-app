import { locationMatches } from '../../src/utils/locationMatching';

describe('locationMatches', () => {
  it('does not match a different city in the same country', () => {
    expect(locationMatches('Austin, United States', 'Denver', 'United States')).toBe(false);
  });

  it('matches the exact city when the selected location includes city and country', () => {
    expect(locationMatches('Austin, United States', 'Austin', 'United States')).toBe(true);
  });

  it('matches by country only when the user selected only a country', () => {
    expect(locationMatches('United States', '', 'United States')).toBe(true);
  });
});
