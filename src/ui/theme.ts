// The 和紙と木 palette and type scale. Every colour on screen comes from here,
// so a dark "lacquer" variant later is a second set of values, not an edit to
// every component.
export const colors = {
  paper: '#F4EEE2',
  card: '#FBF7EF',
  cardLine: '#E4D8C3',
  soft: '#EAE1D0',
  track: '#E2D8C6',
  keyEdge: '#D6C8B0',
  ink: '#2A2320',
  muted: '#7A6D61',
  accent: '#B5412C',
  accentShadow: '#8E3322',
  onAccent: '#FFF8F0',
  frameTop: '#6E4A2F',
  frameBottom: '#4E3220',
  deck: '#EFE3CC',
  rod: '#9C7A55',
  beam: '#4A2F1C',
  beadHighlight: '#6B4028',
  bead: '#3A2014',
  beadShade: '#24130B',
  shadow: '#3C2314',
} as const

// Lightness only, darkening as a move is learned, so the map reads under
// every kind of colour blindness. Keyed like CellState in
// src/ui/progress/AtomGrid.tsx.
export const cellColors = {
  unseen: '#E6DCCB',
  learning: '#E0BE7E',
  reflex: '#B8743F',
  mental: '#4E3220',
} as const

// Hiragino Mincho ships with iOS, so nothing is bundled or loaded. Body text
// stays on the system font, which is Hiragino Sans for Japanese.
export const fonts = {
  display: 'HiraMinProN-W6',
} as const

export const fontSizes = {
  display: 30,
  prompt: 28,
  title: 20,
  body: 15,
  small: 13,
  caption: 11,
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const

export const radius = { panel: 10, key: 12, card: 14 } as const
