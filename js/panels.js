// Forgeway: panels.js
// Weight and Workout tab panels, tab state, shared form helpers.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- render ----------
const WKEYS=["weight","waist","wnote"];
const RKEYS=["mood","calories","protein","steps","pushups","pushSets","surface","session","water","sleep","note"];
let tab="weight";try{tab=sessionStorage.getItem("road255-tab")||localStorage.getItem("road255-tab")||"weight"}catch(e){}
if(!["weight","routine","steps","golf","workout","activity","food"].includes(tab))tab="weight";
let wDate=todayIso(),rDate=todayIso();
function setTab(t){tab=t;try{sessionStorage.setItem("road255-tab",t);localStorage.setItem("road255-tab",t)}catch(e){}render()}
function has(e,keys){return e&&keys.some(k=>e[k]!=null&&e[k]!==""&&!(Array.isArray(e[k])&&!e[k].length))}
const dash=v=>v==null||v===""?"–":v;

function weightPanel(){
  const e=state.entries[wDate]||{},t=todayIso(),ws=weights();
  const wk=weekly().filter(r=>r.weight!=null||r.waist!=null).reverse();
  const hist=sortedDates().filter(d=>has(state.entries[d],WKEYS)).reverse().slice(0,28);
  return`
  <p class="status">${status()}</p>
  <div class="chart">${chart()}</div>
  <div class="legend"><span><i></i>7-day average</span><span><i class="dot"></i>Daily weigh-in</span><span><i class="pace"></i>Planned pace</span></div>
  <div class="notes">${notes()}</div>
  <div class="grid">
    <section class="plan">
      <form id="wlog" autocomplete="off" style="margin:0;border:0;padding:0">
        <h2>Log a weigh-in</h2>
        <p class="foot" style="margin:-6px 0 14px">Morning, after the bathroom, before eating.</p>
        <div class="fields">
          <label class="wide">Date<input type="date" name="date" value="${wDate}" max="${t}"></label>
          <label>Weight (lb)<input type="number" step="0.1" inputmode="decimal" name="weight" value="${esc(e.weight)}"></label>
          <label>Waist (in)<input type="number" step="0.25" inputmode="decimal" name="waist" value="${esc(e.waist)}"></label>
          <label class="wide">Note<input type="text" name="wnote" maxlength="120" value="${esc(e.wnote)}"></label>
        </div>
        <p class="foot">Measure your waist every two weeks at the belly button. The target is under 36 inches.</p>
        <button type="submit" ${readOnly?"disabled":""}>${has(e,WKEYS)?"Update weigh-in":"Save weigh-in"}</button><span class="saved" id="msg" role="status"></span>
      </form>
    </section>
    <section>
      <h2>Weekly weight</h2>
      ${wk.length?`<div class="tablewrap"><table>
        <thead><tr><th>Week</th><th>Avg weight</th><th>Change</th><th>Waist</th><th>Weigh-ins</th></tr></thead>
        <tbody>${wk.map((r,i)=>{const prev=wk.slice(i+1).find(x=>x.weight!=null);const ch=(r.weight!=null&&prev)?r1(r.weight-prev.weight):null;
          return`<tr><td>${r.w}</td><td>${r.weight!=null?r1(r.weight):"–"}</td><td class="${ch==null?"":ch<0?"down":"up"}">${ch==null?"–":(ch>0?"+":"")+ch}</td><td>${r.waist!=null?r.waist:"–"}</td><td>${r.weighins}</td></tr>`}).join("")}</tbody>
      </table></div><p class="foot">Judge progress by the weekly average, not single days.</p>`:`<p class="empty">Your weeks show up here once you log a few weigh-ins.</p>`}
      <div class="history">
        <h2>Recent weigh-ins</h2>
        ${hist.length?`<div class="tablewrap"><table>
          <thead><tr><th>Day</th><th>Weight</th><th>7-day avg</th><th>Waist</th><th></th><th>Note</th></tr></thead>
          <tbody>${hist.map(d=>{const x=state.entries[d],ra=x.weight!=null?rolling(ws,dn(d)):null;return`<tr><td><button class="link" data-edit="${d}">${fmtDate(d)}</button></td><td>${dash(x.weight)}</td><td>${ra!=null?r1(ra):"–"}</td><td>${dash(x.waist)}</td><td>${readOnly?"":`<button class="link" data-del="${d}" aria-label="Delete weigh-in for ${fmtDate(d)}">Delete</button>`}</td><td>${esc(x.wnote)}</td></tr>`}).join("")}</tbody>
        </table></div>`:`<p class="empty">No weigh-ins yet.</p>`}
      </div>
    </section>
  </div>`;
}

