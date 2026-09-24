import { startValue, type Atom } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
// Type-only on purpose: AtomGrid imports useStrings from '@/i18n', so a value import here would create a real runtime cycle.
import type { CellState } from '@/ui/progress/AtomGrid'
// Type-only on purpose, for the same reason as CellState: PracticeTable will import useStrings from '@/i18n'.
import type { PracticeStage } from '@/ui/progress/PracticeTable'
import type { Operation, PracticeKind, Problem } from '@/domain/problem'
import type { BlockKind, PracticePart } from '@/domain/session'
import type { WalkStep } from '@/domain/divisionWalk'
import type { Strings, WalkCaption } from './ja'

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
// line's heading. A 3×3 multiplication's product can take six rods, and a
// 3-digit division works on seven.
const PLACE: readonly string[] = [
  'ones rod',
  'tens rod',
  'hundreds rod',
  'thousands rod',
  'ten-thousands rod',
  'hundred-thousands rod',
  'millions rod',
]
// A rod's name in a few characters, for the row under the division
// walkthrough's soroban.
const PLACE_SHORT: readonly string[] = ['1', '10', '100', '1000', '10k', '100k', '1M']
// A quotient digit named by its place, for the division walkthrough.
const DIGIT_NAME: readonly string[] = ['ones', 'tens', 'hundreds']
const PLACE_TITLE: readonly string[] = [
  'Ones',
  'Tens',
  'Hundreds',
  'Thousands',
  'Ten-thousands',
  'Hundred-thousands',
  'Millions',
]

