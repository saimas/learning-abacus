import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native'
import { expectedValue, startValue, type Atom } from '@/domain/atoms'
import { answerModeForFade, FADE_PROMOTE_STREAK, type FadeLevel } from '@/domain/fade'
import {
  MAX_ATTEMPTS_PER_ATOM,
  type BlockKind,
  type SessionBlock,
  type SessionItem,
  type SessionPlan,
} from '@/domain/session'
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { BEAD_MODE_SCALE } from '@/ui/abacus/geometry'
import { AnswerPad } from '@/ui/answer/AnswerPad'
import { Button } from '@/ui/kit/Button'
import { Seal } from '@/ui/kit/Seal'
import { parseAnswer } from '@/ui/parseAnswer'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'
import { CorrectionCard } from './CorrectionCard'
import { Maru } from './Maru'
import { SessionTrack } from './SessionTrack'

// latencyMs is null for an untimed attempt (answered with the beads).
export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number | null }

type RunnerState = { blockIndex: number; queue: SessionItem[] }

// What a correction card needs. Kept as data rather than a finished sentence
// so the card can name the problem as well as its answer.
type Correction = { atom: Atom; expected: number }

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
  const [answer, setAnswer] = useState('')
  const [correction, setCorrection] = useState<Correction | null>(null)
  const [tally, setTally] = useState({ answered: 0, correct: 0 })
  // Counts correct answers, so each one remounts the 〇 and replays its fade.
  // 0 means the last answer was wrong, or there has not been one.
  const [maru, setMaru] = useState(0)
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  const failures = useRef<Record<string, number>>({})
  // Consecutive-correct streak per atom this session, independent of the
  // Leitner box and fade ladder — it only gates when the next reserve atom
  // is secure enough to join. A wrong answer resets its atom's streak.
  const streaks = useRef<Record<string, number>>({})
  // Reserve atoms that have joined the focus block so far, in join order.
  // Only the focus block's refill ever reads this; warm-up and fade rep are
  // untouched by it.
  const [joined, setJoined] = useState<SessionItem[]>([])
  const shownAt = useRef<number>(sessionStartedAt)
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
      <View testID="session-summary" style={styles.summary}>
        <View style={styles.summaryBody}>
          <Seal text={strings.sealDone} state="stamped" size={118} animateIn />
          <Text testID="summary-text" style={styles.summaryTitle}>
            {strings.sessionComplete}
          </Text>
          {/* Spec §6: the close block reports the result. Atoms mastered and
              tomorrow's preview still belong here and are not built yet. */}
          <Text testID="summary-result" style={styles.summaryResult}>
            {strings.sessionResult(tally.answered, tally.correct)}
          </Text>
        </View>
        <Button
          testID="finish-button"
          label={strings.done}
          onPress={() => {
            if (finished.current) return
            finished.current = true
            onFinish()
          }}
        />
      </View>
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
  const expected = expectedValue(atom)
  const mode = answerModeForFade(current.fade)
  const start = setValue(emptySoroban(2), startValue(atom))
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn one of the atom's attempts.
  const moved = readValue(shownBeads) !== startValue(atom)

  function submit() {
    // Re-narrowed here rather than relied on from the enclosing scope: TS
    // does not carry a const's narrowing into a nested closure.
    if (block === undefined || current === undefined) return

    // A blank or unparseable field is not an answer. Scoring it would mark
    // every n−n atom correct, and scoring it wrong would burn an attempt for
    // a mistap, so nothing happens at all.
    const given = mode === 'beads' ? (moved ? readValue(shownBeads) : null) : parseAnswer(answer)
    if (given === null) return

    const t = now()
    // Bead answers are untimed: speed only counts once the work is mental.
    const latencyMs = mode === 'beads' ? null : Math.max(0, t - shownAt.current)
    const correct = given === expected

    onAttempt({ atomId: current.atomId, correct, latencyMs })
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))

    if (correct) {
      setMaru((previous) => previous + 1)
      AccessibilityInfo.announceForAccessibility(strings.correct)
    } else {
      setMaru(0)
    }

    // Extends the atom's streak on a right answer, breaks it on a wrong one.
    streaks.current[current.atomId] = correct ? (streaks.current[current.atomId] ?? 0) + 1 : 0

    let queue = state.queue.slice(1)
    let nextCorrection: Correction | null = null

    if (!correct) {
      const count = (failures.current[current.atomId] ?? 0) + 1
      failures.current[current.atomId] = count
      // The number alone teaches nothing. What the learner has to take away
      // is the substitution the move stands for.
      if (current.coaching !== 'silent') nextCorrection = { atom, expected }
      if (count < MAX_ATTEMPTS_PER_ATOM) {
        // A high-fade miss reveals one level for the retry, so the learner
        // sees what they should have been imagining.
        const fade = (current.coaching === 'silent' && current.fade >= 4
          ? current.fade - 1
          : current.fade) as FadeLevel
        queue = [...queue, { ...current, fade }]
      }
      // At MAX_ATTEMPTS_PER_ATOM the item is simply not requeued — dropped.
    }

    // Bring in the next reserve atom once every atom currently in the focus
    // block — including this one, just answered — has a full streak. One at
    // a time: the item after this one only becomes "in play" once this one
    // has joined, so it cannot join in the same submit.
    let joinedNow = joined
    if (correct && block.kind === 'focus') {
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
      // from their own items exactly as before.
      const candidates =
        block.kind === 'focus'
          ? liveItems([...block.items, ...joinedNow], failures.current)
          : liveItems(block.items, failures.current)
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

    setAnswer('')
    setBeads(null)

    if (timeUp || queue.length === 0) {
      // Either the deadline passed, or every item in the block has now
      // failed out — either way there is nothing left to show here.
      onBlockEnd(block.kind)
      const next = findActiveBlock(plan.blocks, state.blockIndex + 1, failures.current)
      setCorrection(null)
      setState(next ?? { blockIndex: plan.blocks.length, queue: [] })
    } else {
      setCorrection(nextCorrection)
      setState({ blockIndex: state.blockIndex, queue })
    }
    shownAt.current = t
  }

  const demonstration =
    current.coaching === 'demo' ? (
      // Spec §4: F0 is where the app demonstrates the move, so the
      // substitution is shown *before* the answer, not after a miss.
      <Text testID="demonstration" style={styles.demonstration}>
        {strings.coaching(atom)}
      </Text>
    ) : null
  const correctionCard =
    correction !== null ? (
      <CorrectionCard atom={correction.atom} expected={correction.expected} />
    ) : null
  const track = (
    <SessionTrack
      segments={segments}
      label={strings.blockLabel(block.kind)}
      quitLabel={strings.quitLabel}
      onQuit={onQuit}
    />
  )

  if (mode === 'beads') {
    // Layout A: the soroban takes the keypad's place, enlarged and within
    // thumb reach. Only the text above it scrolls, so the soroban and both
    // buttons stay on screen even on a 375 × 667 phone.
    return (
      <View style={styles.practice}>
        {track}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text testID="prompt" style={styles.prompt}>
            {strings.prompt(atom)}
          </Text>
          {demonstration}
          {correctionCard}
        </ScrollView>
        <View style={styles.sorobanWrap} testID="soroban-wrap">
          {/* `previous ?? start` relies on `start` staying constant for the
              presented question: submit is the only path that changes the
              question, and it resets `beads` to null first. */}
          <Abacus
            soroban={shownBeads}
            fade={current.fade}
            scale={BEAD_MODE_SCALE}
            onTapBead={(rodIndex, bead) => setBeads((previous) => tapSoroban(previous ?? start, rodIndex, bead))}
            onAdjustRod={(rodIndex, delta) => setBeads((previous) => adjustRod(previous ?? start, rodIndex, delta))}
          />
          {maru > 0 ? (
            <View style={styles.maruOverlay} pointerEvents="none">
              <Maru key={maru} />
            </View>
          ) : null}
        </View>
        <Text style={styles.hint}>{strings.beadHint}</Text>
        {/* Layout A puts a flexible gap on both sides of the soroban+hint
            block (mockup: a flex spacer before it, another after). The
            scroll above already absorbs the top gap; this one balances it
            below so spare height on a tall phone doesn't all pile up above
            the soroban. Both share `scroll`'s flexShrink:1, so on a short
            screen this collapses to 0 first and the scroll area is what
            gives way, keeping the soroban, hint and buttons on screen. */}
        <View style={styles.beadSpacer} />
        <View style={styles.beadButtons}>
          <View style={styles.resetSlot}>
            <Button
              testID="reset-beads"
              variant="outline"
              label={strings.resetBeads}
              onPress={() => setBeads(null)}
            />
          </View>
          <View style={styles.submitSlot}>
            <Button testID="submit" label={strings.answer} disabled={!moved} onPress={submit} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.practice}>
      {track}
      {/* R9: the keypad below is always fully visible, pinned at the bottom.
          Everything here that can grow scrolls instead of pushing the keypad
          off a short screen. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.soroban}>
          <Abacus soroban={start} fade={current.fade} />
          {maru > 0 ? (
            <View style={styles.maruOverlay} pointerEvents="none">
              <Maru key={maru} size={110} />
            </View>
          ) : null}
        </View>
        <Text testID="prompt" style={styles.prompt}>
          {strings.prompt(atom)}
        </Text>
        {demonstration}
        {correctionCard}
      </ScrollView>
      <AnswerPad
        value={answer}
        onChange={setAnswer}
        onSubmit={submit}
        submitLabel={strings.answer}
        submitTestID="submit"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
  soroban: { marginTop: space.md, position: 'relative' },
  prompt: {
    marginTop: space.lg,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: fontSizes.prompt,
    color: colors.ink,
    letterSpacing: 1,
  },
  demonstration: {
    alignSelf: 'center',
    marginTop: space.sm,
    paddingVertical: 7,
    paddingHorizontal: space.md,
    borderRadius: radius.panel,
    overflow: 'hidden',
    backgroundColor: colors.soft,
    color: colors.muted,
    fontSize: fontSizes.small,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.sm },
  summary: { flex: 1 },
  summaryBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: {
    marginTop: 26,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 2,
    color: colors.ink,
  },
  summaryResult: { marginTop: space.sm, fontSize: fontSizes.body, color: colors.muted },
  sorobanWrap: { alignSelf: 'center', marginTop: space.sm, position: 'relative' },
  // Centred over whichever soroban it is placed inside (bead mode's
  // sorobanWrap, or keypad mode's soroban view) — that view must itself be
  // position:'relative' for this to fill and centre over it.
  maruOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { textAlign: 'center', marginTop: space.sm, fontSize: fontSizes.caption, color: colors.muted },
  beadSpacer: { flex: 1 },
  beadButtons: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  resetSlot: { flex: 1 },
  submitSlot: { flex: 2 },
})
