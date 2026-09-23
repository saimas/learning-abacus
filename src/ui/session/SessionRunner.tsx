import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { exerciseForAtom } from '@/domain/exercise'
import { FADE_PROMOTE_STREAK, type FadeLevel } from '@/domain/fade'
import {
  MAX_ATTEMPTS_PER_ATOM,
  type BlockKind,
  type SessionBlock,
  type SessionItem,
  type SessionPlan,
} from '@/domain/session'
import { useStrings } from '@/i18n'
import { CorrectionCard } from './CorrectionCard'
import { QuestionView, type Submission } from './QuestionView'
import { SessionSummary } from './SessionSummary'
import { SessionTrack } from './SessionTrack'

// latencyMs is null for an untimed attempt (answered with the beads).
// `assisted` marks an answer given after 手順を見る (spec (core rounds) §5),
// which is kept out of the move's record.
export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number | null; assisted: boolean }

type RunnerState = { blockIndex: number; queue: SessionItem[] }

function parseAtomId(atomId: string): { rodValue: number; operand: number; sign: 1 | -1 } {
  const match = /^(\d)([+-])(\d)$/.exec(atomId)
  if (match === null) throw new Error(`malformed atom id: ${atomId}`)
  const [, rod, op, operand] = match
  return {
    rodValue: Number(rod),
    operand: Number(operand),
    sign: op === '+' ? 1 : -1,
  }
}

// Items whose atom has already failed MAX_ATTEMPTS_PER_ATOM times this
// session are gone for good — they must not come back on the next cycle.
function liveItems(items: SessionItem[], failures: Record<string, number>): SessionItem[] {
  return items.filter((item) => (failures[item.atomId] ?? 0) < MAX_ATTEMPTS_PER_ATOM)
}

// A joined reserve atom's id is never one already in block.items, but this
// keeps the "is everything in play secure" check honest even if that
// invariant ever slips.
function dedupeByAtomId(items: SessionItem[]): SessionItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.atomId)) return false
    seen.add(item.atomId)
    return true
  })
}

// Block k's deadline is the session start plus the running total of every
// block's seconds through k. Cumulative, not per-block, so a skipped or
// drained block's time is inherited by whatever comes next instead of
// shortening the session.
function cumulativeDeadlines(blocks: SessionBlock[], sessionStartedAt: number): number[] {
  const deadlines: number[] = []
  let total = 0
  for (const block of blocks) {
    total += block.seconds
    deadlines.push(sessionStartedAt + total * 1000)
  }
  return deadlines
}

// The block's own cumulative deadline is the right stopping point only when
// something follows it that will actually be shown. Empty blocks at the *tail*
// are skipped straight past by findActiveBlock, and their slice of the budget
// would simply vanish — and fade rep is empty for every learner on day one, so
// that is the normal case, not an edge case. Left alone it turns the spec's
// 255s of practice into 165s every single day, which breaks the one promise
// the fixed five-minute session is making. The active block therefore inherits
// the deadline of the last practice block that will be skipped after it.
function effectiveDeadline(
  blocks: SessionBlock[],
  deadlines: number[],
  index: number,
  failures: Record<string, number>,
): number | undefined {
  let last = index
  for (let next = index + 1; next < blocks.length; next++) {
    const block = blocks[next]
    if (block === undefined) continue
    // Close is never skipped, and its 30s is its own.
    if (block.kind === 'close') break
    if (liveItems(block.items, failures).length > 0) break
    last = next
  }
  return deadlines[last]
}

// Scans forward from `fromIndex` for the next block the learner should see.
// A block with nothing presentable — empty by design, or drained by failure
// caps — is skipped without ever becoming "active"; its slice of the
// cumulative time budget silently rolls into whatever is found next. The
// close block is never skipped this way: it is the terminal summary
// regardless of items.
function findActiveBlock(
  blocks: SessionBlock[],
  fromIndex: number,
  failures: Record<string, number>,
): RunnerState | null {
  for (let index = fromIndex; index < blocks.length; index++) {
    const block = blocks[index]
    if (block === undefined) continue
    if (block.kind === 'close') return { blockIndex: index, queue: [] }
    const queue = liveItems(block.items, failures)
    if (queue.length > 0) return { blockIndex: index, queue }
  }
  return null
}

