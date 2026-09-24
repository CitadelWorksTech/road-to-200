'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, wait, daysAgo, sampleState } = require('./harness');

test('opens on the Weight tab with four tabs and the default header', async () => {
  const a = await openApp();
  const tabs = [...a.doc.querySelectorAll('[role=tab]')].map(b => b.textContent.trim());
  assert.deepEqual(tabs, ['Weight', 'Food', 'Workout', 'Activity']);
  assert.equal(a.text('h1'), 'Road to 200');
  a.close();
});

test('saving a weigh-in stores it and updates the 7-day average', async () => {
  const a = await openApp();
  const f = a.$('#wlog');
  f.elements.weight.value = '283.4';
  a.submit(f);
  assert.equal(a.saved().entries[daysAgo(0)].weight, 283.4);
  assert.match(a.text('.status'), /283\.4 lb/);
  a.close();
});

test('weight tab puts progress photos before goals & milestones', async () => {
  const a = await openApp({ state: sampleState() });
  const heads = [...a.doc.querySelectorAll('#panel h2')].map(h => h.textContent);
  assert.ok(heads.indexOf('Progress photos') < heads.indexOf('Weight goals & milestones'));
  a.close();
});

test('food log totals flow into the day log and calories-left', async () => {
  const a = await openApp({ tab: 'food' });
  const f = a.$('#foodadd');
  f.elements.name.value = 'Chicken rice bowl'; f.elements.cal.value = '650'; f.elements.pro.value = '55'; f.elements.fav.checked = true;
  a.submit(f);
  assert.equal(a.text('#panel h2'), '1,650 calories left');
  a.$('[data-fav]').click();
  const e = a.saved().entries[daysAgo(0)];
  assert.equal(e.calories, 1300);
  assert.equal(e.protein, 110);
  assert.equal(e.foodAuto, true);
  a.close();
});

test('barcode lookup converts per-100 g values to one serving', async () => {
  const fetch = async () => ({ json: async () => ({ status: 1, product: { product_name: 'Rice Noodles', brands: 'Thai Kitchen', serving_size: '2 oz (56 g)', serving_quantity: 56, nutriments: { 'energy-kcal_100g': 364, proteins_100g: 7.1 } } }) });
  const a = await openApp({ tab: 'food', fetch });
  a.w.prompt = () => '737628064502';
  a.$('#barcodetype').click();
  await wait(50);
  const f = a.$('#foodadd');
  assert.equal(f.elements.name.value, 'Thai Kitchen Rice Noodles');
  assert.equal(f.elements.cal.value, '204');
  assert.equal(f.elements.pro.value, '4');
  a.close();
});

test('water buttons add ounces and mark the goal when reached', async () => {
  const a = await openApp({ tab: 'food' });
  for (let i = 0; i < 4; i++) a.$('[data-water="24"]').click();
  a.$('[data-water="8"]').click();
  const e = a.saved().entries[daysAgo(0)];
  assert.equal(e.waterOz, 104);
  assert.equal(e.water, true);
  a.close();
});

test('workout day log saves a mood emoji', async () => {
  const a = await openApp({ tab: 'workout' });
  const f = a.$('#rlog');
  f.elements.steps.value = '5000';
  f.querySelector('input[value="😄"]').checked = true;
  a.submit(f);
  assert.equal(a.saved().entries[daysAgo(0)].mood, '😄');
  a.close();
});

test('guided workout saves the session and adds push-ups', async () => {
  const a = await openApp({ tab: 'workout' });
  a.$('[data-wo]').click();
  for (let i = 0; i < 40 && a.$('#wo'); i++) {
    if (a.$('#wosave')) { a.$('#wosave').click(); break; }
    if (a.$('#woskip')) a.$('#woskip').click(); else a.$('#wodone').click();
  }
  const s = a.saved();
  assert.equal(s.workouts.length, 1);
  assert.equal(s.entries[daysAgo(0)].session, true);
  assert.equal(s.entries[daysAgo(0)].pushups, 30);
  a.close();
});

