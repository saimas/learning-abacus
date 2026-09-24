import { divisionWalk, type WalkStep } from '@/domain/divisionWalk'
import type { Digits, Problem } from '@/domain/problem'
import { en } from './en'
import { ja } from './ja'

function division(q: number, d: number): Problem {
  return { op: 'div', digits: String(d).length as Digits, a: q * d, b: d }
}

// Step `index` of a problem's walk.
function nth(walk: WalkStep[], index: number): WalkStep {
  const step = walk[index]
  if (step === undefined) throw new Error(`no step ${index}`)
  return step
}

// The first step of a problem's walk that `match` accepts.
function stepOf(problem: Problem, match: (step: WalkStep) => boolean): WalkStep {
  const step = divisionWalk(problem).find(match)
  if (step === undefined) throw new Error('no such step')
  return step
}

// Spec (division walkthrough) §3: the owner's example, step by step, in the
// words the web walkthrough that made it click used.
describe('the division walkthrough, in Japanese', () => {
  it('words 1692 ÷ 36 step by step', () => {
    const problem = division(47, 36)
    const captions = divisionWalk(problem).map((step) => ja.divideWalk(problem, step))
    expect(captions).toEqual([
      {
        what: '1692をそろばんに置く',
        math: '',
        note: '1692の中に36がいくつ入るかを、答えの大きい位から1けたずつ決めていく。左はしのけたは空けておく。答えはそこにできていく。',
        rods: '',
      },
      {
        what: '答えの十の位：169の中に36はいくつ？',
        math: '見当 16÷3 → 5',
        note: '36を30と思って九九：3×5=15は16に入る。',
        rods: '',
      },
      {
        what: '5を置いてみる（50×36）',
        math: '',
        note: 'のこりの頭16は36より小さいので、頭の1つ左に置く。5×3も5×6も引けたら、5で決まり。',
        rods: '',
      },
      {
        what: '50×30=1500を引く',
        math: '1692−1500=192',
        note: '',
        rods: 'そろばんでは：5×3=15　千の位から1、百の位から5を引く',
      },
      {
        what: '50×6=300を引く……引けない',
        math: '192−300 ✗',
        note: 'のこりの192は300より小さい。5は大きすぎた。',
        rods: '',
      },
      {
        what: '戻す：5を4にして、300を足し戻す',
        math: '192+300=492',
        note: '50×30を引いたが、40×30でよかった。多く引いた10×30=300を戻す。やり直さなくていい：1692に戻して40×30を引いたのと同じ492になる。',
        rods: 'そろばんでは：答えのけたから1を引き、百の位に3を足す',
      },
      {
        what: 'つづけて40×6=240を引く',
        math: '492−240=252 ✓',
        note: '4×3も4×6も引けたので、4で決まり。',
        rods: 'そろばんでは：4×6=24　百の位から2、十の位から4を引く',
      },
      {
        what: '答えの一の位：252の中に36はいくつ？',
        math: '見当 25÷3 → 8',
        note: '36を30と思って九九：3×8=24は25に入る。',
        rods: '',
      },
      {
        what: '8を置いてみる（8×36）',
        math: '',
        note: 'のこりの頭25は36より小さいので、頭の1つ左に置く。8×3も8×6も引けたら、8で決まり。',
        rods: '',
      },
      {
        what: '8×30=240を引く',
        math: '252−240=12',
        note: '',
        rods: 'そろばんでは：8×3=24　百の位から2、十の位から4を引く',
      },
      {
        what: '8×6=48を引く……引けない',
        math: '12−48 ✗',
        note: 'のこりの12は48より小さい。8は大きすぎた。',
        rods: '',
      },
      {
        what: '戻す：8を7にして、30を足し戻す',
        math: '12+30=42',
        note: '8×30を引いたが、7×30でよかった。多く引いた30を戻す。やり直さなくていい：252に戻して7×30を引いたのと同じ42になる。',
        rods: 'そろばんでは：答えのけたから1を引き、十の位に3を足す',
      },
      {
        what: 'つづけて7×6=42を引く',
        math: '42−42=0 ✓',
        note: '7×3も7×6も引けたので、7で決まり。',
        rods: 'そろばんでは：7×6=42　十の位から4、一の位から2を引く',
      },
      { what: '答えを読む', math: '1692÷36=47', note: '左に47。右はすべて0。', rods: '' },
    ])
  })

  it('says a guess of 10 or more is capped at 9: 684 ÷ 36', () => {
    const problem = division(19, 36)
    expect(ja.divideWalk(problem, stepOf(problem, (s) => s.kind === 'guess' && s.p === 0)).math).toBe(
      '見当 32÷3 → 10以上なので9',
    )
  })

  it('says why a digit is 0: 202032 ÷ 976 and 360 ÷ 36', () => {
    const big = division(207, 976)
    expect(ja.divideWalk(big, stepOf(big, (s) => s.kind === 'guess' && s.p === 1)).note).toBe(
      '9は6に入らないので、この位は0（置かない）。',
    )
    const exact = division(10, 36)
    expect(ja.divideWalk(exact, stepOf(exact, (s) => s.kind === 'guess' && s.p === 0))).toEqual({
      what: '答えの一の位：のこりは0',
      math: '',
      note: 'のこりが0なので、この位は0（置かない）。',
      rods: '',
    })
  })

  it('says a fix down to 0 puts everything back: 17702 ÷ 167', () => {
    const problem = division(106, 167)
    expect(ja.divideWalk(problem, stepOf(problem, (s) => s.kind === 'fix' && s.from === 1)).note).toBe(
      '10×100も多すぎた。引いた1000を全部戻す。この位は0（置かない）。',
    )
  })

  it('guesses a 1-digit divisor by its own 九九: 56 ÷ 8', () => {
    const problem = division(7, 8)
    expect(ja.divideWalk(problem, stepOf(problem, (s) => s.kind === 'guess')).note).toBe('九九：8×7=56は56に入る。')
    expect(ja.divideWalk(problem, stepOf(problem, (s) => s.kind === 'try')).note).toBe(
      'のこりの頭5は8より小さいので、頭の1つ左に置く。7×8が引けたら、7で決まり。',
    )
  })

  it('lists three 九九 and puts back two digits for a 3-digit divisor', () => {
    const three = division(207, 976)
    expect(ja.divideWalk(three, stepOf(three, (s) => s.kind === 'try')).note).toBe(
      'のこりの頭202は976より小さいので、頭の1つ左に置く。2×9も2×7も2×6も引けたら、2で決まり。',
    )
    const twoBack = division(191, 126)
    expect(ja.divideWalk(twoBack, stepOf(twoBack, (s) => s.kind === 'fix' && s.p === 2))).toEqual({
      what: '戻す：2を1にして、12000を足し戻す',
      math: '66+12000=12066',
      note: '200×120を引いたが、100×120でよかった。多く引いた100×120=12000を戻す。やり直さなくていい：24066に戻して100×120を引いたのと同じ12066になる。',
      rods: 'そろばんでは：答えのけたから1を引き、万の位に1、千の位に2を足す',
    })
  })

  it('names rods briefly for the row under the soroban', () => {
    expect([4, 3, 2, 1, 0].map(ja.rodShortName)).toEqual(['万', '千', '百', '十', '一'])
  })
})

