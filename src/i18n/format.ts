// Points with thousands separators (1,240), the same in both catalogues.
export function formatPoints(points: number): string {
  return String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
