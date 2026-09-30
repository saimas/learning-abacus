import type { FadeVisual } from '@/domain/fade'

// How much of the beads each fade step shows. The beads alone take this
// opacity, inside each rod (Rod.tsx); the frame and the rods' tap surfaces
// never do.
export const BEAD_OPACITY: Record<FadeVisual, number> = {
  solid: 1,
  dim: 0.35,
  ghost: 0.12,
  frame: 0,
  hidden: 0,
}

export function showsFrame(visual: FadeVisual): boolean {
  return visual !== 'hidden'
}
