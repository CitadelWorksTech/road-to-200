// Forgeway: goals.js
// Layout state, moods, activities catalog, custom goals and dialogs.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- v3: layout, settings page, activities, goals, moods ----------
let view="main";
let act=(()=>{try{return localStorage.getItem("road200-act")||"steps"}catch(e){return"steps"}})();
if(tab==="routine")tab="workout";
if(tab==="steps"||tab==="golf"){act=tab;tab="activity"}
if(!["weight","food","workout","activity"].includes(tab))tab="weight";
function setAct(a){act=a;try{localStorage.setItem("road200-act",a)}catch(e){}render();window.scrollTo&&window.scrollTo(0,0)}
function openSettings(){view="settings";try{history.pushState({rs:1},"")}catch(e){}render();window.scrollTo&&window.scrollTo(0,0)}
function closeSettings(){if(view!=="settings")return;view="main";render();window.scrollTo&&window.scrollTo(0,0)}
window.addEventListener("popstate",()=>{if(document.getElementById("gw")){closeModal();return}if(view==="settings")closeSettings()});

// ----- moods -----
const MOODS=[["🔥","On fire"],["😄","Great"],["🙂","Good"],["😐","Okay"],["😕","Rough"],["😫","Wiped out"]];
function moodPicker(sel,legend){return`<fieldset class="moods"><legend>${esc(legend||"How did it go?")}</legend>${MOODS.map(([m,l])=>`<label><input type="radio" name="mood" value="${m}" ${sel===m?"checked":""}><span class="em" aria-hidden="true">${m}</span><span class="ml">${l}</span></label>`).join("")}</fieldset>`}
function moodOf(form){const r=form.querySelector('input[name="mood"]:checked');return r?r.value:null}

// ----- activities -----
const ACT_BUILTIN={steps:{id:"steps",name:"Steps",icon:"👟"},golf:{id:"golf",name:"Disc golf",icon:"🥏"}};
const ACT_CATALOG=[
  {id:"hike",name:"Hiking",icon:"🥾",dist:1,gps:1},{id:"bike",name:"Biking",icon:"🚴",dist:1,gps:1},{id:"run",name:"Running",icon:"🏃",dist:1,gps:1},
  {id:"dogwalk",name:"Dog walk",icon:"🐕",dist:1,gps:1},{id:"kayak",name:"Kayaking",icon:"🛶",dist:1,gps:1},{id:"swim",name:"Swimming",icon:"🏊",dist:1},
  {id:"pickleball",name:"Pickleball",icon:"🏓"},{id:"basketball",name:"Basketball",icon:"🏀"},{id:"gym",name:"Gym",icon:"🏋️"},
  {id:"yoga",name:"Yoga / stretching",icon:"🧘"},{id:"yard",name:"Yard work",icon:"🌿"},{id:"plunge",name:"Cold plunge",icon:"🧊"}
];
function actsState(){const a=state.acts||{};return{list:Array.isArray(a.list)&&a.list.length?a.list:["steps","golf"],custom:Array.isArray(a.custom)?a.custom:[]}}
function actInfo(id){return ACT_BUILTIN[id]||ACT_CATALOG.find(x=>x.id===id)||actsState().custom.find(x=>x.id===id)||{id,name:id,icon:"⭐"}}
function actList(){return actsState().list.filter(id=>ACT_BUILTIN[id]||ACT_CATALOG.some(x=>x.id===id)||actsState().custom.some(x=>x.id===id))}
function sessionsOf(id){return state.sessions.filter(s=>s.act===id)}

