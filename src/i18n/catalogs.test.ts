import { ATOMS, atomId, classify, type Atom, type Direction } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import { en } from './en'
import { ja } from './ja'
import { LOCALES } from './locale'

const ALL = { ja, en }

// Same helper as src/domain/explain.test.ts, so the atoms here are built the
// way the domain's own tests build them.
function atom(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

describe('catalog parity', () => {
  it('covers every locale', () => {
    expect(Object.keys(ALL).sort()).toEqual([...LOCALES].sort())
  })

  // `Strings = typeof ja` already makes a missing key a compile error. This
  // catches the case types cannot: a key present but of the wrong kind, or a
  // function that silently takes fewer arguments than its Japanese twin.
  it('gives every key the same kind and arity in both catalogs', () => {
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const left = ja[key]
      const right = en[key]
      expect(typeof right).toBe(typeof left)
      if (typeof left === 'function' && typeof right === 'function') {
        expect(right.length).toBe(left.length)
      }
    }
  })

  it('leaves no constant entry blank', () => {
    for (const catalog of Object.values(ALL)) {
      for (const value of Object.values(catalog)) {
        if (typeof value === 'string') expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('coaching', () => {
  it('names the technique in Japanese for every class and direction', () => {
    // The six atoms are the ones src/domain/explain.test.ts already pins
    // describeSteps against, so only the Japanese wrapper is new here.
    expect(ja.coaching(atom(1, 3, 'add'))).toBe('3をたす = +3')
    expect(ja.coaching(atom(3, 4, 'add'))).toBe('五の合成：4をたす = +5 − 1')
    expect(ja.coaching(atom(7, 8, 'add'))).toBe('十の繰上：8をたす = +10 − 2')
    expect(ja.coaching(atom(6, 4, 'sub'))).toBe('五の分解：4をひく = −5 + 1')
    expect(ja.coaching(atom(7, 8, 'sub'))).toBe('十の繰下：8をひく = −10 + 2')
    expect(ja.coaching(atom(7, 6, 'add'))).toBe('十の繰上と五の分解：6をたす = +10 − 5 + 1')
    expect(ja.coaching(atom(2, 6, 'sub'))).toBe('十の繰下と五の合成：6をひく = −10 + 5 − 1')
  })

  // Spec §3 (curriculum design): the rewiring has happened when "add 8" *means* "+10 − 2" and never means "8". The sentence is the substitution, stated as an identity.
  it('keeps the English wording that explainMove had', () => {
    expect(en.coaching(atom(7, 8, 'add'))).toBe('Add 8 = +10 − 2')
    expect(en.coaching(atom(6, 4, 'sub'))).toBe('Subtract 4 = −5 + 1')
  })

  // Every one of the 180 atoms has to produce a sentence; a hole in the
  // TECHNIQUE table would otherwise only surface on the learner's screen.
  it('produces a non-empty sentence for all 180 atoms in both locales', () => {
    for (const a of ATOMS) {
      expect(ja.coaching(a).length).toBeGreaterThan(0)
      expect(en.coaching(a).length).toBeGreaterThan(0)
    }
  })

  it('prefixes a technique name for every class except direct', () => {
    for (const a of ATOMS) {
      const named = ja.coaching(a).includes('：')
      expect(named).toBe(classify(a) !== 'direct')
    }
  })
})

describe('breakdown, via readingFeedback', () => {
  it('reads a heaven-and-earth rod without a plural in Japanese', () => {
    expect(ja.readingFeedback(6)).toBe('ちがいます。このけたは6です。五珠と一珠1つで 5 + 1。')
  })

  it('reads a bare heaven bead', () => {
    expect(ja.readingFeedback(5)).toContain('五珠だけ')
  })

  it('reads an empty rod', () => {
    expect(ja.readingFeedback(0)).toContain('珠がひとつも入っていません')
  })

  it('keeps the English singular and plural', () => {
    expect(en.readingFeedback(1)).toContain('1 earth bead.')
    expect(en.readingFeedback(3)).toContain('3 earth beads')
  })
})

describe('cellLabel', () => {
  it('translates the cell state', () => {
    expect(ja.cellLabel('7+8', 'mental')).toBe('7+8 暗算')
    expect(ja.cellLabel('7+8', 'unseen')).toBe('7+8 未学習')
    expect(en.cellLabel('7+8', 'mental')).toBe('7+8 mental')
  })
})

describe('sealDays', () => {
  it('stacks the count over its unit', () => {
    expect(ja.sealDays(12)).toBe('12\n日')
    expect(en.sealDays(12)).toBe('12\ndays')
  })

  it('keeps the English singular', () => {
    expect(en.sealDays(1)).toBe('1\nday')
  })
})

describe('blockLabel', () => {
  it('names every block kind in both locales', () => {
    for (const kind of ['warmup', 'focus', 'faderep', 'close'] as const) {
      expect(ja.blockLabel(kind).length).toBeGreaterThan(0)
      expect(en.blockLabel(kind).length).toBeGreaterThan(0)
    }
  })

  it('calls fade rep the anzan block in Japanese', () => {
    expect(ja.blockLabel('faderep')).toBe('暗算')
  })
})

describe('correctionAnswer', () => {
  it('states the answer', () => {
    expect(ja.correctionAnswer(11)).toBe('こたえは 11')
    expect(en.correctionAnswer(11)).toBe('The answer is 11')
  })
})

describe('cellStateName', () => {
  it('uses the same names as the cell labels', () => {
    expect(ja.cellStateName('mental')).toBe('暗算')
    expect(en.cellStateName('unseen')).toBe('unseen')
  })
})

describe('prompt', () => {
  it('reads the start value, so a borrowing subtraction starts at 13', () => {
    expect(ja.prompt(atom(3, 5, 'sub'))).toBe('13から5をひく。')
    expect(ja.prompt(atom(7, 4, 'add'))).toBe('7に4をたす。')
    expect(en.prompt(atom(3, 5, 'sub'))).toBe('The soroban shows 13. Subtract 5.')
    expect(en.prompt(atom(7, 4, 'add'))).toBe('The soroban shows 7. Add 4.')
  })
})

describe('rodName', () => {
  it('names the ones and tens rods', () => {
    expect(ja.rodName(0)).toBe('一の位')
    expect(ja.rodName(1)).toBe('十の位')
    expect(en.rodName(0)).toBe('ones rod')
    expect(en.rodName(1)).toBe('tens rod')
  })
})

// Spec (miss review) §5: the answer card prints the lead, then each step as
// its own span, and has to read exactly as the coaching sentence does.
describe('coachingLead', () => {
  it('is the coaching sentence up to its steps, for all 180 atoms in both locales', () => {
    for (const a of ATOMS) {
      expect(`${ja.coachingLead(a)}${describeSteps(a)}`).toBe(ja.coaching(a))
      expect(`${en.coachingLead(a)}${describeSteps(a)}`).toBe(en.coaching(a))
    }
  })

  it('names the technique and the move', () => {
    expect(ja.coachingLead(atom(7, 8, 'add'))).toBe('十の繰上：8をたす = ')
    expect(ja.coachingLead(atom(1, 3, 'add'))).toBe('3をたす = ')
    expect(en.coachingLead(atom(7, 8, 'add'))).toBe('Add 8 = ')
  })
})

describe('the review step', () => {
  it('labels its buttons and announces a miss', () => {
    expect(ja.showAnswer).toBe('こたえを見る')
    expect(ja.watchAgain).toBe('もう一度見る')
    expect(ja.next).toBe('つぎへ')
    expect(ja.wrong).toBe('ちがいます')
    expect(en.showAnswer).toBe('See answer')
    expect(en.watchAgain).toBe('Watch again')
    expect(en.next).toBe('Next')
    expect(en.wrong).toBe('Not quite')
  })

  it('counts the steps of a replay', () => {
    expect(ja.replayStep(1, 2)).toBe('1 / 2')
    expect(en.replayStep(1, 2)).toBe('1 / 2')
  })
})
