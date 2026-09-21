import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'
import { colors } from '@/ui/theme'

export type IconName = 'grid' | 'gear' | 'close' | 'back' | 'delete'

// Outline icons after Feather (MIT licence), on Feather's 24×24 grid.
const GEAR =
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'

function Shapes({ name, color }: { name: IconName; color: string }) {
  const s = {
    stroke: color,
    strokeWidth: 1.8,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  switch (name) {
    case 'grid':
      return (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1.5" {...s} />
          <Rect x="14" y="3" width="7" height="7" rx="1.5" {...s} />
          <Rect x="3" y="14" width="7" height="7" rx="1.5" {...s} />
          <Rect x="14" y="14" width="7" height="7" rx="1.5" {...s} />
        </>
      )
    case 'gear':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...s} />
          <Path d={GEAR} {...s} />
        </>
      )
    case 'close':
      return (
        <>
          <Line x1="18" y1="6" x2="6" y2="18" {...s} />
          <Line x1="6" y1="6" x2="18" y2="18" {...s} />
        </>
      )
    case 'back':
      return <Polyline points="15 18 9 12 15 6" {...s} />
    case 'delete':
      return (
        <>
          <Path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" {...s} />
          <Line x1="18" y1="9" x2="12" y2="15" {...s} />
          <Line x1="12" y1="9" x2="18" y2="15" {...s} />
        </>
      )
  }
}

export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName
  size?: number
  color?: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Shapes name={name} color={color} />
    </Svg>
  )
}
