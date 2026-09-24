// Forgeway: app.js
// Top-level render and bind, saving, and startup. Loaded last.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ----- new render + bind -----
const GEAR=`<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.2 1.6 2 3.5 2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>`;
function render(){
  const app=document.getElementById("app");
  if(view==="settings"){app.innerHTML=settingsPage();bind();return}
  const S=state.settings,t=todayIso(),w=weekOf(t);
  const where=w<1?`Starts ${fmtDate(S.startDate)}`:w>S.weeks?`Week ${w}, past the ${S.weeks}-week plan`:`Week ${w} of ${S.weeks}, ${phase(w)} phase`;
  const trAct=state.track?(state.track.act||"steps"):null,onTrack=tab==="activity"&&act===trAct;
  let panel;
  if(tab==="weight")panel=weightPanel()+checkinHtml()+photosHtml()+goalsSection("weight","Weight goals & milestones");
  else if(tab==="food")panel=foodPanel()+goalsSection("food","Food goals & milestones");
  else if(tab==="workout")panel=routinePanel()+moodInsights()+goalsSection("workout","Workout goals & milestones");
  else panel=activityPanel();
  app.innerHTML=`
  <div class="top"><div><h1>${esc(S.headline||"Road to 200")}</h1><div class="where">${S.name?esc(S.name)+", ":""}${where}</div></div><button type="button" class="gear" id="opensettings" aria-label="Settings">${GEAR}</button></div>
  <div class="tabs" role="tablist" aria-label="Tracker areas">
    <button role="tab" id="tab-weight" aria-selected="${tab==="weight"}" aria-controls="panel" data-tab="weight">Weight</button>
    <button role="tab" id="tab-food" aria-selected="${tab==="food"}" aria-controls="panel" data-tab="food">Food</button>
    <button role="tab" id="tab-workout" aria-selected="${tab==="workout"}" aria-controls="panel" data-tab="workout">Workout</button>
    <button role="tab" id="tab-activity" aria-selected="${tab==="activity"}" aria-controls="panel" data-tab="activity">Activity</button>
  </div>
  ${state.track&&!onTrack?`<div class="live-banner"><span>${esc(actInfo(trAct).name==="Steps"?"Walk":actInfo(trAct).name)} ${state.track.paused?"paused":"tracking"}: <b id="banner-live"></b></span><button type="button" class="link" data-open-act="${trAct}">Open</button></div>`:""}
  <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${panel}</div>`;
  bind();
}
function bind(){
  if(state.track)setTimeout(updateLive,0);
  if(view==="settings"){bindSettingsPage();return}
  document.getElementById("opensettings").addEventListener("click",openSettings);
  const order=["weight","food","workout","activity"];
  document.querySelectorAll("[data-tab]").forEach(b=>{
    b.addEventListener("click",()=>setTab(b.dataset.tab));
    b.addEventListener("keydown",ev=>{if(ev.key==="ArrowRight"||ev.key==="ArrowLeft"){const i=order.indexOf(tab);setTab(order[(i+(ev.key==="ArrowRight"?1:3))%4]);document.getElementById("tab-"+tab).focus()}});
  });
  document.querySelectorAll("[data-open-act]").forEach(b=>b.addEventListener("click",()=>{tab="activity";act=b.dataset.openAct;try{localStorage.setItem("road200-act",act);localStorage.setItem("road255-tab","activity")}catch(e){}render()}));
  bindGoals();bindShares();
  if(tab==="food"){bindFood();return}
  if(tab==="activity"){bindActivity();return}
  if(tab==="weight")bindWeightExtras();else bindRoutineExtras();
  const isW=tab==="weight",keys=isW?WKEYS:RKEYS;
  const f=document.getElementById(isW?"wlog":"rlog"),F=n=>f.elements[n];
  F("date").addEventListener("change",()=>{const v=F("date").value;if(v){if(isW)wDate=v;else rDate=v;render()}});
  if(!isW){
    const upd=()=>{const sets=parseSets(F("pushsets").value),tgt=pushTarget(weekOf(F("date").value||todayIso()));
      if(sets.length){F("pushups").value=sets.reduce((a,b)=>a+b,0);F("pushups").readOnly=true}else F("pushups").readOnly=false;
      const tot=num(F("pushups").value),el=document.getElementById("pushsum");
      if(tot==null){el.textContent="Target for this day: "+tgt+" push-ups";el.className="sum wide"}else{el.textContent=tot>=tgt?"Target hit: "+tot+" of "+tgt+" ✓":tot+" of "+tgt+", "+(tgt-tot)+" to go";el.className="sum wide"+(tot>=tgt?" hit":"")}};
    F("pushsets").addEventListener("input",upd);F("pushups").addEventListener("input",upd);upd();
  }
  f.addEventListener("submit",ev=>{
    ev.preventDefault();
    const d=F("date").value||todayIso(),e=clearKeys(d,keys),add={};
    if(isW){["weight","waist"].forEach(k=>{const v=num(F(k).value);if(v!=null)add[k]=v});const n=F("wnote").value.trim();if(n)add.wnote=n}
    else{
      ["calories","protein","steps","pushups"].forEach(k=>{const v=num(F(k).value);if(v!=null)add[k]=v});
      const sets=parseSets(F("pushsets").value);if(sets.length){add.pushSets=sets;add.pushups=sets.reduce((a,b)=>a+b,0)}
      if(F("surface").value)add.surface=F("surface").value;
      ["session","water","sleep"].forEach(k=>{if(F(k).checked)add[k]=true});
      const md=moodOf(f);if(md)add.mood=md;
      const n=F("note").value.trim();if(n)add.note=n;
    }
    if(!Object.keys(add).length){say("Add at least one value to save.");return}
    commit(d,Object.assign(e,add));if(isW)wDate=d;else rDate=d;
    persist((isW?"Weigh-in saved for ":"Day saved for ")+fmtDate(d)+".");
  });
  document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{if(isW)wDate=b.dataset.edit;else rDate=b.dataset.edit;render();document.getElementById(isW?"wlog":"rlog").scrollIntoView({behavior:"smooth",block:"start"})}));
  document.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{
    const d=b.dataset.del;if(!confirm("Delete the "+(isW?"weigh-in":"workout log")+" for "+fmtDate(d)+"?"))return;
    commit(d,clearKeys(d,keys));persist("Deleted "+fmtDate(d)+".");
  }));
}

