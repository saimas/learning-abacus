import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { divisionWalk, walkFrames, walkStates, type WalkDigit, type WalkStep } from '@/domain/divisionWalk'
import { stepColouring } from '@/domain/exercise'
import { OPERATION_SYMBOL, rodsFor, type Problem } from '@/domain/problem'
import { emptySoroban, readRod } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus, tintsFor } from '@/ui/abacus/Abacus'
import { beadModeScale, geometryFor } from '@/ui/abacus/geometry'
import { Button, BUTTON_HEIGHT } from '@/ui/kit/Button'
import { BACK_GLYPH, NEXT_GLYPH, StepButton } from '@/ui/session/StepPanel'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// Stands in where indexing is typed as possibly missing. Never shown: the
// walk always has its set and done steps, and every frame points into it.
const NO_STEP: WalkStep = {
  kind: 'set',
  steps: [],
  cascades: false,
  left: 0,
  focus: [],
  marks: [],
  divisorPlaces: [],
  answer: [],
}

// Spec (division walkthrough) §4. After build 20 the owner still could not
// follow わり算のやりかた's text pages ("wording is just hard to process as
// image"). A web walkthrough of 1692 ÷ 36 that placed each 九九 guess, got
// stuck and fixed it, a bead at a time, is what made it click, and they
// asked for "this exact animation" in the app (2026-09-24). So this steps
// through divisionWalk's frames with ◀ ▶, one bead step per ▶, as
// 手順を見る steps a round: the words stay on a step while its beads move,
// and every number they use is on screen, from the digits over the rods to
// what is left.
export function DivideWalkthrough({
  problem,
  finishLabel,
  onFinish,
}: {
  problem: Problem
  finishLabel: string
  onFinish: () => void
}) {
  const strings = useStrings()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)

  const walk = divisionWalk(problem)
  const states = walkStates(problem, walk)
  const { frames, groupStarts } = walkFrames(walk)
  const rods = rodsFor(problem)
  const frame = frames[index] ?? { step: 0, state: 0 }
  const step = walk[frame.step] ?? NO_STEP
  const soroban = states[frame.state] ?? emptySoroban(rods)
  const last = index === frames.length - 1
  const caption = strings.divideWalk(problem, step)
  const scale = beadModeScale(rods, width - 2 * space.xl)

  // As when stepping a round (the owner's request, 2026-09-23): a step's
  // beads moved so far are red, the latest bead step's the deepest. Each
  // step's bead steps are a group of their own, so a 九九 taken off starts
  // in wood again. A step without beads colours nothing, rather than
  // keeping the step before it red.
  const tinted = step.steps.length > 0 ? tintsFor(stepColouring(states, groupStarts, frame.state)) : undefined

  // のこり and the answer boxes never run ahead of the beads: they change
  // when the step's last bead lands, and until then show what they did
  // before the step. They do not follow the rods bead by bead, since a
  // take's first bead leaves only part of its 九九 off. A step without beads
  // is a single frame, which is its last; the set step has none before it,
  // so it shows its own.
  const stepDone = frames[index + 1]?.step !== frame.step
  const settled = stepDone ? step : (walk[frame.step - 1] ?? step)
  const left = settled.left
  const answer = settled.answer

  // A learner who scrolled down to read a long note starts the next step
  // from its top, where its words and the soroban are. Only a new step
  // scrolls: the same step's beads leave the words where they were, and the
  // walkthrough opens at the top anyway.
  const scroll = useRef<ScrollView>(null)
  const scrolledFor = useRef(frame.step)
  useEffect(() => {
    if (frame.step === scrolledFor.current) return
    scrolledFor.current = frame.step
    scroll.current?.scrollTo({ y: 0, animated: false })
  }, [frame.step])

  // The beads' slide is silent to VoiceOver, so each ▶ or ◀ is read out: a
  // new step's words, or just the count while the same step's beads move.
  // Only a change is: nothing is read as the walkthrough opens.
  const spoken = strings.divideWalkSpoken(caption.what, caption.math)
  const count = strings.replayStep(index + 1, frames.length)
  const announced = useRef({ index, step: frame.step })
  useEffect(() => {
    const before = announced.current
    if (index === before.index) return
    announced.current = { index, step: frame.step }
    AccessibilityInfo.announceForAccessibility(frame.step === before.step ? count : spoken)
  }, [index, frame.step, spoken, count])

  const divisor = String(problem.b)
    .split('')
    .map((digit, k, all) => ({ digit, place: all.length - 1 - k }))
  const answerLabel = [
    strings.divideWalkAnswer,
    ...answer.flatMap((entry) => (entry === null ? [] : [answerText(entry)])),
  ].join(' ')

  return (
    <View style={styles.walkthrough}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {strings.divideIntroTitle}
        </Text>
        {/* One dot per step, not per ▶, so the dots count explanations. A
            stuck step's dot is a ring whether reached or not, so the two
            places a guess turns out too big stay in sight among the reached
            dots. */}
        <View style={styles.dots}>
          {walk.map((each, i) => (
            <View
              key={i}
              testID={`walk-dot-${i}`}
              style={[styles.dot, i <= frame.step && styles.dotReached, each.kind === 'stuck' && styles.dotStuck]}
            />
          ))}
        </View>
      </View>
      {/* As in MethodIntro, the controls stay pinned at the bottom and
          everything above them scrolls, so a short phone still reaches the
          note. */}
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.problemRow}>
          {/* The divisor's digits the step uses are underlined: a guess is
              made with the first alone, and each 九九 with one of them. The
              size is capped as the answer boxes' is, so both boxes stay on
              the row at a larger text size. */}
          <Text
            testID="walk-problem"
            accessibilityLabel={`${problem.a} ${OPERATION_SYMBOL[problem.op]} ${problem.b}`}
            maxFontSizeMultiplier={1.3}
            style={styles.problem}
          >
            {`${problem.a} ${OPERATION_SYMBOL[problem.op]} `}
            {divisor.map(({ digit, place }) => (
              <Text
                key={place}
                testID={`walk-divisor-${place}`}
                style={step.divisorPlaces.includes(place) ? styles.divisorInUse : undefined}
              >
                {digit}
              </Text>
            ))}
          </Text>
          <View testID="walk-answers" accessible accessibilityLabel={answerLabel} style={styles.answers}>
            <Text maxFontSizeMultiplier={1.3} style={styles.answerLabel}>
              {strings.divideWalkAnswer}
            </Text>
            {answer.map((entry, k) => (
              <AnswerBox key={k} testID={`walk-answer-${k}`} entry={entry} />
            ))}
          </View>
        </View>
        <View style={styles.readings}>
          <RodRow
            testID="walk-readings"
            scale={scale}
            rods={rods}
            cell={(i) => {
              const rod = soroban.rods[i]
              const mark = step.marks.find((each) => each.rodIndex === i)
              return (
                <>
                  <Text
                    testID={`walk-reading-${i}`}
                    maxFontSizeMultiplier={1.3}
                    style={[styles.reading, step.focus.includes(i) && styles.readingFocus]}
                  >
                    {rod === undefined ? '' : String(readRod(rod))}
                  </Text>
                  {/* A fixed height, so the soroban does not jump as the
                      badges come and go. */}
                  <View style={styles.badgeSlot}>
                    {mark === undefined ? null : (
                      <View testID={`walk-mark-${i}`} style={styles.badge}>
                        <Text maxFontSizeMultiplier={1.2} style={styles.badgeLabel}>
                          {markLabel(step, mark.amount)}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )
            }}
          />
        </View>
        <View testID="walk-soroban">
          <Abacus soroban={soroban} fade={0} scale={scale} highlightRods={step.focus} tintedBeads={tinted} />
        </View>
        <View style={styles.rodNames}>
          <RodRow
            testID="walk-rod-names"
            scale={scale}
            rods={rods}
            cell={(i) => (
              <Text testID={`walk-rod-name-${i}`} maxFontSizeMultiplier={1.3} style={styles.rodName}>
                {strings.rodShortName(rods - 1 - i)}
              </Text>
            )}
          />
        </View>
        <Text testID="walk-what" style={styles.what}>
          {caption.what}
        </Text>
        {/* What is left is a real number at every step, so a 九九 that will
            not come off can be seen not to: 192 − 300. */}
        <View style={styles.leftRow}>
          <Text style={styles.leftLabel}>{strings.divideWalkLeft}</Text>
          <Text testID="walk-left" style={styles.left}>
            {String(left)}
          </Text>
          {caption.math === '' ? null : (
            <Text testID="walk-math" style={[styles.math, { color: mathColour(step) }]}>
              {caption.math}
            </Text>
          )}
        </View>
        {caption.note === '' ? null : (
          <Text testID="walk-note" style={styles.note}>
            {caption.note}
          </Text>
        )}
        {caption.rods === '' ? null : (
          <Text testID="walk-rods" style={styles.rodsLine}>
            {caption.rods}
          </Text>
        )}
      </ScrollView>
      <View style={styles.controls}>
        <StepButton
          testID="walk-back"
          glyph={BACK_GLYPH}
          label={strings.stepBack}
          disabled={index === 0}
          onPress={() => setIndex(index - 1)}
        />
        <Text testID="walk-count" style={styles.count}>
          {count}
        </Text>
        {/* On the last frame ▶ gives way to the finish button, as つぎへ
            does on MethodIntro's last page. */}
        {last ? (
          <View style={styles.finish}>
            <Button testID="intro-finish" label={finishLabel} onPress={onFinish} />
          </View>
        ) : (
          <StepButton
            testID="walk-next"
            glyph={NEXT_GLYPH}
            label={strings.stepNext}
            disabled={false}
            onPress={() => setIndex(index + 1)}
          />
        )}
      </View>
    </View>
  )
}

