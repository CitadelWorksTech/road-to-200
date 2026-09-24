# Forgeway

Forgeway (formerly Road to 200): a weight, food, workout, steps and disc golf tracker. One codebase, two ways to use it:

| | How to get it | Steps |
|---|---|---|
| **Android app** (recommended) | Latest **Release** → `road-to-200.apk` | Counts steps all day with the phone's built-in sensor |
| **Web app** | https://citadelworkstech.github.io/road-to-200/ → Chrome ⋮ → Install app | GPS walks and typed steps |

All data stays on the phone. Use **Plan settings → Export backup** regularly.

## Repository layout
| Path | What it is |
|---|---|
| `index.html` | App shell: loads the stylesheet and scripts |
| `css/app.css` | All styles |
| `js/*.js` | The app, split by feature. Scripts share one global scope and load in the order listed in `index.html`: `core` → `charts` → `panels` → `golf` → `steps` → `native` → `progress` → `workout` → `goals` → `activity` → `settings` → `food` → `share` → `app` |
| `tests/` | Automated tests (Node's built-in test runner + jsdom) that load the real app, with a simulated Android bridge |
| `android/` | Android wrapper (Capacitor) with native step counter, background GPS, reminders and widget in `android/app/src/main/java/tech/citadelworks/roadto200/` |
| `.github/workflows/build-apk.yml` | Runs the tests, then builds a signed APK and Play Store bundle on every change |

## Developing
```
npm ci
npm test
```
Tests must pass before GitHub builds the app.

## Updating
Edit files in `js/` or `css/`, commit, push. Pages updates the web app; Actions tests and builds a new release.
For the web app, also bump `CACHE` in `sw.js` so installed copies refresh.

## Signing key
The APK signing key is **not** in this repo. It lives in two repository secrets:
`KEYSTORE_BASE64` and `KEYSTORE_PASSWORD`. Keep a private copy of the keystore file.
