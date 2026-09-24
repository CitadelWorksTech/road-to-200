# Forgeway

Forgeway (formerly Road to 200): a weight, food, workout, steps and disc golf tracker. One codebase, two ways to use it:

| | How to get it | Steps |
|---|---|---|
| **Android app** (recommended) | Latest **Release** → `road-to-200.apk` | Counts steps all day with the phone's built-in sensor |
| **Web app** | https://citadelworkstech.github.io/road-to-200/ → Chrome ⋮ → Install app | GPS walks and typed steps |

All data stays on the phone. Use **Plan settings → Export backup** regularly.

## Repository layout
- `index.html`, `capacitor.js`, `manifest.webmanifest`, `sw.js`, `icons/`: the app. GitHub Pages serves these.
- `android/`: the Android wrapper (Capacitor), including the step counter in
  `android/app/src/main/java/tech/citadelworks/roadto200/`.
- `.github/workflows/build-apk.yml`: builds a signed APK and publishes it as a Release on every change to the app.

## Updating
Edit `index.html`, commit, push. Pages updates the web app. Actions builds a new APK release.
For the web app, also bump `CACHE` in `sw.js` (`road200-v6`, `v7`, …) so installed copies refresh.

## Signing key
The APK signing key is **not** in this repo. It lives in two repository secrets:
`KEYSTORE_BASE64` and `KEYSTORE_PASSWORD`. Keep a private copy of the keystore file. Every APK must be
signed with the same key, or Android won't install updates over the old version.
