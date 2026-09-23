import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DIGITS, OPERATIONS, type Digits, type Operation, type PracticeKind } from '@/domain/problem'
import { PRACTICE_PARTS, type PracticePart, type SessionPlan } from '@/domain/session'
import { useStrings } from '@/i18n'
import { SegmentedControl } from '@/ui/kit/SegmentedControl'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

export type PartChoice = PracticePart | 'all'

// The size picker's options are strings, as SegmentedControl's are.
const DIGIT_OPTIONS = DIGITS.map(String) as readonly `${Digits}`[]

// Spec (choosing what to practise) §4: the start button asks what to practise.
// ぜんぶ is today's full session, unchanged; each part below practises that
// part alone. The counts come from the plan the session would build now, so a
// part with nothing in it is shown, but cannot be chosen. The sheet is shown
// while `visible`; `plan` is kept by Home after closing so the rows do not
// change while the sheet fades out.
export function PartChooser({
  plan,
  visible,
  onChoose,
  onChooseRound,
  onClose,
}: {
  plan: SessionPlan | null
  visible: boolean
  onChoose: (choice: PartChoice) => void
  onChooseRound: (kind: PracticeKind) => void
  onClose: () => void
}) {
  const strings = useStrings()
  const insets = useSafeAreaInsets()

  // Spec (multi-digit ＋ −) §6: what the round row will start. It starts at
  // ＋ 1けた and, since the sheet stays mounted under Home, is remembered for
  // as long as the app runs.
  const [op, setOp] = useState<Operation>('add')
  const [digits, setDigits] = useState<Digits>(1)
  const kind: PracticeKind = { op, digits }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root} onAccessibilityEscape={onClose}>
        <Pressable
          testID="chooser-backdrop"
          accessibilityRole="button"
          accessibilityLabel={strings.chooseClose}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View testID="part-chooser" style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grab} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.title}>
            {strings.chooseTitle}
          </Text>
          <Row
            testID="choose-all"
            primary
            name={strings.chooseAll}
            detail={strings.chooseAllDetail}
            onPress={() => onChoose('all')}
          />
          {PRACTICE_PARTS.map((part) => {
            const count = plan?.blocks.find((block) => block.kind === part)?.items.length ?? 0
            return (
              <Row
                key={part}
                testID={`choose-${part}`}
                name={strings.chooseOnly(part)}
                detail={count > 0 ? strings.chooseDetail(part, count) : strings.chooseEmpty}
                disabled={count === 0}
                onPress={() => onChoose(part)}
              />
            )
          })}
          <View testID="round-section" style={styles.section}>
            <View style={styles.rule} />
            <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>
              {strings.roundSection}
            </Text>
            <View style={styles.rule} />
          </View>
          <View style={styles.pickers}>
            <SegmentedControl
              options={OPERATIONS}
              value={op}
              onChange={setOp}
              labelFor={(option) => `${option === 'add' ? '＋' : '−'} ${strings.opName(option)}`}
              testIDFor={(option) => `round-op-${option}`}
            />
            <SegmentedControl
              options={DIGIT_OPTIONS}
              value={`${digits}`}
              onChange={(option) => setDigits(Number(option) as Digits)}
              labelFor={(option) => strings.digitsName(Number(option) as Digits)}
              testIDFor={(option) => `round-digits-${option}`}
            />
          </View>
          <Row
            testID="choose-round"
            name={strings.roundName(kind)}
            detail={strings.roundDetail(kind)}
            onPress={() => onChooseRound(kind)}
          />
        </View>
      </View>
    </Modal>
  )
}

// One choice: its name over a line saying what it holds. VoiceOver reads the
// two together, since a Pressable groups its text.
function Row({
  testID,
  name,
  detail,
  primary = false,
  disabled = false,
  onPress,
}: {
  testID: string
  name: string
  detail: string
  primary?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        primary && styles.primaryRow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text maxFontSizeMultiplier={1.3} style={[styles.name, primary && styles.onPrimary]}>
        {name}
      </Text>
      <Text maxFontSizeMultiplier={1.3} style={[styles.detail, primary && styles.onPrimary]}>
        {detail}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  grab: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.keyEdge,
    marginBottom: space.xs,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.ink,
    marginBottom: space.xs,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardLine,
    borderRadius: radius.key,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: 2,
  },
  primaryRow: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderBottomWidth: 2,
    borderBottomColor: colors.accentShadow,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  name: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  detail: { fontSize: fontSizes.caption, color: colors.muted },
  onPrimary: { color: colors.onAccent },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.cardLine },
  sectionTitle: { fontSize: fontSizes.caption, color: colors.muted },
  pickers: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
})
