import { classify, startValue, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
// Type-only on purpose: AtomGrid imports useStrings from '@/i18n', so a value import here would create a real runtime cycle.
import type { CellState } from '@/ui/progress/AtomGrid'
// Type-only on purpose, for the same reason as CellState: PracticeTable will import useStrings from '@/i18n'.
import type { PracticeStage } from '@/ui/progress/PracticeTable'
import { type Digits, type Operation, type PracticeKind, type Problem } from '@/domain/problem'
import type { BlockKind, PracticePart } from '@/domain/session'

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
  // The division walkthrough (spec: division §3). The owner found it hard to
  // follow (2026-09-24: "it says 商4を立てる but I have no idea where that 4
  // comes from"), so the method page first says what division is, and a
  // guess page says how each digit is found by 九九 before the placement
  // page. The placement page gives both halves of placing: where the
  // quotient digit goes (割れる / 割れない), and where its 九九 come off,
  // which each 九九's own page then names rod by rod.
  divideIntroTitle: 'わり算のやりかた',
  divideIntroMethod:
    'わり算は、わられる数の中にわる数がいくつ入るかを調べます。そろばんでは、わられる数を置き、答え（商）を大きい位から一けたずつ決めて、商×わる数の九九を引いていきます（商除法（しょうじょほう））。',
  divideIntroGuess:
    '商の見当は九九でつけます。残りの頭の1けたか2けたを、わる数の一番上の数字でわります。1692÷36なら16÷3で5。でも、わる数の下の数字（6）の分も引くので、5では引ききれないことがあります。そのときは、引けるようになるまで1つずつ下げます（ここでは4）。',
  divideIntroPlacement:
    '残りの頭から、わる数と同じけた数をとって、わる数とくらべます。わる数以上なら頭の2つ左、小さければ1つ左に商を立てます。九九の答えは商のすぐ右から引き、わる数のつぎの数字との九九は、一つ右にずらして引きます。',
  divideIntroResult: (a: number, b: number, quotient: number) => `${a}÷${b} = ${quotient}`,
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
