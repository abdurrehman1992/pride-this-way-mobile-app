import { sumVisitedPointsFromItems } from '../../src/utils/rewardPoints';

describe('sumVisitedPointsFromItems', () => {
  it('ignores points for places that have not been visited yet', () => {
    const result = sumVisitedPointsFromItems([
      { visited: false, pointsEarned: 30 },
      { visited: true, pointsEarned: 20 },
      { visited: false, pointsEarned: 50 },
    ]);

    expect(result).toBe(20);
  });

  it('returns zero when none of the places have been visited', () => {
    expect(
      sumVisitedPointsFromItems([
        { visited: false, pointsEarned: 30 },
        { visited: false, pointsEarned: 50 },
      ])
    ).toBe(0);
  });
});
