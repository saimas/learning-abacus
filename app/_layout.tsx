import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { LocaleProvider } from '@/i18n'
import { ProgressProvider } from '@/ui/ProgressProvider'
import { colors } from '@/ui/theme'

export default function RootLayout() {
  return (
    <LocaleProvider>
      <ProgressProvider>
        <StatusBar style="dark" />
        {/* Paper behind every screen, so no white flashes between them. */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
          {/* The session is left only through ✕ (which confirms and saves) or
              おわる. A stray edge swipe must not skip either. */}
          <Stack.Screen name="session" options={{ gestureEnabled: false }} />
        </Stack>
      </ProgressProvider>
    </LocaleProvider>
  )
}
