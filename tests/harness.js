// Test harness: loads the real app (index.html + js/*.js) in jsdom with an optional fake Android bridge.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const fs = require('fs');
const { JSDOM, ResourceLoader } = require('jsdom');

// Serves https://localhost/<path> from the repo folder so the app's own scripts load.
class LocalLoader extends ResourceLoader {
  fetch(url, options) {
    if (url.startsWith('https://localhost/')) {
      const file = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
      const p = fs.promises.readFile(file);
      p.abort = () => {};
      return p;
    }
    return null; // block everything else (fonts, network)
  }
}

const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };

/**
 * Opens the app. Options:
 *   state  – object saved to localStorage before load
 *   tab    – starting tab
 *   native – true to simulate the Android app (StepCounter, Filesystem, Share, GpsTracker plugins)
 *   fetch  – replacement for window.fetch
 */
async function openApp({ state, tab, native = false, fetch } = {}) {
  const calls = [];
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    url: 'https://localhost/',
    runScripts: 'dangerously',
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.scrollTo = () => {};
      w.confirm = () => true;
      w.alert = () => {};
      w.prompt = () => null;
      w.HTMLElement.prototype.scrollIntoView = function () {};
      if (state) w.localStorage.setItem('road255-state', JSON.stringify(state));
      if (tab) w.localStorage.setItem('road255-tab', tab);
      if (fetch) w.fetch = fetch;
      w.navigator.geolocation = { watchPosition: f => { w.__fix = f; return 1; }, clearWatch() {} };
      if (native) {
        w.androidBridge = { postMessage() {} };
        const plugin = (name, methods) => ({ name, methods: methods.map(m => ({ name: m, rtype: 'promise' })) });
        w.__gps = { active: false, paused: false, meters: 0, elapsedMs: 0, points: [] };
        w.Capacitor = {
          PluginHeaders: [
            plugin('StepCounter', ['getDays', 'start', 'stop', 'openSettings', 'syncState', 'requestNotifications']),
            plugin('Filesystem', ['writeFile', 'readFile']),
            plugin('Share', ['share']),
            plugin('GpsTracker', ['start', 'pause', 'resume', 'stop', 'status']),
          ],
          nativePromise: async (p, m, o) => {
            calls.push(`${p}.${m}`);
            if (m === 'getDays') return { available: true, granted: true, enabled: true, lastAt: Date.now(), days: { [daysAgo(0)]: 4321 } };
            if (m === 'readFile') throw new Error('no file');
            if (p === 'GpsTracker') {
              const g = w.__gps;
              if (m === 'start') Object.assign(g, { active: true, paused: false, meters: 0, elapsedMs: 0, points: [] });
              if (m === 'pause') g.paused = true;
              if (m === 'resume') g.paused = false;
              const snap = { active: g.active, paused: g.paused, meters: g.meters, elapsedMs: g.elapsedMs, accuracy: 5,
                points: g.points.slice(o && o.since || 0), total: g.points.length };
              if (m === 'stop') { g.active = false; return Object.assign(snap, { points: g.points, total: g.points.length }); }
              return snap;
            }
            return { uri: 'file:///cache/x' };
          },
        };
      }
    },
  });
  const w = dom.window;
  await new Promise(r => w.addEventListener('load', r));
  await wait(400);
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const text = s => ($(s) ? $(s).textContent.replace(/\s+/g, ' ').trim() : '');
  const submit = f => f.dispatchEvent(new w.Event('submit', { cancelable: true }));
  const saved = () => JSON.parse(w.localStorage.getItem('road255-state'));
  return { dom, w, doc, $, text, submit, saved, calls, close: () => w.close() };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

function sampleState(days = 10) {
  const entries = {};
  for (let i = 0; i < days; i++) entries[daysAgo(i)] = { weight: 284 - i * 0.1, calories: 2250, protein: 185, pushups: 30, stepsAuto: 8000 };
  return { settings: { startDate: daysAgo(days), startWeight: 287, goal: 255, checkpoint: 270, calories: 2300, protein: 180, weeks: 24, heightIn: 72 }, entries, savedAt: 5 };
}

module.exports = { openApp, wait, daysAgo, sampleState };
