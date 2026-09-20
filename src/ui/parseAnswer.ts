// `Number('')` is 0. Left unguarded, tapping the submit button with an empty
// field scores as *correct* on the nine n−n atoms and completes the tutorial's
// final 0 prompt — a learner could finish either without reading anything.
//
// A blank field is not a wrong answer either. It is no submission at all, so
// it must not burn one of the three attempts an atom gets in a session.
export function parseAnswer(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}
