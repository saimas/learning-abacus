import { pointsToNextRank, RANK_COUNT, rankOf, rankProgress, rankThreshold, TOP_RANK } from './rank'

// Spec (runs) §4: 2500 × (1.4^k − 1), to the nearest 100.
const THRESHOLDS = [
  0, 1_000, 2_400, 4_400, 7_100, 10_900, 16_300, 23_900, 34_400, 49_200, 69_800, 98_700, 139_200, 195_900,
  275_300, 386_400, 542_000, 759_800, 1_064_700, 1_491_600,
]

describe('rankThreshold', () => {
  it('needs 40% more for each rank than the one before', () => {
    expect(Array.from({ length: RANK_COUNT }, (_, rank) => rankThreshold(rank))).toEqual(THRESHOLDS)
    expect(TOP_RANK).toBe(19)
  })
})

describe('rankOf', () => {
  it.each([
    [0, 0],
    [999, 0],
    [1_000, 1],
    [2_399, 1],
    [2_400, 2],
    [1_491_599, 18],
    [1_491_600, 19],
    [9_999_999, 19],
  ])('ranks %p points as rank %p', (points, rank) => {
    expect(rankOf(points)).toBe(rank)
  })
})

describe('rankProgress', () => {
  it('measures from the rank\'s threshold to the next', () => {
    expect(rankProgress(0)).toBe(0)
    expect(rankProgress(500)).toBe(0.5)
    expect(rankProgress(1_700)).toBe(0.5)
  })

  it('stays full past the top rank', () => {
    expect(rankProgress(2_000_000)).toBe(1)
  })
})

describe('pointsToNextRank', () => {
  it('counts the points still to earn', () => {
    expect(pointsToNextRank(0)).toBe(1_000)
    expect(pointsToNextRank(2_500)).toBe(1_900)
    expect(pointsToNextRank(2_000_000)).toBe(0)
  })
})
