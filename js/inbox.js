// Forgeway: inbox.js
// In-app notifications: the bell next to Settings, its unread badge, and the inbox sheet.
// Notifications are created by scanning app data, so every feature feeds the inbox without extra wiring.
'use strict';

const INBOX_CATS = {
  weight:    { icon: '⚖️', label: 'Weight' },
  workout:   { icon: '💪', label: 'Workout' },
  milestone: { icon: '🏅', label: 'Milestones' },
  goal:      { icon: '🏆', label: 'Goals' },
  steps:     { icon: '👟', label: 'Steps' },
  activity:  { icon: '🧭', label: 'Activity' },
};
const INBOX_MAX = 150;
let inboxFilter = 'all';

function inbox() {
  const b = state.inbox && typeof state.inbox === 'object' ? state.inbox : {};
  return { items: Array.isArray(b.items) ? b.items : [], keys: Array.isArray(b.keys) ? b.keys : [], init: !!b.init };
}
function unreadCount() { return inbox().items.filter(n => !n.read).length; }

/** Adds a notification once per key. Returns true if it was new. */
function notify(key, cat, title, body, link, icon) {
  const b = inbox();
  if (b.keys.includes(key)) return false;
  b.keys.push(key);
  if (b.keys.length > 600) b.keys = b.keys.slice(-600);
  b.items.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), key, cat, icon: icon || null, title, body: body || '', at: Date.now(), read: false, link: link || null });
  if (b.items.length > INBOX_MAX) b.items = b.items.slice(0, INBOX_MAX);
  state.inbox = b;
  return true;
}
/** Records keys without notifying (used the first time so existing history doesn't flood the inbox). */
function silence(key) { const b = inbox(); if (!b.keys.includes(key)) b.keys.push(key); state.inbox = b; }

