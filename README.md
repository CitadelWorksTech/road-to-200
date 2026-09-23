# Road to 200 — phone app

A weight and daily-routine tracker that installs on your phone's home screen and works offline.
Your data is stored on the phone itself. Use **Plan settings → Export backup** every week or two.

## Files
- `index.html` — the app
- `manifest.webmanifest` — name, icon, and full-screen settings for installing
- `sw.js` — offline support
- `icons/` — home-screen icons

## Put it online (GitHub Pages, free, about 5 minutes)
1. Create a new public repository on GitHub, e.g. `road-to-200`.
2. Upload everything in this folder (keep the `icons` folder).
3. Repository **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. After a minute your app is at `https://<your-username>.github.io/road-to-200/`.

Any static host with HTTPS works the same way (Azure Static Web Apps, Netlify, Cloudflare Pages).
HTTPS is required for installing and offline use.

## Install on your phone
- **iPhone (Safari):** open the link → Share button → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Install app** (or *Add to Home screen*).

Open it from the home-screen icon from then on. Data saved in the installed app stays separate from data
entered in a normal browser tab, so log from the icon.

## Updating the app
Replace `index.html` on the host. To force phones to refresh cached files, also change `CACHE = "road255-v1"`
in `sw.js` to `v2`, `v3`, and so on. Your logged data is not affected by updates.
