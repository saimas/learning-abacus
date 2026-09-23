import { Alert } from 'react-native'
import type { Strings } from '@/i18n/ja'

// Leaving mid-practice asks first; the answers so far are already recorded.
export function confirmQuit(strings: Strings, onStop: () => void) {
  Alert.alert(strings.quitTitle, strings.quitBody, [
    { text: strings.quitContinue, style: 'cancel' },
    { text: strings.quitStop, style: 'destructive', onPress: onStop },
  ])
}
