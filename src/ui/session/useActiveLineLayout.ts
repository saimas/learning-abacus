import { createContext, useContext, useEffect, useEffectEvent, useRef } from 'react'
import type { LayoutChangeEvent } from 'react-native'

// Where a step panel's highlighted line sits among the lines a card draws: its
// top, measured from the top of the card's own lines, and its height.
export type ActiveLayout = (y: number, height: number) => void

// The owner's request (2026-09-23): in bead mode the step lines fill the
// space below ◀ ▶ and scroll there on their own (ScrollingStepLines), so the
// line stepped to has to be scrolled into view, and only the card knows
// where its lines are. That scroll gives the card inside it this, to tell it
// where the active line sits. Outside it, as in keypad mode, where the lines
// scroll with the prompt, there is nothing to tell. It is a context rather
// than a prop passed on through renderSteps because the scroll reads its
// refs to answer, and React Compiler's rules allow handing such a function
// on as a JSX prop, never through a call made while rendering.
export const ActiveLayoutContext = createContext<ActiveLayout | undefined>(undefined)

// Tells the scroll around a card where the card's active line sits, each
// time the highlight moves to another line, and again whenever that line is
// laid out afresh. onLayout alone would not do: moving the highlight
// restyles a line without moving it, which lays nothing out anew and fires
// no layout event, so each line's last layout is kept to answer from.
//
// `activeLine` names the highlighted line, as the card numbers its lines;
// undefined when none is. The result gives each line its onLayout, or
// nothing outside a scroll that asks. Every line must be a direct child of
// the card's root view, so their layouts share one origin.
export function useActiveLineLayout(
  activeLine: number | undefined,
): (line: number) => ((event: LayoutChangeEvent) => void) | undefined {
  const onActiveLayout = useContext(ActiveLayoutContext)
  const laidOut = useRef(new Map<number, { y: number; height: number }>())
  // An effect event, so a new onActiveLayout from a render of the scroll
  // does not count as the highlight moving: only a new active line does.
  const tell = useEffectEvent((line: number) => {
    const layout = laidOut.current.get(line)
    if (layout !== undefined) onActiveLayout?.(layout.y, layout.height)
  })
  useEffect(() => {
    if (activeLine !== undefined) tell(activeLine)
  }, [activeLine])

  return (line) =>
    onActiveLayout === undefined
      ? undefined
      : (event) => {
        const { y, height } = event.nativeEvent.layout
        laidOut.current.set(line, { y, height })
        if (line === activeLine) onActiveLayout(y, height)
      }
}
