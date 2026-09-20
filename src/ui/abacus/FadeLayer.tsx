import type { ReactNode } from 'react'
import { View } from 'react-native'
import { visualForFade, type FadeLevel, type FadeVisual } from '@/domain/fade'

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

export function FadeLayer({ level, children }: { level: FadeLevel; children: ReactNode }) {
  const visual = visualForFade(level)
  return (
    <View testID="fade-layer" style={{ opacity: BEAD_OPACITY[visual] }}>
      {children}
    </View>
  )
}
