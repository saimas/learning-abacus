# Manual iOS release to TestFlight (no EAS)

Same approach as `learning-vocabulary`: archive locally with Xcode's cloud
signing and upload straight to App Store Connect. EAS is not used.

## Credentials

|                       |                                                         |
| --------------------- | ------------------------------------------------------- |
| Key ID                | `8LHJ29MNAD` (Admin)                                    |
| Issuer ID             | `69a6de87-aa14-47e3-e053-5b8c7c11a4d1`                  |
| Private key           | `~/.appstoreconnect/private_keys/AuthKey_8LHJ29MNAD.p8` |
| Team ID               | `H7PV4KT858`                                            |
| Bundle ID             | `com.saimas.learningabacus`                             |
| App Store Connect app | `6814269098`                                            |

The Key ID and Issuer ID are identifiers, not secrets — the `.p8` is the
credential and stays outside the repo. Never commit a `.p8`.

`8LHJ29MNAD` is the only active key. Four stale `.p8` files sit beside it
(`ZNF5S6LK57`, `2LG2B6F945`, `36ZKZT5Q9X`, and the revoked `49ZA7JDK7S`).
If a step fails to authenticate, check the key before debugging anything
else.

## One-time setup — already done

Both steps below are complete; they are recorded because neither is
automatable and both have to be repeated for any future app.

1. **Register the App ID** at Certificates, Identifiers & Profiles →
   Identifiers → **+** → App IDs → App, explicit, `com.saimas.learningabacus`.
   This must come first: the bundle ID does not appear in App Store
   Connect's dropdown until it exists. Note that archiving with
   `-allowProvisioningUpdates` does *not* create it — the explicit App ID
   is created at **export** time, and export refuses to run without the
   app record, so it is circular.
2. **Create the app record** at App Store Connect → Apps → **+** → New App
   (iOS, Japanese, the bundle ID above, SKU `learning-abacus-001`, Full
   Access). Apple exposes no public API for this and `fastlane produce`
   only accepts an interactive Apple ID login, so it is browser work.

Without the record, `-exportArchive` fails with
`DistributionAppRecordProviderError.missingApp`.

## Release

```bash
# 1. Bump ios.buildNumber in app.json (App Store Connect rejects reused ones)
# 2. Regenerate the native project (also reapplies patches/ via postinstall)
CI=1 npx expo prebuild --platform ios

# 3. Archive from CLEAN derived data (~15 min cold)
rm -rf ios/build/DerivedData ios/build/LearningAbacus.xcarchive
xcodebuild archive \
  -workspace ios/LearningAbacus.xcworkspace -scheme LearningAbacus \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build/DerivedData \
  -archivePath ios/build/LearningAbacus.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_8LHJ29MNAD.p8 \
  -authenticationKeyID 8LHJ29MNAD \
  -authenticationKeyIssuerID 69a6de87-aa14-47e3-e053-5b8c7c11a4d1 \
  DEVELOPMENT_TEAM=H7PV4KT858

# 3b. Before uploading: every framework the binary links must be embedded.
#     A missing one uploads fine and then crashes on launch — see Notes.
APP=ios/build/LearningAbacus.xcarchive/Products/Applications/LearningAbacus.app
for fw in $(otool -L "$APP/LearningAbacus" | sed -n 's|.*@rpath/\([^/]*\.framework\)/.*|\1|p'); do
  [ -d "$APP/Frameworks/$fw" ] || echo "MISSING: $fw — do not upload"
done
du -sh "$APP"                          # ~36 MB at 1.0.0

# 4. Export + direct upload to App Store Connect
xcodebuild -exportArchive \
  -archivePath ios/build/LearningAbacus.xcarchive \
  -exportOptionsPlist scripts/ios-release/exportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_8LHJ29MNAD.p8 \
  -authenticationKeyID 8LHJ29MNAD \
  -authenticationKeyIssuerID 69a6de87-aa14-47e3-e053-5b8c7c11a4d1
```

## Notes

- **`patches/expo-modules-jsi+57.1.0.patch` is required to build at all.**
  Without it the archive fails with ~15 Swift errors: `'weak' must be a
  mutable variable` across the JSI value types, `SWIFT_RETURNS_RETAINED`
  on `RuntimeScheduler`'s constructors (which newer clang rejects), and
  `sending '...' risks causing data races` in `JavaScriptRuntime.swift`.
  Delete the patch when Expo ships a fixed release.

  The last of those is the subtle one: three closure sites already declare
  `nonisolated(unsafe)` just above the closure, but Swift drops that
  annotation across the nested capture, so it has to be re-declared inside.

  The patch is **source-only on purpose** — 14 files, ~220 lines. Do not
  regenerate it with `npx patch-package expo-modules-jsi` after a build:
  the podspec generates an xcframework inside `node_modules`, so
  patch-package sweeps in ~866 KB of binaries and absolute paths from this
  machine. If it needs regenerating, diff only the source files.

- `ITSAppUsesNonExemptEncryption=false` is set in `app.json`, so there is
  no export-compliance question per build.
- The archive signs with the wildcard development profile; the explicit
  App ID, distribution profile and certificate are created at export time
  by cloud signing — which is why the Admin-level key is needed.
- Build appears in App Store Connect → TestFlight after ~5-15 min
  processing. Poll `GET /v1/builds?filter[app]=6814269098` until
  `processingState: VALID`. The 個人テスト group takes every new build
  automatically.
- The upload warns that React, ReactNativeDependencies and hermesvm ship
  without dSYMs. Expected — they are prebuilt frameworks. It only costs
  symbolication of crashes inside them; the upload itself is fine.
- Incremental builds never delete bundled assets that stopped being
  bundled, hence the clean archive in step 3.
- Step 3b exists because a framework can be linked but not embedded: the
  archive and upload both succeed and the app then crashes at launch.
  This shipped once as `learning-vocabulary` TestFlight build 31.