const OP_NAME: Record<Operation, string> = {
  add: 'Addition',
  sub: 'Subtraction',
  mul: 'Multiplication',
  div: 'Division',
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

// A 九九 with its product written as two digits, as the Japanese line
// writes it.
function nineNine(x: number, y: number): string {
  return `${x} × ${y} = ${String(x * y).padStart(2, '0')}`
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
  const digits = productDigits(x * y, place).map(([digit, at]) => `${digit} on the ${PLACE[at] ?? `rod ${at}`}`)
  return `${digits.length === 0 ? head : `${head}: ${digits.join(', ')}`}${cascades ? ' (and carries again into the next rod)' : ''}`
}

// One line of a ÷ problem's answer card for a 九九 taken off the remainder:
// the 九九, then the rod each non-zero digit comes off. A 0 divisor digit
// still has its 九九 to recall, so it gets its line, with nothing to take off.
function subtractLine(q: number, y: number, place: number, cascades: boolean): string {
  const head = nineNine(q, y)
  const digits = productDigits(q * y, place).map(([digit, at]) => `${digit} from the ${PLACE[at] ?? `rod ${at}`}`)
  return `${digits.length === 0 ? head : `${head}: take ${digits.join(', ')}`}${cascades ? ' (borrowing from a rod further left)' : ''}`
}

// One line of a ÷ problem's answer card for a quotient digit, as ja's: the
// guess by times table (the head of what is left ÷ the divisor's first
// digit), why a guess too big to take away was lowered to q, then where q
// goes. A 0 is not placed at all, so its line names no rod.
function quotientLine(
  q: number,
  partial: number,
  d0: number,
  guess: number,
  split: boolean,
  remainderZero: boolean,
): string {
  // Nothing left at all can only give a 0, and a head too small for the
  // first digit guesses 0; both are said directly, as ja does.
  if (remainderZero) return 'Nothing is left here: quotient 0, nothing to place.'
  if (guess === 0) return `${d0} doesn't go into the head: quotient 0, nothing to place.`
  // A digit is at most 9, so "Estimate 32 ÷ 3 = 9" would be wrong
  // arithmetic; the capped guess says why it is 9.
  const estimate =
    Math.floor(partial / d0) > 9 ? `${partial} ÷ ${d0} is 10 or more, so guess 9.` : `Estimate ${partial} ÷ ${d0} = ${guess}.`
  // A guess too big by more than one is lowered until it fits, as ja says.
  const lowered =
    guess - q >= 2
      ? ` ${guess} is too big to take away; lower it until it fits: ${q}.`
      : guess > q
        ? ` ${guess} is too big to take away, so use ${q}.`
        : ''
  // "nothing to place" already reads right wherever the 0 falls, but it is
  // named alongside ja's wording fix so the two stay in step.
  const placed = q === 0 ? ' Quotient 0: nothing to place.' : ` Place ${q} ${split ? 'two rods' : 'one rod'} left of the head.`
  return `${estimate}${lowered}${placed}`
}

// The division walkthrough's words for one step, as ja's (spec: division
// walkthrough §3).
function divideWalk(problem: Problem, step: WalkStep): WalkCaption {
  const { a, b } = problem
  const n = problem.digits
  const none: WalkCaption = { what: '', math: '', note: '', rods: '' }
  const d0 = Math.floor(b / 10 ** (n - 1))
  const listed = (items: string[]) =>
    items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`
  // The digit's times tables with each divisor digit, from the top: a digit
  // is right once they all come off.
  const nineNines = (digit: number) =>
    listed(Array.from({ length: n }, (_, k) => `${digit} × ${Math.floor(b / 10 ** (n - 1 - k)) % 10}`))
  const all = n === 1 ? '' : n === 2 ? 'both ' : 'all '
  switch (step.kind) {
    case 'set':
      return {
        ...none,
        what: `Set ${a} on the soroban`,
        note: `How many ${b}s fit into ${a}? The answer is found one digit at a time, from the top. The leftmost rod stays empty: the answer grows there.`,
      }
    case 'guess': {
      const word = DIGIT_NAME[step.p] ?? `place ${step.p}`
      if (step.remainderZero) {
        return { ...none, what: `The ${word} digit: nothing is left`, note: 'Nothing is left, so this digit is 0 (nothing to place).' }
      }
      const product = d0 * step.guess
      const note =
        step.guess === 0
          ? `${d0} doesn't go into ${step.partial}, so this digit is 0 (nothing to place).`
          : n === 1
            ? `Times tables: ${d0} × ${step.guess} = ${product} fits in ${step.partial}.`
            : `Pretend ${b} is ${d0 * 10 ** (n - 1)} and use the times tables: ${d0} × ${step.guess} = ${product} fits in ${step.partial}.`
      return {
        ...none,
        what: `The ${word} digit: how many ${b}s fit into ${step.chunk}?`,
        math: `Guess ${step.partial} ÷ ${d0} → ${step.raw > 9 ? '10 or more, so 9' : step.guess}`,
        note,
      }
    }
    case 'try':
      return {
        ...none,
        what: `Try ${step.digit} (${step.digit * 10 ** step.p} × ${b})`,
        note: `The head of what's left, ${step.lead}, is ${
          step.split ? `${b} or more, so it goes two rods left of the head` : `smaller than ${b}, so it goes one rod left of the head`
        }. If ${nineNines(step.digit)} ${all}come${n === 1 ? 's' : ''} off, ${step.digit} is right.`,
      }
    case 'take':
      return {
        what: `${step.resumed ? 'Carry on: take' : 'Take'} away ${step.digit * 10 ** step.p} × ${step.y * 10 ** step.j} = ${step.amount}`,
        math: `${step.before} − ${step.amount} = ${step.left}${step.last ? ' ✓' : ''}`,
        note: step.last ? `${nineNines(step.digit)} ${all}came off, so ${step.digit} is right.` : '',
        rods: `On the rods: ${subtractLine(step.digit, step.y, step.p + step.j, step.cascades)}`,
      }
    case 'stuck':
      return {
        ...none,
        what: `Take away ${step.digit * 10 ** step.p} × ${step.y * 10 ** step.j} = ${step.amount} … it won't go`,
        math: `${step.left} − ${step.amount} ✗`,
        note: `Only ${step.left} is left, less than ${step.amount}. ${step.digit} is too big.`,
      }
    case 'fix': {
      const to = step.from - 1
      const unit = 10 ** step.p
      const putBack = listed(
        Array.from({ length: n }, (_, k) => n - 1 - k)
          .map((j) => [Math.floor(step.taken / 10 ** j) % 10, step.p + j] as const)
          .filter(([digit]) => digit !== 0)
          .map(([digit, at]) => `${digit} back on the ${PLACE[at] ?? `rod ${at}`}`),
      )
      const note =
        to === 0
          ? `Even ${step.from * unit} × ${step.taken} was too much. Put all ${step.back} back. This digit is 0 (nothing to place).`
          : `You took away ${step.from * unit} × ${step.taken}, but only ${to * unit} × ${step.taken} was due. Put back the extra ${
            step.p > 0 ? `${unit} × ${step.taken} = ${step.back}` : step.back
          }. No need to start over: it's the same ${step.left} as going back to ${step.laneStart} and taking away ${to * unit} × ${step.taken}.`
      return {
        what: `Fix it: ${step.from} → ${to}, and put back ${step.back}`,
        math: `${step.before} + ${step.back} = ${step.left}`,
        note,
        rods: `On the rods: take 1 off the answer, and put ${putBack}`,
      }
    }
    case 'done':
      return {
        ...none,
        what: 'Read the answer on the left',
        math: `${a} ÷ ${b} = ${a / b}`,
        note: `${a / b} on the left, and 0 on every rod to its right.`,
      }
  }
}

