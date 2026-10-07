import { Redirect, useLocalSearchParams } from 'expo-router'
import { HOW_TO_OPS } from '@/domain/lessons'
import { HowToScreen } from '@/ui/lesson/HowToScreen'

// Spec (howto tutorial) §3: /howto/add and so on. An operation it does not
// know goes Home.
export default function HowToRoute() {
  const param = useLocalSearchParams().op
  const op = HOW_TO_OPS.find((candidate) => candidate === param)
  if (op === undefined) return <Redirect href="/" />
  return <HowToScreen op={op} />
}
