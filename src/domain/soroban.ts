export const ROD_MAX = 9

export type Rod = { heaven: boolean; earth: number }
export type Soroban = { rods: Rod[] }
export type RodStep = { rod: 'working' | 'carry'; delta: number }

export function readRod(rod: Rod): number {
  return (rod.heaven ? 5 : 0) + rod.earth
}

export function rodFor(value: number): Rod {
  if (!Number.isInteger(value) || value < 0 || value > ROD_MAX) throw new Error(`rod value out of range: ${value}`)
  return { heaven: value >= 5, earth: value % 5 }
}

export function emptySoroban(rodCount: number): Soroban {
  return { rods: Array.from({ length: rodCount }, () => rodFor(0)) }
}

export function readValue(s: Soroban): number {
  return s.rods.reduce((acc, rod) => acc * 10 + readRod(rod), 0)
}

export function setValue(s: Soroban, n: number): Soroban {
  if (!Number.isInteger(n) || n < 0 || String(n).length > s.rods.length) throw new Error(`value does not fit ${s.rods.length} rods: ${n}`)
  const digits = String(n).padStart(s.rods.length, '0').split('')
  return { rods: digits.map((d) => rodFor(Number(d))) }
}

export function applyStep(s: Soroban, step: RodStep, workingIndex: number): Soroban {
  const index = step.rod === 'working' ? workingIndex : workingIndex - 1
  const target = s.rods[index]
  if (target === undefined) throw new Error(`no rod at index ${index}`)
  const next = readRod(target) + step.delta
  if (next < 0 || next > ROD_MAX) throw new Error(`step leaves rod out of range: ${next}`)
  const rods = [...s.rods]
  rods[index] = rodFor(next)
  return { rods }
}

const EARTH_BEADS = 4

// Which bead a tap lands on. Earth bead 0 is the one nearest the beam.
export type BeadRef = { kind: 'heaven' } | { kind: 'earth'; index: number }

// A tap moves beads the way a finger does on a real soroban: pushing a bead
// toward the beam pushes every bead between it and the beam along with it,
// and pulling a counted bead away takes every bead beyond it too.
export function tapBead(rod: Rod, bead: BeadRef): Rod {
  if (bead.kind === 'heaven') return { ...rod, heaven: !rod.heaven }
  if (!Number.isInteger(bead.index) || bead.index < 0 || bead.index >= EARTH_BEADS) {
    throw new Error(`no earth bead at index ${bead.index}`)
  }
  if (bead.index < rod.earth) return { ...rod, earth: bead.index }
  return { ...rod, earth: bead.index + 1 }
}

function replaceRod(s: Soroban, rodIndex: number, change: (rod: Rod) => Rod): Soroban {
  const target = s.rods[rodIndex]
  if (target === undefined) throw new Error(`no rod at index ${rodIndex}`)
  const rods = [...s.rods]
  rods[rodIndex] = change(target)
  return { rods }
}

export function tapSoroban(s: Soroban, rodIndex: number, bead: BeadRef): Soroban {
  return replaceRod(s, rodIndex, (rod) => tapBead(rod, bead))
}

// VoiceOver treats each rod as an adjustable value: one swipe moves it by
// one, staying within 0–9.
export function adjustRod(s: Soroban, rodIndex: number, delta: number): Soroban {
  return replaceRod(s, rodIndex, (rod) => rodFor(Math.min(ROD_MAX, Math.max(0, readRod(rod) + delta))))
}
