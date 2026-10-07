// The palette and type scale. Every colour on screen comes from here, so a
// dark variant later is a second set of values, not an edit to every
// component. The screens are sakura pastel (the owner, 2026-10-07: "make the
// UI color more like pastel"); the soroban keeps its walnut and lacquer, and
// reads only its own tokens below. Every text colour is at least 4.5:1 on
// whatever it sits on. Text is dark, except paper-coloured text on ink and on
// the mental stage.
export const colors = {
  paper: '#FFF5F2',
  card: '#FFFFFF',
  cardLine: '#F2D9D3',
  soft: '#FCEBE7',
  track: '#F5E1DC',
  keyEdge: '#EFD3CD',
  ink: '#3A2E2E',
  muted: '#78625E',
  // The deep rose, for accent text, borders and thin marks. A pastel alone
  // is too faint to read.
  accent: '#AE4842',
  // The sakura pastel, behind primary buttons and the stamped seal, which
  // carry dark onAccent text.
  accentFill: '#F4A9A2',
  // 2pt bottom edge under accentFill buttons.
  accentShadow: '#E3918A',
  // Behind the step of an explanation that the learner has just stepped to,
  // and other light accent shading such as the correction card's.
  accentSoft: '#FDE3DF',
  // A sum that comes off in the division walkthrough shows ✓ in it, as one
  // that won't shows ✗ in the accent. The app had no green.
  ok: '#357A50',
  onAccent: '#3A2E2E',
  frameTop: '#6E4A2F',
  frameBottom: '#4E3220',
  deck: '#EFE3CC',
  rod: '#9C7A55',
  beam: '#4A2F1C',
  beadHighlight: '#6B4028',
  bead: '#3A2014',
  beadShade: '#24130B',
  // While stepping, the beads of the operation on show are red instead of
  // wood (the owner's request, 2026-09-23), lit the same way. The latest
  // step's beads are the deepest, shading from beadLatest to
  // beadLatestShade. The operation's earlier beads are that red mixed with
  // the old washi paper (#F4EEE2), lighter but still dark enough to read
  // against the deck. The soroban's reds are its own, the vermilion it was
  // tuned with, so the screens' pastel accent doesn't wash them out.
  beadLatestHighlight: '#C26450',
  beadLatest: '#B5412C',
  beadLatestShade: '#8E3322',
  beadGroupHighlight: '#D8A090',
  beadGroup: '#C87563',
  beadGroupShade: '#BB523E',
  // The band behind a rod the explanation points at, and the dot on the
  // ones rod's beam: the soroban's own, so the screens' palette leaves it be.
  rodHighlight: '#F6DDD6',
  unitDot: '#F4EEE2',
  shadow: '#3C2314',
} as const

// Lightness only, deepening as a move is learned, so the map reads under
// every kind of colour blindness. Keyed like CellState in
// src/domain/progress.ts.
export const cellColors = {
  unseen: '#F3DCD7',
  learning: '#F5BDB5',
  reflex: '#D8877F',
  mental: '#8E4A45',
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
