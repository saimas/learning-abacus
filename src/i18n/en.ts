import { startValue, type Atom } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
// Type-only on purpose: AtomGrid imports useStrings from '@/i18n', so a value import here would create a real runtime cycle.
import type { CellState } from '@/ui/progress/AtomGrid'
// Type-only on purpose, for the same reason as CellState: PracticeTable will import useStrings from '@/i18n'.
import type { PracticeStage } from '@/ui/progress/PracticeTable'
import { practiceId, ROUND_LENGTH, type Operation, type PracticeId, type PracticeKind } from '@/domain/problem'
import type { BlockKind, PracticePart } from '@/domain/session'
import type { Strings } from './ja'

const CELL_STATE: Record<CellState, string> = {
  unseen: 'unseen',
  learning: 'learning',
  reflex: 'reflex',
  mental: 'mental',
}

const BLOCK_LABEL: Record<BlockKind, string> = {
  warmup: 'Warm-up',
  focus: 'Focus',
  faderep: 'Fade',
  close: 'Close',
}

function moves(count: number): string {
  return `${count} ${count === 1 ? 'move' : 'moves'}`
}

// What each part holds, as the chooser's detail line.
const CHOOSE_DETAIL: Record<PracticePart, (count: number) => string> = {
  warmup: (count) => `Review · ${moves(count)}`,
  focus: () => 'New and shaky moves',
  faderep: (count) => `Fading the beads · ${moves(count)}`,
}

// A rod's name by its place, 0 being the ones rod, in a sentence and as a
// line's heading.
const PLACE: readonly string[] = ['ones rod', 'tens rod', 'hundreds rod', 'thousands rod']
const PLACE_TITLE: readonly string[] = ['Ones', 'Tens', 'Hundreds', 'Thousands']

const OP_NAME: Record<Operation, string> = { add: 'Addition', sub: 'Subtraction' }

// One fixed example per kind for the chooser's detail line.
const EXAMPLE: Record<PracticeId, string> = {
  'add:1': '7 + 8',
  'add:2': '23 + 58',
  'add:3': '472 + 385',
  'sub:1': '9 − 4',
  'sub:2': '81 − 36',
  'sub:3': '634 − 258',
}

const PRACTICE_STAGE: Record<PracticeStage, string> = {
  unseen: 'not yet',
  beads: 'beads',
  fading: 'fading',
  mental: 'mental',
}

function roundName(kind: PracticeKind): string {
  return `${kind.digits}-digit ${OP_NAME[kind.op].toLowerCase()}`
}

// English names no technique: this is the wording `explainMove` has today,
// moved rather than rewritten. Only `ja.coaching` consults `classify`.
function coachingLead(atom: Atom): string {
  const verb = atom.direction === 'add' ? 'Add' : 'Subtract'
  return `${verb} ${atom.operand} = `
}

function coaching(atom: Atom): string {
  return `${coachingLead(atom)}${describeSteps(atom)}`
}

// Says what the beads on this rod actually add up to, so a miss teaches the reading rather than just resetting the field.
function breakdown(value: number): string {
  const earth = value % 5
  const beads = `${earth} earth bead${earth === 1 ? '' : 's'}`
  if (value === 0) return 'no beads pushed in'
  if (value < 5) return beads
  if (earth === 0) return 'the heaven bead on its own'
  return `the heaven bead and ${beads}, 5 + ${earth}`
}

