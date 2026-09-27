// Forgeway: progress.js
// Weekly check-in, built-in milestones and progress photos.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- weekly check-in ----------
function weekDates(w){const s=dn(state.settings.startDate)+(w-1)*7,t=dn(todayIso()),out=[];for(let n=s;n<s+7&&n<=t;n++)out.push(iso(n));return out}
function weekAdherence(w){
  const S=state.settings,ds=weekDates(w),st=stepsTarget(w);
  const c={days:ds.length,cal:0,calLogged:0,pro:0,steps:0,push:0,sessions:0,weighins:0};
  for(const d of ds){
    const e=state.entries[d]||{},cal=num(e.calories),pro=num(e.protein),sp=dayStepsTotal(d);
    if(cal!=null){c.calLogged++;if(cal<=S.calories+100)c.cal++}
    if(pro!=null&&pro>=S.protein-10)c.pro++;
    if(sp!=null&&sp>=st)c.steps++;
    if(pushHit(d))c.push++;
    if(e.session)c.sessions++;
    if(num(e.weight)!=null)c.weighins++;
  }
  c.score=c.days?Math.round((c.cal+c.pro+c.steps+c.push)/(c.days*4)*100):null;
  const wk=weekly().find(r=>r.w===w);c.weight=wk&&wk.weight!=null?wk.weight:null;
  const prev=weekly().find(r=>r.w===w-1);c.change=c.weight!=null&&prev&&prev.weight!=null?r1(c.weight-prev.weight):null;
  return c;
}
function projection(){
  const ws=weights(),t=dn(todayIso()),pts=ws.filter(p=>p.n>t-28);
  if(pts.length<5||pts[pts.length-1].n-pts[0].n<7)return null;
  const mx=avg(pts.map(p=>p.n)),my=avg(pts.map(p=>p.w));
  let sxy=0,sxx=0;pts.forEach(p=>{sxy+=(p.n-mx)*(p.w-my);sxx+=(p.n-mx)**2});
  const slope=sxx?sxy/sxx:0,now=my+slope*(t-mx);
  const eta=target=>slope<0&&now>target?t+Math.ceil((now-target)/-slope):null;
  return{perWeek:r1(slope*7),now:r1(now),check:eta(state.settings.checkpoint),goal:eta(state.settings.goal)};
}
function checkinHtml(){
  const w=weekOf(todayIso());if(w<1)return"";
  const cur=weekAdherence(w),last=w>1?weekAdherence(w-1):null,pr=projection(),S=state.settings;
  const isSun=new Date().getDay()===0;
  const row=(label,a,b)=>`<tr><td>${label}</td>${last?`<td>${b}</td>`:""}<td>${a}</td></tr>`;
  const f=(c,k)=>`${c[k]}/${c.days}`;
  const fmtEta=n=>n?new Date(n*864e5).toLocaleDateString(undefined,{month:"short",day:"numeric",timeZone:"UTC"}):"–";
  let proj;
  if(!pr)proj=`<p class="foot">Log at least 5 weigh-ins over a week or more to see a projection.</p>`;
  else if(pr.perWeek>=0)proj=`<p>Trend: <strong>${pr.perWeek>0?"+":""}${pr.perWeek} lb/week</strong>. The last four weeks are flat or up, so there's no projection yet. Check weekend logging first.</p>`;
  else proj=`<p>Trend: <strong>${pr.perWeek} lb/week</strong>. At this pace: <strong>${S.checkpoint} by ${fmtEta(pr.check)}</strong>${pr.goal?`, <strong>${S.goal} by ${fmtEta(pr.goal)}</strong>`:""}.</p>${pr.perWeek<-2.5?`<p class="foot">That's faster than 2.5 lb/week. Consider eating about 200 more calories to protect muscle.</p>`:""}`;
  return`<details class="checkin" ${isSun?"open":""}>
    <summary>${isSun?"Sunday check-in":"Weekly check-in"}${cur.score!=null?` <span class="pill">${cur.score}% this week</span>`:""}</summary>
    ${proj}
    <div class="tablewrap"><table>
      <thead><tr><th></th>${last?`<th>Week ${w-1}</th>`:""}<th>Week ${w}${cur.days<7?" so far":""}</th></tr></thead>
      <tbody>
        ${row("Avg weight",cur.weight!=null?r1(cur.weight):"–",last&&last.weight!=null?r1(last.weight):"–")}
        ${row("Change",cur.change!=null?(cur.change>0?"+":"")+cur.change:"–",last&&last.change!=null?(last.change>0?"+":"")+last.change:"–")}
        ${row("Calories on target",f(cur,"cal"),last?f(last,"cal"):"")}
        ${row("Protein on target",f(cur,"pro"),last?f(last,"pro"):"")}
        ${row("Step target hit",f(cur,"steps"),last?f(last,"steps"):"")}
        ${row("Push-up target hit",f(cur,"push"),last?f(last,"push"):"")}
        ${row("Sessions done",cur.sessions,last?last.sessions:"")}
        ${row("Adherence",cur.score!=null?cur.score+"%":"–",last&&last.score!=null?last.score+"%":"–")}
      </tbody></table></div>
    <p class="foot">Adherence counts days on target for calories (within 100 of ${S.calories.toLocaleString()}), protein, steps and push-ups. 80% or better is a strong week.</p>
  </details>`;
}

