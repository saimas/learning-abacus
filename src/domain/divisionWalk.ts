import {
  answerOf,
  applyPlacedStep,
  divisorFirstDigit,
  playDigits,
  productDigits,
  rodsFor,
  type PlacedStep,
  type Problem,
} from './problem'
import { emptySoroban, readValue, setValue, type Soroban } from './soroban'

// A digit put on or taken off a rod by a walkthrough step, for the badge
// over that rod: +5 placed, −1 taken off.
export type WalkMark = { rodIndex: number; amount: number }

// A quotient digit as the walkthrough's answer boxes show it: `trial` until
// every 九九 of it has come off (the owner, 2026-09-24: "the candidate has to
// pass through each digit").
export type WalkDigit = { digit: number; trial: boolean }

// What every step carries besides its own numbers. `steps` are its bead
// steps, played one per ▶; `left` is what is left below the quotient's rods
// once the step is done; `focus` the rods it works on (indices, highest
// place first); `divisorPlaces` the divisor's digits it uses, for the
// problem line to underline; `answer` the answer boxes after it, highest
// place first, null where no digit is placed yet.
type WalkCommon = {
  steps: PlacedStep[]
  cascades: boolean
  left: number
  focus: number[]
  marks: WalkMark[]
  divisorPlaces: number[]
  answer: (WalkDigit | null)[]
}

// The owner (2026-09-24), after the web walkthrough finally made 商除法 make
// sense: the app's walkthrough should work 1692 ÷ 36 the same way, guess by
// guess. Each step is one explanation:
// - `set`: the dividend on the soroban;
// - `guess`: the next quotient digit (place `p`) guessed by 九九, `partial`
//   (the head of what is left) ÷ the divisor's first digit; `chunk` is what
//   is left counted in 10^p's (169 tens), the number the digit divides;
//   `raw` the 九九's own answer before the cap at 9;
// - `try`: the guess placed on its rod, one or two left of the head of what
//   is left (`split`, from `lead` as in the round's step lines);
// - `take`: one 九九 of the digit on trial and the divisor's digit `y` (at
//   place `j`), `amount` = digit × 10^p × y × 10^j, taken off `before`;
//   `resumed` if it carries on after a fix, `last` if it is the digit's
//   last 九九, so the digit has come through them all;
// - `stuck`: that 九九 will not come off what is left: the digit is too big;
// - `fix`: the digit lowered by one, and one copy of the divisor digits
//   already taken off for it (`taken`, e.g. 30) put back, `back` =
//   taken × 10^p. That lands exactly where going back to the lane's start
//   (`laneStart`) and taking the lowered digit's 九九 would: the owner's own
//   picture of the fix ("go back to the point of the current lane then
//   adjust the number and try again");
// - `done`: the quotient read off the left.
export type WalkStep = WalkCommon &
  (
    | { kind: 'set' }
    | {
      kind: 'guess'
      p: number
      chunk: number
      partial: number
      raw: number
      guess: number
      remainderZero: boolean
    }
    | { kind: 'try'; p: number; digit: number; lead: number; split: boolean }
    | {
      kind: 'take'
      p: number
      digit: number
      y: number
      j: number
      amount: number
      before: number
      resumed: boolean
      last: boolean
    }
    | { kind: 'stuck'; p: number; digit: number; y: number; j: number; amount: number }
    | { kind: 'fix'; p: number; from: number; taken: number; back: number; before: number; laneStart: number }
    | { kind: 'done' }
  )

function digitAt(n: number, place: number): number {
  return Math.floor(n / 10 ** place) % 10
}