/** Everything that can produce a notification. Each yields [key, cat, title, body, link]. */
function inboxCandidates() {
  const out = [], S = state.settings, t = todayIso(), now = new Date(), hour = now.getHours() + now.getMinutes() / 60;
  const w = Math.max(1, weekOf(t)), e = state.entries[t] || {};

  // Milestones and goals
  for (const m of allMilestones()) if (state.milestones[m.id]) out.push([`ms-${m.id}`, 'milestone', m.name, `Milestone earned ${fmtDate(state.milestones[m.id])}.`, { share: m.id }, m.icon]);
  for (const g of state.goals) if (g.doneDate) out.push([`goal-${g.id}`, 'goal', `Goal reached: ${goalLabel(g)}`, `Reached ${fmtDate(g.doneDate)}.`, { tab: areaTab(g.area), act: areaAct(g.area) }]);

  // Weight
  if (hour >= 10 && num(e.weight) == null) out.push([`weigh-missing-${t}`, 'weight', 'No weigh-in yet today', 'Morning weigh-ins give the steadiest trend. Log one when you can.', { tab: 'weight' }]);
  const ws = weights();
  if (ws.length >= 8) {
    const last = ws[ws.length - 1], cur = rolling(ws, last.n);
    const prevMin = Math.min(...ws.slice(0, -1).filter(p => p.n > ws[0].n + 6).map(p => rolling(ws, p.n)));
    if (isFinite(prevMin) && cur < prevMin - 0.05) out.push([`weight-low-${last.d}`, 'weight', `New low: ${r1(cur)} lb`, 'Your 7-day average is the lowest it has been. Keep going.', { tab: 'weight' }]);
  }
  if (now.getDay() === 0 && w > 1) {
    const c = weekAdherence(w);
    if (c.score != null) out.push([`checkin-${w}`, 'weight', `Week ${w} check-in is ready`, `${c.score}% adherence this week. Open the Weight tab to see the breakdown.`, { tab: 'weight' }]);
  }

  // Workout
  const plan = dayPlan(t), m = plan.label.match(/Strength (A|B)/);
  if (m && hour >= 16 && !e.session) out.push([`wo-plan-${t}`, 'workout', `Strength ${m[1]} is on today's plan`, 'Start a guided workout from the Workout tab. It takes about 20 minutes.', { tab: 'workout' }]);
  if (plan.fight && hour >= 16 && !e.session) out.push([`fp-plan-${t}`, 'workout', 'Fight prep rounds are on today\'s plan', `${plan.fight.rounds} rounds of ${plan.fight.mins} minutes. Start them from the Workout tab.`, { tab: 'workout' }]);
  if (pushHit(t)) out.push([`push-hit-${t}`, 'workout', `Push-up target hit: ${pushTotal(e)}`, `That's ${pushStreak()} day${pushStreak() === 1 ? '' : 's'} in a row on target.`, { tab: 'workout' }]);
  for (const x of state.workouts) out.push([`wo-${x.id}`, 'workout', `${woName(x)} done`, `${x.minutes} min${x.push ? `, ${x.push} push-ups` : ''}${x.mood ? ` ${x.mood}` : ''}.`, { tab: 'workout' }]);

  // Steps
  const st = dayStepsTotal(t) || 0, tg = stepsTarget(w);
  if (st >= tg) out.push([`steps-hit-${t}`, 'steps', `Step target hit: ${st.toLocaleString()}`, `You passed today's ${tg.toLocaleString()}-step target.`, { tab: 'activity', act: 'steps' }]);
  else if (hour >= 19) out.push([`steps-short-${t}`, 'steps', `${(tg - st).toLocaleString()} steps to go`, `You're at ${st.toLocaleString()} of ${tg.toLocaleString()}. A 20-minute walk covers about 2,000.`, { tab: 'activity', act: 'steps' }]);
  for (const x of state.walks) if (x.source === 'gps') out.push([`walk-${x.id}`, 'steps', `Walk saved: ${mi(x.meters || 0).toFixed(2)} mi`, `${(x.steps || 0).toLocaleString()} steps in ${x.minutes || 0} min${x.place ? ` at ${x.place}` : ''}.`, { tab: 'activity', act: 'steps' }]);

  // Activity
  for (const s of state.sessions) {
    const a = actInfo(s.act);
    out.push([`sess-${s.id}`, 'activity', `${a.name} logged`, [s.miles != null ? `${s.miles} mi` : '', s.minutes ? `${s.minutes} min` : ''].filter(Boolean).join(', ') + (s.mood ? ` ${s.mood}` : '') + '.', { tab: 'activity', act: s.act }, a.icon]);
  }
  for (const r of state.rounds) out.push([`round-${r.id}`, 'activity', `Round saved: ${vsPar(roundDiff(r))}`, `${r.course || 'Disc golf'}, ${roundHoles(r) || '?'} holes, ${roundScore(r) || '?'} throws.`, { tab: 'activity', act: 'golf' }, '🥏']);
  const best = Math.max(0, ...state.throws.map(x => x.feet));
  for (const x of state.throws) if (x.feet === best && state.throws.length > 1) out.push([`throw-${x.id}`, 'activity', `New longest throw: ${x.feet} ft`, x.disc ? `With your ${x.disc}.` : 'Your best measured drive so far.', { tab: 'activity', act: 'golf' }, '🚀']);
  return out;
}
function areaTab(area) { return area === 'weight' ? 'weight' : area === 'workout' ? 'workout' : area === 'food' ? 'food' : 'activity'; }
function areaAct(area) { return area === 'steps' ? 'steps' : area === 'golf' ? 'golf' : area.startsWith('act:') ? area.slice(4) : undefined; }

/** Scans app data for new notifications. Returns how many were added. */
function updateInbox() {
  let added = 0;
  const b = inbox(), first = !b.init;
  for (const [key, cat, title, body, link, icon] of inboxCandidates()) {
    if (first) silence(key); else if (notify(key, cat, title, body, link, icon)) added++;
  }
  if (first) { const bb = inbox(); bb.init = true; state.inbox = bb; }
  if (added || first) { state.savedAt = Date.now(); try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }
  updateBadge();
  return added;
}

