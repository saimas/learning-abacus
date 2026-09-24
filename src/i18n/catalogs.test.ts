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

// Spec (division) §2: 商除法 leaves the final soroban reading (the quotient
// followed by zeros), which is what a bead answer is actually checked
// against, so a bead-mode miss must say that too, not just the quotient.
describe('correctionAnswerOnBeads', () => {
  it('states the answer and what the beads themselves needed to read', () => {
    expect(ja.correctionAnswerOnBeads(47, 47000)).toBe('こたえは 47（そろばんは 47000）')
    expect(en.correctionAnswerOnBeads(47, 47000)).toBe('The answer is 47 (the soroban reads 47000)')
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

// Spec (choosing what to practise) §4: the chooser's rows.
describe('the part chooser', () => {
  it('names the full session and each part', () => {
    expect(ja.chooseTitle).toBe('なにを練習しますか')
    expect(ja.chooseAll).toBe('ぜんぶ')
    expect(ja.chooseAllDetail).toBe('準備 → 集中 → 暗算・5分')
    expect(ja.chooseOnly('warmup')).toBe('準備だけ')
    expect(ja.chooseOnly('focus')).toBe('集中だけ')
    expect(ja.chooseOnly('faderep')).toBe('暗算だけ')
    expect(ja.chooseEmpty).toBe('今はありません')
    expect(ja.chooseClose).toBe('閉じる')
    expect(en.chooseTitle).toBe('What would you like to practise?')
    expect(en.chooseAll).toBe('Everything')
    expect(en.chooseAllDetail).toBe('Warm-up → Focus → Fade · 5 min')
    expect(en.chooseOnly('warmup')).toBe('Warm-up only')
    expect(en.chooseEmpty).toBe('Nothing right now')
    expect(en.chooseClose).toBe('Close')
  })

  it('says what each part holds', () => {
    expect(ja.chooseDetail('warmup', 3)).toBe('おさらい・3つの動き')
    expect(ja.chooseDetail('focus', 2)).toBe('新しい動きと苦手な動き')
    expect(ja.chooseDetail('faderep', 4)).toBe('珠を消す・4つの動き')
    expect(en.chooseDetail('warmup', 3)).toBe('Review · 3 moves')
    expect(en.chooseDetail('focus', 2)).toBe('New and shaky moves')
    expect(en.chooseDetail('faderep', 4)).toBe('Fading the beads · 4 moves')
  })

  it('keeps the English singular', () => {
    expect(en.chooseDetail('warmup', 1)).toBe('Review · 1 move')
    expect(en.chooseDetail('faderep', 1)).toBe('Fading the beads · 1 move')
  })
})

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

  it('reads a column as its rod and its move', () => {
    expect(ja.columnLine(1, atom(7, 8, 'add'), false)).toBe('十の位　十の繰上：8をたす = +10 − 2')
    expect(ja.columnLine(0, atom(6, 4, 'add'), true)).toBe(
      '一の位　十の繰上と五の分解：4をたす = +10 − 5 − 1（さらに上の位へ繰り上がる）',
    )
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

  it('gives the walkthrough its title, its explanations and its result', () => {
    expect(ja.introTitle).toBe('かけ算のやりかた')
    expect(ja.introMethod).toContain('両落とし')
    expect(ja.introPlacement).toContain('百の位')
    expect(ja.introResult(47, 36, 1692)).toBe('47×36 = 1692')
    expect(en.introResult(47, 36, 1692)).toBe('47 × 36 = 1692')
  })

  it('reads the operand board as the problem', () => {
    expect(ja.operandBoardLabel(472, 385)).toBe('472 × 385')
    expect(en.operandBoardLabel(472, 385)).toBe('472 × 385')
  })
})

// Spec (division) §3: the answer card's lines for 商除法, and the board
// that shows the divisor.
describe('division strings', () => {
  it('says where a quotient digit goes, by the 割れる / 割れない rule', () => {
    expect(ja.quotientLine(4, 16, 36, false)).toBe('商4を立てる（16は36より小さいので、頭の1つ左）')
    expect(ja.quotientLine(1, 43, 36, true)).toBe('商1を立てる（43は36以上なので、頭の2つ左）')
    expect(en.quotientLine(4, 16, 36, false)).toBe('Quotient 4: 16 is less than 36, so one rod left of the head')
    expect(en.quotientLine(1, 43, 36, true)).toBe('Quotient 1: 43 is at least 36, so two rods left of the head')
  })

  // A 0 is not placed, so its line compares nothing, whatever the group's
  // lead says. The wording stays neutral about what follows, since a 0 can
  // be the quotient's last digit (q = 20, 350, …), with no next digit to
  // move to.
  it('moves on from a 0 quotient digit without placing it', () => {
    expect(ja.quotientLine(0, 683, 976, false)).toBe('商0（立てない）')
    expect(en.quotientLine(0, 683, 976, false)).toBe('Quotient 0: nothing to place')
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

  it('gives the walkthrough its title, its explanations and its result', () => {
    expect(ja.divideIntroTitle).toBe('わり算のやりかた')
    expect(en.divideIntroTitle).toBe('How to divide')
    expect(ja.divideIntroMethod).toContain('商除法')
    expect(en.divideIntroMethod).toContain('商除法')
    // The 割れる / 割れない rule compares as many leading digits as the
    // divisor has, taken from the remainder's head each round — not just
    // the dividend's head digit, which is only true of the first round.
    expect(ja.divideIntroPlacement).toContain('残りの頭から、わる数と同じけた数をとって、わる数とくらべます')
    expect(ja.divideIntroPlacement).toContain('わる数以上なら頭の2つ左、小さければ1つ左')
    expect(en.divideIntroPlacement).toContain('as many digits from the head of what’s left as the divisor has')
    expect(en.divideIntroPlacement).toContain('two rods left of the head')
    expect(ja.divideIntroResult(1692, 36, 47)).toBe('1692÷36 = 47')
    expect(en.divideIntroResult(1692, 36, 47)).toBe('1692 ÷ 36 = 47')
  })

  it('names Home’s link to the walkthrough beside the × one', () => {
    expect(ja.homeHowToDivide).toBe('わり算のやりかた')
    expect(en.homeHowToDivide).toBe('How division works')
    expect(ja.homeHowTo).toBe('かけ算のやりかた')
  })
})
