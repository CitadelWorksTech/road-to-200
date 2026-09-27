// Forgeway: fight.js
// Fight prep (guided shadowboxing rounds), class logging, and how-to video links.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- how-to videos ----------
// Each link opens a YouTube search, so there is always a current beginner tutorial to pick from.
const VIDEO={
  "Chair squats":"chair squat for beginners proper form",
  "Incline push-ups (counter)":"incline push up on kitchen counter beginners",
  "Glute bridges":"glute bridge exercise for beginners proper form",
  "Plank":"how to do a plank for beginners",
  "Reverse lunges":"reverse lunge for beginners proper form",
  "Table or doorframe rows":"doorframe row bodyweight back exercise at home",
  "Step-ups (stairs)":"step ups on stairs exercise proper form",
  "Dead bugs":"dead bug exercise for beginners",
  "March in place":"low impact march in place warm up",
  "Arm and hip circles":"arm circles and hip circles warm up",
  "Stance and footwork":"muay thai stance and footwork for beginners",
  "Jab and cross":"muay thai jab cross for beginners",
  "Teeps and knees":"muay thai teep and knee for beginners",
  "Round kicks":"muay thai round kick technique for beginners",
  "Put it together":"muay thai shadow boxing beginner combos",
  "Hip flexor stretch":"kneeling hip flexor stretch beginners",
  "Hamstring stretch":"standing hamstring stretch beginners",
  "Figure-four stretch":"seated figure four glute stretch beginners",
};
const ytUrl=q=>"https://www.youtube.com/results?search_query="+encodeURIComponent(q);
function vidLink(name,label){
  const q=VIDEO[String(name||"").trim()];if(!q)return"";
  // In the Android app a plain link opens YouTube outside the app; on the web it opens a new tab.
  const nat=typeof NATIVE!=="undefined"&&NATIVE;
  return`<a class="vid" href="${ytUrl(q)}"${nat?"":' target="_blank" rel="noopener"'}><span aria-hidden="true">▶</span> ${esc(label||"Watch how")}<span class="sr-only"> (${esc(name)} video)</span></a>`;
}

