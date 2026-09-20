import { Stack } from 'expo-router'
import { ProgressProvider } from '@/ui/ProgressProvider'

export default function RootLayout() {
  return (
    <ProgressProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ProgressProvider>
  )
}
