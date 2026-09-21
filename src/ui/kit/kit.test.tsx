import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '@/ui/theme'
import { BackLink } from './BackLink'
import { Button } from './Button'
import { Card } from './Card'
import { IconButton } from './IconButton'
import { Screen } from './Screen'
import { Seal } from './Seal'
import { SegmentedControl } from './SegmentedControl'

// `<Link>` calls useRouter() internally, which throws outside a real
// navigation tree. A stand-in that renders the href lets it be asserted.
jest.mock('expo-router', () => {
  const { Text } = require('react-native')
  return {
    Link: ({ href, testID }: { href: string; testID?: string }) => (
      <Text testID={testID}>{href}</Text>
    ),
  }
})

function styleOf(element: { props: { style?: unknown } }) {
  return StyleSheet.flatten(element.props.style as StyleProp<ViewStyle>)
}

describe('Screen', () => {
  it('puts its children on paper', () => {
    const { getByTestId, getByText } = render(
      <Screen testID="screen">
        <Text>inside</Text>
      </Screen>,
    )
    expect(getByText('inside')).toBeTruthy()
    expect(styleOf(getByTestId('screen')).backgroundColor).toBe(colors.paper)
  })
})

describe('Button', () => {
  it('calls onPress', () => {
    const onPress = jest.fn()
    const { getByTestId } = render(<Button testID="b" label="はじめる" onPress={onPress} />)
    fireEvent.press(getByTestId('b'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows its label and an optional detail', () => {
    const { getByText } = render(<Button label="はじめる" detail="5分" onPress={jest.fn()} />)
    expect(getByText('はじめる')).toBeTruthy()
    expect(getByText('5分')).toBeTruthy()
  })

  it('fills a primary button with vermilion and outlines an outline button', () => {
    const primary = render(<Button testID="p" label="a" onPress={jest.fn()} />)
    expect(styleOf(primary.getByTestId('p')).backgroundColor).toBe(colors.accent)

    const outline = render(<Button testID="o" label="a" variant="outline" onPress={jest.fn()} />)
    expect(styleOf(outline.getByTestId('o')).backgroundColor).toBeUndefined()
    expect(styleOf(outline.getByTestId('o')).borderColor).toBe(colors.accent)
  })
})

describe('Card', () => {
  it('gives an accent card a vermilion left edge', () => {
    const { getByTestId } = render(
      <Card accent testID="c">
        <Text>x</Text>
      </Card>,
    )
    expect(styleOf(getByTestId('c')).borderLeftColor).toBe(colors.accent)
  })
})

describe('Seal', () => {
  it('shows its text', () => {
    const { getByText } = render(<Seal text="12日" state="outline" />)
    expect(getByText('12日')).toBeTruthy()
  })

  it('fills in when stamped', () => {
    const { getByTestId } = render(<Seal testID="s" text="済" state="stamped" />)
    expect(styleOf(getByTestId('s')).backgroundColor).toBe(colors.accent)
  })

  it('draws an empty seal as a dashed ring with no text', () => {
    const { getByTestId, queryByText } = render(<Seal testID="s" text="" state="empty" />)
    expect(styleOf(getByTestId('s')).borderStyle).toBe('dashed')
    expect(queryByText(/./)).toBeNull()
  })
})

describe('SegmentedControl', () => {
  const options = ['ja', 'en'] as const

  function renderControl(onChange = jest.fn()) {
    const utils = render(
      <SegmentedControl
        options={options}
        value="ja"
        onChange={onChange}
        labelFor={(o) => (o === 'ja' ? '日本語' : 'English')}
        testIDFor={(o) => `locale-${o}`}
      />,
    )
    return { ...utils, onChange }
  }

  it('labels each option', () => {
    const { getByTestId } = renderControl()
    expect(getByTestId('locale-ja-label').props.children).toBe('日本語')
    expect(getByTestId('locale-en-label').props.children).toBe('English')
  })

  it('marks the selected option', () => {
    const { getByTestId } = renderControl()
    expect(getByTestId('locale-ja').props.accessibilityState).toMatchObject({ selected: true })
    expect(getByTestId('locale-en').props.accessibilityState).toMatchObject({ selected: false })
  })

  it('reports a new choice', () => {
    const { getByTestId, onChange } = renderControl()
    fireEvent.press(getByTestId('locale-en'))
    expect(onChange).toHaveBeenCalledWith('en')
  })
})

describe('IconButton', () => {
  it('is a labelled button', () => {
    const onPress = jest.fn()
    const { getByTestId } = render(
      <IconButton testID="i" icon="gear" label="設定" onPress={onPress} />,
    )
    expect(getByTestId('i').props.accessibilityLabel).toBe('設定')
    fireEvent.press(getByTestId('i'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('BackLink', () => {
  it('links back to today', () => {
    const { getByTestId } = render(<BackLink />)
    expect(getByTestId('link-today').props.children).toBe('/')
  })
})
