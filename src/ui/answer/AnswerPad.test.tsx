import { fireEvent, render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AnswerPad, appendDigit } from './AnswerPad'

describe('appendDigit', () => {
  it('appends a digit', () => {
    expect(appendDigit('1', '1')).toBe('11')
  })

  it('starts from a blank value', () => {
    expect(appendDigit('', '0')).toBe('0')
  })

  it('stops at two digits, since no answer exceeds 18', () => {
    expect(appendDigit('18', '3')).toBe('18')
  })

  it('replaces a lone zero, so "05" can never be typed', () => {
    expect(appendDigit('0', '5')).toBe('5')
  })

  it('takes as many digits as a problem’s answer can have', () => {
    expect(appendDigit('185', '7', 4)).toBe('1857')
    expect(appendDigit('1857', '3', 4)).toBe('1857')
  })
})

describe('AnswerPad', () => {
  function renderPad(value = '') {
    const onChange = jest.fn()
    const onSubmit = jest.fn()
    const utils = render(
      <AnswerPad
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        submitLabel="こたえる"
        submitTestID="submit"
        adornment={<Text testID="adornment">〇</Text>}
      />,
    )
    return { ...utils, onChange, onSubmit }
  }

  it('has a key for every digit', () => {
    const { getByTestId } = renderPad()
    for (let digit = 0; digit <= 9; digit++) {
      expect(getByTestId(`key-${digit}`)).toBeTruthy()
    }
  })

  it('reports the value a digit key produces', () => {
    const { getByTestId, onChange } = renderPad('1')
    fireEvent.press(getByTestId('key-7'))
    expect(onChange).toHaveBeenCalledWith('17')
  })

  it('deletes the last digit', () => {
    const { getByTestId, onChange } = renderPad('17')
    fireEvent.press(getByTestId('key-delete'))
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('shows the value in the readout', () => {
    const { getByTestId } = renderPad('17')
    expect(getByTestId('answer-readout').props.children).toBe('17')
  })

  it('does not submit a blank value', () => {
    const { getByTestId, onSubmit } = renderPad('')
    fireEvent.press(getByTestId('submit'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a typed value', () => {
    const { getByTestId, onSubmit } = renderPad('7')
    fireEvent.press(getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows the submit label on its key', () => {
    const { getByText } = renderPad()
    expect(getByText('こたえる')).toBeTruthy()
  })

  it('labels the delete key for VoiceOver', () => {
    const { getByTestId } = renderPad()
    expect(getByTestId('key-delete').props.accessibilityLabel).toBe('1文字消す')
  })

  it('shows an adornment beside the readout', () => {
    const { getByTestId } = renderPad()
    expect(getByTestId('adornment')).toBeTruthy()
  })
})
