import type { PracticeStage } from '@/domain/practice'
import { cellColors, colors } from '@/ui/theme'

// The atom map's four colours, in the same order of progress: the progress
// table's cells and, spec (home menu) §2–3, Home's operation buttons and an
// operation's cards, so a stage looks the same wherever it is shown.
export const STAGE_COLOR: Record<PracticeStage, string> = {
  unseen: cellColors.unseen,
  beads: cellColors.learning,
  fading: cellColors.reflex,
  mental: cellColors.mental,
}

// Words drawn on a stage's colour: only the mental stage's dark background
// needs light text for contrast.
export function stageInk(stage: PracticeStage): string {
  return stage === 'mental' ? colors.paper : colors.ink
}
