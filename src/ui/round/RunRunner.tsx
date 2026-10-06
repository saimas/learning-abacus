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
import { LevelBanner } from './RunMoments'
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

// One showing of a problem of the run, at the level it is shown at.
// `position` is the problem's place in the run's problems: a problem gone
// back to is shown again as a new card at the same position (spec (runs) §5).
// `banner` says the level moved since the card before (`up` which way).
// `easeFrom`, set when it moved up to a new look (F2 → F3 and on: F0–F2 all
// look solid), is the old level: the beads start at its look and ease to the
// new one once the card is uncovered (spec (runs) §5).
type RunCard = {
  problem: Problem
  position: number
  level: FadeLevel
  banner: boolean
  up: boolean
  easeFrom?: FadeLevel
}

function cardAt(problem: Problem, position: number, level: FadeLevel, previous: FadeLevel | undefined): RunCard {
  if (previous === undefined || previous === level) return { problem, position, level, banner: false, up: false }
  const up = level > previous
  const newLook = up && visualForFade(level) !== visualForFade(previous)
  return { problem, position, level, banner: true, up, ...(newLook ? { easeFrom: previous } : {}) }
}

// Spec (runs) §2: a run is its kind's problems one card after another, until
// the third miss or a confirmed ✕, then its results. Each card is laid at
// the kind's level as it stands then (`level`, the record's, live), so a
// promotion earned on one answer shows from the next problem on. A miss is
// reviewed and the run moves on; it does not come back unless the learner
// goes back to it (戻る, spec (runs) §5).
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
  // The next problem, given the run's problems so far, in order, each once
  // however often it was gone back to.
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
  const [first] = useState(() => draw([]))
  // Each card laid so far, in order: only ever added to, so each keeps its
  // place, which keys it. The one on screen is the last (`index`), or past
  // the last, the results.
  const [cards, setCards] = useState<RunCard[]>(() => [cardAt(first, 0, level, undefined)])
  const [run, setRun] = useState<RunState>(() => startRun(level))
  const [index, setIndex] = useState(0)
  // As of the latest press or timer, which can come before the next render.
  const cardsRef = useRef(cards)
  const runRef = useRef(run)
  const indexRef = useRef(0)
  // The run's problems in order, each once, growing only as a new one is
  // drawn: a card's `position` is its problem's place here. What is drawn
  // next keeps clear of them (`draw`, spec (runs) §2), however often one is
  // gone back to.
  const problemsRef = useRef<readonly Problem[]>([first])
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
  // onLeave, once: it writes progress and goes home, and ✕ then おわる on the
  // results, or おわる twice while the write is pending, must not go twice.
  const left = useRef(false)
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
  // A moved level's banner over the card it moved for, keyed so it plays
  // once.
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

  // The problem at `position` in the run: one already shown, or past the
  // latest, a new one.
  function problemAt(position: number): Problem {
    const shown = problemsRef.current[position]
    if (shown !== undefined) return shown
    const drawn = draw(problemsRef.current)
    problemsRef.current = [...problemsRef.current, drawn]
    return drawn
  }

  // Rolls on from card `from`: the card of the problem after its own in the
  // run is laid underneath (or, the run over, the results), and the answered
  // one, back in its place, stays on top. Only from the card on top, so only
  // once: a second つぎへ can land before the blocker is drawn and reach here
  // after the swipe has started, and a tap on a card just left by 戻る can
  // land before the render that takes it away.
  function roll(from: number) {
    if (from !== indexRef.current) return
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
      const last = cardsRef.current[from]
      const position = last === undefined ? problemsRef.current.length : last.position + 1
      const next = cardAt(problemAt(position), position, levelRef.current, last?.level)
      cardsRef.current = [...cardsRef.current, next]
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
    const shown = cardsRef.current[index]
    if (shown === undefined) return
    // ✕ was confirmed while this card came in: on to the results.
    if (runRef.current.ended) {
      roll(index)
      return
    }
    showLevel(index, shown)
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

  // Card `at`, just put on screen: a moved level's banner, said to
  // VoiceOver, and a promotion felt.
  function showLevel(at: number, shown: RunCard) {
    if (!shown.banner) return
    setBanner({ key: at, level: shown.level })
    AccessibilityInfo.announceForAccessibility(strings.levelName(shown.level))
    if (shown.up) feel.levelUp()
  }

  function leave() {
    if (left.current) return
    left.current = true
    onLeave()
  }

  function quit() {
    askQuit(() => {
      // Nothing answered: nothing to show.
      if (runRef.current.answered === 0) {
        leave()
        return
      }
      runRef.current = quitRun(runRef.current)
      setRun(runRef.current)
      // A held 〇 rolls on to the results by itself, and a card coming in
      // does once it is uncovered (swiped); a card standing still goes now.
      if (!moving.current) roll(indexRef.current)
    })
  }

  // Spec (runs) §5 (the owner, 2026-10-06: "user should be able to go back
  // as far back as they want … we dont need to keep the state of previous
  // problem when user go back"): the problem before the one on screen in the
  // run, laid again as a new card at the level as it stands, and put on top
  // at once, with no swipe. It starts afresh, as if shown for the first
  // time, and its clock with it; nothing of the problem left is kept. Its
  // answer counts like any other's (the owner's choice), and from it the run
  // goes on to the problem after it. Offered only while nothing moves and
  // the run goes on (`onBack`), and checked again here, as a second tap can
  // land before the render that takes 戻る away.
  function goBack() {
    if (moving.current || runRef.current.ended) return
    const shown = cardsRef.current[indexRef.current]
    if (shown === undefined || shown.position === 0) return
    const position = shown.position - 1
    const back = cardAt(problemAt(position), position, levelRef.current, shown.level)
    cardsRef.current = [...cardsRef.current, back]
    setCards(cardsRef.current)
    indexRef.current = cardsRef.current.length - 1
    setIndex(indexRef.current)
    setShownAt(now())
    showLevel(indexRef.current, back)
  }

  function question(at: number, card: RunCard) {
    function submitted({ correct, assisted, t }: Submission) {
      // A card just left by 戻る, answered by a tap that landed before the
      // render that took it away: it is not the run's any more.
      if (at !== indexRef.current) return
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
      // The owner (2026-10-06): just the 〇, with no points in or over it;
      // the bar's score shows them (spec (runs) §5).
      if (next.lastPoints > 0) onPoints(next.lastPoints)
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
        revealed={leaving === null}
        onAgain={onAgain}
        onDone={leave}
      />
    )
  }

  const blocker = rolling ? <View testID="roll-blocker" style={StyleSheet.absoluteFill} /> : null
  // The bar sits outside the cards, so it stays put while they move. It
  // shows the level of the card on top, and on the results the last card's;
  // there its ✕, with nothing left to lose, just leaves. The cards are keyed
  // by their place in `cards`: the answered one keeps its answer and its 〇
  // as it goes on top, the next keeps its place once uncovered, and a
  // problem gone back to is a card of its own, so it starts afresh.
  const atResults = index >= cards.length
  const shownLevel = cards[Math.min(index, cards.length - 1)]?.level ?? level
  const stack = leaving === null ? [index] : [index, leaving]
  // 戻る: on a problem after the run's first, while no card moves (under a
  // 〇 or swiping off) and the run goes on, so not on the third miss's
  // review nor the results.
  const onScreen = cards[index]
  const onBack = onScreen !== undefined && onScreen.position > 0 && !rolling && !run.ended ? goBack : undefined
  return (
    <View style={styles.practice}>
      <RunBar
        lives={run.lives}
        level={shownLevel}
        score={run.score}
        combo={run.combo}
        reduceMotion={reduceMotion}
        onQuit={atResults ? leave : quit}
        onBack={onBack}
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
