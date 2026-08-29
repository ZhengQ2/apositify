# Apostifi for Android

This directory contains the native Android implementation of Apostifi. It uses
Kotlin, Jetpack Compose, and bundled ML Kit models. The app accepts exactly one
camera or gallery image per verification, scans allowlisted QR routes first, and
falls back to on-device multilingual OCR and user review.

## Open and run

1. Open this `android` directory in Android Studio.
2. Install Android SDK 37 when Android Studio prompts for it.
3. Select the `app` run configuration and an Android 6.0 (API 23) or newer device.
4. Run the app.

The included Gradle wrapper downloads Gradle 9.5.0. The project uses Android
Gradle Plugin 9.3.0 and requires JDK 17 or newer.

From a terminal with `ANDROID_HOME` configured:

```bash
./gradlew test assembleDebug
```

## Shared authority data

`app/src/main/assets/e-registers.json` is generated from the same 97-authority
catalog used by the web and iOS apps. From the repository root, run:

```bash
npm run build:android-data
npm run check:android-data
```

The freshness check is intentionally non-mutating and fails when the Android
snapshot differs from the generated iOS/shared catalog.

## Security and data-quality boundaries

- QR payloads are accepted only when they match specimen-backed protocol, host,
  path, query, and fragment rules.
- Full-resolution images are never decoded into memory; the longest edge is
  bounded to 2400 pixels before both QR and OCR processing.
- OCR geometry assigns a candidate line to at most one numbered item. Multiple
  plausible dates or references remain blank until the user selects one.
- Numeric dates use authority-country ordering. A corrected value is normalized
  again immediately before browser autofill.
- Only HTTPS authority hosts appear inside the branded verifier. HTTP and
  off-domain destinations open externally after a warning, without autofill.
- No document image or recognized text is uploaded by Apostifi.
