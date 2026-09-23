import { fireEvent, within, type render } from '@testing-library/react-native'

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

// Every bead drawn red while stepping, as "rod bead tint" (for example
// "1 earth2 latest"), on the `rods` rods of the soroban inside `container`,
// rods from the left. Each rod draws its heaven bead, then its earth beads
// from the beam out, and a tinted bead's testID ends in its tint.
export function tintedBeads(container: Node, rods: number): string[] {
  return Array.from({ length: rods }, (_, rod) => rod).flatMap((rod) =>
    within(within(container).getByTestId(`rod-${rod}`))
      .getAllByTestId(/^bead-/)
      .flatMap((bead, i) => {
        const match = /^bead-(heaven|earth)-(group|latest)$/.exec(String(bead.props.testID))
        if (match === null) return []
        return [`${rod} ${match[1] === 'heaven' ? 'heaven' : `earth${i - 1}`} ${match[2]}`]
      }),
  )
}
