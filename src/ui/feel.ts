import * as Haptics from 'expo-haptics'

// Spec (runs) §5: the moments of a run that can be felt, and nothing else.
// A haptic is a nicety: a phone without them, or a failed call, changes
// nothing, so failures are dropped.
function quietly(touch: Promise<void>) {
  touch.catch(() => {})
}

export const feel = {
  right: () => quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  miss: () => quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  levelUp: () => quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  rankUp: () => quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
}
