import { Stack } from 'expo-router'
import { LocaleProvider } from '@/i18n'
import { ProgressProvider } from '@/ui/ProgressProvider'

export default function RootLayout() {
  return (
    <LocaleProvider>
      <ProgressProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ProgressProvider>
    </LocaleProvider>
  )
}