function routinePanel(){
  const S=state.settings,t=todayIso(),wd=Math.max(1,weekOf(t)),plan=dayPlan(t),e=state.entries[rDate]||{};
  const wk=weekly().filter(r=>r.days>0&&(r.cal!=null||r.pro!=null||r.steps!=null||r.push!=null||r.sessions)).reverse();
  const hist=sortedDates().filter(d=>has(state.entries[d],RKEYS)).reverse().slice(0,21);
  const tt=pushTotal(state.entries[t]),st=pushStreak(),yes=v=>v?"Yes":"–";
  return`
  <div class="grid" style="margin-top:28px">
    <section class="plan">
      <h2>Today</h2>
      <div class="targets">
        <div><b>${S.calories.toLocaleString()}</b>calories</div>
        <div><b>${S.protein}g</b>protein</div>
        <div><b>${stepsTarget(wd).toLocaleString()}</b>steps</div>
        <div><b>${pushTarget(wd)}</b>push-ups</div>
      </div>
      <div class="daily"><p><strong>Every day: ${pushTarget(wd)} push-ups</strong>, split into 3–4 sets through the day.</p><p>Stop each set 2–3 reps short of failure. Start with hands on a counter and lower the surface once all sets feel easy.${plan.label.startsWith("Strength A")?" Today's circuit push-ups count toward the total.":""}</p><p>${tt!=null?"Today so far: "+tt+" of "+pushTarget(wd)+(tt>=pushTarget(wd)?" ✓. ":". "):""}${st?"Streak: "+st+" day"+(st>1?"s":"")+" on target.":"No streak yet. Hit today's target to start one."}</p></div>
      <p class="today">${esc(plan.label)}</p>
      ${workoutButton(plan)}
      ${plan.moves.length?`<ul class="moves">${plan.moves.map(m=>`<li>${esc(m)} ${vidLink(m.split(",")[0],"Watch")}</li>`).join("")}</ul><p class="foot">3 rounds, 60–90 sec rest. When every round hits the top of the range, make it harder.</p>`:""}

      <form id="rlog" autocomplete="off">
        <h3>Log the day</h3>
        <div class="fields">
          <label class="wide">Date<input type="date" name="date" value="${rDate}" max="${t}"></label>
          <label>Calories${e.foodAuto?" (food log)":""}<input type="number" inputmode="numeric" name="calories" value="${esc(e.calories)}" ${e.foodAuto?"readonly":""}></label>
          <label>Protein (g)${e.foodAuto?" (food log)":""}<input type="number" inputmode="numeric" name="protein" value="${esc(e.protein)}" ${e.foodAuto?"readonly":""}></label>
          <label>Steps (typed)<input type="number" inputmode="numeric" name="steps" value="${esc(e.steps)}"></label>
          <label>Push-up sets<input type="text" inputmode="numeric" name="pushsets" placeholder="6, 5, 5, 4" value="${esc((e.pushSets||[]).join(", "))}"></label>
          <label>Push-ups total<input type="number" inputmode="numeric" name="pushups" value="${esc(pushTotal(e))}" ${(e.pushSets||[]).length?"readonly":""}></label>
          <label>Push-up surface<select name="surface"><option value="">Not set</option>${Object.entries(SURF).map(([k,v])=>`<option value="${k}" ${e.surface===k?"selected":""}>${v}</option>`).join("")}</select></label>
          <div class="sum wide" id="pushsum"></div>
          <label class="wide">Note<input type="text" name="note" maxlength="120" value="${esc(e.note)}"></label>
        </div>
        ${moodPicker(e.mood,"How did today go?")}
        <div class="checks">
          <label><input type="checkbox" name="session" ${e.session?"checked":""}>Did the day's session</label>
          <label><input type="checkbox" name="water" ${e.water?"checked":""}>Water goal</label>
          <label><input type="checkbox" name="sleep" ${e.sleep?"checked":""}>Slept 7+ hrs</label>
        </div>
        <button type="submit" ${readOnly?"disabled":""}>${has(e,RKEYS)?"Update day":"Save day"}</button><span class="saved" id="msg" role="status"></span>
      </form>
    </section>
    <section>
      ${fightSection()}
      <h2>Push-ups</h2>
      <div class="pushchart">${pushChart()}</div>
      ${pushStatsHtml()}
      <div class="block">
        <h2>This week's log</h2>
        ${wk.length?`<div class="tablewrap"><table>
          <thead><tr><th>Week</th><th>Calories</th><th>Protein</th><th>Steps</th><th>Push-ups/day</th><th>Sessions</th><th>Disc golf</th></tr></thead>
          <tbody>${wk.map(r=>`<tr><td>${r.w}</td><td>${r.cal!=null?Math.round(r.cal).toLocaleString():"–"}</td><td>${r.pro!=null?Math.round(r.pro):"–"}</td><td>${r.steps!=null?Math.round(r.steps).toLocaleString():"–"}</td><td>${r.push!=null?Math.round(r.push)+" ("+r.pushHits+"/"+r.pushDays+" hit)":"–"}</td><td>${r.sessions}</td><td>${roundsInWeek(r.w)||"–"}</td></tr>`).join("")}</tbody>
        </table></div><p class="foot">Averages cover the days you logged.</p>`:`<p class="empty">Your weeks show up here once you log a few days.</p>`}
      </div>
      <div class="history">
        <h2>Recent days</h2>
        ${hist.length?`<div class="tablewrap"><table>
          <thead><tr><th>Day</th><th>Cal</th><th>Protein</th><th>Steps</th><th>Push-ups</th><th>Surface</th><th>Session</th><th>Water</th><th>Sleep</th><th>Mood</th><th></th><th>Note</th></tr></thead>
          <tbody>${hist.map(d=>{const x=state.entries[d],pt=pushTotal(x);return`<tr><td><button class="link" data-edit="${d}">${fmtDate(d)}</button></td><td>${dash(x.calories)}</td><td>${dash(x.protein)}</td><td>${dayStepsTotal(d)!=null?dayStepsTotal(d).toLocaleString():"–"}</td><td title="${esc((x.pushSets||[]).join(", "))}">${pt!=null?pt+(pushHit(d)?" ✓":""):"–"}</td><td>${x.surface?SURF[x.surface]:"–"}</td><td>${yes(x.session)}</td><td>${yes(x.water)}</td><td>${yes(x.sleep)}</td><td class="moodcell">${x.mood||""}</td><td>${readOnly?"":`<button class="link" data-del="${d}" aria-label="Delete routine for ${fmtDate(d)}">Delete</button>`}</td><td>${esc(x.note)}</td></tr>`}).join("")}</tbody>
        </table></div>`:`<p class="empty">No days logged yet.</p>`}
      </div>
    </section>
  </div>`;
}

function clearKeys(d,keys){const e=Object.assign({},state.entries[d]||{});keys.forEach(k=>delete e[k]);return e}
function commit(d,e){if(Object.keys(e).length)state.entries[d]=e;else delete state.entries[d]}

function say(t){const m=document.getElementById("msg");if(m)m.textContent=t}