// ---------- saving ----------
function persist(msg){
  state.savedAt=Date.now();
  let ok=true;
  try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){ok=false}
  checkMilestones();checkGoals();render();nativeSync();autoBackup();say(ok?msg:"Couldn't save. Your phone's storage may be full or blocked for this app.");
}
function backupName(){return "forgeway-backup-"+todayIso()+".json"}
async function exportData(){
  if(NATIVE&&FS&&SH){try{await nativeExport()}catch(e){if(!/cancel/i.test(errText(e)))alert("Couldn't export the backup: "+errText(e))}return}
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const file=new File([blob],backupName(),{type:"application/json"});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Forgeway backup"});return}
  }catch(e){if(e&&e.name==="AbortError")return}
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=backupName();document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d||typeof d!=="object"||!d.entries||!d.settings)throw 0;
      const n=Object.keys(d.entries).length;
      if(!confirm("Replace everything in the app with this backup ("+n+" days)?"))return;
      state=norm(d);persist("Backup restored: "+n+" days.");
    }catch(e){alert("That file isn't a Forgeway backup. Choose a .json file exported from this app.")}
  };
  r.readAsText(file);
}
if(!NATIVE&&"serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}

let rzT=null,lastW=window.innerWidth;window.addEventListener("resize",()=>{if(Math.abs(window.innerWidth-lastW)<40)return;lastW=window.innerWidth;clearTimeout(rzT);rzT=setTimeout(()=>{const a=document.activeElement;if(!a||!/INPUT|SELECT|TEXTAREA/.test(a.tagName))render()},250)});
handleImport();
if(state.track&&state.track.native){if(GT)gtStartPolling();else{state.track.paused=true}}
else if(state.track&&!state.track.paused){state.track.route.push([]);startWatch()}
render();
loadPhotos().then(()=>{checkMilestones();checkGoals();quietRender()});
nativeSync();
checkRestore();
updateLive();