// ----- built-in milestones by area -----
const MS_AREA={weigh1:"weight",checkpoint:"weight",goal:"weight",photo1:"weight",log7:"food",water7:"food",fav5:"food",scan1:"food",push7:"workout",push30:"workout",floor:"workout",wo1:"workout",wo12:"workout",steps10k:"steps",steps7:"steps",mile:"steps",golf1:"golf",golfpar:"golf",golf4:"golf",throw300:"golf"};
function msArea(m){return m.area||MS_AREA[m.id]||(m.id.startsWith("lost")?"weight":"weight")}
function actMilestones(){const out=[];for(const id of actList()){if(ACT_BUILTIN[id])continue;const a=actInfo(id);
  out.push({id:`a_${id}_1`,area:"act:"+id,icon:a.icon,name:`First ${a.name.toLowerCase()} session`,test:()=>sessionsOf(id).length>=1});
  out.push({id:`a_${id}_10`,area:"act:"+id,icon:"🔟",name:`10 ${a.name.toLowerCase()} sessions`,test:()=>sessionsOf(id).length>=10});
  out.push({id:`a_${id}_600`,area:"act:"+id,icon:"⏳",name:`10 hours of ${a.name.toLowerCase()}`,test:()=>sessionsOf(id).reduce((x,s)=>x+(s.minutes||0),0)>=600});
  if(a.dist)out.push({id:`a_${id}_d50`,area:"act:"+id,icon:"🗺️",name:`50 miles of ${a.name.toLowerCase()}`,test:()=>sessionsOf(id).reduce((x,s)=>x+(s.miles||0),0)>=50});
}return out}
function allMilestones(){return MILESTONES.concat(actMilestones())}

