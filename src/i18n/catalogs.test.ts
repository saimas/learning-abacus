import { ATOMS, atomId, classify, type Atom, type Direction } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import { lessonById, type Lesson } from '@/domain/lessons'
import type { FlashProblem, MitoriProblem, StepSection } from '@/domain/problem'
import { en } from './en'
import { formatPoints } from './format'
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

// A move's coaching sentence, as a ＋ − or 見取算 step line reads it after
// its rod's name (spec (roll) §2: the single-move card that also used it is
// gone, the sentence is not).
const jaMove = (a: Atom) => ja.columnLine(0, a, false).replace(/^一の位　/, '')
const enMove = (a: Atom) => en.columnLine(0, a, false).replace(/^Ones: /, '')

describe('a move’s coaching sentence', () => {
  it('names the technique in Japanese for every class and direction', () => {
    // The six atoms are the ones src/domain/explain.test.ts already pins
    // describeSteps against, so only the Japanese wrapper is new here.
    expect(jaMove(atom(1, 3, 'add'))).toBe('3をたす = +3')
    expect(jaMove(atom(3, 4, 'add'))).toBe('五の合成：4をたす = +5 − 1')
    expect(jaMove(atom(7, 8, 'add'))).toBe('十の繰上：8をたす = +10 − 2')
    expect(jaMove(atom(6, 4, 'sub'))).toBe('五の分解：4をひく = −5 + 1')
    expect(jaMove(atom(7, 8, 'sub'))).toBe('十の繰下：8をひく = −10 + 2')
    expect(jaMove(atom(7, 6, 'add'))).toBe('十の繰上と五の分解：6をたす = +10 − 5 + 1')
    expect(jaMove(atom(2, 6, 'sub'))).toBe('十の繰下と五の合成：6をひく = −10 + 5 − 1')
  })

  // Spec §3 (curriculum design): the rewiring has happened when "add 8" *means* "+10 − 2" and never means "8". The sentence is the substitution, stated as an identity.
  it('keeps the English wording that explainMove had', () => {
    expect(enMove(atom(7, 8, 'add'))).toBe('Add 8 = +10 − 2')
    expect(enMove(atom(6, 4, 'sub'))).toBe('Subtract 4 = −5 + 1')
  })

  // Every one of the 180 atoms has to produce a sentence; a hole in the
  // TECHNIQUE table would otherwise only surface on the learner's screen.
  it('produces a sentence ending in its steps for all 180 atoms in both locales', () => {
    for (const a of ATOMS) {
      expect(jaMove(a).endsWith(describeSteps(a))).toBe(true)
      expect(enMove(a).endsWith(describeSteps(a))).toBe(true)
    }
  })

  it('prefixes a technique name for every class except direct', () => {
    for (const a of ATOMS) {
      const named = jaMove(a).includes('：')
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

describe('sealDays', () => {
  it('stacks the count over its unit', () => {
    expect(ja.sealDays(12)).toBe('12\n日')
    expect(en.sealDays(12)).toBe('12\ndays')
  })

  it('keeps the English singular', () => {
    expect(en.sealDays(1)).toBe('1\nday')
  })
})

describe('correctionAnswer', () => {
  it('states the answer', () => {
    expect(ja.correctionAnswer(11)).toBe('こたえは 11')
    expect(en.correctionAnswer(11)).toBe('The answer is 11')
  })
})

// The owner (2026-09-29): a miss on the beads names what the learner's
// beads read beside the answer, once the steps have taken them over.
describe('correctionWithGiven', () => {
  it('names the learner’s answer beside the answer', () => {
    expect(ja.correctionWithGiven('こたえは 81', 80)).toBe('こたえは 81　あなたの答え 80')
    expect(en.correctionWithGiven('The answer is 81', 80)).toBe('The answer is 81 · you answered 80')
  })

  it('reads the number shown under answered beads aloud as the learner’s answer', () => {
    expect(ja.beadReadingLabel(800)).toBe('あなたの答え 800')
    expect(en.beadReadingLabel(800)).toBe('You answered 800')
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
describe('the review step', () => {
  it('labels its buttons and announces a miss', () => {
    expect(ja.showAnswer).toBe('こたえを見る')
    expect(ja.next).toBe('つぎへ')
    expect(ja.wrong).toBe('ちがいます')
    expect(en.showAnswer).toBe('See answer')
    expect(en.next).toBe('Next')
    expect(en.wrong).toBe('Not quite')
  })

  it('counts the steps of a replay', () => {
    expect(ja.replayStep(1, 2)).toBe('1 / 2')
    expect(en.replayStep(1, 2)).toBe('1 / 2')
  })

  it('labels the step panel', () => {
    expect(ja.stepsOpen).toBe('手順を見る')
    expect(en.stepRestart).toBe('From the start')
  })
})

describe('multi-digit strings', () => {
  it('prompts a problem', () => {
    expect(ja.problemPrompt({ op: 'add', digits: 3, a: 472, b: 385 })).toBe('472に385をたす。')
    expect(ja.problemPrompt({ op: 'sub', digits: 2, a: 81, b: 36 })).toBe('81から36をひく。')
    expect(ja.problemPrompt({ op: 'mul', digits: 2, a: 47, b: 36 })).toBe('47に36をかける。')
    expect(ja.problemPrompt({ op: 'div', digits: 2, a: 1692, b: 36 })).toBe('1692を36でわる。')
    expect(en.problemPrompt({ op: 'div', digits: 2, a: 1692, b: 36 })).toBe('Divide 1692 by 36.')
  })

  // Spec (見取算) §4: the column's VoiceOver label.
  it('prompts a 見取算 column as one sentence', () => {
    const column: MitoriProblem = { op: 'mitori', digits: 2, terms: [47, 85, -23, 61, -19] }
    expect(ja.problemPrompt(column)).toBe('47、たす85、ひく23、たす61、ひく19。')
    expect(en.problemPrompt(column)).toBe('47 + 85 − 23 + 61 − 19')
  })

  // Spec (flash) §2, §5: the kind's name wherever operations are named, and
  // its prompt as VoiceOver reads it: its count, never its numbers.
  it('names フラッシュ暗算 and prompts it by its count', () => {
    const numbers: FlashProblem = { op: 'flash', digits: 2, terms: [47, 30, 23, 61, 19] }
    expect(ja.problemPrompt(numbers)).toBe('フラッシュ暗算、5口')
    expect(en.problemPrompt(numbers)).toBe('Flash, 5 numbers')
    expect(ja.practiceCellLabel({ op: 'flash', digits: 2 }, 'unseen')).toBe('2けたのフラッシュ暗算、まだ')
    expect(en.practiceCellLabel({ op: 'flash', digits: 2 }, 'unseen')).toBe('2-digit flash, not yet')
  })

  it('reads a column as its rod and its move', () => {
    expect(ja.columnLine(1, atom(7, 8, 'add'), false)).toBe('十の位　十の繰上：8をたす = +10 − 2')
    expect(ja.columnLine(0, atom(6, 4, 'add'), true)).toBe(
      '一の位　十の繰上と五の分解：4をたす = +10 − 5 − 1（さらに上の位へ繰り上がる）',
    )
  })

  // Spec (core rounds) §11: each section's lines sit under a heading that
  // says what the section does and what the soroban reads before and after
  // it (for ÷, what is left).
  it('heads each section with what it does to the soroban', () => {
    const number = (value: number, before: number, after: number): StepSection => ({ kind: 'number', value, before, after, groups: [] })
    expect(ja.sectionHeading(number(-59, 77, 18))).toBe('59をひく　77 → 18')
    expect(ja.sectionHeading(number(385, 472, 857))).toBe('385をたす　472 → 857')
    expect(en.sectionHeading(number(-59, 77, 18))).toBe('−59: 77 → 18')
    expect(en.sectionHeading(number(385, 472, 857))).toBe('+385: 472 → 857')
    const multiply: StepSection = { kind: 'multiply', x: 4, multiplier: 36, before: 0, after: 1440, groups: [] }
    expect(ja.sectionHeading(multiply)).toBe('4×36　0 → 1440')
    expect(en.sectionHeading(multiply)).toBe('4 × 36: 0 → 1440')
    const divide: StepSection = { kind: 'divide', q: 4, before: 1692, after: 252, groups: [] }
    expect(ja.sectionHeading(divide)).toBe('商4　のこり 1692 → 252')
    expect(en.sectionHeading(divide)).toBe('Quotient 4: 1692 → 252 left')
  })

  it('names all four rods', () => {
    expect([0, 1, 2, 3].map(ja.rodName)).toEqual(['一の位', '十の位', '百の位', '千の位'])
  })

  // roundName itself is module-local now (only practiceCellLabel calls it),
  // so it is exercised through that key rather than as a catalog entry.
  it('names a kind', () => {
    expect(ja.practiceCellLabel({ op: 'add', digits: 2 }, 'unseen')).toBe('2けたのたし算、まだ')
    expect(en.practiceCellLabel({ op: 'sub', digits: 3 }, 'unseen')).toBe('3-digit subtraction, not yet')
    expect(ja.practiceCellLabel({ op: 'div', digits: 2 }, 'unseen')).toBe('2けたのわり算、まだ')
    expect(en.practiceCellLabel({ op: 'div', digits: 2 }, 'unseen')).toBe('2-digit division, not yet')
    // The owner (2026-09-30): a practised kind reads its level too.
    expect(ja.practiceCellLabel({ op: 'add', digits: 2 }, 'fading', 3)).toBe('2けたのたし算、うすい珠、レベル 3')
    expect(en.practiceCellLabel({ op: 'add', digits: 2 }, 'fading', 3)).toBe('2-digit addition, fading, level 3')
  })
})

describe('multiplication strings', () => {
  it('reads a 九九 as its product and where each digit goes', () => {
    expect(ja.productLine(4, 3, 2, false)).toBe('4×3=12　千の位に1、百の位に2')
    expect(ja.productLine(2, 3, 2, false)).toBe('2×3=06　百の位に6')
    expect(ja.productLine(5, 4, 0, false)).toBe('5×4=20　十の位に2')
    expect(ja.productLine(5, 0, 0, false)).toBe('5×0=00')
    expect(ja.productLine(9, 9, 2, true)).toBe('9×9=81　千の位に8、百の位に1（さらに上の位へ繰り上がる）')
    expect(en.productLine(4, 3, 2, false)).toBe('4 × 3 = 12: 1 on the thousands rod, 2 on the hundreds rod')
  })

  it('names six rods', () => {
    expect([4, 5].map(ja.rodName)).toEqual(['万の位', '十万の位'])
    expect([4, 5].map(en.rodName)).toEqual(['ten-thousands rod', 'hundred-thousands rod'])
  })

  it('explains how the × walkthrough works', () => {
    expect(ja.introMethod).toContain('両落とし')
  })

  it('reads the operand board as the problem', () => {
    expect(ja.operandBoardLabel(472, 385)).toBe('472 × 385')
    expect(en.operandBoardLabel(472, 385)).toBe('472 × 385')
  })
})

// Spec (division) §3: the answer card's lines for 商除法, and the board
// that shows the divisor.
describe('division strings', () => {
  // The owner (2026-09-24): "it says 商4を立てる but I have no idea where
  // that 4 comes from". The line leads with the guess by 九九 (the head of
  // what is left ÷ the divisor's first digit), says why it was lowered when
  // it was too big, then where the digit goes (割れる / 割れない).
  it('guesses a quotient digit by 九九, lowers a guess too big to take away, then places it', () => {
    // 1692 ÷ 36: 16 ÷ 3 is 5, but 5 × 36 does not come off, so 4.
    expect(ja.quotientLine(4, 16, 3, 5, false, false)).toBe(
      '16÷3で見当をつけると5。5だと引ききれないので4にする。商4を頭の1つ左に立てる',
    )
    expect(en.quotientLine(4, 16, 3, 5, false, false)).toBe(
      'Estimate 16 ÷ 3 = 5. 5 is too big to take away, so use 4. Place 4 one rod left of the head.',
    )
  })

  it('places a guess that is right first time as it is', () => {
    // 432 ÷ 36: 4 ÷ 3 is 1, and 43 is at least 36 (割れる).
    expect(ja.quotientLine(1, 4, 3, 1, true, false)).toBe('4÷3で見当をつけると1。商1を頭の2つ左に立てる')
    expect(en.quotientLine(1, 4, 3, 1, true, false)).toBe('Estimate 4 ÷ 3 = 1. Place 1 two rods left of the head.')
  })

  // A digit is at most 9, so a head ÷ first digit of 10 or more guesses 9;
  // "32÷3で見当をつけると9" would be wrong arithmetic, so the line says why.
  it('guesses 9 when the head ÷ the first digit is 10 or more, and says so', () => {
    // 684 ÷ 36 = 19, after 1: 324 left, and 32 ÷ 3 is 10.
    expect(ja.quotientLine(9, 32, 3, 9, false, false)).toBe('32÷3は10以上なので、見当は9。商9を頭の1つ左に立てる')
    expect(en.quotientLine(9, 32, 3, 9, false, false)).toBe(
      '32 ÷ 3 is 10 or more, so guess 9. Place 9 one rod left of the head.',
    )
  })

  // A guess can be too big by more than one (mostly for a divisor starting
  // with 1), so the line says it was lowered until it fits, not by one.
  it('lowers a guess more than one too big until it fits', () => {
    // 285 ÷ 19 = 15, after 1: 95 left, and 9 ÷ 1 is 9, but only 5 × 19 fits.
    expect(ja.quotientLine(5, 9, 1, 9, true, false)).toBe(
      '9÷1で見当をつけると9。9だと引ききれないので、引けるまで下げて5にする。商5を頭の2つ左に立てる',
    )
    expect(en.quotientLine(5, 9, 1, 9, true, false)).toBe(
      'Estimate 9 ÷ 1 = 9. 9 is too big to take away; lower it until it fits: 5. Place 5 two rods left of the head.',
    )
    // 893 ÷ 19 = 47, after 4: 133 left, 13 ÷ 1 is 10 or more, so 9, then 7.
    expect(ja.quotientLine(7, 13, 1, 9, false, false)).toBe(
      '13÷1は10以上なので、見当は9。9だと引ききれないので、引けるまで下げて7にする。商7を頭の1つ左に立てる',
    )
    expect(en.quotientLine(7, 13, 1, 9, false, false)).toBe(
      '13 ÷ 1 is 10 or more, so guess 9. 9 is too big to take away; lower it until it fits: 7. Place 7 one rod left of the head.',
    )
  })

  // Nothing left at all (360 ÷ 36 = 10, after the 1) is why the digit is
  // 0: "0÷3で見当をつけると0" would read oddly, so the line says so.
  it('says a 0 digit with nothing left is 0 because nothing is left', () => {
    expect(ja.quotientLine(0, 0, 3, 0, false, true)).toBe('残りは0なので、商0（立てない）')
    expect(en.quotientLine(0, 0, 3, 0, false, true)).toBe('Nothing is left here: quotient 0, nothing to place.')
  })

  // A head of 0 with something still left below it is not "nothing left":
  // only the remainder being 0 says that. 10815 ÷ 105 = 103, after the 1:
  // 315 left, whose head above the tens is 0; the next line reads 3 from
  // it.
  it('says a 0 digit whose head is 0 but not all that is left is 0 because the first digit does not go in', () => {
    expect(ja.quotientLine(0, 0, 1, 0, false, false)).toBe('頭に1は入らないので、商0（立てない）')
    expect(en.quotientLine(0, 0, 1, 0, false, false)).toBe(
      "1 doesn't go into the head: quotient 0, nothing to place.",
    )
  })

  // A guess of 1 or more that will not come off is lowered to 0 like any
  // other: 17702 ÷ 167 = 106, after the 1: 1002 left, 1 ÷ 1 is 1, but 167
  // does not go into 100.
  it('lowers a guess to 0 as it lowers any guess too big', () => {
    expect(ja.quotientLine(0, 1, 1, 1, false, false)).toBe(
      '1÷1で見当をつけると1。1だと引ききれないので0にする。商0（立てない）',
    )
    expect(en.quotientLine(0, 1, 1, 1, false, false)).toBe(
      'Estimate 1 ÷ 1 = 1. 1 is too big to take away, so use 0. Quotient 0: nothing to place.',
    )
  })

  // A 0 is not placed, so its line names no rod. The wording stays neutral
  // about what follows, since a 0 can be the quotient's last digit (q = 20,
  // 350, …), with no next digit to move to. A head smaller than the
  // divisor's first digit guesses 0, which reads as the digit not going in
  // rather than as a sum ("6÷9で見当をつけると0").
  it('moves on from a 0 quotient digit without placing it', () => {
    // 202032 ÷ 976, after 2: 6832 left, and 9 does not go into 6.
    expect(ja.quotientLine(0, 6, 9, 0, false, false)).toBe('頭に9は入らないので、商0（立てない）')
    expect(en.quotientLine(0, 6, 9, 0, false, false)).toBe(
      "9 doesn't go into the head: quotient 0, nothing to place.",
    )
  })

  it('reads a 九九 taken off as its product and the rod each digit comes from', () => {
    expect(ja.subtractLine(4, 3, 2, false)).toBe('4×3=12　千の位から1、百の位から2を引く')
    expect(ja.subtractLine(2, 3, 2, false)).toBe('2×3=06　百の位から6を引く')
    expect(ja.subtractLine(5, 4, 0, false)).toBe('5×4=20　十の位から2を引く')
    expect(en.subtractLine(4, 3, 2, false)).toBe('4 × 3 = 12: take 1 from the thousands rod, 2 from the hundreds rod')
    expect(en.subtractLine(2, 3, 2, false)).toBe('2 × 3 = 06: take 6 from the hundreds rod')
  })

  // A 0 digit of the divisor still has its 九九 to recall, though nothing
  // comes off.
  it('keeps the 九九 of a 0 divisor digit, with nothing to take off', () => {
    expect(ja.subtractLine(1, 0, 1, false)).toBe('1×0=00')
    expect(en.subtractLine(1, 0, 1, false)).toBe('1 × 0 = 00')
  })

  it('says when a borrow ripples on', () => {
    expect(ja.subtractLine(1, 7, 1, true)).toBe('1×7=07　十の位から7を引く（さらに上の位から繰り下がる）')
    expect(en.subtractLine(1, 7, 1, true)).toBe('1 × 7 = 07: take 7 from the tens rod (borrowing from a rod further left)')
  })

  // 3けた ÷ takes 九九 off as high as the hundred-thousands rod.
  it('names the highest rods a 九九 comes off', () => {
    expect(ja.subtractLine(9, 9, 4, false)).toBe('9×9=81　十万の位から8、万の位から1を引く')
    expect(en.subtractLine(9, 9, 4, false)).toBe(
      '9 × 9 = 81: take 8 from the hundred-thousands rod, 1 from the ten-thousands rod',
    )
  })

  // 3けた ÷ works on seven rods, and VoiceOver names each.
  it('names the seventh rod', () => {
    expect(ja.rodName(6)).toBe('百万の位')
    expect(en.rodName(6)).toBe('millions rod')
  })

  it('reads the divisor board as the divisor', () => {
    expect(ja.divisorBoardLabel(36)).toBe('わる数 36')
    expect(en.divisorBoardLabel(36)).toBe('Divisor 36')
  })

  it('heads Home’s lesson buttons', () => {
    expect(ja.homeHowToSection).toBe('やりかた')
    expect(en.homeHowToSection).toBe('How it works')
  })
})

// Spec (howto tutorial) §2–3: the やりかた lessons' words.
// The owner (2026-09-30): the level a kind is at, in the grid and during a
// round, on the fade ladder's own 0–6 scale.
describe('level strings', () => {
  it('names a level, and a round’s level out of the top one', () => {
    expect(ja.levelName(3)).toBe('レベル 3')
    expect(en.levelName(3)).toBe('Level 3')
    expect(ja.roundLevel(0)).toBe('レベル 0/6')
    expect(en.roundLevel(6)).toBe('Level 6/6')
  })
})

describe('lesson strings', () => {
  const lesson = (id: string): Lesson => {
    const found = lessonById(id)
    if (found === null) throw new Error(`no lesson ${id}`)
    return found
  }

  it('names Home’s four tiles and each operation’s page', () => {
    const ops = ['add', 'sub', 'mul', 'div'] as const
    expect(ops.map(ja.howToSymbol)).toEqual(['＋', '−', '×', '÷'])
    expect(ops.map(ja.howToName)).toEqual(['たし算', 'ひき算', 'かけ算', 'わり算'])
    expect(ops.map(en.howToSymbol)).toEqual(['+', '−', '×', '÷'])
    expect(ops.map(en.howToName)).toEqual(['Add', 'Subtract', 'Multiply', 'Divide'])
    expect(ja.howToTitle('add')).toBe('たし算のやりかた')
    expect(en.howToTitle('div')).toBe('How division works')
  })

  it('titles a lesson by its move, or by its size and operation', () => {
    expect(ja.lessonTitle(lesson('add:direct'))).toBe('そのまま')
    expect(ja.lessonTitle(lesson('add:both'))).toBe('十の繰上と五の分解')
    expect(ja.lessonTitle(lesson('sub:both'))).toBe('十の繰下と五の合成')
    expect(ja.lessonTitle(lesson('mul:3'))).toBe('3けたのかけ算')
    expect(en.lessonTitle(lesson('sub:ten'))).toBe('Borrow ten')
    expect(en.lessonTitle(lesson('add:2'))).toBe('2-digit addition')
  })

  it('lists a lesson as its move and example, or its example alone', () => {
    expect(ja.lessonRow(lesson('add:five'))).toBe('五の合成　4＋3')
    expect(ja.lessonRow(lesson('sub:ten'))).toBe('十の繰下　13−5')
    expect(ja.lessonRow(lesson('mul:2'))).toBe('47×36')
    expect(ja.lessonRow(lesson('div:1'))).toBe('56÷7')
    expect(en.lessonRow(lesson('add:five'))).toBe('Five complement  4 + 3')
    expect(ja.lessonRowLabel(lesson('add:five'), true)).toBe('五の合成　4＋3、できた')
    expect(ja.lessonRowLabel(lesson('add:five'), false)).toBe('五の合成　4＋3')
    expect(en.lessonRowLabel(lesson('div:2'), true)).toBe('1692 ÷ 36, done')
  })

  it('explains each move with its own example, and ＋ − worked by place', () => {
    expect(ja.techniqueIntro('add', 'five')).toContain('4に3をたす')
    expect(ja.techniqueIntro('add', 'both')).toContain('−3 は −5 +2')
    expect(ja.techniqueIntro('sub', 'ten')).toContain('13から5をひく')
    expect(ja.techniqueIntro('sub', 'both')).toContain('+4 は +5 −1')
    expect(en.techniqueIntro('add', 'ten')).toContain('8 + 5 is +10 −5')
    expect(ja.lessonMethod('add')).toContain('繰り上がり')
    expect(ja.lessonMethod('sub')).toContain('繰り下がり')
  })

  it('tells × where a 九九’s digits go, for each size', () => {
    expect(ja.multiplyPlacement(1)).toContain('一の位')
    expect(ja.multiplyPlacement(2)).toContain('十の位どうしなら百の位')
    expect(ja.multiplyPlacement(3)).toContain('百の位どうしなら万の位')
    expect(en.multiplyPlacement(3)).toContain('hundreds × hundreds on the ten-thousands rod')
  })

  it('gives the result, やってみよう and its buttons', () => {
    expect(ja.lessonResult({ op: 'mul', digits: 2, a: 47, b: 36 }, 1692)).toBe('47×36 = 1692')
    expect(en.lessonResult({ op: 'mul', digits: 2, a: 47, b: 36 }, 1692)).toBe('47 × 36 = 1692')
    expect(ja.lessonResult({ op: 'sub', digits: 1, a: 13, b: 5 }, 8)).toBe('13−5 = 8')
    expect([ja.lessonTry, ja.lessonAgain, ja.lessonStartRound]).toEqual(['やってみよう', 'もう一問', '練習をはじめる'])
    expect([en.lessonTry, en.lessonAgain, en.lessonStartRound]).toEqual(['Try one', 'Another', 'Start practising'])
  })
})

describe('formatPoints', () => {
  it('separates thousands', () => {
    expect([0, 999, 1_000, 1_491_600].map(formatPoints)).toEqual(['0', '999', '1,000', '1,491,600'])
  })
})

// Spec (runs) §4: 練習 marks the ranks as the app's own.
describe('ranks', () => {
  it('names each rank as the app’s own 級 or 段', () => {
    expect([0, 1, 9, 10, 11, 19].map(ja.rankName)).toEqual([
      '練習10級',
      '練習9級',
      '練習1級',
      '練習初段',
      '練習二段',
      '練習十段',
    ])
    expect([0, 7, 8, 9, 10, 11, 12, 19].map(en.rankName)).toEqual([
      'Practice 10th kyu',
      'Practice 3rd kyu',
      'Practice 2nd kyu',
      'Practice 1st kyu',
      'Practice 1st dan',
      'Practice 2nd dan',
      'Practice 3rd dan',
      'Practice 10th dan',
    ])
  })

  it('splits a rank over two lines for its seal', () => {
    expect([ja.rankSeal(0), ja.rankSeal(10)]).toEqual(['練習\n10級', '練習\n初段'])
    expect([en.rankSeal(0), en.rankSeal(10)]).toEqual(['10th\nkyu', '1st\ndan'])
  })

  it('counts the points to the next rank', () => {
    expect(ja.rankToNext(1_900)).toBe('次まで あと1,900点')
    expect(en.rankToNext(1_900)).toBe('1,900 points to the next rank')
    expect([ja.rankTop, en.rankTop]).toEqual(['最高位です', 'Top rank'])
  })

  it('reads the badge as one line', () => {
    expect(ja.rankLabel(2, 1_900)).toBe('練習8級、次まで あと1,900点')
    expect(ja.rankLabel(19, 0)).toBe('練習十段、最高位です')
    expect(en.rankLabel(2, 1_900)).toBe('Practice 8th kyu, 1,900 points to the next rank')
    expect(en.rankLabel(19, 0)).toBe('Practice 10th dan, top rank')
  })
})

// Spec (runs) §5: the run's bar.
describe('the run\'s bar', () => {
  it('counts points', () => {
    expect([ja.runScore(1_240), en.runScore(1_240)]).toEqual(['1,240点', '1,240 pts'])
  })

  it('names the combo and its factor', () => {
    expect([ja.runCombo(12, 2), en.runCombo(5, 1.5)]).toEqual(['12れんぞく ×2', '5 in a row ×1.5'])
  })

  it('reads the bar as one line', () => {
    expect(ja.runBarLabel(2, 3, 1_240)).toBe('ライフ 2、レベル 3/6、1,240点')
    expect(en.runBarLabel(1, 3, 1_240)).toBe('1 life, level 3/6, 1,240 points')
  })

  it('says what a miss leaves', () => {
    expect([ja.livesLeft(2), ja.livesLeft(0)]).toEqual(['のこりライフ 2', 'ライフなし'])
    expect([en.livesLeft(2), en.livesLeft(1), en.livesLeft(0)]).toEqual(['2 lives left', '1 life left', 'no lives left'])
  })
})

// Spec (runs) §5: the results.
describe('a run’s results', () => {
  it('name the score, the best and three facts', () => {
    expect([ja.resultsScore, ja.newBest, ja.bestScore(3_420)]).toEqual(['スコア', '自己ベスト！', 'ベスト 3,420点'])
    expect([en.resultsScore, en.newBest, en.bestScore(3_420)]).toEqual(['Score', 'New best!', 'Best 3,420'])
    expect([ja.resultsRight(14), ja.resultsCombo(8), ja.resultsLevel(4)]).toEqual(['正解 14', '最大れんぞく 8', '最高レベル 4'])
    expect([en.resultsRight(14), en.resultsCombo(8), en.resultsLevel(4)]).toEqual([
      '14 right',
      'Longest combo 8',
      'Highest level 4',
    ])
  })

  it('stamp a rank crossed and offer another run', () => {
    expect([ja.rankUp(1), en.rankUp(10)]).toEqual(['練習9級に上がりました！', 'Up to Practice 1st dan!'])
    expect([ja.runAgain, en.runAgain]).toEqual(['もう一回', 'Again'])
  })
})

// Spec (runs) §5 (the owner, 2026-10-06): 戻る goes back to the problem
// before; build 35's look-back and its ways back are gone.
describe('going back in a run', () => {
  it('names 戻る', () => {
    expect([ja.goBack, en.goBack]).toEqual(['戻る', 'Back'])
    expect([ja.goBackLabel, en.goBackLabel]).toEqual(['前の問題にもどる', 'Back to the previous problem'])
  })

  it('has no look-back strings left', () => {
    for (const catalog of [ja, en]) {
      for (const key of ['lookBackLabel', 'lookBackReturn', 'lookBackToResults']) expect(catalog).not.toHaveProperty(key)
    }
  })
})

// Spec (flash) §2, §5.
describe('フラッシュ暗算 strings', () => {
  it('counts the numbers as they flash', () => {
    expect([ja.flashCounter(1, 5), en.flashCounter(5, 5)]).toEqual(['1/5', '5/5'])
  })

  it('asks for the answer once the flash is over', () => {
    expect([ja.flashAnswer, en.flashAnswer]).toEqual(['こたえてください', 'Your answer'])
  })

  // The column a flash shows with its steps reads as a 見取算 prompt does.
  it('reads a column of numbers as one sentence', () => {
    expect(ja.columnReading([47, 30, 23, 61, 19])).toBe('47、たす30、たす23、たす61、たす19。')
    expect(en.columnReading([47, 30, 23, 61, 19])).toBe('47 + 30 + 23 + 61 + 19')
    expect(ja.columnReading([47, 85, -23])).toBe('47、たす85、ひく23。')
    expect(en.columnReading([47, 85, -23])).toBe('47 + 85 − 23')
  })
})