// ---------- round session ----------
const FR_FOCUS=[
  {n:"Stance and footwork",d:"Stay in stance with your hands up. Step forward, back and side to side."},
  {n:"Jab and cross",d:"Jab, cross, step out. Breathe out on every punch and bring your hands back to your face."},
  {n:"Teeps and knees",d:"Push kicks and knees, slow and controlled. Balance matters more than power."},
  {n:"Round kicks",d:"Half-height kicks. Pivot on your standing foot. Switch sides halfway through."},
  {n:"Put it together",d:"Mix it up: jab-cross-knee, jab-teep, cross-kick. Keep moving the whole round."},
];
const FR_WARM=[
  {n:"March in place",r:"1 minute, arms swinging"},
  {n:"Arm and hip circles",r:"10 each way"},
  {n:"Chair squats",r:"10 easy reps"},
];
const FR_COOL=[
  {n:"Hip flexor stretch",r:"30 seconds per side",hold:60},
  {n:"Hamstring stretch",r:"30 seconds per side",hold:60},
  {n:"Figure-four stretch",r:"30 seconds per side",hold:60},
];
let fr=null;
function frSteps(f){
  const out=[];
  FR_WARM.forEach(x=>out.push({kind:"ex",ph:"Warm-up",...x}));
  for(let i=0;i<f.rounds;i++){
    const fo=FR_FOCUS[i%FR_FOCUS.length];
    out.push({kind:"round",i,secs:f.mins*60,...fo});
    if(i<f.rounds-1)out.push({kind:"rest",secs:FIGHT.rest,next:FR_FOCUS[(i+1)%FR_FOCUS.length].n});
  }
  FR_COOL.forEach(x=>out.push({kind:"ex",ph:"Cool-down",...x}));
  return out;
}
function startRounds(f){if(wo)return;fr={f,steps:frSteps(f),i:0,started:Date.now(),endsAt:0,paused:0};keepAwake();frRender()}
function frEnd(){clearInterval(woTimer);woTimer=null;const el=document.getElementById("wo");if(el)el.remove();fr=null;if(!state.track){try{wakeLock&&wakeLock.release()}catch(e){}wakeLock=null}}
function frNext(){
  const prev=fr.steps[fr.i];fr.i++;const n=fr.steps[fr.i];fr.paused=0;
  // Rest always counts down; the round after a rest starts on its own. The first round waits for a tap.
  fr.endsAt=n&&(n.kind==="rest"||(n.kind==="round"&&prev&&prev.kind==="rest"))?Date.now()+n.secs*1000:0;
  frRender();
}
function mmss(s){return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
function frRender(){
  let el=document.getElementById("wo");
  if(!el){el=document.createElement("div");el.id="wo";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Fight prep rounds");document.body.appendChild(el)}
  clearInterval(woTimer);woTimer=null;
  const s=fr.steps[fr.i],total=fr.steps.length,bar=`<div class="wobar"><i style="width:${Math.round(fr.i/total*100)}%"></i></div>`;
  const quit=`<button type="button" class="link woquit" id="woquit">End session</button>`;
  if(!s){
    const mins=Math.max(1,Math.round((Date.now()-fr.started)/60000));
    el.innerHTML=`<div class="woin">${bar}<p class="wok">Fight prep, week ${fr.f.week}</p><h2>Rounds done.</h2>
      <p class="wobig">${fr.f.rounds} × ${fr.f.mins}:00</p><p>${mins} minutes including warm-up and stretching.</p>${moodPicker(fr.mood||null,"How did the rounds feel?")}
      <div class="backup"><button type="button" id="wosave">Save session</button><button type="button" class="quiet" id="woquit">Don't save</button></div></div>`;
    el.querySelector("#wosave").onclick=()=>{
      const t=todayIso(),e=Object.assign({},state.entries[t]||{});e.session=true;const md=moodOf(el);if(md&&!e.mood)e.mood=md;state.entries[t]=e;
      state.workouts.push({id:Date.now(),date:t,type:"R",minutes:mins,rounds:fr.f.rounds,roundMin:fr.f.mins,mood:md||undefined});
      frEnd();persist("Fight prep saved.");
    };
    el.querySelector("#woquit").onclick=()=>{if(confirm("Close without saving?"))frEnd()};
    beep();return;
  }
  if(s.kind==="ex"){
    el.innerHTML=`<div class="woin">${bar}<p class="wok">${s.ph}</p><h2>${esc(s.n)}</h2><p class="wobig sm">${esc(s.r)}</p>${vidLink(s.n,"Watch how to do it")}
      ${s.hold?`<p><button type="button" class="quiet" id="wohold">Start ${s.hold}-second timer</button></p>`:""}
      <div class="backup"><button type="button" id="wodone">Done</button></div>${quit}</div>`;
    if(s.hold){const hb=el.querySelector("#wohold");const tick=()=>{const left=Math.max(0,Math.ceil((fr.endsAt-Date.now())/1000));hb.textContent=left>0?left+" sec left":"Time! Tap Done";if(left<=0){clearInterval(woTimer);woTimer=null;beep()}};
      hb.onclick=()=>{if(woTimer)return;fr.endsAt=Date.now()+s.hold*1000;tick();woTimer=setInterval(tick,250)}}
    el.querySelector("#wodone").onclick=frNext;
  }else{
    const isRound=s.kind==="round",left=()=>fr.paused||Math.max(0,Math.ceil((fr.endsAt-Date.now())/1000));
    const head=isRound?`<p class="wok">Round ${s.i+1} of ${fr.f.rounds}</p><h2>${esc(s.n)}</h2><p>${esc(s.d)}</p>${vidLink(s.n,"Watch the technique")}`
      :`<p class="wok">Rest</p><p>Walk around and breathe. Next: <strong>${esc(s.next)}</strong></p>${vidLink(s.next,"Preview the next round")}`;
    const running=fr.endsAt>0;
    el.innerHTML=`<div class="woin">${bar}${head}<p class="wobig" id="wotime" aria-live="off">${mmss(running?left():s.secs)}</p>
      <div class="backup">${running?`<button type="button" class="quiet" id="wopause">${fr.paused?"Resume":"Pause"}</button><button type="button" id="woskip">${isRound?"End round":"Skip rest"}</button>`:`<button type="button" id="wostart">Start round</button>`}</div>${quit}</div>`;
    if(running){
      const tick=()=>{if(fr.paused)return;const l=left(),t=el.querySelector("#wotime");if(t)t.textContent=mmss(l);if(l<=0){beep();frNext()}};
      el.querySelector("#wopause").onclick=()=>{if(fr.paused){fr.endsAt=Date.now()+fr.paused*1000;fr.paused=0}else fr.paused=left();frRender()};
      el.querySelector("#woskip").onclick=frNext;
      woTimer=setInterval(tick,250);
    }else el.querySelector("#wostart").onclick=()=>{fr.endsAt=Date.now()+s.secs*1000;beep();frRender()};
  }
  el.querySelector("#woquit").onclick=()=>{if(confirm("End this session? Nothing will be saved."))frEnd()};
}

// ---------- Workout tab pieces ----------
function woName(x){return{R:"Fight prep rounds",MT:"Muay Thai class",BJJ:"BJJ class"}[x.type]||`Guided Strength ${x.type}`}
function fightButton(plan){
  const f=plan.fight,done=state.workouts.some(x=>x.date===todayIso()&&x.type==="R");
  const n=Math.min(f.rounds,FR_FOCUS.length);
  const note=f.test?"Test day. Aim to finish every round at a steady pace.":f.easy?"Keep it light. Trial week starts Tuesday.":`Week ${f.week} of 5. ${FIGHT.rest}-second rest between rounds.`;
  return`<div class="fcard"><p class="foot" style="margin-top:0">${note}</p>
    <ul class="focus">${FR_FOCUS.slice(0,n).map((x,i)=>`<li><span><b>Round ${i+1}:</b> ${esc(x.n)}</span>${vidLink(x.n,"Watch")}</li>`).join("")}</ul>
    <div class="backup" style="margin-top:10px"><button type="button" data-fr="1">Start fight prep rounds</button></div>
    ${done?`<p class="foot">Fight prep done today ✓</p>`:""}</div>`;
}
function classButton(plan){
  const c=plan.cls,done=state.workouts.some(x=>x.date===todayIso()&&x.type===c.type);
  return`<div class="backup" style="margin-top:10px">${done?`<p class="foot">${esc(c.name)} logged today ✓</p>`:`<button type="button" data-cls="1">Log today's class</button>`}</div>`;
}
function bindFightExtras(){
  const t=todayIso(),plan=dayPlan(t);
  document.querySelectorAll("[data-fr]").forEach(b=>b.addEventListener("click",()=>plan.fight&&startRounds(plan.fight)));
  document.querySelectorAll("[data-cls]").forEach(b=>b.addEventListener("click",()=>{
    if(!plan.cls)return;const e=Object.assign({},state.entries[t]||{});e.session=true;state.entries[t]=e;
    state.workouts.push({id:Date.now(),date:t,type:plan.cls.type,minutes:plan.cls.mins,cls:true});persist("Class logged.");
  }));
}