// ---------- milestones ----------
function bestStreak(pred){const ds=sortedDates();let best=0,run=0,prev=null;for(const d of ds){const n=dn(d);if(pred(d)){run=(prev!=null&&n===prev+1&&run)?run+1:1}else run=0;prev=n;best=Math.max(best,run)}return best}
function currentAvg(){const ws=weights();return ws.length?rolling(ws,ws[ws.length-1].n):null}
const MILESTONES=[
  {id:"weigh1",icon:"⚖️",name:"First weigh-in",test:()=>weights().length>0},
  ...[5,10,15,20,25,30,40,50].map(n=>({id:"lost"+n,icon:"⬇️",name:`${n} lb down`,test:()=>{const a=currentAvg();return a!=null&&state.settings.startWeight-a>=n}})),
  {id:"checkpoint",icon:"🚩",name:"Passed the checkpoint",test:()=>{const a=currentAvg();return a!=null&&a<=state.settings.checkpoint}},
  {id:"goal",icon:"🏁",name:"Reached the goal",test:()=>{const a=currentAvg();return a!=null&&a<=state.settings.goal}},
  {id:"log7",icon:"📓",name:"7 days of food logged in a row",test:()=>bestStreak(d=>num(state.entries[d].calories)!=null)>=7},
  {id:"steps10k",icon:"👟",name:"First 10,000-step day",test:()=>Object.keys(state.entries).some(d=>(dayStepsTotal(d)||0)>=10000)},
  {id:"steps7",icon:"📈",name:"Step target 7 days straight",test:()=>bestStreak(d=>(dayStepsTotal(d)||0)>=stepsTarget(weekOf(d)))>=7},
  {id:"mile",icon:"🗺️",name:"First GPS mile",test:()=>state.walks.some(w=>(w.meters||0)>=1609)},
  {id:"push7",icon:"💪",name:"7-day push-up streak",test:()=>bestStreak(pushHit)>=7},
  {id:"push30",icon:"🔥",name:"30-day push-up streak",test:()=>bestStreak(pushHit)>=30},
  {id:"floor",icon:"🧱",name:"Push-ups from the floor",test:()=>Object.values(state.entries).some(e=>e.surface==="floor")},
  {id:"wo1",icon:"⏱️",name:"First guided workout",test:()=>state.workouts.length>=1},
  {id:"wo12",icon:"🏋️",name:"12 guided workouts",test:()=>state.workouts.length>=12},
  {id:"fp1",icon:"🥊",name:"First fight prep session",test:()=>state.workouts.some(w=>w.type==="R")},
  {id:"fptest",icon:"⏱️",name:"Five 3-minute rounds",test:()=>state.workouts.some(w=>w.type==="R"&&w.rounds>=5&&w.roundMin>=3)},
  {id:"mt1",icon:"🥋",name:"First Muay Thai class",test:()=>state.workouts.some(w=>w.type==="MT")},
  {id:"golf1",icon:"🥏",name:"First disc golf round",test:()=>state.rounds.length>0},
  {id:"golfpar",icon:"🎯",name:"Round at or under par",test:()=>state.rounds.some(r=>(roundHoles(r)||0)>=9&&roundDiff(r)!=null&&roundDiff(r)<=0)},
  {id:"golf4",icon:"📅",name:"Disc golf 4 weeks in a row",test:()=>golfStreak()>=4},
  {id:"throw300",icon:"🚀",name:"300-foot throw",test:()=>state.throws.some(t=>t.feet>=300)},
  {id:"photo1",icon:"📸",name:"First progress photo",test:()=>photoCount>0},
  {id:"water7",icon:"💧",name:"Water goal 7 days straight",test:()=>bestStreak(d=>!!state.entries[d].water)>=7},
  {id:"fav5",icon:"⭐",name:"5 favorite foods saved",test:()=>foodsState().saved.length>=5},
  {id:"scan1",icon:"📷",name:"First barcode scan",test:()=>foodsState().scans>=1},
];
let newMilestones=[];
function checkMilestones(){
  const t=todayIso();let added=[];
  for(const m of allMilestones()){if(!state.milestones[m.id]){let ok=false;try{ok=m.test()}catch(e){}if(ok){state.milestones[m.id]=t;added.push(m)}}}
  if(added.length){state.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}newMilestones=added;showToast(added.length>2?`🏅 ${added.length} new milestones, including ${added[0].icon} ${added[0].name}`:(added.length>1?"🏅 New milestones: ":"🏅 New milestone: ")+added.map(m=>m.icon+" "+m.name).join(", "))}
}
function milestonesHtml(){
  const got=MILESTONES.filter(m=>state.milestones[m.id]).length;
  return`<div class="block"><h2>Milestones <small class="count">${got} of ${MILESTONES.length}</small></h2>
    <div class="ms">${MILESTONES.map(m=>{const d=state.milestones[m.id];return`<div class="m ${d?"got":""}"><span class="mi" aria-hidden="true">${d?m.icon:"🔒"}</span><span><b>${esc(m.name)}</b><small>${d?fmtDate(d):"Not yet"}</small></span></div>`}).join("")}</div></div>`;
}
let toastT=null;
function showToast(msg){
  let el=document.getElementById("toast");
  if(!el){el=document.createElement("div");el.id="toast";el.setAttribute("role","status");document.body.appendChild(el)}
  el.textContent=msg;el.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("on"),5000);
}