// A row of cells, one per rod, each over (or under) its own rod: as wide as
// a rod, and indented by the frame's and the deck's padding as Abacus lays
// out its rods. Abacus centres itself, and so does the row, so the columns
// line up.
//
// Both rows, the readings with their badges and the rod names, are hidden
// from VoiceOver: each of Abacus's rods already reads out its value, and the
// words carry the step's numbers, so the rows would only add a stop per rod.
function RodRow({
  testID,
  scale,
  rods,
  cell,
}: {
  testID: string
  scale: number
  rods: number
  cell: (rodIndex: number) => ReactNode
}) {
  const g = geometryFor(scale)
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.rodRow, { paddingHorizontal: g.framePadding + g.deckPadding }]}
    >
      {Array.from({ length: rods }, (_, i) => (
        <View key={i} testID={`${testID}-cell-${i}`} style={[styles.rodCell, { width: g.rodWidth }]}>
          {cell(i)}
        </View>
      ))}
    </View>
  )
}

// An answer box: dashed while the digit is still to come, the digit with a
// ? in the accent while it is on trial, and in ink once every 九九 of it has
// come off (the owner, 2026-09-24: the candidate "has to pass through each
// digit").
function AnswerBox({ testID, entry }: { testID: string; entry: WalkDigit | null }) {
  if (entry === null) return <View testID={testID} style={[styles.box, styles.boxEmpty]} />
  return (
    <View testID={testID} style={[styles.box, entry.trial ? styles.boxTrial : styles.boxSettled]}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.boxDigit, entry.trial && styles.boxDigitTrial]}>
        {answerText(entry)}
      </Text>
    </View>
  )
}

