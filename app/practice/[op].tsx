import { Redirect, useLocalSearchParams } from 'expo-router'
import { OPERATIONS } from '@/domain/problem'
import { OperationScreen } from '@/ui/practice/OperationScreen'

// Spec (home menu) §3: /practice/add and so on, a page per operation. An
// operation it does not know, from a hand-typed or stale URL, goes Home.
export default function PracticeRoute() {
  const param = useLocalSearchParams().op
  const op = OPERATIONS.find((candidate) => candidate === param)
  if (op === undefined) return <Redirect href="/" />
  return <OperationScreen op={op} />
}
