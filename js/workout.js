// Forgeway: workout.js
// Guided Strength A/B workout overlay.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- guided workout ----------
const WO_DEF={
  A:[{n:"Chair squats",r:"10–15 reps"},{n:"Incline push-ups (counter)",r:"8–12 reps",push:10},{n:"Glute bridges",r:"15 reps"},{n:"Plank",r:"20–40 seconds",hold:30}],
  B:[{n:"Reverse lunges",r:"8 per leg"},{n:"Table or doorframe rows",r:"10–12 reps"},{n:"Step-ups (stairs)",r:"10 per leg"},{n:"Dead bugs",r:"10 per side"}]
};
const WO_ROUNDS=3,WO_SHORT=20,WO_LONG=75;
let wo=null,woTimer=null,audioCtx=null;
function woSteps(type){const ex=WO_DEF[type],out=[];for(let r=1;r<=WO_ROUNDS;r++){ex.forEach((e,i)=>{out.push({kind:"ex",round:r,i,...e});const last=r===WO_ROUNDS&&i===ex.length-1;if(!last)out.push({kind:"rest",secs:i===ex.length-1?WO_LONG:WO_SHORT,next:i===ex.length-1?ex[0].n:ex[i+1].n})})}return out}
function beep(){try{navigator.vibrate&&navigator.vibrate([200,100,200]);audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=880;g.gain.value=0.15;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.35)}catch(e){}}
function startWorkout(type){wo={type,steps:woSteps(type),i:0,started:Date.now(),push:[],endsAt:0,reps:WO_DEF[type].find(e=>e.push)?.push||0};keepAwake();woRender()}
function woEnd(){clearInterval(woTimer);woTimer=null;const el=document.getElementById("wo");if(el)el.remove();wo=null;if(!state.track){try{wakeLock&&wakeLock.release()}catch(e){}wakeLock=null}}
function woNext(){const s=wo.steps[wo.i];if(s&&s.kind==="ex"&&s.push)wo.push.push(wo.reps);wo.i++;const n=wo.steps[wo.i];if(n&&n.kind==="rest")wo.endsAt=Date.now()+n.secs*1000;if(n&&n.hold)wo.endsAt=0;woRender()}
function woRender(){
  let el=document.getElementById("wo");
  if(!el){el=document.createElement("div");el.id="wo";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Guided workout");document.body.appendChild(el)}
  clearInterval(woTimer);woTimer=null;
  const s=wo.steps[wo.i],total=wo.steps.filter(x=>x.kind==="ex").length,done=wo.steps.slice(0,wo.i).filter(x=>x.kind==="ex").length;
  const bar=`<div class="wobar"><i style="width:${Math.round(done/total*100)}%"></i></div>`;
  if(!s){
    const mins=Math.max(1,Math.round((Date.now()-wo.started)/60000)),push=wo.push.reduce((a,b)=>a+b,0);
    el.innerHTML=`<div class="woin">${bar}<p class="wok">Strength ${wo.type} complete</p><h2>Nice work.</h2>
      <p class="wobig">${mins} min</p>${moodPicker(wo.mood||null,"How did the workout go?")}<p>${push?`${push} push-ups in ${wo.push.length} sets will be added to today's push-up total.`:""}</p>
      <div class="backup"><button type="button" id="wosave">Save workout</button><button type="button" class="quiet" id="woquit">Don't save</button></div></div>`;
    el.querySelector("#wosave").onclick=()=>{
      const t=todayIso(),e=Object.assign({},state.entries[t]||{});e.session=true;
      if(push){const sets=(e.pushSets&&e.pushSets.length)?e.pushSets.slice():(num(e.pushups)?[num(e.pushups)]:[]);wo.push.forEach(x=>sets.push(x));e.pushSets=sets;e.pushups=sets.reduce((a,b)=>a+b,0)}
      const md=moodOf(el);if(md){if(!e.mood)e.mood=md}state.entries[t]=e;state.workouts.push({id:Date.now(),date:t,type:wo.type,minutes:mins,push,mood:md||undefined});
      woEnd();persist("Workout saved.");
    };
    el.querySelector("#woquit").onclick=()=>{if(confirm("Close without saving?"))woEnd()};
    beep();return;
  }
  const quit=`<button type="button" class="link woquit" id="woquit">End workout</button>`;
  if(s.kind==="rest"){
    const tick=()=>{const left=Math.max(0,Math.ceil((wo.endsAt-Date.now())/1000));const t=el.querySelector("#wotime");if(t)t.textContent=left;if(left<=0){beep();woNext()}};
    el.innerHTML=`<div class="woin">${bar}<p class="wok">Rest</p><p class="wobig" id="wotime" aria-live="polite">${s.secs}</p><p>Next: <strong>${esc(s.next)}</strong></p>
      <div class="backup"><button type="button" class="quiet" id="woadd">+15 sec</button><button type="button" id="woskip">Skip rest</button></div>${quit}</div>`;
    el.querySelector("#woadd").onclick=()=>{wo.endsAt+=15000;tick()};el.querySelector("#woskip").onclick=woNext;
    woTimer=setInterval(tick,250);
  }else{
    el.innerHTML=`<div class="woin">${bar}<p class="wok">Strength ${wo.type}, round ${s.round} of ${WO_ROUNDS}</p><h2>${esc(s.n)}</h2><p class="wobig sm">${esc(s.r)}</p>${vidLink(s.n,"Watch how to do it")}
      ${s.push?`<div class="wopush"><span>Reps done</span><span class="stepper"><button type="button" id="wom" aria-label="Fewer reps">−</button><b id="wor">${wo.reps}</b><button type="button" id="wop" aria-label="More reps">+</button></span></div>`:""}
      ${s.hold?`<p><button type="button" class="quiet" id="wohold">${wo.endsAt?"":"Start "+s.hold+"-second timer"}</button></p>`:""}
      <div class="backup"><button type="button" id="wodone">Done</button></div>${quit}</div>`;
    if(s.push){el.querySelector("#wom").onclick=()=>{wo.reps=Math.max(0,wo.reps-1);el.querySelector("#wor").textContent=wo.reps};el.querySelector("#wop").onclick=()=>{wo.reps=Math.min(99,wo.reps+1);el.querySelector("#wor").textContent=wo.reps}}
    if(s.hold){const hb=el.querySelector("#wohold");const tick=()=>{const left=Math.max(0,Math.ceil((wo.endsAt-Date.now())/1000));hb.textContent=left>0?left+" sec left":"Time! Tap Done";if(left<=0){clearInterval(woTimer);woTimer=null;beep()}};
      hb.onclick=()=>{if(woTimer)return;wo.endsAt=Date.now()+s.hold*1000;tick();woTimer=setInterval(tick,250)}}
    el.querySelector("#wodone").onclick=woNext;
  }
  el.querySelector("#woquit").onclick=()=>{if(confirm("End this workout? Nothing will be saved."))woEnd()};
}
function workoutButton(plan){
  if(plan.fight)return fightButton(plan);
  if(plan.cls)return classButton(plan);
  const m=plan.label.match(/Strength (A|B)/),last=state.workouts.filter(x=>x.date===todayIso()).length;
  return`<div class="backup" style="margin-top:10px">${m?`<button type="button" data-wo="${m[1]}">Start guided Strength ${m[1]}</button>`:`<button type="button" class="quiet" data-wo="A">Guided Strength A</button><button type="button" class="quiet" data-wo="B">Guided Strength B</button>`}</div>${last?`<p class="foot">Guided workout done today ✓</p>`:""}`;
}
function bindRoutineExtras(){document.querySelectorAll("[data-wo]").forEach(b=>b.addEventListener("click",()=>startWorkout(b.dataset.wo)));bindFightExtras()}