// ----- custom goals -----
const clamp=v=>Math.max(0,Math.min(1,isFinite(v)?v:0));
function since(g,d){return d>=g.created}
function curStreak(pred){let n=dn(todayIso());if(!pred(iso(n)))n--;let c=0;while(c<3650&&pred(iso(n))){c++;n--}return c}
function weekStepSum(w){return weekDates(w).reduce((a,d)=>a+(dayStepsTotal(d)||0),0)}
function allDates(){return [...new Set([...Object.keys(state.entries),...state.walks.map(x=>x.date)])].sort()}
const GOAL_TYPES={
  weight:[
    {t:"weight_at",icon:"🎯",pick:"Reach a weight",q:"What weight do you want to reach?",unit:"lb",def:()=>Math.round((currentAvg()||state.settings.startWeight)-5),label:v=>`Reach ${v} lb`,
      prog:(g,v)=>{const a=currentAvg(),s=Math.max(state.settings.startWeight,v+0.1);return a==null?{cur:"No weigh-ins yet",pct:0}:{cur:`${r1(a)} lb now`,pct:clamp((s-a)/(s-v)),done:a<=v}}},
    {t:"lost",icon:"⬇️",pick:"Lose a number of pounds",q:"How many pounds do you want to lose from your start weight?",unit:"lb",def:()=>10,label:v=>`Lose ${v} lb`,
      prog:(g,v)=>{const a=currentAvg(),l=a==null?0:Math.max(0,state.settings.startWeight-a);return{cur:`${r1(l)} lb lost`,pct:clamp(l/v),done:l>=v}}},
    {t:"waist_at",icon:"📏",pick:"Reach a waist size",q:"What waist size are you aiming for, in inches?",unit:"in",def:()=>36,label:v=>`Waist ${v} in`,
      prog:(g,v)=>{const w=sortedDates().filter(d=>num(state.entries[d].waist)!=null).map(d=>num(state.entries[d].waist));if(!w.length)return{cur:"No waist measurements yet",pct:0};const now=w[w.length-1],first=Math.max(w[0],v+0.1);return{cur:`${now} in now`,pct:clamp((first-now)/(first-v)),done:now<=v}}},
    {t:"weigh_streak",icon:"📆",pick:"Weigh in every day",q:"How many days in a row do you want to weigh in?",unit:"days",def:()=>14,label:v=>`Weigh in ${v} days in a row`,
      prog:(g,v)=>{const c=curStreak(d=>num((state.entries[d]||{}).weight)!=null);return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}}
  ],
  workout:[
    {t:"sessions",icon:"🏋️",pick:"Finish a number of workouts",q:"How many workouts do you want to finish?",unit:"workouts",def:()=>12,label:v=>`Finish ${v} workouts`,
      prog:(g,v)=>{const c=Object.keys(state.entries).filter(d=>since(g,d)&&state.entries[d].session).length;return{cur:`${c} done`,pct:clamp(c/v),done:c>=v}}},
    {t:"push_day",icon:"💪",pick:"Push-ups in one day",q:"How many push-ups do you want to do in a single day?",unit:"push-ups",def:()=>pushTarget(Math.max(1,weekOf(todayIso())))+20,label:v=>`${v} push-ups in one day`,
      prog:(g,v)=>{const b=Math.max(0,...Object.values(state.entries).map(e=>pushTotal(e)||0));return{cur:`Best: ${b}`,pct:clamp(b/v),done:b>=v}}},
    {t:"push_streak",icon:"🔥",pick:"Push-up target streak",q:"How many days in a row do you want to hit your push-up target?",unit:"days",def:()=>14,label:v=>`Push-up target ${v} days in a row`,
      prog:(g,v)=>{const c=pushStreak();return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}},
  ],
  food:[
    {t:"log_streak",icon:"📓",pick:"Log food every day",q:"How many days in a row do you want to log your food?",unit:"days",def:()=>14,label:v=>`Log food ${v} days in a row`,
      prog:(g,v)=>{const c=curStreak(d=>foodDay(d).length>0||num((state.entries[d]||{}).calories)!=null);return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}},
    {t:"cal_streak",icon:"🍽️",pick:"Calories on target streak",q:"How many days in a row do you want to stay on your calorie target?",unit:"days",def:()=>7,label:v=>`Calories on target ${v} days in a row`,
      prog:(g,v)=>{const c=curStreak(d=>{const x=num((state.entries[d]||{}).calories);return x!=null&&x<=state.settings.calories+100});return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}},
    {t:"pro_streak",icon:"🥩",pick:"Protein target streak",q:"How many days in a row do you want to hit your protein target?",unit:"days",def:()=>7,label:v=>`Protein target ${v} days in a row`,
      prog:(g,v)=>{const c=curStreak(d=>{const x=num((state.entries[d]||{}).protein);return x!=null&&x>=state.settings.protein-10});return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}},
    {t:"water_streak",icon:"💧",pick:"Water goal streak",q:"How many days in a row do you want to hit your water goal?",unit:"days",def:()=>7,label:v=>`Water goal ${v} days in a row`,
      prog:(g,v)=>{const c=curStreak(d=>!!(state.entries[d]||{}).water);return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}}
  ],
  steps:[
    {t:"steps_day",icon:"👟",pick:"Steps in one day",q:"How many steps do you want to hit in a single day?",unit:"steps",def:()=>12000,label:v=>`${v.toLocaleString()} steps in a day`,
      prog:(g,v)=>{const b=Math.max(0,...allDates().map(d=>dayStepsTotal(d)||0));return{cur:`Best: ${b.toLocaleString()}`,pct:clamp(b/v),done:b>=v}}},
    {t:"steps_week",icon:"📈",pick:"Steps in one week",q:"How many steps do you want in a single week?",unit:"steps",def:()=>60000,label:v=>`${v.toLocaleString()} steps in a week`,
      prog:(g,v)=>{const w=Math.max(1,weekOf(todayIso()));let b=0;for(let i=1;i<=w;i++)b=Math.max(b,weekStepSum(i));const c=weekStepSum(w);return{cur:`This week: ${c.toLocaleString()}`,pct:clamp(Math.max(b,c)/v),done:b>=v}}},
    {t:"steps_streak",icon:"🔁",pick:"Step target streak",q:"How many days in a row do you want to hit your step target?",unit:"days",def:()=>14,label:v=>`Step target ${v} days in a row`,
      prog:(g,v)=>{const c=curStreak(d=>(dayStepsTotal(d)||0)>=stepsTarget(weekOf(d)));return{cur:`${c} day streak`,pct:clamp(c/v),done:c>=v}}}
  ],
  golf:[
    {t:"golf_rounds",icon:"🥏",pick:"Play a number of rounds",q:"How many rounds do you want to play?",unit:"rounds",def:()=>10,label:v=>`Play ${v} rounds`,
      prog:(g,v)=>{const c=state.rounds.filter(r=>since(g,r.date)).length;return{cur:`${c} played`,pct:clamp(c/v),done:c>=v}}},
    {t:"golf_score",icon:"🎯",pick:"Shoot a score vs par",q:"What score vs par do you want to shoot on a full round? Use 0 for even par, -2 for two under, 5 for five over.",unit:"vs par",allowNeg:1,def:()=>0,label:v=>`Shoot ${vsPar(v)} on a round`,
      prog:(g,v)=>{const ds=state.rounds.filter(r=>(roundHoles(r)||0)>=9).map(roundDiff).filter(x=>x!=null);if(!ds.length)return{cur:"No full rounds yet",pct:0};const b=Math.min(...ds),f=Math.max(ds[0],v+1);return{cur:`Best: ${vsPar(b)}`,pct:b<=v?1:clamp((f-b)/(f-v)),done:b<=v}}},
    {t:"throw_ft",icon:"🚀",pick:"Throw a distance",q:"How far do you want to throw, in feet?",unit:"ft",def:()=>300,label:v=>`Throw ${v} ft`,
      prog:(g,v)=>{const b=Math.max(0,...state.throws.map(t=>t.feet));return{cur:`Best: ${b} ft`,pct:clamp(b/v),done:b>=v}}}
  ],
  act:[
    {t:"act_sessions",icon:"✅",pick:"Number of sessions",q:"How many sessions do you want to log?",unit:"sessions",def:()=>10,label:(v,a)=>`${v} ${a.name.toLowerCase()} sessions`,
      prog:(g,v,id)=>{const c=sessionsOf(id).filter(s=>since(g,s.date)).length;return{cur:`${c} logged`,pct:clamp(c/v),done:c>=v}}},
    {t:"act_minutes",icon:"⏱️",pick:"Total time",q:"How many total minutes do you want to put in?",unit:"minutes",def:()=>600,label:(v,a)=>`${v.toLocaleString()} minutes of ${a.name.toLowerCase()}`,
      prog:(g,v,id)=>{const c=sessionsOf(id).filter(s=>since(g,s.date)).reduce((x,s)=>x+(s.minutes||0),0);return{cur:`${c.toLocaleString()} min`,pct:clamp(c/v),done:c>=v}}},
    {t:"act_miles",icon:"🗺️",pick:"Total distance",q:"How many total miles do you want to cover?",unit:"miles",distOnly:1,def:()=>25,label:(v,a)=>`${v} miles of ${a.name.toLowerCase()}`,
      prog:(g,v,id)=>{const c=r1(sessionsOf(id).filter(s=>since(g,s.date)).reduce((x,s)=>x+(s.miles||0),0));return{cur:`${c} mi`,pct:clamp(c/v),done:c>=v}}},
    {t:"act_week",icon:"📅",pick:"Sessions in one week",q:"How many sessions do you want to fit into one week?",unit:"sessions",def:()=>3,label:(v,a)=>`${v} ${a.name.toLowerCase()} sessions in a week`,
      prog:(g,v,id)=>{const w=weekOf(todayIso());let b=0;const byW={};sessionsOf(id).forEach(s=>{const k=weekOf(s.date);byW[k]=(byW[k]||0)+1;b=Math.max(b,byW[k])});const c=byW[w]||0;return{cur:`This week: ${c}`,pct:clamp(Math.max(b,c)/v),done:b>=v}}}
  ]
};
function areaKind(area){return area.startsWith("act:")?"act":area}
function goalType(g){return(GOAL_TYPES[areaKind(g.area)]||[]).find(x=>x.t===g.t)}
function goalProgress(g){const ty=goalType(g);if(!ty)return{cur:"",pct:0};try{return ty.prog(g,g.v,g.area.slice(4))}catch(e){return{cur:"",pct:0}}}
function goalLabel(g){const ty=goalType(g);if(g.name)return g.name;if(!ty)return"Goal";return ty.label(g.v,actInfo(g.area.slice(4)))}
function checkGoals(){
  const done=[];
  for(const g of state.goals){if(g.doneDate)continue;const p=goalProgress(g);if(p.done){g.doneDate=todayIso();done.push(g)}}
  if(done.length){state.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}showToast("🏆 Goal reached: "+done.map(goalLabel).join(", "))}
}
function goalsSection(area,title){
  const gs=state.goals.filter(g=>g.area===area).sort((a,b)=>(a.doneDate?1:0)-(b.doneDate?1:0)||a.created.localeCompare(b.created));
  const ms=allMilestones().filter(m=>msArea(m)===area),got=ms.filter(m=>state.milestones[m.id]).length;
  return`<div class="block goalsec"><div class="gshead"><h2>${esc(title||"Goals & milestones")}</h2><button type="button" data-newgoal="${esc(area)}">+ New goal</button></div>
    ${gs.length?`<div class="goals">${gs.map(g=>{const p=goalProgress(g),ty=goalType(g),pct=g.doneDate?100:Math.round(p.pct*100);
      const left=g.by&&!g.doneDate?dn(g.by)-dn(todayIso()):null;
      return`<div class="goal ${g.doneDate?"done":""}"><div class="gtop"><span class="gi" aria-hidden="true">${g.doneDate?"🏆":(ty?ty.icon:"⭐")}</span><b>${esc(goalLabel(g))}</b><button type="button" class="link gdel" data-gdel="${g.id}" aria-label="Delete goal ${esc(goalLabel(g))}">✕</button></div>
        <div class="pbar"><i style="width:${pct}%"></i></div>
        <div class="gmeta"><span>${g.doneDate?`Reached ${fmtDate(g.doneDate)} · <button type="button" class="link" data-share-goal="${g.id}">Share</button>`:esc(p.cur)}</span><span>${pct}%${left!=null?` · ${left>=0?left+" days left":"past due"}`:""}</span></div></div>`}).join("")}</div>`
      :`<p class="empty">No goals here yet. Tap <strong>+ New goal</strong> and answer a couple of questions to set one.</p>`}
    ${ms.length?`<h3>Milestones <small class="count">${got} of ${ms.length}</small></h3><div class="ms">${ms.map(m=>{const d=state.milestones[m.id];return`<div class="m ${d?"got":""}"><span class="mi" aria-hidden="true">${d?m.icon:"🔒"}</span><span><b>${esc(m.name)}</b><small>${d?fmtDate(d):"Not yet"}</small></span>${d?`<button type="button" class="link msshare" data-share-ms="${m.id}" aria-label="Share ${esc(m.name)}">Share</button>`:""}</div>`}).join("")}</div>`:""}
  </div>`;
}

