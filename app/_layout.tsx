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
          {/* The session and a round are left only through ✕ (which confirms
              and saves) or おわる. A stray edge swipe must not skip either. */}
          <Stack.Screen name="session" options={{ gestureEnabled: false }} />
          <Stack.Screen name="round" options={{ gestureEnabled: false }} />
          {/* Spec (multiplication) §4: opened with a round's kind, the
              walkthrough leads into it, so it is left only through its last
              button, as a round is. Opened from Home's やりかた link
              (no kind) it leads nowhere, so an edge swipe back is fine. */}
          <Stack.Screen
            name="multiply-intro"
            options={({ route }) => ({ gestureEnabled: !(route.params as { kind?: string } | undefined)?.kind })}
          />
        </Stack>
      </ProgressProvider>
    </LocaleProvider>
  )
}
