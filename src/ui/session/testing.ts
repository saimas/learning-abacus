import { fireEvent, type render } from '@testing-library/react-native'

type GetByTestId = ReturnType<typeof render>['getByTestId']

// Sets the two-rod session soroban to `value` through each rod's VoiceOver
// adjust action: the same state change a tap makes, without aiming at pixels.
// Test-only; imported by the session tests, never by app code.
export function setBeads(getByTestId: GetByTestId, value: number) {
  const digits = [Math.floor(value / 10), value % 10]
  digits.forEach((digit, rodIndex) => {
    const shown = () => Number(getByTestId(`rod-${rodIndex}`).props.accessibilityValue.text)
    const adjust = (actionName: string) =>
      fireEvent(getByTestId(`rod-${rodIndex}`), 'accessibilityAction', { nativeEvent: { actionName } })
    for (let step = 0; step < 10 && shown() < digit; step++) adjust('increment')
    for (let step = 0; step < 10 && shown() > digit; step++) adjust('decrement')
  })
}
