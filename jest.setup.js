// Global Jest setup.
//
// AsyncStorage's native module is unavailable under Jest, so anything that
// requires it — even indirectly, e.g. via `jest.mock('@/storage/progressStore')`
// automocking the real module to learn its shape — crashes without this.
// The package ships this mock for exactly that purpose.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