describe('the division walkthrough, in English', () => {
  it('words the fix and the digit coming through', () => {
    const problem = division(47, 36)
    const walk = divisionWalk(problem)
    expect(en.divideWalk(problem, nth(walk, 2))).toMatchObject({
      what: 'Try 5 (50 × 36)',
      note: "The head of what's left, 16, is smaller than 36, so it goes one rod left of the head. If 5 × 3 and 5 × 6 both come off, 5 is right.",
    })
    expect(en.divideWalk(problem, nth(walk, 5))).toEqual({
      what: 'Fix it: 5 → 4, and put back 300',
      math: '192 + 300 = 492',
      note: "You took away 50 × 30, but only 40 × 30 was due. Put back the extra 10 × 30 = 300. No need to start over: it's the same 492 as going back to 1692 and taking away 40 × 30.",
      rods: 'On the rods: take 1 off the answer, and put 3 back on the hundreds rod',
    })
    expect(en.divideWalk(problem, nth(walk, 6))).toMatchObject({
      what: 'Carry on: take away 40 × 6 = 240',
      math: '492 − 240 = 252 ✓',
      note: '4 × 3 and 4 × 6 both came off, so 4 is right.',
    })
  })

  it('lists three 九九 for a 3-digit divisor', () => {
    const problem = division(207, 976)
    expect(en.divideWalk(problem, stepOf(problem, (s) => s.kind === 'try')).note).toContain(
      'If 2 × 9, 2 × 7 and 2 × 6 all come off, 2 is right.',
    )
  })
})
