import { classify, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import { MAX_FADE, type FadeLevel } from '@/domain/fade'
import {
  answerOf,
  digitAt,
  divisorFirstDigit,
  type Digits,
  type Operation,
  type PairOperation,
  type PairProblem,
  type PracticeKind,
  type Problem,
  type StepSection,
} from '@/domain/problem'
import type { PracticeStage } from '@/domain/practice'
import type { WalkStep } from '@/domain/divisionWalk'
import { techniqueOf, type Lesson, type TechniqueOperation } from '@/domain/lessons'
import { formatPoints } from './format'

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

// A rod's name by its place, 0 being the ones rod. A 3-digit problem's
// soroban has four rods, a 3×3 multiplication's product can take six, and a
// 3けた division works on seven: the dividend's six and the quotient's
// highest digit left of them.
const PLACE: readonly string[] = ['一の位', '十の位', '百の位', '千の位', '万の位', '十万の位', '百万の位']

// Spec (howto tutorial) §2–3: the やりかた lessons' names and words.
const HOW_TO_SYMBOL: Record<PairOperation, string> = { add: '＋', sub: '−', mul: '×', div: '÷' }

function techniqueName(op: TechniqueOperation, technique: AtomClass): string {
  return technique === 'direct' ? 'そのまま' : TECHNIQUE[technique][op]
}

function lessonExample(problem: PairProblem): string {
  return `${problem.a}${HOW_TO_SYMBOL[problem.op]}${problem.b}`
}

function lessonRow(lesson: Lesson): string {
  const move = techniqueOf(lesson)
  const example = lessonExample(lesson.example)
  return move === null ? example : `${techniqueName(move.op, move.technique)}　${example}`
}

// What each move is and when it is used, with the lesson's own example.
const TECHNIQUE_INTRO: Record<TechniqueOperation, Record<AtomClass, string>> = {
  add: {
    direct: 'たす数の一の珠や五の珠が、その位にそのまま入るときは、そのまま入れます。3に1をたすなら、一の珠を1つ上げます。',
    five: 'たす数の一の珠が足りないときは、五の珠を入れて、入れすぎた分の一の珠をはらいます（五の合成）。4に3をたすなら、+5 −2 です。',
    ten: 'その位が10をこえるときは、左の位に1を入れて（+10）、入れすぎた分をはらいます（十の繰上）。8に5をたすなら、+10 −5 です。',
    both: '左の位に1を入れて（+10）から入れすぎた分をはらうとき、一の珠だけではらえなければ、五の珠をはらって一の珠を入れます。6に7をたすなら、+10 −3 で、−3 は −5 +2 です。',
  },
  sub: {
    direct: 'ひく数の一の珠や五の珠が、その位からそのままはらえるときは、そのままはらいます。4から3をひくなら、一の珠を3つ下げます。',
    five: 'ひく数の一の珠が足りないときは、五の珠をはらって、はらいすぎた分の一の珠を入れます（五の分解）。6から3をひくなら、−5 +2 です。',
    ten: 'その位からひけないときは、左の位から1をはらって（−10）、ひきすぎた分を入れます（十の繰下）。13から5をひくなら、−10 +5 です。',
    both: '左の位から1をはらって（−10）からひきすぎた分を入れるとき、一の珠だけで入れられなければ、五の珠を入れて一の珠をはらいます。12から6をひくなら、−10 +4 で、+4 は +5 −1 です。',
  },
}

// The ＋ − 2けた and 3けた lessons' method: by place, from the highest.
const LESSON_METHOD: Record<TechniqueOperation, string> = {
  add: 'たし算は、上の位から順に、位ごとにたしていきます。その位が10をこえたら、左の位に1を入れます（繰り上がり）。左の位が9のときは、その1がさらに左の位へ上がります。',
  sub: 'ひき算は、上の位から順に、位ごとにひいていきます。その位からひけないときは、左の位から1をかります（繰り下がり）。',
}

// Where a 九九's digits go, stated for each size (spec §2): the 2けた rule is
// the one the × walkthrough has always given.
const MULTIPLY_PLACEMENT: Record<Digits, string> = {
  1: '九九の答えは、十の位を左の位に、一の位をその右の一の位に入れます。',
  2: '九九の答えの一の位は、一の位どうしなら一の位、十の位と一の位なら十の位、十の位どうしなら百の位に入れます。十の位は、その一つ上の位です。',
  3: '九九の答えの一の位は、かけた二つの数の位を合わせた位に入れます。一の位どうしなら一の位、十の位と一の位なら十の位、十の位どうしや百の位と一の位なら百の位、百の位と十の位なら千の位、百の位どうしなら万の位です。十の位は、その一つ上の位です。',
}
// A rod's name in one or two characters, for the row under the division
// walkthrough's soroban.
const PLACE_SHORT: readonly string[] = ['一', '十', '百', '千', '万', '十万', '百万']

const OP_NAME: Record<Operation, string> = {
  add: 'たし算',
  sub: 'ひき算',
  mul: 'かけ算',
  div: 'わり算',
  mitori: '見取算',
  flash: 'フラッシュ暗算',
}

const PRACTICE_STAGE: Record<PracticeStage, string> = {
  unseen: 'まだ',
  beads: '珠で',
  fading: 'うすい珠',
  mental: '暗算',
}

function roundName(kind: PracticeKind): string {
  return `${kind.digits}けたの${OP_NAME[kind.op]}`
}

// A grid cell as VoiceOver reads it, with its level once practised. An
// operation's card reads the same, then its best (spec (home menu) §3).
function practiceCellLabel(kind: PracticeKind, stage: PracticeStage, level?: FadeLevel): string {
  return `${roundName(kind)}、${PRACTICE_STAGE[stage]}${level === undefined ? '' : `、レベル ${level}`}`
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

// One line of a problem's answer card: the rod, then the move worked on it,
// read exactly as a single move's card reads it.
function columnLine(place: number, atom: Atom, cascades: boolean): string {
  return `${PLACE[place] ?? place}　${coaching(atom)}${
    cascades ? (atom.direction === 'add' ? '（さらに上の位へ繰り上がる）' : '（さらに上の位から繰り下がる）') : ''
  }`
}

// Spec (core rounds) §11: the heading over a section's lines — what the
// section does, then what the soroban reads before and after it, or for ÷
// what is left — so the learner can see where each section's clicks end
// (the owner, 2026-09-27). A number is named without its sign: 「−59をひく」
// would read as taking away −59.
function sectionHeading(section: StepSection): string {
  const change = `${section.before} → ${section.after}`
  switch (section.kind) {
    case 'number':
      return `${Math.abs(section.value)}を${section.value < 0 ? 'ひく' : 'たす'}　${change}`
    case 'multiply':
      return `${section.x}×${section.multiplier}　${change}`
    case 'divide':
      return `商${section.q}　のこり ${change}`
  }
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

function divideWalk(problem: PairProblem, step: WalkStep): WalkCaption {
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

// A miss on the beads, once the steps have taken the learner's beads over:
// the answer line, then what their beads read (the owner, 2026-09-29).
function correctionWithGiven(line: string, given: number): string {
  return `${line}　${beadReadingLabel(given)}`
}

// The number shown under answered beads, as VoiceOver reads it.
function beadReadingLabel(given: number): string {
  return `あなたの答え ${given}`
}

// No plural branch — Japanese has none. The English catalog needs one.
function breakdown(value: number): string {
  const earth = value % 5
  if (value === 0) return '珠がひとつも入っていません'
  if (value < 5) return `一珠が${earth}つ`
  if (earth === 0) return '五珠だけ'
  return `五珠と一珠${earth}つで 5 + ${earth}`
}

// Spec (runs) §4: 練習 marks the ranks as the app's own, so they are not
// taken for 珠算検定 grades. Rank 0 is 10級, rank 9 is 1級, rank 10 初段.
const DAN = ['初', '二', '三', '四', '五', '六', '七', '八', '九', '十']
function rankGrade(rank: number): string {
  return rank < 10 ? `${10 - rank}級` : `${DAN[rank - 10] ?? ''}段`
}

function rankToNext(points: number): string {
  return `次まで あと${formatPoints(points)}点`
}

// Spec (見取算) §4: a column of numbers read as one sentence, signs and all,
// since the column writes no plus signs. A フラッシュ暗算 problem's column
// reads the same once its steps show it (spec (flash) §2).
function columnReading(terms: readonly number[]): string {
  return `${terms
    .map((term, index) => (index === 0 ? `${term}` : `${term < 0 ? 'ひく' : 'たす'}${Math.abs(term)}`))
    .join('、')}。`
}

export const ja = {
  loading: '読み込み中…',
  loadingProgress: '進捗を読み込み中…',
  daysPracticed: (days: number) => `練習 ${days}日間`,
  navProgress: '進捗',
  navSettings: '設定',

  start: 'はじめる',
  notYetToday: '今日の練習はまだです',
  practisedToday: '今日は練習しました',
  seeYouTomorrow: 'またあした。',
  // Spec (home menu) §2: Home's menu: its heading, each operation's button,
  // and the button as VoiceOver reads it, with the highest level among the
  // operation's sizes, or まだ while none has been played.
  practiceMenu: '練習',
  menuName: (op: Operation) => OP_NAME[op],
  menuLabel: (op: Operation, level: FadeLevel | undefined) =>
    `${OP_NAME[op]}、${level === undefined ? PRACTICE_STAGE.unseen : `レベル ${level}`}`,
  // Spec (howto tutorial) §3: an operation's lessons page title, which
  // VoiceOver also reads for the やりかた button that opens it (spec (home
  // menu) §3).
  howToTitle: (op: PairOperation) => `${OP_NAME[op]}のやりかた`,
  // A lesson: its title, its row on the やりかた page (and what VoiceOver
  // reads for the row, done or not), its words and its result.
  lessonTitle: (lesson: Lesson) => {
    const move = techniqueOf(lesson)
    return move === null ? roundName({ op: lesson.op, digits: lesson.digits }) : techniqueName(move.op, move.technique)
  },
  lessonRow,
  lessonRowLabel: (lesson: Lesson, done: boolean) => `${lessonRow(lesson)}${done ? '、できた' : ''}`,
  techniqueIntro: (op: TechniqueOperation, technique: AtomClass) => TECHNIQUE_INTRO[op][technique],
  lessonMethod: (op: TechniqueOperation) => LESSON_METHOD[op],
  multiplyPlacement: (digits: Digits) => MULTIPLY_PLACEMENT[digits],
  lessonResult: (problem: PairProblem, answer: number) => `${lessonExample(problem)} = ${answer}`,
  lessonTry: 'やってみよう',
  lessonAgain: 'もう一問',
  lessonStartRound: '練習をはじめる',
  sealDays: (days: number) => `${days}\n日`,
  back: '今日',

  languageLabel: '言語',
  resetAll: 'すべての進捗を消す',
  resetConfirm: '本当にすべての進捗を消しますか？',

  done: 'おわる',
  answer: 'こたえる',
  correctionAnswer,
  correctionWithGiven,
  beadReadingLabel,
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
      case 'mitori':
        return columnReading(problem.terms)
      // Spec (flash) §5: its count, never its numbers: they flash.
      case 'flash':
        return `フラッシュ暗算、${problem.terms.length}口`
    }
  },
  columnReading,
  // Spec (flash) §2, §5: the counter with a flashed number, and what
  // VoiceOver hears once the flash is over and the beads are the learner's.
  flashCounter: (index: number, total: number) => `${index}/${total}`,
  flashAnswer: 'こたえてください',
  // Spec (home menu) §4: in the prompt's place once the flash is over, until
  // the answer is in. The owner (2026-10-07) took こたえる and もどす for
  // broken: nothing on screen said the fifth number was theirs to add. It
  // breaks after 、: left to wrap, an iPhone 17 Pro split it inside ましょう
  // and put ょう alone on the second line.
  flashAddLast: '5つめの数を珠でたして、\nこたえましょう',
  columnLine,
  sectionHeading,
  productLine,
  quotientLine,
  subtractLine,
  roundSection: 'けたの練習',
  digitsName: (digits: Digits) => `${digits}けた`,
  practiceStageName: (stage: PracticeStage) => PRACTICE_STAGE[stage],
  practiceCellLabel,
  // Spec (home menu) §3: an operation's page: its title, a size's card as
  // VoiceOver reads it, and the button to its lessons (＋ − × ÷ only).
  operationName: (op: Operation) => OP_NAME[op],
  practiceCardLabel: (
    kind: PracticeKind,
    stage: PracticeStage,
    level: FadeLevel | undefined,
    best: number | undefined,
  ) => `${practiceCellLabel(kind, stage, level)}${best === undefined ? '' : `、ベスト ${formatPoints(best)}点`}`,
  howToButton: 'やりかた',
  // The owner (2026-09-30): the level a kind is at, on the fade ladder's own
  // 0–6, in the grid and, out of the top one, during a round.
  levelName: (level: FadeLevel) => `レベル ${level}`,
  roundLevel: (level: FadeLevel) => `レベル ${level}/${MAX_FADE}`,
  // Spec (runs) §4–§5: the rank, as Home and the results show it.
  rankName: (rank: number) => `練習${rankGrade(rank)}`,
  rankSeal: (rank: number) => `練習\n${rankGrade(rank)}`,
  rankToNext,
  rankTop: '最高位です',
  rankLabel: (rank: number, toNext: number) => `練習${rankGrade(rank)}、${toNext === 0 ? '最高位です' : rankToNext(toNext)}`,

  // Spec (runs) §5: the run's bar, and what a miss leaves (said with the ✕).
  runScore: (score: number) => `${formatPoints(score)}点`,
  runCombo: (combo: number, factor: number) => `${combo}れんぞく ×${factor}`,
  runBarLabel: (lives: number, level: FadeLevel, score: number) =>
    `ライフ ${lives}、レベル ${level}/${MAX_FADE}、${formatPoints(score)}点`,
  livesLeft: (lives: number) => (lives === 0 ? 'ライフなし' : `のこりライフ ${lives}`),

  // Spec (runs) §5: the results.
  resultsScore: 'スコア',
  newBest: '自己ベスト！',
  bestScore: (best: number) => `ベスト ${formatPoints(best)}点`,
  resultsRight: (right: number) => `正解 ${right}`,
  resultsCombo: (combo: number) => `最大れんぞく ${combo}`,
  resultsLevel: (level: FadeLevel) => `最高レベル ${level}`,
  rankUp: (rank: number) => `練習${rankGrade(rank)}に上がりました！`,
  runAgain: 'もう一回',

  // Spec (runs) §5 (the owner, 2026-10-06): 戻る in the run's bar, and what
  // VoiceOver says it does: show the problem before afresh.
  goBack: '戻る',
  goBackLabel: '前の問題にもどる',

  readingIndex: (index: number, total: number) => `${total}問中 ${index}問目`,
  readingPrompt: 'このけたはいくつですか？',
  check: 'たしかめる',
  readingInstruction: '梁（はり）につけた珠だけを数えます。上の五珠は5、下の一珠は1つにつき1です。けたの数はその合計です。',
  readingFeedback: (target: number) => `ちがいます。このけたは${target}です。${breakdown(target)}。`,
  readingTitle: 'そろばんの読み方',

  // How 両落とし works: the × lessons' first page (spec (howto tutorial) §2).
  introMethod:
    'かけ算は、答えだけをそろばんに入れていきます（両落とし（りょうおとし））。かけられる数の上の位から順に、その一つ一つに、かける数の上の位から順にかけて、九九の答えをたしていきます。',
  // The owner's request (2026-09-24): a way back through the walkthrough,
  // not just forward.
  introBack: 'もどる',
  // The walkthroughs' ✕, read by VoiceOver.
  introExit: '説明をやめる',
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
