import { fireEvent, type render } from '@testing-library/react-native'

type GetByTestId = ReturnType<typeof render>['getByTestId']
type Node = ReturnType<GetByTestId>

// Sets the session soroban to `value` through each rod's VoiceOver adjust
// action: the same state change a tap makes, without aiming at pixels.
// `rods` is the soroban's rod count: 2 for a single move, digits + 1 for a
// problem. Test-only; imported by the session tests, never by app code.
export function setBeads(getByTestId: GetByTestId, value: number, rods = 2) {
  const digits = String(value).padStart(rods, '0').split('').map(Number)
  digits.forEach((digit, rodIndex) => {
    const shown = () => Number(getByTestId(`rod-${rodIndex}`).props.accessibilityValue.text)
    const adjust = (actionName: string) =>
      fireEvent(getByTestId(`rod-${rodIndex}`), 'accessibilityAction', { nativeEvent: { actionName } })
    for (let step = 0; step < 10 && shown() < digit; step++) adjust('increment')
    for (let step = 0; step < 10 && shown() > digit; step++) adjust('decrement')
  })
}

// What a Text element reads out, nested Text included: the line the learner
// sees, where props.children would be a list of pieces.
export function textOf(node: Node): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}
