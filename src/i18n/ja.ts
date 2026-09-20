import { classify, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import type { CellState } from '@/ui/progress/AtomGrid'

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
  reflex: '反射',
  mental: '暗算',
}

// Declared as a function rather than inline on the object: `correction` calls
// it, and a member referencing `ja` from inside the initialiser of `ja` makes
// `typeof ja` circular, which TypeScript rejects.
function coaching(atom: Atom): string {
  const name = TECHNIQUE[classify(atom)][atom.direction === 'add' ? 'add' : 'sub']
  const verb = atom.direction === 'add' ? 'たす' : 'ひく'
  const move = `${atom.operand}を${verb} = ${describeSteps(atom)}`
  return name === '' ? move : `${name}：${move}`
}

// No plural branch — Japanese has none. The English catalog needs one.
function breakdown(value: number): string {
  const earth = value % 5
  if (value === 0) return '珠がひとつも入っていません'
  if (value < 5) return `一珠が${earth}つ`
  if (earth === 0) return '天珠だけ'
  return `天珠と一珠が${earth}つ、5 + ${earth}`
}

export const ja = {
  loading: '読み込み中…',
  loadingProgress: '進捗を読み込んでいます…',
  daysPracticed: (days: number) => `練習 ${days}日`,
  navProgress: '進捗',
  navSettings: '設定',
  navToday: '今日にもどる',

  languageLabel: '言語',
  resetAll: 'すべての進捗を消す',
  resetConfirm: '本当にすべて消しますか？',

  sessionComplete: 'セッション完了',
  sessionResult: (answered: number, correct: number) => `${answered}問中 ${correct}問正解`,
  done: 'おわる',
  answer: 'こたえる',
  prompt: (atom: Atom) =>
    `けたは${atom.rodValue}。${atom.operand}を${atom.direction === 'add' ? 'たす' : 'ひく'}。`,
  coaching,
  correction: (expected: number, atom: Atom) => `こたえは${expected}。${coaching(atom)}`,

  atomSummary: (mental: number, total: number) => `${total}手中 ${mental}手が暗算`,
  cellLabel: (atomId: string, state: CellState) => `${atomId} ${CELL_STATE[state]}`,

  readingIndex: (index: number, total: number) => `${total}問中 ${index}問目`,
  readingPrompt: 'このけたはいくつですか？',
  check: 'たしかめる',
  readingInstruction: '天珠（上の珠）は5、一珠（下の珠）は1です。けたの数はその合計です。',
  readingFeedback: (target: number) => `ちがいます。このけたは${target}です：${breakdown(target)}。`,
}

// The contract every catalog satisfies, derived from the catalog that ships
// by default rather than hand-written — so a missing or wrong-arity key in
// `en` fails `tsc` instead of rendering a blank label on a learner's device.
export type Strings = typeof ja
