// Forgeway: activity.js
// Generic activity pages (hiking, biking, custom) with GPS sessions.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ----- generic activity page -----
function genericPanel(id){
  const a=actInfo(id),ss=sessionsOf(id).slice().sort((x,y)=>y.date.localeCompare(x.date)||y.id-x.id),t=todayIso(),w=weekOf(t);
  const wk=ss.filter(s=>weekOf(s.date)===w),mins=ss.reduce((x,s)=>x+(s.minutes||0),0),miles=r1(ss.reduce((x,s)=>x+(s.miles||0),0));
  const tr=state.track&&state.track.act===id?state.track:null,busy=state.track&&!tr;
  const live=tr?`<h2>${esc(a.name)} in progress</h2>
      <div class="targets" style="grid-template-columns:repeat(3,1fr)"><div><b id="lv-dist">0.00</b>miles</div><div><b id="lv-time">0:00</b>time</div><div><b id="lv-steps">0</b>est. steps</div></div>
      <p class="foot" id="lv-acc" style="margin:0 0 10px">Looking for a GPS signal…</p><div class="route" id="lv-route">${routeSvg(tr.route,600,260,false)}</div>
      <div class="backup"><button type="button" id="tpause">${tr.paused?"Resume":"Pause"}</button><button type="button" class="quiet" id="tfinish">Finish</button><button type="button" class="link" id="tdiscard">Discard</button></div>
      <p class="foot">${typeof GT!=="undefined"&&GT?"Tracking keeps going with the screen off or in other apps. A notification shows your distance and time.":"Keep this app open. The screen stays awake while tracking. Switching apps or locking the phone pauses GPS until you come back."}</p>`:"";
  return`<p class="status">${a.icon} <strong>${wk.length}</strong> ${esc(a.name.toLowerCase())} session${wk.length===1?"":"s"} this week${wk.length?`, ${wk.reduce((x,s)=>x+(s.minutes||0),0)} min`:""}.</p>
  <div class="grid" style="margin-top:28px">
    <section class="plan">
      ${live||(a.gps?`<h2>Track with GPS</h2><p class="foot" style="margin-top:0">Maps your route and measures distance and time.${GT?" Keeps tracking with the screen off.":" Keep the app open."}</p><div class="backup"><button type="button" id="gstartact" ${busy?"disabled":""}>Start ${esc(a.name.toLowerCase())}</button></div>${busy?`<p class="foot">Finish the GPS session already running first.</p>`:""}`:"")}
      <form id="alog" autocomplete="off" ${tr||a.gps?'style="margin-top:28px"':""}>
        <h3>Log a session</h3>
        <div class="fields">
          <label class="wide">Date<input type="date" name="date" value="${t}" max="${t}"></label>
          <label>Minutes<input type="number" name="minutes" inputmode="numeric" min="1"></label>
          ${a.dist?`<label>Miles<input type="number" name="miles" step="0.01" inputmode="decimal"></label>`:""}
          <label class="wide">Note<input type="text" name="note" maxlength="120"></label>
        </div>
        ${moodPicker(null)}
        <button type="submit">Save session</button><span class="saved" id="msg" role="status"></span>
      </form>
    </section>
    <section>
      <h2>Your ${esc(a.name.toLowerCase())}</h2>
      <div class="targets" style="grid-template-columns:repeat(3,1fr)">
        <div><b>${ss.length}</b>sessions</div><div><b>${mins>=90?r1(mins/60)+" hr":mins+" min"}</b>total time</div>
        ${a.dist?`<div><b>${miles}</b>total miles</div>`:`<div><b>${ss.length?Math.round(mins/ss.length):0}</b>avg minutes</div>`}
      </div>
      <div class="history">
        <h2>Recent sessions</h2>
        ${ss.length?`<div class="tablewrap"><table><thead><tr><th>Day</th>${a.gps?"<th>Route</th>":""}<th>Time</th>${a.dist?"<th>Miles</th>":""}<th></th><th></th><th>Note</th></tr></thead>
        <tbody>${ss.slice(0,25).map(s=>`<tr><td>${fmtDate(s.date)}</td>${a.gps?`<td class="thumb">${s.route?routeSvg(s.route,64,40,true):"<small>Logged</small>"}</td>`:""}<td>${s.minutes?s.minutes+" min":"–"}</td>${a.dist?`<td>${s.miles!=null?s.miles:"–"}</td>`:""}<td class="moodcell">${s.mood||""}</td><td><button type="button" class="link" data-sdel="${s.id}">Delete</button></td><td>${esc(s.note||"")}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty">No sessions yet.</p>`}
      </div>
    </section>
  </div>`;
}
function togglePause(){const t=state.track;if(!t)return;if(t.native){nativeTrackPauseToggle();return}if(t.paused){t.paused=false;t.resumedAt=Date.now();t.route.push([]);saveQuiet();startWatch()}else{t.elapsed=trackElapsed(t);t.paused=true;stopWatch();saveQuiet()}updateLive()}
function bindGeneric(id){
  const on=(i,f)=>{const el=document.getElementById(i);if(el)el.addEventListener("click",f)};
  on("gstartact",()=>startTrack(actInfo(id).name,id));on("tpause",togglePause);on("tfinish",finishTrack);
  on("tdiscard",()=>{if(confirm("Discard this session?"))discardTrack()});
  const f=document.getElementById("alog");
  if(f)f.addEventListener("submit",ev=>{ev.preventDefault();const E=f.elements,m=num(E.minutes.value),mi2=E.miles?num(E.miles.value):null;
    if(m==null&&mi2==null){say("Add minutes or distance.");return}
    const s={id:Date.now(),act:id,date:E.date.value||todayIso(),source:"manual"};if(m!=null)s.minutes=Math.round(m);if(mi2!=null)s.miles=r1(mi2*10)/10;
    const md=moodOf(f);if(md)s.mood=md;const n=E.note.value.trim();if(n)s.note=n;
    state.sessions.push(s);persist("Session saved.")});
  document.querySelectorAll("[data-sdel]").forEach(b=>b.addEventListener("click",()=>{if(confirm("Delete this session?")){state.sessions=state.sessions.filter(s=>String(s.id)!==b.dataset.sdel);persist("Session deleted.")}}));
  updateLive();
}
function activityPanel(){
  const list=actList();if(!list.includes(act))act=list[0]||"steps";
  const nav=`<nav class="subnav" aria-label="Activities">${list.map(id=>{const a=actInfo(id);return`<button type="button" class="chip ${id===act?"on":""}" data-act="${id}" aria-pressed="${id===act}"><span aria-hidden="true">${a.icon}</span> ${esc(a.name)}</button>`}).join("")}<button type="button" class="chip add" id="actadd">+ Add activity</button></nav>`;
  let body;
  if(act==="steps")body=stepsPanel()+goalsSection("steps","Step goals & milestones");
  else if(act==="golf")body=golfPanel()+golfExtras()+goalsSection("golf","Disc golf goals & milestones");
  else body=genericPanel(act)+goalsSection("act:"+act,actInfo(act).name+" goals & milestones");
  return nav+body;
}
function bindActivity(){
  document.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>setAct(b.dataset.act)));
  const ad=document.getElementById("actadd");if(ad)ad.addEventListener("click",activityPicker);
  if(act==="steps")bindSteps();else if(act==="golf"){bindGolf();bindGolfExtras()}else bindGeneric(act);
}
