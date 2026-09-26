import { classify, startValue, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import {
  answerOf,
  digitAt,
  divisorFirstDigit,
  type Digits,
  type Operation,
  type PracticeKind,
  type Problem,
} from '@/domain/problem'
import type { PracticeStage } from '@/domain/practice'
import type { CellState } from '@/domain/progress'
import type { BlockKind, PracticePart } from '@/domain/session'
import type { WalkStep } from '@/domain/divisionWalk'

// The curriculum spec's own vocabulary, not a translation of the English.
// `both` names the two substitutions in the order they are performed: a
// `both` addition carries ten and then resolves the inner subtraction with a
// five-complement (+10 − 5 + 1), which is 繰上 followed by 五の分解.
const TECHNIQUE: Record<AtomClass, { add: string; sub: string }> = {
  direct: { add: '', sub: '' },
  five: { add: '五の合成', sub: '五の分解' },
  ten: { add: '十の繰上', sub: '十の繰下' },
  both: { add: '十の繰上と五の分解', sub: '十の繰下と五の合成' },
}

const CELL_STATE: Record<CellState, string> = {
  unseen: '未学習',
  learning: '学習中',
  reflex: '即答',
  mental: '暗算',
}

// Fade rep is where anzan is actually built, so it is named for that.
const BLOCK_LABEL: Record<BlockKind, string> = {
  warmup: '準備',
  focus: '集中',
  faderep: '暗算',
  close: 'まとめ',
}

// What each part holds, as the chooser's detail line. Focus's size changes as
// new moves join during the session, so it names the kind of move instead of
// a count.
const CHOOSE_DETAIL: Record<PracticePart, (count: number) => string> = {
  warmup: (count) => `おさらい・${count}つの動き`,
  focus: () => '新しい動きと苦手な動き',
  faderep: (count) => `珠を消す・${count}つの動き`,
}

// A rod's name by its place, 0 being the ones rod. A 3-digit problem's
// soroban has four rods, a 3×3 multiplication's product can take six, and a
// 3けた division works on seven: the dividend's six and the quotient's
// highest digit left of them.
const PLACE: readonly string[] = ['一の位', '十の位', '百の位', '千の位', '万の位', '十万の位', '百万の位']
// A rod's name in one or two characters, for the row under the division
// walkthrough's soroban.
const PLACE_SHORT: readonly string[] = ['一', '十', '百', '千', '万', '十万', '百万']

const OP_NAME: Record<Operation, string> = { add: 'たし算', sub: 'ひき算', mul: 'かけ算', div: 'わり算' }

const PRACTICE_STAGE: Record<PracticeStage, string> = {
  unseen: 'まだ',
  beads: '珠で',
  fading: 'うすい珠',
  mental: '暗算',
}

function roundName(kind: PracticeKind): string {
  return `${kind.digits}けたの${OP_NAME[kind.op]}`
}

// Declared as a function rather than inline on the object: a member
// referencing `ja` from inside the initialiser of `ja` makes `typeof ja`
// circular, which TypeScript rejects.
// Everything in the coaching sentence before the steps themselves, so the
// answer card can set each step apart and highlight the one just stepped to.
function coachingLead(atom: Atom): string {
  const name = TECHNIQUE[classify(atom)][atom.direction]
  const verb = atom.direction === 'add' ? 'たす' : 'ひく'
  const move = `${atom.operand}を${verb} = `
  return name === '' ? move : `${name}：${move}`
}

function coaching(atom: Atom): string {
  return `${coachingLead(atom)}${describeSteps(atom)}`
}

// A 九九 with its product written as two digits, as it is said (2×3 is
// ゼロロク).
function nineNine(x: number, y: number): string {
  return `${x}×${y}=${String(x * y).padStart(2, '0')}`
}

// The digits of a 九九's product with the rod each goes on or comes off:
// its ones digit at `place`, its tens one above. A 0 moves no bead, so it is
// left out.
function productDigits(product: number, place: number): (readonly [digit: number, place: number])[] {
  return (
    [
      [Math.floor(product / 10), place + 1],
      [product % 10, place],
    ] as const
  ).filter(([digit]) => digit !== 0)
}

// One line of a × problem's answer card: the 九九, then where each non-zero
// digit goes.
function productLine(x: number, y: number, place: number, cascades: boolean): string {
  const head = nineNine(x, y)
  const digits = productDigits(x * y, place).map(([digit, at]) => `${PLACE[at] ?? at}に${digit}`)
  return `${digits.length === 0 ? head : `${head}　${digits.join('、')}`}${cascades ? '（さらに上の位へ繰り上がる）' : ''}`
}

// One line of a ÷ problem's answer card for a 九九 taken off the remainder:
// the 九九 of the quotient digit and a divisor digit, then the rod each
// non-zero digit comes off. A 0 divisor digit still has its 九九 to recall,
// so it gets its line, with nothing to take off.
function subtractLine(q: number, y: number, place: number, cascades: boolean): string {
  const head = nineNine(q, y)
  const digits = productDigits(q * y, place).map(([digit, at]) => `${PLACE[at] ?? at}から${digit}`)
  return `${digits.length === 0 ? head : `${head}　${digits.join('、')}を引く`}${cascades ? '（さらに上の位から繰り下がる）' : ''}`
}

// One line of a ÷ problem's answer card for a quotient digit. The owner
// (2026-09-24): "it says 商4を立てる but I have no idea where that 4 comes
// from". So it leads with the guess by 九九 (the head of what is left,
// `partial`, ÷ the divisor's first digit `d0`), says why a guess too big to
// take away was lowered to q (the beads play only q), then where q goes by
// the 割れる / 割れない rule. A 0 is not placed at all, so its line names no
// rod.
function quotientLine(
  q: number,
  partial: number,
  d0: number,
  guess: number,
  split: boolean,
  remainderZero: boolean,
): string {
  // "立てずに次へ" reads wrong when the 0 is the quotient's last digit (there
  // is no next digit to move to), so this stays neutral about what follows.
  const zero = '商0（立てない）'
  // Nothing left at all (360 ÷ 36 = 10, after the 1) can only give a 0, and
  // "0÷3で見当をつけると0" reads oddly, so it says why directly. A head of 0
  // is not enough: 10815 ÷ 105, after the 1, leaves 315, whose head above
  // the tens is 0, and the next digit is read from it.
  if (remainderZero) return `残りは0なので、${zero}`
  // A head smaller than the divisor's first digit (0 included, with
  // something left below it) guesses 0: said as the digit not going in, not
  // as a sum ("6÷9で見当をつけると0").
  if (guess === 0) return `頭に${d0}は入らないので、${zero}`
  // A digit is at most 9, so a head ÷ first digit of 10 or more guesses 9;
  // "32÷3で見当をつけると9" would be wrong arithmetic.
  const estimate =
    Math.floor(partial / d0) > 9 ? `${partial}÷${d0}は10以上なので、見当は9。` : `${partial}÷${d0}で見当をつけると${guess}。`
  // A guess can be too big by more than one (mostly for a divisor starting
  // with 1); then it is lowered until it fits, not just once.
  const lowered =
    guess - q >= 2
      ? `${guess}だと引ききれないので、引けるまで下げて${q}にする。`
      : guess > q
        ? `${guess}だと引ききれないので${q}にする。`
        : ''
  const placed = q === 0 ? zero : `商${q}を頭の${split ? 2 : 1}つ左に立てる`
  return `${estimate}${lowered}${placed}`
}

// The division walkthrough's words for one step (spec: division walkthrough
// §3): what the step does, its sum, a note, and what it does on the rods,
// each empty where the step has none. The owner (2026-09-24) found the old
// walkthrough's sentences "hard to process as image", so these stay short
// and every number in them is one the screen shows.
export type WalkCaption = { what: string; math: string; note: string; rods: string }

function divideWalk(problem: Problem, step: WalkStep): WalkCaption {
  const { a, b } = problem
  const n = problem.digits
  const none: WalkCaption = { what: '', math: '', note: '', rods: '' }
  const d0 = divisorFirstDigit(problem)
  // The digit's 九九 with each divisor digit, from the top (5×3も5×6も): a
  // digit is right once they all come off (the owner: the candidate "has to
  // pass through each digit").
  const nineNines = (digit: number) =>
    Array.from({ length: n }, (_, k) => `${digit}×${digitAt(b, n - 1 - k)}`).join('も') + (n === 1 ? 'が' : 'も')
  switch (step.kind) {
    case 'set':
      return {
        ...none,
        what: `${a}をそろばんに置く`,
        note: `${a}の中に${b}がいくつ入るかを、答えの大きい位から1けたずつ決めていく。左はしのけたは空けておく。答えはそこにできていく。`,
      }
    case 'guess': {
      const place = PLACE[step.p] ?? `${step.p}`
      if (step.remainderZero) {
        return { ...none, what: `答えの${place}：のこりは0`, note: 'のこりが0なので、この位は0（置かない）。' }
      }
      const product = d0 * step.guess
      const note =
        step.guess === 0
          ? `${d0}は${step.partial}に入らないので、この位は0（置かない）。`
          : n === 1
            ? `九九：${d0}×${step.guess}=${product}は${step.partial}に入る。`
            : `${b}を${d0 * 10 ** (n - 1)}と思って九九：${d0}×${step.guess}=${product}は${step.partial}に入る。`
      return {
        ...none,
        what: `答えの${place}：${step.chunk}の中に${b}はいくつ？`,
        // A digit is at most 9, so "32÷3 → 9" would be wrong arithmetic.
        math: `見当 ${step.partial}÷${d0} → ${step.raw > 9 ? '10以上なので9' : step.guess}`,
        note,
      }
    }
    case 'try':
      return {
        ...none,
        what: `${step.digit}を置いてみる（${step.digit * 10 ** step.p}×${b}）`,
        note: `のこりの頭${step.lead}は${b}${step.split ? '以上なので、頭の2つ左' : 'より小さいので、頭の1つ左'}に置く。${nineNines(step.digit)}引けたら、${step.digit}で決まり。`,
      }
    case 'take':
      return {
        what: `${step.resumed ? 'つづけて' : ''}${step.digit * 10 ** step.p}×${step.y * 10 ** step.j}=${step.amount}を引く`,
        math: `${step.before}−${step.amount}=${step.left}${step.last ? ' ✓' : ''}`,
        note: step.last ? `${nineNines(step.digit)}引けたので、${step.digit}で決まり。` : '',
        rods: `そろばんでは：${subtractLine(step.digit, step.y, step.p + step.j, step.cascades)}`,
      }
    case 'stuck':
      return {
        ...none,
        what: `${step.digit * 10 ** step.p}×${step.y * 10 ** step.j}=${step.amount}を引く……引けない`,
        math: `${step.left}−${step.amount} ✗`,
        note: `のこりの${step.left}は${step.amount}より小さい。${step.digit}は大きすぎた。`,
      }
    case 'fix': {
      const to = step.from - 1
      const unit = 10 ** step.p
      // The divisor digits taken off so far go back where they came off.
      const putBack = step.putBack.map(({ digit, place }) => `${PLACE[place] ?? place}に${digit}`).join('、')
      // The owner's own picture of the fix (2026-09-24): "go back to the
      // point of the current lane then adjust the number and try again".
      // Putting back only the extra lands on that same number.
      const note =
        to === 0
          ? `${step.from * unit}×${step.taken}も多すぎた。引いた${step.back}を全部戻す。この位は0（置かない）。`
          : `${step.from * unit}×${step.taken}を引いたが、${to * unit}×${step.taken}でよかった。多く引いた${
            step.p > 0 ? `${unit}×${step.taken}=${step.back}` : step.back
          }を戻す。やり直さなくていい：${step.laneStart}に戻して${to * unit}×${step.taken}を引いたのと同じ${step.left}になる。`
      return {
        what: `戻す：${step.from}を${to}にして、${step.back}を足し戻す`,
        math: `${step.before}+${step.back}=${step.left}`,
        note,
        // A put-back digit can carry into a rod that is already 9, as a ×
        // round's 九九 can, so it says so as the product line does.
        rods: `そろばんでは：答えのけたから1を引き、${putBack}を足す${step.cascades ? '（さらに上の位へ繰り上がる）' : ''}`,
      }
    }
    case 'done': {
      const quotient = answerOf(problem)
      return { ...none, what: '答えを読む', math: `${a}÷${b}=${quotient}`, note: `左に${quotient}。右はすべて0。` }
    }
  }
}

// The answer line shared by a miss's card, its review, and its VoiceOver
// announcement.
function correctionAnswer(expected: number): string {
  return `こたえは ${expected}`
}

// A ÷ miss answered on the beads: 商除法 leaves the quotient followed by
// zeros on the rods (spec (division) §2), so the beads had to read that
// final value, not the quotient `correctionAnswer` already names. Told
// alongside it so a miss teaches what the beads themselves needed to show.
function correctionAnswerOnBeads(expected: number, beads: number): string {
  return `${correctionAnswer(expected)}（そろばんは ${beads}）`
}

// No plural branch — Japanese has none. The English catalog needs one.
function breakdown(value: number): string {
  const earth = value % 5
  if (value === 0) return '珠がひとつも入っていません'
  if (value < 5) return `一珠が${earth}つ`
  if (earth === 0) return '五珠だけ'
  return `五珠と一珠${earth}つで 5 + ${earth}`
}

export const ja = {
  loading: '読み込み中…',
  loadingProgress: '進捗を読み込み中…',
  daysPracticed: (days: number) => `練習 ${days}日間`,
  navProgress: '進捗',
  navSettings: '設定',

  homeTitle: '今日の五分',
  start: 'はじめる',
  notYetToday: '今日の練習はまだです',
  practisedToday: '今日は練習しました',
  seeYouTomorrow: 'またあした。',
  chooseTitle: 'なにを練習しますか',
  chooseAll: 'ぜんぶ',
  chooseAllDetail: `${BLOCK_LABEL.warmup} → ${BLOCK_LABEL.focus} → ${BLOCK_LABEL.faderep}・5分`,
  chooseOnly: (part: PracticePart) => `${BLOCK_LABEL[part]}だけ`,
  chooseDetail: (part: PracticePart, count: number) => CHOOSE_DETAIL[part](count),
  chooseEmpty: '今はありません',
  chooseClose: '閉じる',
  basicsTitle: '基礎の練習',
  basicsDetail: '1けたの動き・5分',
  homeHowTo: 'かけ算のやりかた',
  homeHowToDivide: 'わり算のやりかた',
  sealDays: (days: number) => `${days}\n日`,
  back: '今日',

  languageLabel: '言語',
  resetAll: 'すべての進捗を消す',
  resetConfirm: '本当にすべての進捗を消しますか？',

  sessionComplete: '今日の練習おわり',
  sessionResult: (answered: number, correct: number) => `${answered}問中 ${correct}問正解`,
  done: 'おわる',
  answer: 'こたえる',
  prompt: (atom: Atom) =>
    atom.direction === 'add'
      ? `${startValue(atom)}に${atom.operand}をたす。`
      : `${startValue(atom)}から${atom.operand}をひく。`,
  coaching,
  coachingLead,
  blockLabel: (kind: BlockKind) => BLOCK_LABEL[kind],
  correctionAnswer,
  correctionAnswerOnBeads,
  correct: '正解',
  wrong: 'ちがいます',
  quitLabel: '練習をやめる',
  quitTitle: '練習をやめますか？',
  quitBody: 'ここまでの答えは記録されています。',
  quitStop: 'やめる',
  quitContinue: 'つづける',
  sealDone: '済',
  deleteKey: '1文字消す',
  beadHint: '珠をタップして動かします',
  resetBeads: 'もどす',
  showAnswer: 'こたえを見る',
  next: 'つぎへ',
  replayStep: (step: number, total: number) => `${step} / ${total}`,
  // The step panel (spec: core rounds §3), which walks a move one bead
  // step at a time. replayStep above is its counter.
  stepsOpen: '手順を見る',
  stepBack: '一つもどる',
  stepNext: '一つすすむ',
  stepRestart: '最初から',
  stepsClose: 'とじる',
  rodName: (place: number): string => PLACE[place] ?? `${place}`,
  problemPrompt: (problem: Problem) => {
    switch (problem.op) {
      case 'add':
        return `${problem.a}に${problem.b}をたす。`
      case 'sub':
        return `${problem.a}から${problem.b}をひく。`
      case 'mul':
        return `${problem.a}に${problem.b}をかける。`
      case 'div':
        return `${problem.a}を${problem.b}でわる。`
    }
  },
  // One line of a problem's answer card: the rod, then the move worked on
  // it, read exactly as a single move's card reads it.
  columnLine: (place: number, atom: Atom, cascades: boolean) =>
    `${PLACE[place] ?? place}　${coaching(atom)}${
      cascades ? (atom.direction === 'add' ? '（さらに上の位へ繰り上がる）' : '（さらに上の位から繰り下がる）') : ''
    }`,
  productLine,
  quotientLine,
  subtractLine,
  roundCount: (index: number, total: number) => `${index} / ${total}`,
  roundComplete: 'けたの練習おわり',
  roundSection: 'けたの練習',
  digitsName: (digits: Digits) => `${digits}けた`,
  practiceStageName: (stage: PracticeStage) => PRACTICE_STAGE[stage],
  practiceCellLabel: (kind: PracticeKind, stage: PracticeStage) => `${roundName(kind)}、${PRACTICE_STAGE[stage]}`,

  atomSummary: (mental: number, total: number) => `全${total}問中 ${mental}問が暗算`,
  cellLabel: (atomId: string, state: CellState) => `${atomId} ${CELL_STATE[state]}`,
  cellStateName: (state: CellState) => CELL_STATE[state],
  mapAdd: 'たし算',
  mapSub: 'ひき算',
  mapAxis: '縦：いまのけたの数（0〜9）　横：たす数・ひく数（1〜9）',

  readingIndex: (index: number, total: number) => `${total}問中 ${index}問目`,
  readingPrompt: 'このけたはいくつですか？',
  check: 'たしかめる',
  readingInstruction: '梁（はり）につけた珠だけを数えます。上の五珠は5、下の一珠は1つにつき1です。けたの数はその合計です。',
  readingFeedback: (target: number) => `ちがいます。このけたは${target}です。${breakdown(target)}。`,
  readingTitle: 'そろばんの読み方',

  // The multiplication walkthrough (spec: multiplication §4), and the
  // chooser's link that replays it.
  introTitle: 'かけ算のやりかた',
  introMethod:
    'かけ算は、答えだけをそろばんに入れていきます（両落とし（りょうおとし））。かけられる数の上の位から順に、その一つ一つに、かける数の上の位から順にかけて、九九の答えをたしていきます。',
  introPlacement:
    '九九の答えの一の位は、一の位どうしなら一の位、十の位と一の位なら十の位、十の位どうしなら百の位に入れます。十の位は、その一つ上の位です。',
  introResult: (a: number, b: number, product: number) => `${a}×${b} = ${product}`,
  // The owner's request (2026-09-24): a way back through the walkthrough,
  // not just forward.
  introBack: 'もどる',
  // The division walkthrough's title (spec: division walkthrough §4).
  divideIntroTitle: 'わり算のやりかた',
  // The division walkthrough, guess by guess (spec: division walkthrough §3).
  divideWalk,
  // What VoiceOver reads as a walkthrough step opens: its words, then its
  // sum if it has one, with the pause a Japanese sentence takes between two
  // clauses.
  divideWalkSpoken: (what: string, math: string) => (math === '' ? what : `${what}、${math}`),
  divideWalkLeft: 'のこり',
  divideWalkAnswer: '答え',
  rodShortName: (place: number): string => PLACE_SHORT[place] ?? `${place}`,
  // What VoiceOver reads for the operand board under a × problem's soroban:
  // the two numbers, as the board shows them.
  operandBoardLabel: (a: number, b: number) => `${a} × ${b}`,
  // What VoiceOver reads for the board under a ÷ problem's soroban, which
  // shows only the divisor: the dividend is already on the soroban.
  divisorBoardLabel: (b: number) => `わる数 ${b}`,
}

// The contract every catalog satisfies, derived from the catalog that ships
// by default rather than hand-written — so a missing or wrong-arity key in
// `en` fails `tsc` instead of rendering a blank label on a learner's device.
export type Strings = typeof ja
