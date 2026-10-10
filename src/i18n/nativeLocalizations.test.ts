import appJson from '../../app.json'
import enInfoPlist from '../../locales/en.json'
import jaInfoPlist from '../../locales/ja.json'
import { LOCALES } from './locale'

// The App Store lists an app's languages from the localizations inside its
// binary. Through 1.3.0 this one declared none, so the Japanese storefront
// listed the app as 英語 only, though it ships both catalogs. Two app.json
// settings fix that, and nothing else would notice them gone:
// CFBundleLocalizations, and `locales`, which makes prebuild write
// ja.lproj / en.lproj.
describe('native localizations (app.json)', () => {
  it('declares every shipped locale as a bundle localization', () => {
    expect(appJson.expo.ios.infoPlist.CFBundleLocalizations).toEqual([...LOCALES])
  })

  it('points each locale at its InfoPlist strings file', () => {
    expect(appJson.expo.locales).toEqual({ ja: './locales/ja.json', en: './locales/en.json' })
  })

  // Not empty on purpose: prebuild skips EVERY .lproj when any locale file
  // is `{}` (writeStringsFile in @expo/config-plugins).
  it.each([
    ['ja', jaInfoPlist],
    ['en', enInfoPlist],
  ])('keeps the home-screen name in %s.lproj', (_lang, strings) => {
    expect(strings).toEqual({ CFBundleDisplayName: appJson.expo.ios.infoPlist.CFBundleDisplayName })
  })
})
