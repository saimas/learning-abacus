import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { PracticeAttempt } from '@/domain/practice'
import { practiceId, type PracticeKind, type Problem } from '@/domain/problem'
import { answerRun, quitRun, startRun, type RunState } from '@/domain/run'
import { useStrings } from '@/i18n'
import { feel } from '@/ui/feel'
import type { Submission } from '@/ui/session/QuestionView'
import { colors } from '@/ui/theme'
import { ProblemQuestion } from './ProblemQuestion'
import { RunBar } from './RunBar'
import { LevelBanner, PointsFloat } from './RunMoments'
import { RunResults } from './RunResults'

// Spec (roll) §3: a right answer's 〇 is held on the answered problem for
// ROLL_HOLD_MS; then it moves on, so the change of problem is seen (the
// owner, 2026-09-28: "i didnt notice the problem moved to next … it rolled
// even before i see red circle"). It moves on as a stack of cards: the next
// problem is laid in its place underneath, still, and the answered card is
// swiped off to the left over it in ROLL_SWIPE_MS. The eye has nothing to
// chase and no blank to wait through (2026-09-29: sliding "makes human eye to
// chase it"; fading "is still distracting").
export const ROLL_HOLD_MS = 700
export const ROLL_SWIPE_MS = 300

// A problem of the run, at the level it is shown at. `banner` says the level
// moved since the card before (`up` which way). `easeFrom`, set when it moved
// up to a new look (F2 → F3 and on: F0–F2 all look solid), is the old level:
// the beads start at its look and ease to the new one once the card is
// uncovered (spec (runs) §5).
type RunCard = { problem: Problem; level: FadeLevel; banner: boolean; up: boolean; easeFrom?: FadeLevel }

function cardAt(problem: Problem, level: FadeLevel, previous: FadeLevel | undefined): RunCard {
  if (previous === undefined || previous === level) return { problem, level, banner: false, up: false }
  const up = level > previous
  const newLook = up && visualForFade(level) !== visualForFade(previous)
  return { problem, level, banner: true, up, ...(newLook ? { easeFrom: previous } : {}) }
}

