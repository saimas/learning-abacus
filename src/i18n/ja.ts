import { classify, startValue, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
// Type-only on purpose: AtomGrid imports useStrings from '@/i18n', so a value import here would create a real runtime cycle.
import type { CellState } from '@/ui/progress/AtomGrid'
import type { BlockKind } from '@/domain/session'

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

// Declared as a function rather than inline on the object: a member
// referencing `ja` from inside the initialiser of `ja` makes `typeof ja`
// circular, which TypeScript rejects.
function coaching(atom: Atom): string {
  const name = TECHNIQUE[classify(atom)][atom.direction]
  const verb = atom.direction === 'add' ? 'たす' : 'ひく'
  const move = `${atom.operand}を${verb} = ${describeSteps(atom)}`
  return name === '' ? move : `${name}：${move}`
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
  blockLabel: (kind: BlockKind) => BLOCK_LABEL[kind],
  previousProblem: 'さっきの問題',
  correctionAnswer: (expected: number) => `こたえは ${expected}`,
  correct: '正解',
  quitLabel: '練習をやめる',
  quitTitle: '練習をやめますか？',
  quitBody: 'ここまでの答えは記録されています。',
  quitStop: 'やめる',
  quitContinue: 'つづける',
  sealDone: '済',
  deleteKey: '1文字消す',
  beadHint: '珠をタップして動かします',
  resetBeads: 'もどす',
  rodName: (place: number): string => (place === 0 ? '一の位' : '十の位'),

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
}

// The contract every catalog satisfies, derived from the catalog that ships
// by default rather than hand-written — so a missing or wrong-arity key in
// `en` fails `tsc` instead of rendering a blank label on a learner's device.
export type Strings = typeof ja