const BELL = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>`;
function bellHtml() {
  const n = unreadCount();
  return `<button type="button" class="gear bell" id="openinbox" aria-label="Notifications${n ? `, ${n} unread` : ''}">${BELL}<span class="badge" id="bellcount" ${n ? '' : 'hidden'}>${n > 9 ? '9+' : n}</span></button>`;
}
function updateBadge() {
  const n = unreadCount(), el = document.getElementById('bellcount'), btn = document.getElementById('openinbox');
  if (el) { el.textContent = n > 9 ? '9+' : String(n); el.hidden = !n; }
  if (btn) btn.setAttribute('aria-label', `Notifications${n ? `, ${n} unread` : ''}`);
}
function timeAgo(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function inboxHtml(unreadIds) {
  const items = inbox().items.filter(n => inboxFilter === 'all' || n.cat === inboxFilter);
  const counts = {}; inbox().items.forEach(n => counts[n.cat] = (counts[n.cat] || 0) + 1);
  return `<div class="gshead"><h2 style="margin:0">Notifications</h2>${inbox().items.length ? `<button type="button" class="link" id="inboxclear">Clear all</button>` : ''}</div>
    <nav class="subnav" aria-label="Notification types">
      <button type="button" class="chip ${inboxFilter === 'all' ? 'on' : ''}" data-ifilter="all" aria-pressed="${inboxFilter === 'all'}">All</button>
      ${Object.entries(INBOX_CATS).map(([k, c]) => `<button type="button" class="chip ${inboxFilter === k ? 'on' : ''}" data-ifilter="${k}" aria-pressed="${inboxFilter === k}"><span aria-hidden="true">${c.icon}</span> ${c.label}${counts[k] ? ` <small>${counts[k]}</small>` : ''}</button>`).join('')}
    </nav>
    ${items.length ? `<ul class="inbox">${items.map(n => {
      const c = INBOX_CATS[n.cat] || { icon: '🔔', label: '' };
      return `<li><button type="button" class="note-item ${unreadIds.has(n.id) ? 'unread' : ''}" data-inote="${n.id}">
        <span class="ni-icon" aria-hidden="true">${n.icon || c.icon}</span>
        <span class="ni-text"><b>${esc(n.title)}</b><small>${esc(n.body)}</small><small class="ni-meta">${c.label} · ${timeAgo(n.at)}</small></span>
        ${unreadIds.has(n.id) ? '<span class="ni-dot" aria-label="Unread"></span>' : ''}
      </button></li>`;
    }).join('')}</ul>` : `<p class="empty">${inboxFilter === 'all' ? "You're all caught up. Weigh-ins, workouts, milestones, goals, steps and activities show up here." : 'Nothing here yet.'}</p>`}
    <div class="backup"><button type="button" id="inboxdone">Done</button></div>`;
}
function openInbox() {
  updateInbox();
  const b = inbox(), unreadIds = new Set(b.items.filter(n => !n.read).map(n => n.id));
  b.items.forEach(n => { n.read = true; });
  state.inbox = b; state.savedAt = Date.now();
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {}
  updateBadge();
  const el = openModal(inboxHtml(unreadIds), 'Notifications');
  const bindInbox = () => {
    el.querySelector('#inboxdone').onclick = dismissModal;
    el.querySelectorAll('[data-ifilter]').forEach(x => x.onclick = () => { inboxFilter = x.dataset.ifilter; el.querySelector('.gwin').innerHTML = inboxHtml(unreadIds); bindInbox(); });
    const clr = el.querySelector('#inboxclear');
    if (clr) clr.onclick = () => { if (!confirm('Clear all notifications?')) return; const bb = inbox(); bb.items = []; state.inbox = bb; state.savedAt = Date.now(); try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} el.querySelector('.gwin').innerHTML = inboxHtml(unreadIds); bindInbox(); };
    el.querySelectorAll('[data-inote]').forEach(x => x.onclick = () => {
      const n = inbox().items.find(i => String(i.id) === x.dataset.inote); if (!n) return;
      dismissModal();
      const l = n.link || {};
      setTimeout(() => {
        if (l.share) { const m = allMilestones().find(mm => mm.id === l.share); tab = m ? areaTab(msArea(m)) : 'weight'; if (m) { const ak = areaAct(msArea(m)); if (ak) act = ak; } }
        else { if (l.tab) tab = l.tab; if (l.act) act = l.act; }
        view = 'main';
        try { localStorage.setItem('road255-tab', tab); localStorage.setItem('road200-act', act); } catch (e) {}
        render(); window.scrollTo && window.scrollTo(0, 0);
      }, 60);
    });
  };
  bindInbox();
}
setInterval(() => { if (document.visibilityState === 'visible' && state) updateInbox(); }, 5 * 60 * 1000);
