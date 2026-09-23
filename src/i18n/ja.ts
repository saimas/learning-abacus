import { classify, startValue, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
// Type-only on purpose: AtomGrid imports useStrings from '@/i18n', so a value import here would create a real runtime cycle.
import type { CellState } from '@/ui/progress/AtomGrid'
// Type-only on purpose, for the same reason as CellState: PracticeTable will import useStrings from '@/i18n'.
import type { PracticeStage } from '@/ui/progress/PracticeTable'
import {
  practiceId,
  ROUND_LENGTH,
  type Digits,
  type Operation,
  type PracticeId,
  type PracticeKind,
  type Problem,
} from '@/domain/problem'
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
// soroban has four rods; a 3×3 multiplication's product can take six.
const PLACE: readonly string[] = ['一の位', '十の位', '百の位', '千の位', '万の位', '十万の位']

const OP_NAME: Record<Operation, string> = { add: 'たし算', sub: 'ひき算', mul: 'かけ算' }

// One fixed example per kind for the chooser's detail line.
const EXAMPLE: Record<PracticeId, string> = {
  'add:1': '7 + 8',
  'add:2': '23 + 58',
  'add:3': '472 + 385',
  'sub:1': '9 − 4',
  'sub:2': '81 − 36',
  'sub:3': '634 − 258',
  'mul:1': '7 × 8',
  'mul:2': '47 × 36',
  'mul:3': '472 × 385',
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

// Declared as a function rather than inline on the object: a member
// referencing `ja` from inside the initialiser of `ja` makes `typeof ja`
// circular, which TypeScript rejects.
// Everything in the coaching sentence before the steps themselves, so the
// answer card can set each step apart and highlight the one being replayed.
function coachingLead(atom: Atom): string {
  const name = TECHNIQUE[classify(atom)][atom.direction]
  const verb = atom.direction === 'add' ? 'たす' : 'ひく'
  const move = `${atom.operand}を${verb} = `
  return name === '' ? move : `${name}：${move}`
}

function coaching(atom: Atom): string {
  return `${coachingLead(atom)}${describeSteps(atom)}`
}

// One line of a × problem's answer card: the 九九 with its product written
// as two digits, as it is said (2×3 is ゼロロク), then where each non-zero
// digit goes.
function productLine(x: number, y: number, place: number, cascades: boolean): string {
  const product = x * y
  const digits = (
    [
      [Math.floor(product / 10), place + 1],
      [product % 10, place],
    ] as const
  )
    .filter(([digit]) => digit !== 0)
    .map(([digit, at]) => `${PLACE[at] ?? at}に${digit}`)
  const head = `${x}×${y}=${String(product).padStart(2, '0')}`
  return `${digits.length === 0 ? head : `${head}　${digits.join('、')}`}${cascades ? '（さらに上の位へ繰り上がる）' : ''}`
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
  startMinutes: '5分',
  notYetToday: '今日の練習はまだです',
  practisedToday: '今日は練習しました',
  seeYouTomorrow: 'またあした。',
  practiseAgain: 'もう一度練習する',
  chooseTitle: 'なにを練習しますか',
  chooseAll: 'ぜんぶ',
  chooseAllDetail: `${BLOCK_LABEL.warmup} → ${BLOCK_LABEL.focus} → ${BLOCK_LABEL.faderep}・5分`,
  chooseOnly: (part: PracticePart) => `${BLOCK_LABEL[part]}だけ`,
  chooseDetail: (part: PracticePart, count: number) => CHOOSE_DETAIL[part](count),
  chooseEmpty: '今はありません',
  chooseClose: '閉じる',
  mapPreviewTitle: '暗算できる動き',
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
  correctionAnswer: (expected: number) => `こたえは ${expected}`,
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
  watchAgain: 'もう一度見る',
  next: 'つぎへ',
  replayStep: (step: number, total: number) => `${step} / ${total}`,
  rodName: (place: number): string => PLACE[place] ?? `${place}`,
  problemPrompt: (problem: Problem) =>
    problem.op === 'add'
      ? `${problem.a}に${problem.b}をたす。`
      : problem.op === 'sub'
        ? `${problem.a}から${problem.b}をひく。`
        : `${problem.a}に${problem.b}をかける。`,
  // One line of a problem's answer card: the rod, then the move worked on
  // it, read exactly as a single move's card reads it.
  columnLine: (place: number, atom: Atom, cascades: boolean) =>
    `${PLACE[place] ?? place}　${coaching(atom)}${
      cascades ? (atom.direction === 'add' ? '（さらに上の位へ繰り上がる）' : '（さらに上の位から繰り下がる）') : ''
    }`,
  productLine,
  roundCount: (index: number, total: number) => `${index} / ${total}`,
  roundComplete: 'けたの練習おわり',
  roundSection: 'けたの練習',
  opName: (op: Operation) => OP_NAME[op],
  digitsName: (digits: Digits) => `${digits}けた`,
  roundName,
  roundDetail: (kind: PracticeKind) => `${EXAMPLE[practiceId(kind)]} など・${ROUND_LENGTH}問`,
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
    'かけ算は、答えだけをそろばんに入れていきます（両落とし）。かけられる数の大きい位から、かける数の大きい位へと順に九九をして、その答えをたしていきます。',
  introPlacement:
    '九九の答えの一の位は、一の位どうしなら一の位、十の位と一の位なら十の位、十の位どうしなら百の位に入れます。十の位は、その一つ上の位です。',
  introResult: (a: number, b: number, product: number) => `${a}×${b} = ${product}`,
  chooseHowTo: 'やりかた',
}

// The contract every catalog satisfies, derived from the catalog that ships
// by default rather than hand-written — so a missing or wrong-arity key in
// `en` fails `tsc` instead of rendering a blank label on a learner's device.
export type Strings = typeof ja
