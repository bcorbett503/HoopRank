# Changelog

All notable changes to HoopRank will be documented in this file.

## [1.0.0+10] - 2026-01-22

### Added - App Store Submission
- **Email/Password Authentication** for App Review demo account
  - New `signInWithEmail()` method in `AuthService`
  - Expandable email/password form on Login screen
  - Demo credentials: `demo@hooprank.app` / `HoopRank2026!`

### Added - Push Notifications
- **APNs Key Configuration** (`JW78JLZVLT`) in Firebase
- Firebase Cloud Messaging setup for both iOS and Android
- FCM token registration with backend

### Added - Legal/Compliance
- `LICENSE_AGREEMENT.md` - EULA for App Store
- Privacy policy page at `web/public/privacy.html`
- Support page at `web/public/support.html`

### Configuration
- iOS GoogleService-Info.plist for Firebase
- iOS entitlements for push notifications
- Updated `pubspec.yaml` version to `1.0.0+10`

---

## Build Instructions

### iOS (Xcode)
```bash
cd app/hooprank-starter-with-frontend/hooprank-starter/mobile
flutter pub get
flutter build ios
# Then archive in Xcode: Product → Archive
```

### Android
```bash
cd app/hooprank-starter-with-frontend/hooprank-starter/mobile
flutter pub get
flutter build apk --debug
# APK: build/app/outputs/flutter-apk/app-debug.apk
```

---

## Firebase Setup Status
| Service | Status |
|---------|--------|
| Authentication (Email/Password) | ✅ Enabled |
| Cloud Messaging (iOS APNs) | ✅ Configured |
| Cloud Messaging (Android FCM) | ✅ Configured |

## App Store Connect Status
| Item | Status |
|------|--------|
| Beta App Review Credentials | ✅ Updated |
| Build 1.0.0+10 | 🔄 Ready to upload |
