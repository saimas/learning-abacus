import { emptySoroban, readRod, readValue, rodFor, setValue, applyStep } from './soroban'

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
