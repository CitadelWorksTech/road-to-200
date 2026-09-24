// Forgeway: steps.js
// Steps page, GPS walk tracking, places and phone step import.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- steps, GPS walks, places, phone import ----------
const PLACES_DEF=["Home","Work","Neighborhood","Park","Disc golf course"];
function strideM(){return (num(state.settings.heightIn)||72)*0.0254*0.415}
function perMile(){return Math.round(1609.344/strideM())}
function walkSteps(d){return state.walks.filter(w=>w.date===d).reduce((a,w)=>a+(w.steps||0),0)}
function dayStepsTotal(d){const e=state.entries[d]||{};if(num(e.stepsAuto)!=null)return num(e.stepsAuto);const m=num(e.steps),w=walkSteps(d);return (m==null&&!w)?null:(m||0)+w}
function places(){return [...new Set([...PLACES_DEF,...state.walks.map(w=>w.place).filter(Boolean),...state.rounds.map(r=>r.course).filter(Boolean)])]}
function hav(a,b){const R=6371000,t=Math.PI/180,dl=(b[0]-a[0])*t,dg=(b[1]-a[1])*t,x=Math.sin(dl/2)**2+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
const mi=m=>m/1609.344;
function fmtDur(ms){const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(ss).padStart(2,"0")}
function trackElapsed(t){return t.elapsed+(t.paused?0:Date.now()-t.resumedAt)}

function routeSvg(route,W,H,thumb){
  const pts=(route||[]).flat();
  if(pts.length<2)return thumb?"":`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route map"><rect width="${W}" height="${H}" fill="var(--route-soft)" rx="8"/><text x="${W/2}" y="${H/2+5}" text-anchor="middle" font-size="15" fill="var(--muted)" font-family="Barlow, system-ui, sans-serif">Your route draws here as you walk</text></svg>`;
  const lat0=pts.reduce((a,p)=>a+p[0],0)/pts.length,kx=Math.cos(lat0*Math.PI/180)*111320,ky=110540;
  const P=p=>[p[1]*kx,-p[0]*ky],xy=pts.map(P);
  let x0=Math.min(...xy.map(p=>p[0])),x1=Math.max(...xy.map(p=>p[0])),y0=Math.min(...xy.map(p=>p[1])),y1=Math.max(...xy.map(p=>p[1]));
  const pad=thumb?4:18,dx=Math.max(x1-x0,40),dy=Math.max(y1-y0,40),sc=Math.min((W-2*pad)/dx,(H-2*pad)/dy);
  const ox=(W-(x1-x0)*sc)/2,oy=(H-(y1-y0)*sc)/2,T=p=>{const q=P(p);return[(ox+(q[0]-x0)*sc).toFixed(1),(oy+(q[1]-y0)*sc).toFixed(1)]};
  let g=thumb?"":`<rect width="${W}" height="${H}" fill="var(--route-soft)" rx="8"/>`;
  for(const seg of route){if(seg.length<2)continue;g+=`<path d="M${seg.map(p=>T(p).join(",")).join(" L")}" fill="none" stroke="var(--route)" stroke-width="${thumb?2:4}" stroke-linejoin="round" stroke-linecap="round"/>`}
  if(!thumb){const a=T(pts[0]),b=T(pts[pts.length-1]);g+=`<circle cx="${a[0]}" cy="${a[1]}" r="6" fill="var(--sage)"/><circle cx="${b[0]}" cy="${b[1]}" r="7" fill="var(--paper)" stroke="var(--route)" stroke-width="3"/>`}
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route map">${g}</svg>`;
}

let watchId=null,wakeLock=null,lastFix=null,lastAcc=null,liveTimer=null,skips=0,lastSave=0,geoErr="";
async function keepAwake(){try{if("wakeLock" in navigator&&!wakeLock){wakeLock=await navigator.wakeLock.request("screen");wakeLock.addEventListener("release",()=>{wakeLock=null})}}catch(e){}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.track&&!state.track.paused)keepAwake()});
function startWatch(){
  if(!("geolocation" in navigator)){alert("GPS isn't available in this browser.");return false}
  if(watchId!=null)return true;
  lastFix=null;skips=0;geoErr="";
  watchId=navigator.geolocation.watchPosition(onFix,onGeoErr,{enableHighAccuracy:true,maximumAge:0,timeout:30000});
  keepAwake();clearInterval(liveTimer);liveTimer=setInterval(updateLive,1000);
  return true;
}
function stopWatch(){if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;clearInterval(liveTimer);liveTimer=null;try{wakeLock&&wakeLock.release()}catch(e){}wakeLock=null}
function onGeoErr(err){
  if(err&&err.code===1){geoErr="Location permission is off. Allow location for this app in Android settings, then press Resume.";const t=state.track;if(t&&!t.paused){t.elapsed=trackElapsed(t);t.paused=true;stopWatch();saveQuiet()}}
  else geoErr="Looking for a GPS signal…";
  updateLive();
}
function onFix(p){
  const t=state.track;if(!t||t.paused)return;
  const c=p.coords;lastAcc=Math.round(c.accuracy);geoErr="";
  if(c.accuracy>35){updateLive();return}
  const pt=[+c.latitude.toFixed(6),+c.longitude.toFixed(6)],now=p.timestamp||Date.now();
  if(!t.route.length)t.route.push([]);
  const seg=t.route[t.route.length-1];
  if(!lastFix){seg.push(pt);lastFix={pt,time:now}}
  else{
    const d=hav(lastFix.pt,pt),dt=Math.max(1,(now-lastFix.time)/1000);
    if(d<Math.max(4,c.accuracy*0.4)){updateLive();return}
    if(d/dt>4){ if(++skips<3){updateLive();return} t.route.push([pt]);lastFix={pt,time:now};skips=0; }
    else{t.meters+=d;seg.push(pt);lastFix={pt,time:now};skips=0}
  }
  if(Date.now()-lastSave>10000){lastSave=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}}
  updateLive();
}
function updateLive(){
  const t=state.track;if(!t)return;const el=id=>document.getElementById(id),steps=Math.round(t.meters/strideM());
  if(el("lv-dist"))el("lv-dist").textContent=mi(t.meters).toFixed(2);
  if(el("lv-steps"))el("lv-steps").textContent=steps.toLocaleString();
  if(el("lv-time"))el("lv-time").textContent=fmtDur(trackElapsed(t));
  if(el("lv-acc"))el("lv-acc").textContent=geoErr||(t.paused?"Paused. GPS is off.":lastAcc==null?"Looking for a GPS signal…":lastAcc>35?"Weak GPS signal (±"+lastAcc+" m). Points are skipped until it improves.":"GPS accuracy ±"+lastAcc+" m");
  if(el("lv-route"))el("lv-route").innerHTML=routeSvg(t.route,600,260,false);
  if(el("banner-live"))el("banner-live").textContent=mi(t.meters).toFixed(2)+" mi, "+steps.toLocaleString()+" steps, "+fmtDur(trackElapsed(t));
}
function startTrack(place,actId){
  if(GT){nativeTrackStart(place,actId);return}
  state.track={act:actId||undefined,place:place||"Neighborhood",date:todayIso(),startedAt:Date.now(),resumedAt:Date.now(),elapsed:0,paused:false,meters:0,route:[[]]};
  saveQuiet();startWatch();updateLive();
}
async function discardTrack(){
  const t=state.track;if(!t)return;
  if(t.native)await nativeTrackDiscard();else stopWatch();
  state.track=null;saveQuiet();
}
function simplifyRoute(route){
  const total=route.reduce((a,s)=>a+s.length,0);if(total<=500)return route;
  const k=Math.ceil(total/500);return route.map(s=>s.filter((p,i)=>i%k===0||i===s.length-1));
}
async function finishTrack(){
  const t=state.track;if(!t)return;
  if(t.native)await nativeTrackFinish();else stopWatch();
  const ms=trackElapsed(t),steps=Math.round(t.meters/strideM());
  if(t.meters<20&&!confirm("This recorded almost no distance. Save it anyway?")){return}
  if(t.act){const mins=Math.max(1,Math.round(ms/60000));state.sessions.push({id:Date.now(),act:t.act,date:t.date,source:"gps",minutes:mins,miles:Math.round(mi(t.meters)*100)/100,route:simplifyRoute(t.route.filter(x=>x.length))});
    state.track=null;persist(actInfo(t.act).name+" saved: "+mi(t.meters).toFixed(2)+" mi, "+mins+" min.");return}
  state.walks.push({id:Date.now(),date:t.date,source:"gps",place:t.place,meters:Math.round(t.meters),steps,minutes:Math.max(1,Math.round(ms/60000)),route:simplifyRoute(t.route.filter(s=>s.length))});
  state.track=null;
  persist("Walk saved: "+mi(t.meters).toFixed(2)+" mi, "+steps.toLocaleString()+" steps.");
}

