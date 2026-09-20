export const ROD_MAX = 9

export type Rod = { heaven: boolean; earth: number }
export type Soroban = { rods: Rod[] }
export type RodStep = { rod: 'working' | 'carry'; delta: number }

export function readRod(rod: Rod): number {
  return (rod.heaven ? 5 : 0) + rod.earth
}

export function rodFor(value: number): Rod {
  if (value < 0 || value > ROD_MAX) throw new Error(`rod value out of range: ${value}`)
  return { heaven: value >= 5, earth: value % 5 }
}

export function emptySoroban(rodCount: number): Soroban {
  return { rods: Array.from({ length: rodCount }, () => rodFor(0)) }
}

export function readValue(s: Soroban): number {
  return s.rods.reduce((acc, rod) => acc * 10 + readRod(rod), 0)
}

export function setValue(s: Soroban, n: number): Soroban {
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
