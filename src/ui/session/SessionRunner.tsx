import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { explainMove } from '@/domain/explain'
import type { FadeLevel } from '@/domain/fade'
import {
  MAX_ATTEMPTS_PER_ATOM,
  type BlockKind,
  type SessionBlock,
  type SessionItem,
  type SessionPlan,
} from '@/domain/session'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from '@/ui/abacus/Abacus'
import { parseAnswer } from '@/ui/parseAnswer'

export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number }

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
  now = Date.now,
}: {
  plan: SessionPlan
  onAttempt: (result: AttemptResult) => void
  onBlockEnd: (kind: BlockKind) => void
  onFinish: () => void
  now?: () => number
}) {
  const [sessionStartedAt] = useState(() => now())
  const [state, setState] = useState<RunnerState>(
    () => findActiveBlock(plan.blocks, 0, {}) ?? { blockIndex: plan.blocks.length, queue: [] },
  )
  const [answer, setAnswer] = useState('')
  const [correction, setCorrection] = useState<string | null>(null)
  const [tally, setTally] = useState({ answered: 0, correct: 0 })
  const failures = useRef<Record<string, number>>({})
  const shownAt = useRef<number>(sessionStartedAt)
  const finished = useRef(false)

  const deadlines = useMemo(
    () => cumulativeDeadlines(plan.blocks, sessionStartedAt),
    [plan, sessionStartedAt],
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
      <View testID="session-summary">
        <Text testID="summary-text">Session complete</Text>
        {/* Spec §6: the close block reports the result. Atoms mastered and
            tomorrow's preview still belong here and are not built yet. */}
        <Text testID="summary-result">
          {`${tally.answered} answered, ${tally.correct} correct`}
        </Text>
        <Pressable
          testID="finish-button"
          accessibilityRole="button"
          onPress={() => {
            if (finished.current) return
            finished.current = true
            onFinish()
          }}
        >
          <Text>Done</Text>
        </Pressable>
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
  const expected = rodValue + sign * operand
  const atom: Atom = {
    id: current.atomId,
    rodValue,
    operand,
    direction: sign === 1 ? 'add' : 'sub',
  }

  function submit() {
    // Re-narrowed here rather than relied on from the enclosing scope: TS
    // does not carry a const's narrowing into a nested closure.
    if (block === undefined || current === undefined) return

    // A blank or unparseable field is not an answer. Scoring it would mark
    // every n−n atom correct, and scoring it wrong would burn an attempt for
    // a mistap, so nothing happens at all.
    const given = parseAnswer(answer)
    if (given === null) return

    const t = now()
    const latencyMs = Math.max(0, t - shownAt.current)
    const correct = given === expected

    onAttempt({ atomId: current.atomId, correct, latencyMs })
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))

    let queue = state.queue.slice(1)
    let nextCorrection: string | null = null

    if (!correct) {
      const count = (failures.current[current.atomId] ?? 0) + 1
      failures.current[current.atomId] = count
      // The number alone teaches nothing. What the learner has to take away
      // is the substitution the move stands for.
      if (current.coaching !== 'silent') nextCorrection = `It is ${expected}. ${explainMove(atom)}`
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

    const deadline = effectiveDeadline(plan.blocks, deadlines, state.blockIndex, failures.current)
    const timeUp = deadline !== undefined && t >= deadline

    if (!timeUp && queue.length === 0) {
      // The block's queue drained mid-cycle with time still on the clock:
      // start it again. Repeated presentation within a block is deliberate.
      queue = liveItems(block.items, failures.current)
    }

    setAnswer('')

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

  return (
    <View>
      <Abacus soroban={setValue(emptySoroban(2), rodValue)} fade={current.fade} />
      <Text testID="prompt">{`Rod shows ${rodValue}. ${sign === 1 ? 'Add' : 'Subtract'} ${operand}.`}</Text>
      {/* Spec §4: F0 is where the app demonstrates the move, so the
          substitution is shown *before* the answer, not after a miss. */}
      {current.coaching === 'demo' ? (
        <Text testID="demonstration">{explainMove(atom)}</Text>
      ) : null}
      <TextInput
        testID="answer-input"
        keyboardType="number-pad"
        value={answer}
        onChangeText={setAnswer}
      />
      <Pressable testID="submit" accessibilityRole="button" onPress={submit}>
        <Text>Answer</Text>
      </Pressable>
      {correction !== null ? <Text testID="correction">{correction}</Text> : null}
    </View>
  )
}
