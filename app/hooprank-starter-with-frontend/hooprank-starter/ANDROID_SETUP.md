# HoopRank — Android Setup Guide (Windows PC)

> Pull this repo on your PC, follow these steps, and you'll be running on the Android emulator in minutes.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Flutter SDK** | 3.38+ (stable) | [flutter.dev/get-started](https://docs.flutter.dev/get-started/install/windows/mobile) |
| **Android Studio** | Latest | [developer.android.com/studio](https://developer.android.com/studio) |
| **Git** | Any | [git-scm.com](https://git-scm.com/) |

### Android Studio First-Launch Setup
1. Open Android Studio → **More Actions** → **SDK Manager**
2. Install **Android SDK 35** (API 35) and **Android SDK Command-line Tools**
3. Accept all licenses: `flutter doctor --android-licenses`

### Create an Android Emulator
1. Android Studio → **More Actions** → **Virtual Device Manager**
2. Click **Create Virtual Device**
3. Choose **Pixel 8** (or any modern phone)
4. Select **API 35** system image → Download if needed → **Finish**
5. Click the **▶ Play** button to boot the emulator

---

## Clone & Configure

```bash
git clone https://github.com/bcorbett503/HoopRank.git
cd HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile
```

### Install Dependencies
```bash
flutter pub get
```

### Verify Environment
```bash
flutter doctor
```
You should see ✓ for **Flutter** and **Android toolchain**. Fix any issues `doctor` flags.

---

## Firebase (Already Configured)

The `android/app/google-services.json` is already in the repo and configured for:
- **Package**: `beta.hooprank.android`
- **Firebase Project**: `hooprank-503`

No additional Firebase setup is needed.

---

## Run on Emulator

### Quick Start (PowerShell)
```powershell
.\start_app.ps1
```

### Manual Launch
```bash
# List available devices
flutter devices

# Run on the emulator
flutter run -d emulator-5554
```

> **Tip**: If the emulator ID differs, use `flutter devices` to find the correct one.

---

## Release Build

### Generate a Signing Keystore (One-Time)
```bash
keytool -genkey -v -keystore hooprank-release.jks -keyalias hooprank -keyalg RSA -keysize 2048 -validity 10000
```

### Create `android/key.properties`
```properties
storePassword=YOUR_PASSWORD
keyPassword=YOUR_PASSWORD
keyAlias=hooprank
storeFile=../../hooprank-release.jks
```

> ⚠️ **Do NOT commit `key.properties` or `.jks` files to git.**

### Build APK (for sideloading / testing)
```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### Build App Bundle (for Google Play)
```bash
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `flutter.sdk not set` | Run `flutter doctor`; it auto-writes `local.properties` |
| Gradle build fails | Delete `mobile/build/` and `mobile/android/.gradle/`, re-run |
| `NDK not installed` | Android Studio → SDK Manager → SDK Tools → install NDK 25.1.x |
| Emulator not detected | Ensure it's booted in AVD Manager before running |
| Facebook login issues | App is in Dev mode; add testers in Meta Developer Console |

---

## Project Structure

```
HoopRank/
├── app/hooprank-starter-with-frontend/hooprank-starter/
│   ├── mobile/          ← Flutter app (this is where you run from)
│   │   ├── android/     ← Android-specific config
│   │   ├── ios/         ← iOS-specific config
│   │   ├── lib/         ← Dart source code (shared)
│   │   └── pubspec.yaml ← Dependencies
│   └── backend/         ← NestJS API (hosted on Railway)
```

---

## Backend

The backend is already deployed at:
```
https://heartfelt-appreciation-production-65f1.up.railway.app
```
The mobile app connects to this automatically. No local backend setup is needed unless you're developing backend features.
