import { Redirect, useLocalSearchParams } from 'expo-router'
import type { PairOperation } from '@/domain/problem'
import { HowToScreen } from '@/ui/lesson/HowToScreen'

const OPS: readonly PairOperation[] = ['add', 'sub', 'mul', 'div']

// Spec (howto tutorial) §3: /howto/add and so on. An operation it does not
// know goes Home.
export default function HowToRoute() {
  const param = useLocalSearchParams().op
  const op = OPS.find((candidate) => candidate === param)
  if (op === undefined) return <Redirect href="/" />
  return <HowToScreen op={op} />
}
