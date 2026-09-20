import { parseAnswer } from './parseAnswer'

describe('parseAnswer', () => {
  it('reads a number', () => {
    expect(parseAnswer('7')).toBe(7)
  })

  it('reads a genuine zero', () => {
    expect(parseAnswer('0')).toBe(0)
  })

  // The whole point: Number('') is 0, which would pass as the right answer on
  // every n−n atom and on the tutorial's last prompt.
  it.each(['', ' ', '\t'])('rejects a blank field (%j) rather than reading it as zero', (text) => {
    expect(parseAnswer(text)).toBeNull()
  })

  it.each(['abc', '-', 'NaN'])('rejects unparseable input (%j)', (text) => {
    expect(parseAnswer(text)).toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseAnswer(' 12 ')).toBe(12)
  })
})
