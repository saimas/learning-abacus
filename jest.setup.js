// Global Jest setup.
//
// AsyncStorage's native module is unavailable under Jest, so anything that
// requires it — even indirectly, e.g. via `jest.mock('@/storage/progressStore')`
// automocking the real module to learn its shape — crashes without this.
// The package ships this mock for exactly that purpose.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// Screen reads safe-area insets. The library ships this mock: zero insets and
// a provider-free useSafeAreaInsets, which is what a component test wants.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
)

// react-native-svg's elements are native views with no JS fallback. Tests
// never inspect the drawing, only the Views around it, so each element
// becomes a plain View that keeps its props and children.
jest.mock('react-native-svg', () => {
  const React = require('react')
  const { View } = require('react-native')
  const element = (name) => {
    const Component = ({ children, ...props }) => React.createElement(View, props, children)
    Component.displayName = name
    return Component
  }
  const names = ['Svg', 'Defs', 'LinearGradient', 'Stop', 'Polygon', 'Rect', 'Path', 'Circle', 'Line', 'Polyline']
  const elements = Object.fromEntries(names.map((name) => [name, element(name)]))
  return { __esModule: true, default: elements.Svg, ...elements }
})
