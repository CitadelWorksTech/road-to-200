// Forgeway: native.js
// Android bridge: built-in step counter, reminders and widget sync.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- Android app (Capacitor): built-in step counter + native backup ----------
const NATIVE=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==="function"&&window.Capacitor.isNativePlatform());
const plug=n=>(NATIVE&&typeof window.Capacitor.registerPlugin==="function")?window.Capacitor.registerPlugin(n):null;
const SC=plug("StepCounter"),FS=plug("Filesystem"),SH=plug("Share");
const sc={checked:false,available:false,granted:false,enabled:false,lastAt:0,enabledAt:0,busy:false,error:""};
const errText=e=>String((e&&e.message)||e||"Unknown error");
function applySteps(r){
  sc.checked=true;sc.available=!!r.available;sc.granted=!!r.granted;sc.enabled=!!r.enabled;sc.lastAt=r.lastAt||0;sc.enabledAt=r.enabledAt||0;
  let changed=false;const days=r.days||{};
  for(const d of Object.keys(days)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;
    const v=Math.round(Number(days[d])||0),e=Object.assign({},state.entries[d]||{});
    if(e.stepsAuto!==v){e.stepsAuto=v;e.stepsAutoAt=Date.now();state.entries[d]=e;changed=true}
  }
  if(changed){state.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}}
  return changed;
}
function quietRender(){const a=document.activeElement;if(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName))return;render()}
async function scRefresh(){
  if(!SC)return;
  try{applySteps(await SC.getDays());sc.error=""}catch(e){sc.checked=true;sc.error=errText(e)}
  checkMilestones();checkGoals();updateInbox();quietRender();nativeSync();
}
async function scStart(){
  if(!SC||sc.busy)return;sc.busy=true;render();
  try{applySteps(await SC.start());sc.error="";sc.busy=false;persist("Step counting is on. Steps count from now on, all day.")}
  catch(e){sc.busy=false;const m=errText(e);sc.error=/DENIED|allowed/i.test(m)?"Physical activity permission is needed to count steps. Tap App settings, then Permissions, then Physical activity, and choose Allow.":m;render()}
}
async function scStop(){
  if(!SC)return;if(!confirm("Turn off step counting? Steps already counted are kept."))return;
  try{applySteps(await SC.stop());persist("Step counting is off.")}catch(e){sc.error=errText(e);render()}
}
let scTimer=null;
if(SC){
  setTimeout(scRefresh,300);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")scRefresh()});
  scTimer=setInterval(()=>{if(document.visibilityState==="visible"&&sc.enabled)scRefresh()},60000);
}
function hcPanel(){
  if(!SC)return"";
  let body;
  if(!sc.checked)body=`<p class="foot">Checking the step counter…</p>`;
  else if(!sc.available)body=`<p>This phone doesn't have a step counter sensor. Use GPS walks or type your steps instead.</p>`;
  else if(!sc.enabled||!sc.granted)body=`<p>Count steps all day with your phone's built-in step sensor. No other apps needed. Android will ask to allow <strong>Physical activity</strong>.</p><div class="backup"><button type="button" id="scstart" ${sc.busy?"disabled":""}>${sc.busy?"Starting…":"Turn on step counting"}</button>${sc.error?`<button type="button" class="link" id="scsettings">App settings</button>`:""}</div>`;
  else{
    const last=sc.lastAt?new Date(sc.lastAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):"waiting for your first steps";
    const firstDay=sc.enabledAt&&localKey(new Date(sc.enabledAt))===todayIso();
    body=`<p>On. Your phone counts steps all day, even when this app is closed. A small notification shows today's count. Last update: <strong>${esc(last)}</strong>.</p>${firstDay?`<p class="foot">Today started counting when you turned it on, so today's total is partial.</p>`:""}<div class="backup"><button type="button" class="quiet" id="screfresh">Refresh</button><button type="button" class="link" id="scstop">Turn off</button><button type="button" class="link" id="scsettings">App settings</button></div><p class="foot">If counts stop overnight, set Battery for this app to Unrestricted in App settings.</p>`;
  }
  return`<div class="daily" style="margin-bottom:18px"><p><strong>Built-in step counter</strong></p>${body}${sc.error?`<p class="foot" style="color:var(--amber)">${esc(sc.error)}</p>`:""}</div>`;
}
function localKey(dt){return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0")}
function bindHc(){
  const on=(id,f)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",f)};
  on("scstart",scStart);on("scstop",scStop);on("screfresh",scRefresh);
  on("scsettings",async()=>{try{await SC.openSettings()}catch(e){sc.error=errText(e);render()}});
}
async function nativeExport(){
  const name=backupName(),data=JSON.stringify(state,null,2);
  const w=await FS.writeFile({path:name,data,directory:"CACHE",encoding:"utf8"});
  await SH.share({title:"Forgeway backup",files:[w.uri],dialogTitle:"Save or send your backup"});
}

// ---------- reminders + home-screen widget (Android app) ----------
const REMIND_DEF={weighOn:true,weigh:"07:00",pushOn:true,push:["10:00","13:00","16:00"],stepsOn:true,steps:"19:00"};
function remind(){return Object.assign({},REMIND_DEF,state.settings.remind||{})}
let syncT=null;
function nativeSync(){
  if(!SC)return;clearTimeout(syncT);
  syncT=setTimeout(()=>{
    const t=todayIso(),w=Math.max(1,weekOf(t)),e=state.entries[t]||{};
    const payload={date:t,weighed:num(e.weight)!=null,pushups:pushTotal(e)||0,pushTarget:pushTarget(w),steps:dayStepsTotal(t)||0,stepTarget:stepsTarget(w),
      calories:num(e.calories)!=null?Math.round(num(e.calories)):-1,calorieTarget:state.settings.calories,protein:num(e.protein)!=null?Math.round(num(e.protein)):-1,proteinTarget:state.settings.protein,remind:remind()};
    try{SC.syncState(payload).catch(()=>{})}catch(err){}
  },400);
}
function remindersHtml(){
  if(!SC)return"";
  const r=remind();
  return`<h3>Reminders</h3>
  <form id="remform" style="border:0;padding:0;margin:0">
    <div class="checks" style="flex-direction:column;align-items:flex-start;gap:12px">
      <label><input type="checkbox" name="weighOn" ${r.weighOn?"checked":""}>Morning weigh-in at <input type="time" name="weigh" value="${r.weigh}" class="tm"></label>
      <label><input type="checkbox" name="pushOn" ${r.pushOn?"checked":""}>Push-up nudges at <input type="time" name="p0" value="${r.push[0]||""}" class="tm"><input type="time" name="p1" value="${r.push[1]||""}" class="tm"><input type="time" name="p2" value="${r.push[2]||""}" class="tm"></label>
      <label><input type="checkbox" name="stepsOn" ${r.stepsOn?"checked":""}>Evening step check at <input type="time" name="steps" value="${r.steps}" class="tm"></label>
    </div>
    <button type="submit" class="quiet">Save reminders</button>
    <p class="foot">Reminders only go off when you still need them: no weigh-in logged yet, push-ups under today's target, or steps under today's target.</p>
  </form>
  <h3>Home-screen widget</h3>
  <p class="foot" style="margin-top:0">Long-press your home screen, tap Widgets, find Forgeway, and drag it out. It shows today's steps, push-ups and calories left.</p>`;
}
function bindReminders(){
  const f=document.getElementById("remform");if(!f)return;
  f.addEventListener("submit",async ev=>{ev.preventDefault();const E=f.elements;
    const r={weighOn:E.weighOn.checked,weigh:E.weigh.value||"07:00",pushOn:E.pushOn.checked,push:[E.p0.value,E.p1.value,E.p2.value].filter(Boolean),stepsOn:E.stepsOn.checked,steps:E.steps.value||"19:00"};
    state.settings=Object.assign({},state.settings,{remind:r});
    if(r.weighOn||r.pushOn||r.stepsOn){try{await SC.requestNotifications()}catch(e){}}
    persist("Reminders saved.");
  });
}

// ---------- background GPS tracking (Android: GpsTrackerService) ----------
const GT=plug("GpsTracker");
let gtPoll=null;
function gtMaxSpeed(actId){return actId==="bike"||actId==="kayak"?25:actId==="run"?8:4}
async function nativeTrackStart(place,actId){
  const a=actId?actInfo(actId):null,label=a?a.name:("Walk"+(place?": "+place:""));
  try{
    await GT.start({label,maxSpeed:gtMaxSpeed(actId)});
    state.track={native:true,act:actId||undefined,place:place||"Neighborhood",date:todayIso(),startedAt:Date.now(),resumedAt:Date.now(),elapsed:0,paused:false,meters:0,route:[[]],seen:0,seg:-1};
    saveQuiet();gtStartPolling();
  }catch(e){const m=errText(e);alert(/DENIED|allowed|permission/i.test(m)?"Forgeway needs location permission to track. Allow it in Settings, Apps, Forgeway, Permissions, Location.":"Couldn't start GPS tracking: "+m)}
}
function applyGps(r){
  const t=state.track;if(!t||!t.native||!r)return;
  t.meters=r.meters||0;t.elapsed=r.elapsedMs||0;t.resumedAt=Date.now();t.paused=!!r.paused;
  if(r.accuracy!=null&&r.accuracy>=0)lastAcc=Math.round(r.accuracy);
  for(const p of (r.points||[])){const seg=p[0];if(seg!==t.seg){t.route.push([]);t.seg=seg}t.route[t.route.length-1].push([+(+p[1]).toFixed(6),+(+p[2]).toFixed(6)])}
  t.seen=r.total!=null?r.total:(t.seen||0)+(r.points||[]).length;
}
async function gtTick(){
  const t=state.track;if(!GT||!t||!t.native){gtStopPolling();return}
  try{
    const r=await GT.status({since:t.seen||0});
    if(!r.active){t.elapsed=trackElapsed(t);t.paused=true;gtStopPolling();saveQuiet();return}
    applyGps(r);
    if(Date.now()-lastSave>10000){lastSave=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}}
    updateLive();
  }catch(e){}
}
function gtStartPolling(){gtStopPolling();gtPoll=setInterval(gtTick,2000);clearInterval(liveTimer);liveTimer=setInterval(updateLive,1000);gtTick()}
function gtStopPolling(){clearInterval(gtPoll);gtPoll=null}
async function nativeTrackPauseToggle(){
  const t=state.track;if(!t)return;
  try{applyGps(t.paused?await GT.resume({since:t.seen||0}):await GT.pause({since:t.seen||0}))}catch(e){}
  if(!gtPoll)gtStartPolling();saveQuiet();updateLive();
}
async function nativeTrackFinish(){
  const t=state.track;
  try{const r=await GT.stop();t.route=[[]];t.seg=-1;t.seen=0;applyGps(r);t.paused=true}catch(e){}
  gtStopPolling();clearInterval(liveTimer);liveTimer=null;
}
async function nativeTrackDiscard(){try{await GT.stop()}catch(e){}gtStopPolling();clearInterval(liveTimer);liveTimer=null}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.track&&state.track.native&&GT)gtStartPolling()});
