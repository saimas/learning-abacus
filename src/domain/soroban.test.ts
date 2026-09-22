import { adjustRod, applyStep, emptySoroban, readRod, readValue, rodFor, setValue, tapBead, tapSoroban } from './soroban'

describe('rod', () => {
  it('reads 0 as no beads', () => {
    expect(readRod({ heaven: false, earth: 0 })).toBe(0)
  })

  it('reads the heaven bead as 5', () => {
    expect(readRod({ heaven: true, earth: 0 })).toBe(5)
  })

  it('reads heaven plus three earth as 8', () => {
    expect(readRod({ heaven: true, earth: 3 })).toBe(8)
  })

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('round-trips %i', (n) => {
    expect(readRod(rodFor(n))).toBe(n)
  })
})

describe('soroban', () => {
  it('starts empty', () => {
    expect(readValue(emptySoroban(2))).toBe(0)
  })

  it('round-trips a two-digit value', () => {
    expect(readValue(setValue(emptySoroban(2), 47))).toBe(47)
  })

  it('applies a step to the working rod', () => {
    const s = setValue(emptySoroban(2), 3)
    expect(readValue(applyStep(s, { rod: 'working', delta: 5 }, 1))).toBe(8)
  })

  it('applies a carry step to the rod on the left', () => {
    const s = setValue(emptySoroban(2), 7)
    expect(readValue(applyStep(s, { rod: 'carry', delta: 1 }, 1))).toBe(17)
  })
})

describe('error cases', () => {
  describe('rodFor guards', () => {
    it('throws on negative value', () => {
      expect(() => rodFor(-1)).toThrow()
    })

    it('throws on value above 9', () => {
      expect(() => rodFor(10)).toThrow()
    })

    it('throws on NaN', () => {
      expect(() => rodFor(NaN)).toThrow()
    })
  })

  describe('setValue guards', () => {
    it('throws on negative value', () => {
      expect(() => setValue(emptySoroban(2), -1)).toThrow()
    })

    it('throws on value too wide for rod count', () => {
      expect(() => setValue(emptySoroban(2), 470)).toThrow()
    })
  })

  describe('applyStep guards', () => {
    it('throws when carry step would go off left edge', () => {
      const s = setValue(emptySoroban(2), 0)
      expect(() => applyStep(s, { rod: 'carry', delta: 1 }, 0)).toThrow()
    })
  })
})

describe('tapBead', () => {
  it('toggles the heaven bead', () => {
    expect(tapBead(rodFor(2), { kind: 'heaven' })).toEqual(rodFor(7))
    expect(tapBead(rodFor(7), { kind: 'heaven' })).toEqual(rodFor(2))
  })

  it('pushes a resting earth bead to the beam with every bead in between', () => {
    expect(tapBead(rodFor(1), { kind: 'earth', index: 3 })).toEqual(rodFor(4))
  })

  it('lifts only the first resting bead when that is the one tapped', () => {
    expect(tapBead(rodFor(1), { kind: 'earth', index: 1 })).toEqual(rodFor(2))
  })

  it('sends a counted earth bead back with every bead beyond it', () => {
    expect(tapBead(rodFor(4), { kind: 'earth', index: 1 })).toEqual(rodFor(1))
    expect(tapBead(rodFor(9), { kind: 'earth', index: 0 })).toEqual(rodFor(5))
  })

  it('leaves the heaven bead where it is when an earth bead moves', () => {
    expect(tapBead(rodFor(6), { kind: 'earth', index: 2 })).toEqual(rodFor(8))
  })

  it('rejects a bead that does not exist', () => {
    expect(() => tapBead(rodFor(0), { kind: 'earth', index: 4 })).toThrow()
  })
})

describe('tapSoroban', () => {
  it('moves beads only on the rod that was tapped', () => {
    const s = setValue(emptySoroban(2), 7)
    expect(readValue(tapSoroban(s, 0, { kind: 'earth', index: 0 }))).toBe(17)
  })
})

describe('adjustRod', () => {
  it('steps one rod up or down by one', () => {
    const s = setValue(emptySoroban(2), 14)
    expect(readValue(adjustRod(s, 1, 1))).toBe(15)
    expect(readValue(adjustRod(s, 0, -1))).toBe(4)
  })

  it('stays within 0–9', () => {
    expect(readRod(adjustRod(setValue(emptySoroban(1), 9), 0, 1).rods[0] ?? rodFor(0))).toBe(9)
    expect(readRod(adjustRod(setValue(emptySoroban(1), 0), 0, -1).rods[0] ?? rodFor(9))).toBe(0)
  })
})
