# Android migration — status and Windows build instructions

Last updated: 2026-07-09 (commit on `main`). The Flutter/Dart layer is fully
cross-platform, so every feature shipped on iOS (scan-verified matches, live
challenges, map clustering, avatar creator, courts/runs/calendar) comes along
automatically. This document covers the Android-specific work: what was fixed
from the Mac, what only Brett can do in external consoles, and how to build on
the Windows machine.

## Already fixed in the repo (no action needed)

Platform config:
- `android/app/src/main/AndroidManifest.xml`: added CAMERA (+`uses-feature`
  `required=false`), POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED,
  SCHEDULE_EXACT_ALARM, READ_EXTERNAL_STORAGE (≤ API 32); the
  flutter_local_notifications receivers (scheduled run reminders were silently
  broken without them); FCM default-channel/icon meta-data; url_launcher
  `<queries>` for https/geo. Replaced global `usesCleartextTraffic="true"`
  with `res/xml/network_security_config.xml` (HTTPS-only except
  localhost/127.0.0.1/10.0.2.2 for local dev and model_viewer).
- Toolchain bumped for mobile_scanner 7.x / Play requirements: AGP 8.9.1,
  Kotlin 2.1.20, Gradle 8.11.1, compileSdk/targetSdk 36, Java/Kotlin 17,
  desugar_jdk_libs 2.1.4, NDK 27. Crashlytics Gradle plugin now applied;
  `play-services-ads-identifier` added so AppsFlyer can read the GAID.
  **This combination has not been compiled yet (no Android SDK on the Mac) —
  the first Windows build verifies it.**
- Release build type falls back to debug signing until `android/key.properties`
  exists, so dev builds work before the upload keystore is created.

Dart platform gates (iOS behavior unchanged):
- Apple Sign-In button hidden on Android (it threw immediately —
  sign_in_with_apple needs a web-auth flow we don't configure).
- Apple Maps button in the court sheet is iOS-only; Google Maps goes full width.
- Calendar reminders: exact-alarm scheduling falls back to inexact and never
  throws (previously error-ed the whole calendar screen on Android 12+).
- iOS-only MethodChannels (badge clear, APNs registration, IDFV logging) are
  gated to iOS.
- NotificationService now creates the `hooprank_calendar_channel` at init so
  background FCM notifications land on a real channel.

## Blockers only Brett can do (external consoles)

1. **Fix Google Sign-In (currently broken on Android).** The Android OAuth
   client in `google-services.json` has a malformed 41-char SHA-1
   (`...1633886d97b18` — an extra `8` was typed into the Firebase console).
   In Firebase console → project `hooprank-503` → Android app
   `beta.hooprank.android` → add the correct fingerprints:
   - release/upload keystore SHA-1: `5B:61:40:C8:49:76:65:30:48:78:D4:7A:8D:11:16:33:86:D9:7B:18`
   - the Windows machine's debug keystore SHA-1 (get it with
     `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android`)
   Then re-download `google-services.json` into `mobile/android/app/`.
   Until this is done, Google login returns ApiException 10 (DEVELOPER_ERROR)
   — and with Apple hidden, no sign-in method works on Android.
2. **Create the upload keystore** (on whichever machine does release builds):
   `keytool -genkey -v -keystore upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
   then create `mobile/android/key.properties` (gitignored) with
   `storeFile/storePassword/keyAlias/keyPassword`. Back the keystore up
   outside the repo. Play rejects debug-signed bundles.
3. **Decide the applicationId before the first Play upload — it's permanent.**
   Currently `beta.hooprank.android` (Firebase/Facebook/AppsFlyer are all
   registered against it; iOS uses `com.bcorbett.hooprank`). Keeping it is
   zero work; changing it means re-registering the app in Firebase (new
   `google-services.json`), Facebook, and AppsFlyer.
4. **Post-launch:** invite/QR download links point to the Apple App Store
   (`lib/app_config.dart`). Once the Play listing exists, add a smart link
   that redirects by platform. Apple Sign-In on Android (web-auth flow) is
   optional if users need cross-platform Apple accounts.

## Windows machine setup

The old Windows build failures in the removed gradle logs were environmental,
not config: the project lived under OneDrive (file locks) and the Gradle
caches were corrupted.

1. Clone to a path **outside OneDrive**, e.g. `C:\dev\HoopRank`
   (`git clone https://github.com/bcorbett503/HoopRank.git C:\dev\HoopRank`).
   The app is at `C:\dev\HoopRank\app\hooprank-starter-with-frontend\hooprank-starter\mobile`.
2. One-time cleanup: `gradlew --stop` (if any daemon runs), delete
   `%USERPROFILE%\.gradle\caches`, and exclude `C:\dev` from OneDrive sync and
   Windows Defender real-time scanning.
3. `flutter pub get`, start an emulator (or plug in a device), `flutter run`.
   First build downloads Gradle 8.11.1 + AGP 8.9.1 — expect several minutes.
4. Version comes from pubspec (`6.0.1+20`) via the Flutter tool — always build
   with `flutter build appbundle`, never bare `gradlew`.

## Android QA checklist (emulator/device)

- Login: Google (after the SHA-1 fix), guest flow; Apple button must NOT appear.
- Home map: courts + player clustering, court sheet (Google Maps full width,
  directions open the Maps app), follows filter default.
- Quick Play QR: generate QR; scanning needs a real camera or the emulator's
  virtual scene (Extended controls → Camera). Camera permission prompt appears.
- Messages: challenge cards (Start Match / Decline / Message), badge counts.
- Calendar: join a run — must not error; reminder scheduled (inexact fallback
  on API 31+ without the exact-alarm grant).
- Avatar creator webview opens, saves, and persists after cold restart.
- Notifications: runtime prompt on first login (Android 13+), push arrives on
  the `hooprank_calendar_channel`. Known cosmetic issue: the status-bar icon
  uses the full-color launcher mipmap and will render as a flat square — add a
  monochrome `drawable/ic_notification` and point the manifest meta-data +
  `AndroidInitializationSettings` at it.
- Back button/predictive back behaves on nested routes (targetSdk 36).