// ---------- progress photos (stored on this device in IndexedDB) ----------
let photoCount=0,photoList=[],photoUrls={};
function pdb(){return new Promise((res,rej)=>{const r=indexedDB.open("road200-photos",1);r.onupgradeneeded=()=>r.result.createObjectStore("photos",{keyPath:"id"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function ptx(mode,fn){const db=await pdb();return new Promise((res,rej)=>{const tx=db.transaction("photos",mode),st=tx.objectStore("photos");const out=fn(st);tx.oncomplete=()=>res(out&&out.result!==undefined?out.result:out);tx.onerror=()=>rej(tx.error)})}
async function loadPhotos(){
  try{const all=await ptx("readonly",st=>st.getAll());photoList=(all||[]).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);photoCount=photoList.length;
    for(const p of photoList)if(!photoUrls[p.id])photoUrls[p.id]=URL.createObjectURL(p.blob);
  }catch(e){photoList=[];photoCount=0}
}
async function shrink(file){
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file)});
  const s=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");
  c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);
  return new Promise(res=>c.toBlob(b=>res(b),"image/jpeg",0.82));
}
async function addPhoto(file){
  try{const blob=await shrink(file),a=currentAvg(),id=Date.now();
    await ptx("readwrite",st=>st.put({id,date:todayIso(),weight:a!=null?r1(a):null,blob}));
    await loadPhotos();checkMilestones();render();showToast("Photo saved on this phone.");
  }catch(e){alert("Couldn't save that photo: "+errText(e))}
}
async function deletePhoto(id){await ptx("readwrite",st=>st.delete(id));if(photoUrls[id]){URL.revokeObjectURL(photoUrls[id]);delete photoUrls[id]}await loadPhotos();render()}
let cmpA=null,cmpB=null;
function photosHtml(){
  const opts=sel=>photoList.map(p=>`<option value="${p.id}" ${p.id===sel?"selected":""}>${fmtDate(p.date)}${p.weight?` (${p.weight} lb)`:""}</option>`).join("");
  if(photoList.length>=2){if(!photoList.some(p=>p.id===cmpA))cmpA=photoList[0].id;if(!photoList.some(p=>p.id===cmpB))cmpB=photoList[photoList.length-1].id}
  const pa=photoList.find(p=>p.id===cmpA),pb=photoList.find(p=>p.id===cmpB);
  return`<div class="block"><h2>Progress photos</h2>
    <p class="foot" style="margin-top:0">Same spot, same lighting, once a month. Photos stay on this phone only and aren't included in backups.</p>
    <div class="backup"><label class="filebtn">Add photo<input type="file" id="photoin" accept="image/*"></label></div>
    ${photoList.length>=2?`<div class="compare">
      <div><select id="cmpa" aria-label="Before photo">${opts(cmpA)}</select>${pa?`<img src="${photoUrls[pa.id]}" alt="Progress photo ${esc(pa.date)}">`:""}</div>
      <div><select id="cmpb" aria-label="After photo">${opts(cmpB)}</select>${pb?`<img src="${photoUrls[pb.id]}" alt="Progress photo ${esc(pb.date)}">`:""}</div>
    </div>`:""}
    ${photoList.length?`<div class="thumbs">${photoList.slice().reverse().map(p=>`<figure><img src="${photoUrls[p.id]}" alt="Progress photo ${esc(p.date)}"><figcaption>${fmtDate(p.date)}${p.weight?`<br>${p.weight} lb`:""} <button type="button" class="link" data-pdel="${p.id}">Delete</button></figcaption></figure>`).join("")}</div>`:`<p class="empty">No photos yet.</p>`}
  </div>`;
}
function bindWeightExtras(){
  const pi=document.getElementById("photoin");if(pi)pi.addEventListener("change",ev=>{const f=ev.target.files&&ev.target.files[0];if(f)addPhoto(f);ev.target.value=""});
  const a=document.getElementById("cmpa"),b=document.getElementById("cmpb");
  if(a)a.addEventListener("change",()=>{cmpA=+a.value;render()});if(b)b.addEventListener("change",()=>{cmpB=+b.value;render()});
  document.querySelectorAll("[data-pdel]").forEach(x=>x.addEventListener("click",()=>{if(confirm("Delete this photo?"))deletePhoto(+x.dataset.pdel)}));
}
function weightExtras(){return checkinHtml()+milestonesHtml()+photosHtml()}