let importMsg="";
function handleImport(){
  try{
    const u=new URL(location.href),st=u.searchParams.get("steps");if(st==null)return;
    const n=parseInt(String(st).replace(/[^0-9]/g,""),10);let d=u.searchParams.get("date");
    if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d))d=todayIso();
    if(isFinite(n)&&n>=0&&n<200000){
      const e=Object.assign({},state.entries[d]||{});e.stepsAuto=n;e.stepsAutoAt=Date.now();state.entries[d]=e;
      state.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}
      importMsg="Imported "+n.toLocaleString()+" steps from your phone for "+fmtDate(d)+".";tab="steps";
    }else importMsg="The import link didn't include a valid step count.";
    history.replaceState(null,"",u.pathname);
  }catch(e){}
}

function stepsPanel(){
  const t=todayIso(),wd=Math.max(1,weekOf(t)),tg=stepsTarget(wd),tot=dayStepsTotal(t),tr=state.track,e=state.entries[t]||{};
  const pl=`<datalist id="placelist">${places().map(p=>`<option value="${esc(p)}">`).join("")}</datalist>`;
  const lastPlace=(state.walks.slice().sort((a,b)=>b.id-a.id)[0]||{}).place||"Neighborhood";
  // 30-day breakdown by place
  const by={},cnt={},from=dn(t)-29;let untagged=0;
  for(let n=from;n<=dn(t);n++){const d=iso(n),ws=state.walks.filter(w=>w.date===d),ee=state.entries[d]||{},wsum=ws.reduce((a,w)=>a+(w.steps||0),0);
    ws.forEach(w=>{const k=w.place||"No place";by[k]=(by[k]||0)+(w.steps||0);cnt[k]=(cnt[k]||0)+1});
    if(num(ee.stepsAuto)!=null)untagged+=Math.max(0,num(ee.stepsAuto)-wsum);else if(num(ee.steps)!=null)untagged+=num(ee.steps);}
  if(untagged)by["Everywhere else"]=(by["Everywhere else"]||0)+untagged;
  const rows=Object.entries(by).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]),sum=rows.reduce((a,r)=>a+r[1],0);
  const recent=state.walks.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,20);
  const url=location.origin+location.pathname;
  const card=tr?`
      <h2>Walk in progress</h2>
      <p class="today" style="margin-bottom:12px">${esc(tr.place)}</p>
      <div class="targets" style="grid-template-columns:repeat(3,1fr)">
        <div><b id="lv-dist">0.00</b>miles</div><div><b id="lv-steps">0</b>est. steps</div><div><b id="lv-time">0:00</b>time</div>
      </div>
      <p class="foot" id="lv-acc" style="margin:0 0 10px">Looking for a GPS signal…</p>
      <div class="route" id="lv-route">${routeSvg(tr.route,600,260,false)}</div>
      <div class="backup"><button type="button" id="tpause">${tr.paused?"Resume":"Pause"}</button><button type="button" class="quiet" id="tfinish">Finish walk</button><button type="button" class="link" id="tdiscard">Discard</button></div>
      <p class="foot">${typeof GT!=="undefined"&&GT?"Tracking keeps going with the screen off or in other apps. A notification shows your distance and time.":"Keep this app open. The screen stays awake while tracking. Switching apps or locking the phone pauses GPS until you come back."}</p>`
    :`
      <h2>Track a walk</h2>
      <form id="tstart" autocomplete="off" style="margin:0;border:0;padding:0">
        <div class="fields"><label class="wide">Place<input type="text" name="place" list="placelist" maxlength="60" value="${esc(lastPlace)}"></label></div>
        <p class="foot">GPS measures your distance and estimates steps at about ${perMile().toLocaleString()} per mile for your height.${GT?" Tracking keeps going with the screen off.":" Keep the app open with the screen on while you walk."}</p>
        <button type="submit">Start walk</button><span class="saved" id="msg" role="status"></span>
      </form>`;
  return`
  ${importMsg?`<div class="notes"><p class="note">${esc(importMsg)}</p></div>`:""}
  <p class="status">Today: <strong>${tot!=null?tot.toLocaleString():"0"}</strong> of ${tg.toLocaleString()} steps${tot!=null&&tot>=tg?" ✓":""}. ${num(e.stepsAuto)!=null?"From your phone's step count.":"From walks and steps you've logged."}</p>
  ${pl}
  <div class="grid" style="margin-top:28px">
    <section class="plan">
      ${card}
      <details style="margin-top:28px">
        <summary>Add steps at a place</summary>
        <form id="splog" autocomplete="off" style="border:0;padding:0;margin-top:14px">
          <div class="fields">
            <label>Date<input type="date" name="date" value="${t}" max="${t}"></label>
            <label>Place<input type="text" name="place" list="placelist" maxlength="60"></label>
            <label class="wide">Steps<input type="number" name="steps" inputmode="numeric"></label>
          </div>
          <button type="submit" class="quiet" style="margin-top:12px">Add steps</button>
        </form>
      </details>
      <p class="foot" style="margin-top:28px">Built-in step counter and phone totals are in <strong>Settings</strong> (gear icon, top right).</p>
    </section>
    <section>
      <h2>Steps by place</h2>
      ${rows.length?`<div class="places">${rows.map(([p,v])=>`<div class="prow"><div class="ptop"><span>${esc(p)}</span><span>${v.toLocaleString()} <small>${Math.round(v/sum*100)}%</small></span></div><div class="pbar"><i style="width:${(v/rows[0][1]*100).toFixed(1)}%"></i></div></div>`).join("")}</div><p class="foot">Last 30 days, ${sum.toLocaleString()} steps. "Everywhere else" is steps from your phone or typed totals that aren't tied to a walk.</p>`:`<p class="empty">Track a walk or add steps at a place to see where your steps come from.</p>`}
      <div class="history">
        <h2>Recent walks</h2>
        ${recent.length?`<div class="tablewrap"><table><thead><tr><th>Day</th><th>Route</th><th>Place</th><th>Distance</th><th>Steps</th><th>Time</th><th></th></tr></thead>
        <tbody>${recent.map(w=>`<tr><td>${fmtDate(w.date)}</td><td class="thumb">${w.source==="gps"?routeSvg(w.route,64,40,true):"<small>Logged</small>"}</td><td>${esc(w.place||"–")}</td><td>${w.meters?mi(w.meters).toFixed(2)+" mi":"–"}</td><td>${(w.steps||0).toLocaleString()}</td><td>${w.minutes?w.minutes+" min":"–"}</td><td><button class="link" data-wdel="${w.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="empty">No walks yet.</p>`}
      </div>
    </section>
  </div>`;
}

function bindSteps(){
  const ts=document.getElementById("tstart");
  if(ts)ts.addEventListener("submit",ev=>{ev.preventDefault();startTrack(ts.elements.place.value.trim())});
  const tp=document.getElementById("tpause");
  if(tp)tp.addEventListener("click",togglePause);
  const tf=document.getElementById("tfinish");if(tf)tf.addEventListener("click",finishTrack);
  const td=document.getElementById("tdiscard");if(td)td.addEventListener("click",()=>{if(confirm("Discard this walk?"))discardTrack()});
  const sp=document.getElementById("splog");
  if(sp)sp.addEventListener("submit",ev=>{ev.preventDefault();const E=sp.elements,n=num(E.steps.value);
    if(n==null||n<=0){alert("Enter a step count.");return}
    state.walks.push({id:Date.now(),date:E.date.value||todayIso(),source:"manual",place:E.place.value.trim()||"No place",steps:Math.round(n)});
    persist("Steps added.");
  });
  const ph=document.getElementById("phlog");
  if(ph)ph.addEventListener("submit",ev=>{ev.preventDefault();const E=ph.elements,n=num(E.steps.value),d=E.date.value||todayIso();
    if(n==null||n<0){alert("Enter your phone's step total.");return}
    const e=Object.assign({},state.entries[d]||{});e.stepsAuto=Math.round(n);e.stepsAutoAt=Date.now();state.entries[d]=e;persist("Phone total saved.");
  });
  const pc=document.getElementById("phclear");
  if(pc)pc.addEventListener("click",()=>{const d=todayIso(),e=Object.assign({},state.entries[d]||{});delete e.stepsAuto;delete e.stepsAutoAt;commit(d,e);persist("Phone total cleared.")});
  const cu=document.getElementById("copyurl");
  if(cu)cu.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+"?steps=%steps");cu.textContent="Copied"}catch(e){cu.textContent="Copy failed"}});
  bindHc();
  document.querySelectorAll("[data-wdel]").forEach(b=>b.addEventListener("click",()=>{if(!confirm("Delete this walk?"))return;state.walks=state.walks.filter(w=>String(w.id)!==b.dataset.wdel);persist("Walk deleted.")}));
  updateLive();
}