test('goal wizard creates a goal with progress', async () => {
  const a = await openApp({ tab: 'workout', state: sampleState() });
  a.$('[data-newgoal="workout"]').click();
  a.$('[data-gt="push_day"]').click();
  a.$('#gwf').elements.v.value = '60';
  a.submit(a.$('#gwf'));
  assert.equal(a.saved().goals.length, 1);
  assert.match(a.text('.goal'), /60 push-ups in one day/);
  assert.match(a.text('.goal'), /50%/);
  a.close();
});

test('milestones are earned from logged data', async () => {
  const a = await openApp({ state: sampleState(8) });
  await wait(100);
  const ms = a.saved().milestones;
  assert.ok(ms.weigh1, 'first weigh-in');
  assert.ok(ms.push7, '7-day push-up streak');
  a.close();
});

test('adding an activity and logging a session', async () => {
  const a = await openApp({ tab: 'activity' });
  a.$('#actadd').click();
  a.$('[data-actsel="hike"]').checked = true;
  a.$('#actdone').click();
  await wait(30);
  const f = a.$('#alog');
  f.elements.minutes.value = '45'; f.elements.miles.value = '2.3';
  a.submit(f);
  const s = a.saved();
  assert.deepEqual(s.acts.list, ['steps', 'golf', 'hike']);
  assert.equal(s.sessions[0].miles, 2.3);
  a.close();
});

test('disc golf scorecard records fairway and putts', async () => {
  const a = await openApp({ tab: 'activity' });
  a.$('[data-act="golf"]').click();
  a.submit(a.$('#gstart'));
  a.$('[data-h="0"][data-f="s"][data-d="1"]').click();
  a.$('[data-fw="0"]').click();
  a.$('[data-pt="0"][data-d="1"]').click();
  a.$('#finish').click();
  const r = a.saved().rounds[0];
  assert.deepEqual(r.holesData[0], { par: 3, s: 3, fw: true, putts: 1 });
  a.close();
});

test('settings page saves profile and header title', async () => {
  const a = await openApp();
  a.$('#opensettings').click();
  const f = a.$('#profile');
  f.elements.name.value = 'Tyler'; f.elements.headline.value = 'Road to 200';
  a.submit(f);
  a.$('#setback').click();
  await wait(50);
  assert.match(a.text('.where'), /^Tyler,/);
  a.close();
});

test('Android: built-in step counter totals show on the Steps page', async () => {
  const a = await openApp({ tab: 'activity', native: true });
  await wait(200);
  assert.match(a.text('.status'), /4,321/);
  a.close();
});

test('Android: background GPS walk records, pauses and saves', async () => {
  const a = await openApp({ tab: 'activity', native: true });
  a.submit(a.$('#tstart'));
  await wait(50);
  assert.ok(a.calls.includes('GpsTracker.start'));
  assert.equal(a.saved().track.native, true);
  Object.assign(a.w.__gps, { meters: 805, elapsedMs: 600000, points: [[0, 39.5, -119.8], [0, 39.5072, -119.8]] });
  await a.w.gtTick();
  assert.equal(a.text('#lv-dist'), '0.50');
  a.$('#tpause').click();
  await wait(30);
  assert.ok(a.calls.includes('GpsTracker.pause'));
  a.$('#tfinish').click();
  await wait(50);
  const walk = a.saved().walks[0];
  assert.equal(walk.source, 'gps');
  assert.equal(walk.meters, 805);
  assert.equal(walk.minutes, 10);
  assert.equal(walk.route.flat().length, 2);
  assert.ok(walk.steps > 1000 && walk.steps < 1100);
  assert.equal(a.saved().track, null);
  a.close();
});

test('Android: background GPS hike saves as an activity session', async () => {
  const a = await openApp({ tab: 'activity', native: true, state: { acts: { list: ['steps', 'golf', 'hike'], custom: [] }, savedAt: 1 } });
  a.$('[data-act="hike"]').click();
  a.$('#gstartact').click();
  await wait(50);
  Object.assign(a.w.__gps, { meters: 3219, elapsedMs: 3600000, points: [[0, 39.5, -119.8], [1, 39.52, -119.8]] });
  a.$('#tfinish').click();
  await wait(50);
  const s = a.saved().sessions[0];
  assert.equal(s.act, 'hike');
  assert.equal(s.miles, 2);
  assert.equal(s.minutes, 60);
  assert.equal(s.route.length, 2, 'two GPS segments');
  a.close();
});