// Spec (runs) §2: a run is its kind's problems one card after another, until
// the third miss or a confirmed ✕, then its results. Each card is laid at
// the kind's level as it stands then (`level`, the record's, live), so a
// promotion earned on one answer shows from the next problem on. A miss is
// reviewed and the run moves on; it does not come back.
export function RunRunner({
  kind,
  level,
  calibrationMs,
  draw,
  pointsBefore,
  best,
  onAttempt,
  onPoints,
  onEnd,
  onAgain,
  onLeave,
  askQuit,
  now = Date.now,
}: {
  kind: PracticeKind
  level: FadeLevel
  calibrationMs: number
  // The next problem, given every problem shown so far in the run.
  draw: (shown: readonly Problem[]) => Problem
  // For the results: the lifetime points, and the kind's best, before the run.
  pointsBefore: number
  best: number | undefined
  onAttempt: (attempt: PracticeAttempt) => void
  // Points as each answer earns them.
  onPoints: (points: number) => void
  // Once, as the results are laid: the run's score.
  onEnd: (score: number) => void
  onAgain: () => void
  onLeave: () => void
  // Asks before leaving mid-run; `confirmed` ends the run.
  askQuit: (confirmed: () => void) => void
  now?: () => number
}) {
  const strings = useStrings()
  const [cards, setCards] = useState<RunCard[]>(() => [cardAt(draw([]), level, undefined)])
  const [run, setRun] = useState<RunState>(() => startRun(level))
  const [index, setIndex] = useState(0)
  // As of the latest press or timer, which can come before the next render.
  const cardsRef = useRef(cards)
  const runRef = useRef(run)
  const indexRef = useRef(0)
  // The record's level, which moves as answers are recorded: each new card
  // is laid at it.
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  }, [level])
  // While a card is held under its 〇 or swiping off. A ✕ confirmed then
  // leaves the roll to bring the results in.
  const moving = useRef(false)
  // When the problem on screen was uncovered, for its answer time. The first
  // is shown when the run mounts.
  const [shownAt, setShownAt] = useState(() => now())
  // onEnd, once.
  const ended = useRef(false)
  const { width } = useWindowDimensions()
  // While a roll is pending or running: a blocker over the cards takes their
  // taps, so nothing is answered or stepped mid-roll.
  const [rolling, setRolling] = useState(false)
  // The answered card being swiped off, over `index`'s.
  const [leaving, setLeaving] = useState<number | null>(null)
  const [offset] = useState(() => new Animated.Value(0))
  const [opacity] = useState(() => new Animated.Value(1))
  // Spec (roll) §3, (runs) §5: with Reduce Motion on, nothing travels.
  const [reduceMotion, setReduceMotion] = useState(false)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The last card rolled on from: each rolls on once.
  const rolledFrom = useRef(-1)
  // The latest answer's points over its 〇, and a moved level's banner over
  // the card it moved for, each keyed so it plays once.
  const [float, setFloat] = useState<{ key: number; points: number } | null>(null)
  const [banner, setBanner] = useState<{ key: number; level: FadeLevel } | null>(null)
  useEffect(() => {
    // It starts off, so only on is set: setting it off again can still
    // schedule a render for nothing.
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (on === true) setReduceMotion(true)
    })
    // Leaving mid-roll: nothing may fire into the unmounted run.
    return () => {
      if (hold.current !== null) clearTimeout(hold.current)
      offset.stopAnimation()
      opacity.stopAnimation()
    }
  }, [offset, opacity])

  // Rolls on from card `from`: the next card is laid underneath (or, the run
  // over, the results), and the answered one, back in its place, stays on
  // top. Only once: a second つぎへ can land before the blocker is drawn and
  // reach here after the swipe has started.
  function roll(from: number) {
    if (from <= rolledFrom.current) return
    rolledFrom.current = from
    if (hold.current !== null) {
      clearTimeout(hold.current)
      hold.current = null
    }
    moving.current = true
    setRolling(true)
    offset.setValue(0)
    opacity.setValue(1)
    if (runRef.current.ended) {
      if (!ended.current) {
        ended.current = true
        onEnd(runRef.current.score)
      }
    } else {
      const laid = cardsRef.current
      const next = cardAt(draw(laid.map((card) => card.problem)), levelRef.current, laid[from]?.level)
      cardsRef.current = [...laid, next]
      setCards(cardsRef.current)
    }
    indexRef.current = from + 1
    setLeaving(from)
    setIndex(from + 1)
  }

  // The swipe starts once the next card is underneath; the next problem's
  // clock starts once it is uncovered (spec (roll) §3), and so does its
  // banner. Both run on the native driver.
  const swiped = useEffectEvent(() => {
    moving.current = false
    setLeaving(null)
    setShownAt(now())
    setRolling(false)
    setFloat(null)
    const shown = cardsRef.current[index]
    if (shown === undefined) return
    // ✕ was confirmed while this card came in: on to the results.
    if (runRef.current.ended) {
      roll(index)
      return
    }
    if (!shown.banner) return
    setBanner({ key: index, level: shown.level })
    AccessibilityInfo.announceForAccessibility(strings.levelName(shown.level))
    if (shown.up) feel.levelUp()
  })
  useEffect(() => {
    if (leaving === null) return
    const config = { duration: ROLL_SWIPE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }
    const away = reduceMotion
      ? Animated.timing(opacity, { ...config, toValue: 0 })
      : Animated.timing(offset, { ...config, toValue: -width })
    away.start(({ finished: gone }) => {
      if (gone) swiped()
    })
  }, [leaving, offset, opacity, width, reduceMotion])

  function quit() {
    askQuit(() => {
      // Nothing answered: nothing to show.
      if (runRef.current.answered === 0) {
        onLeave()
        return
      }
      runRef.current = quitRun(runRef.current)
      setRun(runRef.current)
      // A held 〇 rolls on to the results by itself, and a card coming in
      // does once it is uncovered (swiped); a card standing still goes now.
      if (!moving.current) roll(indexRef.current)
    })
  }

  function question(at: number, card: RunCard) {
    function submitted({ correct, assisted, t }: Submission) {
      const next = answerRun(runRef.current, {
        problem: card.problem,
        level: card.level,
        calibrationMs,
        answerMs: t - shownAt,
        correct,
        assisted,
      })
      runRef.current = next
      setRun(next)
      // Spec (runs) §3: the time is for points only, so the record still
      // moves on accuracy alone (the owner, 2026-09-30).
      onAttempt({ id: practiceId(kind), correct, pace: null, assisted, fade: card.level })
      if (next.lastPoints > 0) {
        onPoints(next.lastPoints)
        setFloat({ key: next.answered, points: next.lastPoints })
      }
      if (!correct) {
        feel.miss()
        return
      }
      feel.right()
      // Held under its 〇, then swiped away (spec (roll) §3).
      moving.current = true
      setRolling(true)
      hold.current = setTimeout(() => {
        hold.current = null
        roll(at)
      }, ROLL_HOLD_MS)
    }

    // Underneath the card going off, a new look is still the old one.
    const underneath = leaving !== null && at === index
    return (
      <ProblemQuestion
        problem={card.problem}
        fade={card.easeFrom !== undefined && underneath ? card.easeFrom : card.level}
        easeFade={card.easeFrom !== undefined && !reduceMotion}
        missNote={strings.livesLeft(run.lives - 1)}
        shownAt={shownAt}
        now={now}
        onSubmit={submitted}
        onMoveOn={() => roll(at)}
      />
    )
  }

  // Card `at`, or past the last, the results.
  function card(at: number) {
    const shown = cards[at]
    if (shown !== undefined) return question(at, shown)
    return (
      <RunResults
        score={run.score}
        best={best}
        right={run.right}
        longestCombo={run.longestCombo}
        highestLevel={run.highestLevel}
        pointsBefore={pointsBefore}
        onAgain={onAgain}
        onDone={onLeave}
      />
    )
  }

  const blocker = rolling ? <View testID="roll-blocker" style={StyleSheet.absoluteFill} /> : null
  // The bar sits outside the cards, so it stays put while they move. It
  // shows the level of the card on top, and on the results the last card's;
  // there its ✕, with nothing left to lose, just leaves. The cards are keyed
  // by position: the answered one keeps its answer and its 〇 as it goes on
  // top, and the next keeps its place once uncovered.
  const atResults = index >= cards.length
  const shownLevel = cards[Math.min(index, cards.length - 1)]?.level ?? level
  const stack = leaving === null ? [index] : [index, leaving]
  return (
    <View style={styles.practice}>
      <RunBar
        lives={run.lives}
        level={shownLevel}
        score={run.score}
        combo={run.combo}
        reduceMotion={reduceMotion}
        onQuit={atResults ? onLeave : quit}
      />
      <View style={styles.practice}>
        {stack.map((at) => (
          <Animated.View
            key={at}
            testID={at === leaving ? 'card-leaving' : 'card'}
            style={
              at === leaving ? [styles.card, styles.leaving, { opacity, transform: [{ translateX: offset }] }] : styles.card
            }
          >
            {card(at)}
          </Animated.View>
        ))}
        <View pointerEvents="none" style={styles.moments}>
          {float !== null ? (
            <PointsFloat key={`float-${float.key}`} points={float.points} reduceMotion={reduceMotion} />
          ) : null}
          {banner !== null ? (
            <LevelBanner key={`banner-${banner.key}`} level={banner.level} reduceMotion={reduceMotion} />
          ) : null}
        </View>
        {blocker}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
  // Opaque paper, so the card underneath shows only as this one uncovers it.
  card: { ...StyleSheet.absoluteFill, backgroundColor: colors.paper },
  // A soft shadow on the trailing edge of the card going off, so it reads as
  // a card lifting away from the one beneath.
  leaving: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 6, height: 0 },
  },
  // Over the soroban's top, where the 〇 lands.
  moments: { position: 'absolute', top: '24%', left: 0, right: 0, alignItems: 'center' },
})