// Spec (division walkthrough) §2: 商除法 as a learner really works it. Where
// the rounds' steps place the right digit at once, this places the 九九
// guess and takes its 九九 off one by one; when one will not come off, it
// lowers the digit and puts back what was taken too much, then carries on
// from the 九九 that stuck. The guess is never too small, so a digit that
// comes through every 九九 is the quotient's, and the soroban ends where the
// rounds' does.
export function divisionWalk(problem: Problem): WalkStep[] {
  const n = problem.digits
  const rods = rodsFor(problem)
  const quotient = answerOf(problem)
  const d0 = divisorFirstDigit(problem)
  const rodOf = (place: number) => rods - 1 - place
  // The rods a number sits on when its lowest digit is at `place`.
  const rodsSpanned = (value: number, place: number) =>
    value === 0 ? [] : Array.from({ length: String(value).length }, (_, k) => rodOf(place + String(value).length - 1 - k))
  const answer: (WalkDigit | null)[] = Array.from({ length: n }, () => null)
  const setAnswer = (p: number, digit: WalkDigit) => {
    answer[n - 1 - p] = digit
  }

  let soroban: Soroban = setValue(emptySoroban(rods), problem.a)
  const walk: WalkStep[] = [
    {
      kind: 'set',
      steps: [],
      cascades: false,
      left: problem.a,
      focus: rodsSpanned(problem.a, 0),
      marks: [],
      divisorPlaces: [],
      answer: [...answer],
    },
  ]
  // Plays digits on the rods, returning the bead steps.
  const play = (digits: [digit: number, place: number][], direction: 'add' | 'sub') => {
    const played = playDigits(soroban, digits, direction)
    soroban = played.soroban
    return {
      steps: played.moves.flatMap((move) => move.steps),
      cascades: played.moves.some((move) => move.cascades),
    }
  }

  for (let p = n - 1; p >= 0; p--) {
    const place = p + n + 1
    const leftNow = () => readValue(soroban) % 10 ** place
    const laneStart = leftNow()
    const chunk = Math.floor(laneStart / 10 ** p)
    const partial = Math.floor(laneStart / 10 ** (p + n - 1))
    const raw = Math.floor(partial / d0)
    const guess = Math.min(9, raw)
    const remainderZero = laneStart === 0
    if (guess === 0) setAnswer(p, { digit: 0, trial: false })
    walk.push({
      kind: 'guess',
      p,
      chunk,
      partial,
      raw,
      guess,
      remainderZero,
      steps: [],
      cascades: false,
      left: laneStart,
      focus: rodsSpanned(chunk, p),
      marks: [],
      divisorPlaces: [n - 1],
      answer: [...answer],
    })
    if (guess === 0) continue

    const head = String(laneStart).length - 1
    const lead = Math.floor(laneStart / 10 ** Math.max(0, head - n + 1))
    let digit = guess
    setAnswer(p, { digit, trial: true })
    walk.push({
      kind: 'try',
      p,
      digit,
      lead,
      split: place - head === 2,
      ...play([[digit, place]], 'add'),
      left: laneStart,
      focus: [rodOf(place)],
      marks: [{ rodIndex: rodOf(place), amount: digit }],
      divisorPlaces: [],
      answer: [...answer],
    })

    // The divisor's digits taken off for the digit on trial so far, as a
    // number (30 once 5 × 3 is off, for 36).
    let taken = 0
    let resumed = false
    for (let j = n - 1; j >= 0; ) {
      const y = digitAt(problem.b, j)
      const amount = digit * y * 10 ** (p + j)
      const before = leftNow()
      const nineNinePlaces = [rodOf(p + j + 1), rodOf(p + j)]
      const nineNineMarks = productDigits(digit * y, p + j)
        .filter(([d]) => d !== 0)
        .map(([d, at]) => ({ rodIndex: rodOf(at), amount: -d }))
      if (amount <= before) {
        const last = j === 0
        if (last) setAnswer(p, { digit, trial: false })
        walk.push({
          kind: 'take',
          p,
          digit,
          y,
          j,
          amount,
          before,
          resumed,
          last,
          ...play(productDigits(digit * y, p + j), 'sub'),
          left: before - amount,
          focus: nineNinePlaces,
          marks: nineNineMarks,
          divisorPlaces: [j],
          answer: [...answer],
        })
        taken += y * 10 ** j
        resumed = false
        j--
        continue
      }
      walk.push({
        kind: 'stuck',
        p,
        digit,
        y,
        j,
        amount,
        steps: [],
        cascades: false,
        left: before,
        focus: nineNinePlaces,
        marks: nineNineMarks,
        divisorPlaces: [j],
        answer: [...answer],
      })
      // The guess is never too small, so a digit that sticks is at least 1
      // too big, and lowering it keeps it at or above the quotient's digit.
      const takenDigits: [number, number][] = []
      for (let k = n - 1; k > j; k--) takenDigits.push([digitAt(taken, k), p + k])
      const lowered = play([[1, place]], 'sub')
      const putBack = play(takenDigits, 'add')
      const back = taken * 10 ** p
      digit -= 1
      setAnswer(p, { digit, trial: digit !== 0 })
      walk.push({
        kind: 'fix',
        p,
        from: digit + 1,
        taken,
        back,
        before,
        laneStart,
        steps: [...lowered.steps, ...putBack.steps],
        cascades: lowered.cascades || putBack.cascades,
        left: before + back,
        focus: [rodOf(place), ...takenDigits.filter(([d]) => d !== 0).map(([, at]) => rodOf(at))],
        marks: [
          { rodIndex: rodOf(place), amount: -1 },
          ...takenDigits.filter(([d]) => d !== 0).map(([d, at]) => ({ rodIndex: rodOf(at), amount: d })),
        ],
        divisorPlaces: takenDigits.map(([, at]) => at - p),
        answer: [...answer],
      })
      // Lowered to 0: nothing of it was due, and everything is back.
      if (digit === 0) break
      resumed = true
    }
    if (digit !== digitAt(quotient, p)) throw new Error(`walk settled on ${digit}, not ${digitAt(quotient, p)}`)
  }

  walk.push({
    kind: 'done',
    steps: [],
    cascades: false,
    left: 0,
    focus: Array.from({ length: n }, (_, k) => rodOf(2 * n - k)),
    marks: [],
    divisorPlaces: [],
    answer: [...answer],
  })
  return walk
}

// What one ▶ shows: step `step` of the walk, with state `state` of
// walkStates on the soroban.
export type WalkFrame = { step: number; state: number }

// The owner chose one bead step per ▶ (2026-09-24), as when stepping a
// round: a step with beads is a frame per bead step, its first frame
// already showing its first bead moved; a step without beads is one frame,
// the soroban as the step before left it. `groupStarts` is where each step's
// bead steps start among the states' steps, for stepColouring.
export function walkFrames(walk: WalkStep[]): { frames: WalkFrame[]; groupStarts: number[] } {
  const frames: WalkFrame[] = []
  const groupStarts: number[] = []
  let state = 0
  walk.forEach((step, index) => {
    groupStarts.push(state)
    if (step.steps.length === 0) frames.push({ step: index, state })
    for (let k = 0; k < step.steps.length; k++) {
      state += 1
      frames.push({ step: index, state })
    }
  })
  return { frames, groupStarts }
}

// The soroban at the start, then after each bead step of the walk.
export function walkStates(problem: Problem, walk: WalkStep[]): Soroban[] {
  let current = setValue(emptySoroban(rodsFor(problem)), problem.a)
  const states = [current]
  for (const step of walk) {
    for (const placed of step.steps) {
      current = applyPlacedStep(current, placed)
      states.push(current)
    }
  }
  return states
}