export const en: Strings = {
  loading: 'Loading…',
  loadingProgress: 'Loading your progress…',
  daysPracticed: (days) => `${days} days practised`,
  navProgress: 'Progress',
  navSettings: 'Settings',

  homeTitle: "Today's five minutes",
  start: 'Start',
  startMinutes: '5 min',
  notYetToday: 'Not practised yet today',
  practisedToday: 'You practised today',
  seeYouTomorrow: 'See you tomorrow.',
  practiseAgain: 'Practise again',
  chooseTitle: 'What would you like to practise?',
  chooseAll: 'Everything',
  chooseAllDetail: `${BLOCK_LABEL.warmup} → ${BLOCK_LABEL.focus} → ${BLOCK_LABEL.faderep} · 5 min`,
  chooseOnly: (part) => `${BLOCK_LABEL[part]} only`,
  chooseDetail: (part, count) => CHOOSE_DETAIL[part](count),
  chooseEmpty: 'Nothing right now',
  chooseClose: 'Close',
  mapPreviewTitle: 'Moves you can do mentally',
  sealDays: (days) => `${days}\n${days === 1 ? 'day' : 'days'}`,
  back: 'Today',

  languageLabel: 'Language',
  resetAll: 'Reset all progress',
  resetConfirm: 'Really erase all progress?',

  sessionComplete: 'Session complete',
  sessionResult: (answered, correct) => `${answered} answered, ${correct} correct`,
  done: 'Done',
  answer: 'Answer',
  prompt: (atom) =>
    `The soroban shows ${startValue(atom)}. ${atom.direction === 'add' ? 'Add' : 'Subtract'} ${atom.operand}.`,
  coaching,
  coachingLead,
  blockLabel: (kind) => BLOCK_LABEL[kind],
  correctionAnswer: (expected) => `The answer is ${expected}`,
  correct: 'Correct',
  wrong: 'Not quite',
  quitLabel: 'Stop practice',
  quitTitle: 'Stop practising?',
  quitBody: 'Your answers so far are saved.',
  quitStop: 'Stop',
  quitContinue: 'Keep going',
  sealDone: 'Done',
  deleteKey: 'Delete',
  beadHint: 'Tap the beads to move them',
  resetBeads: 'Reset',
  showAnswer: 'See answer',
  watchAgain: 'Watch again',
  next: 'Next',
  replayStep: (step, total) => `${step} / ${total}`,
  rodName: (place): string => PLACE[place] ?? `rod ${place}`,
  problemPrompt: (problem) =>
    `The soroban shows ${problem.a}. ${problem.op === 'add' ? 'Add' : 'Subtract'} ${problem.b}.`,
  columnLine: (place, atom, cascades) =>
    `${PLACE_TITLE[place] ?? place}: ${coaching(atom)}${
      cascades ? (atom.direction === 'add' ? ' (the carry moves on a rod)' : ' (the borrow comes from a rod further on)') : ''
    }`,
  roundCount: (index, total) => `${index} / ${total}`,
  roundComplete: 'Practice complete',
  roundSection: 'Bigger numbers',
  opName: (op) => OP_NAME[op],
  digitsName: (digits) => `${digits} ${digits === 1 ? 'digit' : 'digits'}`,
  roundName,
  roundDetail: (kind) => `e.g. ${EXAMPLE[practiceId(kind)]} · ${ROUND_LENGTH} problems`,
  practiceStageName: (stage) => PRACTICE_STAGE[stage],
  practiceCellLabel: (kind, stage) => `${roundName(kind)}, ${PRACTICE_STAGE[stage]}`,

  atomSummary: (mental, total) => `${mental} of ${total} moves are mental`,
  cellLabel: (atomId, state) => `${atomId} ${CELL_STATE[state]}`,
  cellStateName: (state) => CELL_STATE[state],
  mapAdd: 'Addition',
  mapSub: 'Subtraction',
  mapAxis: "Rows: the rod's value (0–9) · Columns: the number added or taken away (1–9)",

  readingIndex: (index, total) => `Rod ${index} of ${total}`,
  readingPrompt: 'What number is on this rod?',
  check: 'Check',
  readingInstruction:
    'The heaven bead above the bar is worth 5. Each earth bead pushed up to the bar is worth 1. The rod reads as their total.',
  readingFeedback: (target) => `Not quite. This rod shows ${target}: ${breakdown(target)}.`,
  readingTitle: 'Reading the soroban',
}
