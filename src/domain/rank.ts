// Spec (runs) §4: twenty ranks from the lifetime points, from rank 0
// (練習10級) to rank 19 (練習十段). Their names are the catalogues'.
export const RANK_COUNT = 20
export const TOP_RANK = RANK_COUNT - 1

// The points rank `rank` is reached at. Each step needs 40% more than the
// one before: the first comes within about one run, the last after months.
export function rankThreshold(rank: number): number {
  return Math.round((2500 * (1.4 ** rank - 1)) / 100) * 100
}

export function rankOf(points: number): number {
  let rank = 0
  while (rank < TOP_RANK && points >= rankThreshold(rank + 1)) rank++
  return rank
}

// From the rank's threshold to the next one's, 0 to 1. Past the top rank,
// points keep adding and the bar stays full.
export function rankProgress(points: number): number {
  const rank = rankOf(points)
  if (rank === TOP_RANK) return 1
  const from = rankThreshold(rank)
  return (points - from) / (rankThreshold(rank + 1) - from)
}

// The points still to earn for the next rank; 0 at the top.
export function pointsToNextRank(points: number): number {
  const rank = rankOf(points)
  return rank === TOP_RANK ? 0 : rankThreshold(rank + 1) - points
}