function answerText(entry: WalkDigit): string {
  return entry.trial ? `${entry.digit}?` : `${entry.digit}`
}

// The badge over a rod: the digit put on or taken off. A digit tried is
// still a question (5?), and so is a 九九 that will not come off (−3?);
// anything else is done (−1, +3). The minus is U+2212, as the captions'.
function markLabel(step: WalkStep, amount: number): string {
  if (step.kind === 'try') return `${amount}?`
  const signed = amount < 0 ? `−${-amount}` : `+${amount}`
  return step.kind === 'stuck' ? `${signed}?` : signed
}

// The sum of a digit's last 九九, the one that settles it, is in green (its
// words end in ✓), and a 九九 that will not come off in the accent (✗); the
// rest are plain working. Read off the step, not the words, so no locale's
// wording can change the colour.
function mathColour(step: WalkStep): string {
  if (step.kind === 'take' && step.last) return colors.ok
  if (step.kind === 'stuck') return colors.accent
  return colors.ink
}

const styles = StyleSheet.create({
  walkthrough: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  title: { flexShrink: 1, fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.track },
  dotReached: { backgroundColor: colors.accent },
  // After dotReached, so a reached stuck step stays a ring.
  dotStuck: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.sm },
  problemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  problem: { fontFamily: fonts.display, fontSize: fontSizes.prompt, color: colors.ink },
  divisorInUse: { color: colors.accent, textDecorationLine: 'underline' },
  answers: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  answerLabel: { fontSize: fontSizes.small, color: colors.muted },
  // Wide enough for "5?", and it grows rather than clip at a larger text
  // size.
  box: {
    minWidth: 34,
    height: 40,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 6,
  },
  boxEmpty: { borderStyle: 'dashed', borderColor: colors.cardLine },
  boxTrial: { borderColor: colors.accent },
  boxSettled: { borderColor: colors.ink },
  boxDigit: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  boxDigitTrial: { color: colors.accent },
  readings: { marginTop: space.md },
  rodRow: { alignSelf: 'center', flexDirection: 'row' },
  rodCell: { alignItems: 'center' },
  reading: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  readingFocus: { color: colors.accent },
  badgeSlot: { height: 22, marginTop: 2, marginBottom: space.xs, justifyContent: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 9, backgroundColor: colors.accentSoft },
  badgeLabel: { fontSize: fontSizes.small, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  // Clear of the soroban frame's shadow.
  rodNames: { marginTop: space.sm },
  rodName: { fontSize: fontSizes.small, color: colors.muted },
  what: {
    marginTop: space.lg,
    fontSize: fontSizes.body + 2,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  // A long sum wraps under what is left rather than off the screen.
  leftRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: space.sm,
    marginTop: space.sm,
  },
  leftLabel: { fontSize: fontSizes.small, color: colors.muted },
  left: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, fontVariant: ['tabular-nums'] },
  math: { fontFamily: fonts.display, fontSize: 18 },
  note: { marginTop: space.sm, fontSize: fontSizes.body, lineHeight: 22, color: colors.ink },
  rodsLine: { marginTop: space.sm, fontSize: fontSizes.small, lineHeight: 18, color: colors.muted },
  // As tall as the finish button, so the row, and the scroll above it, keep
  // their size when ▶ gives way to it.
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: BUTTON_HEIGHT,
    marginTop: space.sm,
  },
  count: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  finish: { minWidth: 140 },
})