// The answer line shared by a miss's card, its review, and its VoiceOver
// announcement.
function correctionAnswer(expected: number): string {
  return `The answer is ${expected}`
}

// A ÷ miss answered on the beads: 商除法 leaves the quotient followed by
// zeros on the rods (spec (division) §2), so the beads had to read that
// final value, not the quotient `correctionAnswer` already names. Told
// alongside it so a miss teaches what the beads themselves needed to show.
function correctionAnswerOnBeads(expected: number, beads: number): string {
  return `${correctionAnswer(expected)} (the soroban reads ${beads})`
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
  notYetToday: 'Not practised yet today',
  practisedToday: 'You practised today',
  seeYouTomorrow: 'See you tomorrow.',
  chooseTitle: 'What would you like to practise?',
  chooseAll: 'Everything',
  chooseAllDetail: `${BLOCK_LABEL.warmup} → ${BLOCK_LABEL.focus} → ${BLOCK_LABEL.faderep} · 5 min`,
  chooseOnly: (part) => `${BLOCK_LABEL[part]} only`,
  chooseDetail: (part, count) => CHOOSE_DETAIL[part](count),
  chooseEmpty: 'Nothing right now',
  chooseClose: 'Close',
  basicsTitle: 'Basics',
  basicsDetail: 'Single-rod moves · 5 min',
  homeHowTo: 'How multiplication works',
  homeHowToDivide: 'How division works',
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
  correctionAnswer,
  correctionAnswerOnBeads,
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
  next: 'Next',
  replayStep: (step, total) => `${step} / ${total}`,
  stepsOpen: 'Show the steps',
  stepBack: 'Step back',
  stepNext: 'Next step',
  stepRestart: 'From the start',
  stepsClose: 'Close',
  rodName: (place): string => PLACE[place] ?? `rod ${place}`,
  problemPrompt: (problem) => {
    switch (problem.op) {
      case 'mul':
        return `Multiply ${problem.a} by ${problem.b}.`
      case 'div':
        return `Divide ${problem.a} by ${problem.b}.`
      default:
        return `The soroban shows ${problem.a}. ${problem.op === 'add' ? 'Add' : 'Subtract'} ${problem.b}.`
    }
  },
  columnLine: (place, atom, cascades) =>
    `${PLACE_TITLE[place] ?? place}: ${coaching(atom)}${
      cascades
        ? atom.direction === 'add'
          ? ' (and carries again into the next rod)'
          : ' (borrowing from a rod further left)'
        : ''
    }`,
  productLine,
  quotientLine,
  subtractLine,
  roundCount: (index, total) => `${index} / ${total}`,
  roundComplete: 'Practice complete',
  roundSection: 'Bigger numbers',
  digitsName: (digits) => `${digits} ${digits === 1 ? 'digit' : 'digits'}`,
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

  introTitle: 'How to multiply',
  introMethod:
    'Only the answer goes on the soroban (両落とし). Take the first number’s digits from the highest, times the second number’s digits from the highest, and add each times-table answer onto the rods.',
  introPlacement:
    'Each answer’s ones digit goes on the rod for the two places together: ones × ones on the ones rod, tens × ones on the tens rod, tens × tens on the hundreds rod. Its tens digit goes one rod to the left.',
  introResult: (a, b, product) => `${a} × ${b} = ${product}`,
  // The division walkthrough's title (spec: division walkthrough §4).
  divideIntroTitle: 'How to divide',
  divideWalk,
  divideWalkLeft: 'left',
  divideWalkAnswer: 'Answer',
  rodShortName: (place) => PLACE_SHORT[place] ?? `${place}`,
  operandBoardLabel: (a, b) => `${a} × ${b}`,
  divisorBoardLabel: (b) => `Divisor ${b}`,
}
