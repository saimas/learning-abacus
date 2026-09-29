import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { LESSONS, lessonById, type Lesson } from '@/domain/lessons'
import { ja } from '@/i18n/ja'
import { textOf } from '@/ui/session/testing'
import { LessonWalkthrough } from './LessonWalkthrough'

beforeEach(() => {
  // The bead steps play on timers.
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function lesson(id: string): Lesson {
  const found = lessonById(id)
  if (found === null) throw new Error(`no lesson ${id}`)
  return found
}

function renderLesson(id: string, onFinish = jest.fn()) {
  render(<LessonWalkthrough lesson={lesson(id)} finishLabel="やってみよう" onFinish={onFinish} />)
  return onFinish
}

// ▶ until the last button, whichever walkthrough it is (at most 80 presses).
function pageToEnd() {
  for (let i = 0; i < 80 && screen.queryByTestId('intro-finish') === null; i++) {
    fireEvent.press(screen.queryByTestId('intro-next') ?? screen.getByTestId('walk-next'))
  }
}

const rods = () =>
  ['rod-0', 'rod-1'].map((id) => within(screen.getByTestId('intro-soroban')).getByTestId(id).props.accessibilityValue.text)

describe('LessonWalkthrough', () => {
  // Spec (howto tutorial) §2: intro, one page per step group, result.
  it('walks a technique lesson: what the move is, its one move, the result', () => {
    const onFinish = renderLesson('add:five')
    expect(screen.getByText('五の合成')).toBeTruthy()
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.techniqueIntro('add', 'five'))
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toContain('五の合成')
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('4＋3 = 7')
    expect(screen.getByText('やってみよう')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('starts ＋ and − from the first number set on the soroban', () => {
    renderLesson('add:five')
    expect(rods()).toEqual(['0', '4'])
  })

  it('draws the number board under × only', () => {
    renderLesson('add:2')
    expect(screen.queryByTestId('operand-a')).toBeNull()
    screen.unmount()
    renderLesson('mul:1')
    expect(screen.getByTestId('operand-a')).toBeTruthy()
  })

  it('works ＋ − 2けた and 3けた by place', () => {
    renderLesson('sub:3')
    expect(screen.getByText('3けたのひき算')).toBeTruthy()
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.lessonMethod('sub'))
  })

  it('tells × where a 九九’s digits go, for its size', () => {
    renderLesson('mul:3')
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.introMethod)
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.multiplyPlacement(3))
  })

  it('walks ÷ with the division walk, titled for its size', () => {
    renderLesson('div:1')
    expect(screen.getByText('1けたのわり算')).toBeTruthy()
    expect(textOf(screen.getByTestId('walk-problem'))).toContain('56')
  })

  // Review focus: every example renders and reaches its last button,
  // 13 − 5 on two rods and the long 3けた × and ÷ among them.
  it.each(LESSONS.map((each) => [each.id]))('pages through %s to its last button', (id) => {
    renderLesson(id)
    pageToEnd()
    expect(screen.getByTestId('intro-finish')).toBeTruthy()
  })
})