export function SessionRunner({
  plan,
  onAttempt,
  onBlockEnd,
  onFinish,
  onQuit,
  now = Date.now,
}: {
  plan: SessionPlan
  onAttempt: (result: AttemptResult) => void
  onBlockEnd: (kind: BlockKind) => void
  onFinish: () => void
  onQuit?: () => void
  now?: () => number
}) {
  const strings = useStrings()
  const [sessionStartedAt] = useState(() => now())
  const [state, setState] = useState<RunnerState>(
    () => findActiveBlock(plan.blocks, 0, {}) ?? { blockIndex: plan.blocks.length, queue: [] },
  )
  const [tally, setTally] = useState({ answered: 0, correct: 0 })
  // Counts correct answers, so each one remounts the 〇 and replays its fade.
  // 0 means the last answer was wrong, or there has not been one.
  const [maru, setMaru] = useState(0)
  // Counts the questions shown, as QuestionView's key.
  const [question, setQuestion] = useState(0)
  const failures = useRef<Record<string, number>>({})
  // Consecutive-correct streak per atom this session, independent of the
  // Leitner box and fade ladder — it only gates when the next reserve atom
  // is secure enough to join. A wrong answer resets its atom's streak.
  const streaks = useRef<Record<string, number>>({})
  // Fade-rep moves that have earned their one level this session. Fade rep
  // shows a move one level above its stored fade, and the stored fade is
  // promoted after FADE_PROMOTE_STREAK right in a row. Cycling the move on at
  // the planned level would promote it again and again, past anything the
  // learner was shown. So once earned, it leaves the rotation.
  const retired = useRef<Set<string>>(new Set())
  // Reserve atoms that have joined the focus block so far, in join order.
  // Only the focus block's refill ever reads this; warm-up and fade rep are
  // untouched by it.
  const [joined, setJoined] = useState<SessionItem[]>([])
  // When the current question came up. State, not a ref: QuestionView reads
  // it during render.
  const [shownAt, setShownAt] = useState(sessionStartedAt)
  const finished = useRef(false)

  const deadlines = useMemo(
    () => cumulativeDeadlines(plan.blocks, sessionStartedAt),
    [plan, sessionStartedAt],
  )

  // The practice blocks' seconds, for the time track. Close is a summary that
  // waits for おわる, not a timed stretch, so it gets no segment.
  const segments = useMemo(
    () => plan.blocks.filter((b) => b.kind !== 'close' && b.seconds > 0).map((b) => b.seconds),
    [plan],
  )

  const block = plan.blocks[state.blockIndex]

  // Defensive fallback: only reachable if a plan has no terminal close block
  // (every plan produced by selectSession, and every plan in tests, has one).
  useEffect(() => {
    if (block === undefined && !finished.current) {
      finished.current = true
      onFinish()
    }
  }, [block, onFinish])

  if (block === undefined) {
    // Distinct testID from the real close screen: this branch means the
    // plan had no terminal close block, which is a dead end, not a summary.
    return <View testID="session-no-close-block" />
  }

  if (block.kind === 'close') {
    return (
      <SessionSummary
        title={strings.sessionComplete}
        answered={tally.answered}
        correct={tally.correct}
        onDone={() => {
          if (finished.current) return
          finished.current = true
          onFinish()
        }}
      />
    )
  }

  const current = state.queue[0]
  if (current === undefined) {
    // Invariant: findActiveBlock and the refill below never leave a
    // non-close block active with an empty queue. Distinct testID from the
    // real close screen so a broken invariant fails loudly instead of
    // looking like a legitimate session end.
    return <View testID="session-empty-queue" />
  }

  const { rodValue, operand, sign } = parseAtomId(current.atomId)
  const atom: Atom = {
    id: current.atomId,
    rodValue,
    operand,
    direction: sign === 1 ? 'add' : 'sub',
  }

  // The session's side of an answer: the attempt, the tally, the streak and
  // the 〇. A right one moves straight on; a miss is held for review in
  // QuestionView, and advance() runs later, from つぎへ.
  function submitted({ correct, latencyMs, t, assisted }: Submission) {
    // Re-narrowed here rather than relied on from the enclosing scope: TS
    // does not carry a const's narrowing into a nested closure.
    if (block === undefined || current === undefined) return

    onAttempt({ atomId: current.atomId, correct, latencyMs, assisted })
    // The tally counts every answer, with help or not: it is what the
    // learner did this session.
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))

    // Extends the atom's streak on a right answer, breaks it on a wrong one.
    // Spec (core rounds) §5: an answer after 手順を見る is not the learner's
    // own, so it neither extends nor breaks the streak that brings in new
    // moves and retires fade-rep moves.
    if (!assisted) {
      streaks.current[current.atomId] = correct ? (streaks.current[current.atomId] ?? 0) + 1 : 0
    }

    if (correct) {
      setMaru((previous) => previous + 1)
      advance(true, t, assisted)
      return
    }

    failures.current[current.atomId] = (failures.current[current.atomId] ?? 0) + 1
    setMaru(0)
  }

  // Moves the session on from the question just answered: requeue, joins,
  // refill, block end. A right answer runs it straight from submitted(); a miss
  // runs it from つぎへ, with `t` the moment つぎへ was pressed, so the
  // deadline is checked then and the review never counts toward the next
  // answer's latency. `assisted` is a right answer given after 手順を見る.
  function advance(correct: boolean, t: number, assisted = false) {
    if (block === undefined || current === undefined) return

    // Spec (core rounds) §5: only a right answer of the learner's own may
    // bring in a reserve move or retire a fade-rep move. One with help has
    // left the streaks alone, but everything in play can already be secure
    // without it (when the one move short of five fails out, say), and the
    // answer with help must not be the one that acts on that.
    const own = correct && !assisted

    let queue = state.queue.slice(1)

    // submitted() has already counted this failure.
    if (!correct && (failures.current[current.atomId] ?? 0) < MAX_ATTEMPTS_PER_ATOM) {
      // A high-fade miss reveals one level for the retry, so the learner
      // sees what they should have been imagining.
      const fade = (current.coaching === 'silent' && current.fade >= 4
        ? current.fade - 1
        : current.fade) as FadeLevel
      queue = [...queue, { ...current, fade }]
    }
    // At MAX_ATTEMPTS_PER_ATOM a missed item is simply not requeued — dropped.

    // Bring in the next reserve atom once every atom currently in the focus
    // block — including this one, just answered — has a full streak. One at
    // a time: the item after this one only becomes "in play" once this one
    // has joined, so it cannot join on the same answer.
    let joinedNow = joined
    if (own && block.kind === 'focus') {
      const inPlay = dedupeByAtomId(liveItems([...block.items, ...joined], failures.current))
      const secure = inPlay.length > 0 && inPlay.every((it) => (streaks.current[it.atomId] ?? 0) >= FADE_PROMOTE_STREAK)
      const newcomer = plan.reserve?.[joined.length]
      if (secure && newcomer !== undefined) {
        joinedNow = [...joined, newcomer]
        // The learner meets it with its demonstration right away, not
        // somewhere later in the cycle.
        queue = [newcomer, ...queue]
      }
    }
    if (own && block.kind === 'faderep' && (streaks.current[current.atomId] ?? 0) >= FADE_PROMOTE_STREAK) {
      retired.current.add(current.atomId)
    }
    const deadline = effectiveDeadline(plan.blocks, deadlines, state.blockIndex, failures.current)
    const timeUp = deadline !== undefined && t >= deadline

    // Warm-up makes a single pass and is never refilled: once its queue
    // drains the block simply ends below, and its remaining time rolls into
    // whatever comes next (the cumulative deadlines already do that). Focus
    // and fade rep refill from their live items as before, but never into a
    // cycle that would put the move just answered straight back in front of
    // the learner — that is filler, not practice, and it is the TestFlight
    // repeat bug.
    if (!timeUp && queue.length === 0 && block.kind !== 'warmup') {
      // The focus block's candidates include whatever has joined from the
      // reserve so far; other blocks never gain items, so they still draw
      // from their own items exactly as before. Fade rep leaves out the moves
      // that have earned their level (see retired).
      const candidates =
        block.kind === 'focus'
          ? liveItems([...block.items, ...joinedNow], failures.current)
          : liveItems(block.items, failures.current).filter((it) => !retired.current.has(it.atomId))
      if (candidates.length === 1 && candidates[0]?.atomId === current.atomId) {
        // Refilling here would only ever hand back the move just answered —
        // a repeat, not a refill. A focus block still has somewhere to go if
        // the reserve has a newcomer left; fade rep, and focus with nothing
        // left in reserve, end the block instead (below).
        const newcomer = block.kind === 'focus' ? plan.reserve?.[joinedNow.length] : undefined
        if (newcomer !== undefined) {
          joinedNow = [...joinedNow, newcomer]
          queue = [newcomer, ...candidates]
        }
      } else {
        // Rotate a leading repeat to the end. This only bites right after a
        // missed item's retry lands last in the drained queue: without it,
        // a plain refill would put that same item straight back in front.
        const [first, ...rest] = candidates
        queue = first !== undefined && first.atomId === current.atomId ? [...rest, first] : candidates
      }
    }

    if (joinedNow !== joined) setJoined(joinedNow)

    // A new key gives the next question a clean field, untouched beads and no review.
    setQuestion((previous) => previous + 1)

    if (timeUp || queue.length === 0) {
      // Either the deadline passed, or every item in the block has now
      // failed out — either way there is nothing left to show here.
      onBlockEnd(block.kind)
      const next = findActiveBlock(plan.blocks, state.blockIndex + 1, failures.current)
      setState(next ?? { blockIndex: plan.blocks.length, queue: [] })
    } else {
      setState({ blockIndex: state.blockIndex, queue })
    }
    setShownAt(t)
  }

  const exercise = exerciseForAtom(atom)
  // The time track sits outside the keyed QuestionView, which remounts with
  // every question: its fill runs from the runner's mount, and remounting it
  // would start it over at 0. QuestionView's own track slot stays empty.
  return (
    <View style={styles.practice}>
      <SessionTrack
        segments={segments}
        label={strings.blockLabel(block.kind)}
        quitLabel={strings.quitLabel}
        onQuit={onQuit}
      />
      <QuestionView
        key={question}
        exercise={exercise}
        fade={current.fade}
        coaching={current.coaching}
        prompt={strings.prompt(atom)}
        demonstration={current.coaching === 'demo' ? strings.coaching(atom) : null}
        renderSteps={({ activeStep, showAnswer }) => (
          <CorrectionCard atom={atom} expected={exercise.expected} activeStep={activeStep} showAnswer={showAnswer} />
        )}
        track={null}
        maru={maru}
        shownAt={shownAt}
        now={now}
        onSubmit={submitted}
        onMoveOn={(t) => advance(false, t)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
})