// ----- modal (goal wizard, activity picker) -----
function openModal(html,label){closeModal(true);const el=document.createElement("div");el.id="gw";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label",label||"Dialog");el.innerHTML=`<div class="gwin">${html}</div>`;document.body.appendChild(el);try{history.pushState({gw:1},"")}catch(e){}const f=el.querySelector("button,input");if(f)f.focus();return el}
function closeModal(silent){const el=document.getElementById("gw");if(el)el.remove()}
function dismissModal(){if(document.getElementById("gw")){try{history.back()}catch(e){closeModal()}}}
function goalWizard(area){
  const kind=areaKind(area),a=kind==="act"?actInfo(area.slice(4)):null;
  const types=(GOAL_TYPES[kind]||[]).filter(t=>!t.distOnly||(a&&a.dist));
  const where={weight:"weight",workout:"workouts",steps:"steps",golf:"disc golf",act:a?a.name.toLowerCase():""}[kind];
  const html=`<p class="wok">New ${esc(where)} goal</p><h2>What do you want to work toward?</h2>
    <div class="picks">${types.map(t=>`<button type="button" class="pick" data-gt="${t.t}"><span aria-hidden="true">${t.icon}</span>${esc(t.pick)}</button>`).join("")}</div>
    <button type="button" class="link" data-close>Cancel</button>`;
  let el=document.getElementById("gw");if(el)el.querySelector(".gwin").innerHTML=html;else el=openModal(html,"New goal");
  el.querySelector("[data-close]").onclick=dismissModal;
  el.querySelectorAll("[data-gt]").forEach(b=>b.onclick=()=>goalStep2(area,types.find(t=>t.t===b.dataset.gt)));
}
function goalStep2(area,ty){
  const el=document.getElementById("gw");if(!el)return;const a=actInfo(area.slice(4));
  el.querySelector(".gwin").innerHTML=`<p class="wok">${ty.icon} ${esc(ty.pick)}</p><h2>${esc(ty.q)}</h2>
    <form id="gwf" autocomplete="off">
      <div class="fields">
        <label class="wide">Target (${esc(ty.unit)})<input type="number" name="v" step="any" inputmode="decimal" required value="${ty.def()}"></label>
        <label class="wide">By when? (optional)<input type="date" name="by" min="${todayIso()}"></label>
        <label class="wide">Name it (optional)<input type="text" name="name" maxlength="60" placeholder="${esc(ty.label(ty.def(),a))}"></label>
      </div>
      <div class="backup"><button type="submit">Create goal</button><button type="button" class="quiet" id="gwback">Back</button></div>
    </form>`;
  const f=el.querySelector("#gwf");f.elements.v.focus();f.elements.v.select&&f.elements.v.select();
  el.querySelector("#gwback").onclick=()=>goalWizard(area);
  f.onsubmit=ev=>{ev.preventDefault();let v=num(f.elements.v.value);if(v==null||(!ty.allowNeg&&v<=0)){alert("Enter a target number.");return}
    const g={id:Date.now(),area,t:ty.t,v,created:todayIso()};if(f.elements.by.value)g.by=f.elements.by.value;const nm=f.elements.name.value.trim();if(nm)g.name=nm;
    const p=(()=>{try{return ty.prog(g,v,area.slice(4))}catch(e){return{}}})();if(p.done)g.doneDate=todayIso();
    state.goals.push(g);dismissModal();persist(p.done?"Goal created, and you've already reached it!":"Goal created.");};
}
function bindGoals(){
  document.querySelectorAll("[data-newgoal]").forEach(b=>b.addEventListener("click",()=>goalWizard(b.dataset.newgoal)));
  document.querySelectorAll("[data-gdel]").forEach(b=>b.addEventListener("click",()=>{if(confirm("Delete this goal?")){state.goals=state.goals.filter(g=>String(g.id)!==b.dataset.gdel);persist("Goal deleted.")}}));
}
function activityPicker(){
  const S=actsState(),on=id=>S.list.includes(id);
  const row=a=>`<label class="actrow"><input type="checkbox" data-actsel="${a.id}" ${on(a.id)?"checked":""} ${a.id==="steps"?"disabled":""}><span class="em" aria-hidden="true">${a.icon}</span><span>${esc(a.name)}</span></label>`;
  const el=openModal(`<p class="wok">Activities</p><h2>What do you like to do?</h2>
    <p class="foot">Checked activities show up as tabs under Activity.</p>
    <div class="actlist">${[ACT_BUILTIN.steps,ACT_BUILTIN.golf,...ACT_CATALOG,...S.custom].map(row).join("")}</div>
    <h3>Add your own</h3>
    <form id="actnew" autocomplete="off"><div class="fields">
      <label>Name<input type="text" name="name" maxlength="30" placeholder="Rock climbing"></label>
      <label>Emoji<input type="text" name="icon" maxlength="4" placeholder="🧗"></label>
      <label class="wide checks" style="margin:0"><input type="checkbox" name="dist">Track distance (miles)</label>
    </div><button type="submit" class="quiet">Add activity</button></form>
    <div class="backup"><button type="button" id="actdone">Done</button></div>`,"Choose activities");
  el.querySelector("#actdone").onclick=()=>{const list=["steps",...[...el.querySelectorAll("[data-actsel]:checked")].map(x=>x.dataset.actsel).filter(x=>x!=="steps")];
    const before=actsState().list,added=list.filter(x=>!before.includes(x));
    state.acts={list,custom:actsState().custom};if(added.length)act=added[0];else if(!list.includes(act))act="steps";try{localStorage.setItem("road200-act",act)}catch(e){}dismissModal();persist("Activities updated.")};
  el.querySelector("#actnew").onsubmit=ev=>{ev.preventDefault();const f=ev.target,name=f.elements.name.value.trim();if(!name){alert("Give the activity a name.");return}
    const id="c"+Date.now().toString(36),S2=actsState();S2.custom.push({id,name,icon:f.elements.icon.value.trim()||"⭐",dist:f.elements.dist.checked?1:0});
    const list=["steps",...[...el.querySelectorAll("[data-actsel]:checked")].map(x=>x.dataset.actsel).filter(x=>x!=="steps"),id];
    state.acts={list,custom:S2.custom};act=id;dismissModal();persist(name+" added.")};
}
