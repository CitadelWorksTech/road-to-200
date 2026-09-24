// Forgeway: golf.js
// Disc golf scorecard, course stats and GPS throw measuring.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- disc golf ----------
function vsPar(n){return n==null?"–":n===0?"E":(n>0?"+"+n:""+n)}
function roundPar(r){return r.holesData&&r.holesData.length?r.holesData.reduce((a,h)=>a+h.par,0):num(r.par)}
function roundScore(r){return r.holesData&&r.holesData.length?r.holesData.reduce((a,h)=>a+h.s,0):num(r.score)}
function roundHoles(r){return r.holesData&&r.holesData.length?r.holesData.length:num(r.holes)}
function roundDiff(r){const p=roundPar(r),s=roundScore(r);return p!=null&&s!=null?s-p:null}
function courses(){return [...new Set(state.rounds.map(r=>r.course).filter(Boolean))].sort()}
function roundsInWeek(w){return state.rounds.filter(r=>weekOf(r.date)===w).length}
function golfStreak(){let w=weekOf(todayIso());if(!roundsInWeek(w))w--;let c=0;while(c<520&&roundsInWeek(w)){c++;w--}return c}
function saveQuiet(){state.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}render();nativeSync();autoBackup()}
function lastPars(course,n){const r=state.rounds.filter(x=>x.course===course&&x.holesData&&x.holesData.length===n).sort((a,b)=>b.date.localeCompare(a.date))[0];return r?r.holesData.map(h=>h.par):null}

function golfChart(rs){
  const list=rs.filter(r=>roundDiff(r)!=null).slice(0,20).reverse();
  if(list.length<2)return"";
  const W=cw(),H=180,L=36,R=12,T=14,B=26,bw=(W-L-R)/list.length;
  const ds=list.map(roundDiff),mx=Math.max(3,...ds.map(Math.abs));const lim=Math.ceil(mx/3)*3;
  const Y=v=>T+(lim-v)/(2*lim)*(H-T-B);
  let g=`<line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="1.5"/>`;
  for(const v of[-lim,0,lim])g+=`<text x="${L-6}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="var(--muted)">${vsPar(v)}</text>`;
  list.forEach((r,i)=>{const d=ds[i],x=L+i*bw+bw*.15,y=Math.min(Y(0),Y(d)),h=Math.max(2,Math.abs(Y(d)-Y(0)));
    g+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw*.7).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${d<=0?"var(--sage)":"var(--amber)"}"><title>${r.date} ${esc(r.course||"")}: ${vsPar(d)}</title></rect>`});
  g+=`<text x="${L}" y="${H-8}" font-size="11" fill="var(--muted)">Older</text><text x="${W-R}" y="${H-8}" text-anchor="end" font-size="11" fill="var(--muted)">Latest</text>`;
  return`<div class="pushchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Score versus par, last ${list.length} rounds" font-family="Barlow, system-ui, sans-serif">${g}</svg></div>`;
}

function golfPanel(){
  const t=todayIso(),w=weekOf(t),d=state.draft;
  const rs=state.rounds.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
  const diffs=rs.map(roundDiff).filter(v=>v!=null);
  const last5=avg(diffs.slice(0,5));
  const cl=`<datalist id="courselist">${courses().map(c=>`<option value="${esc(c)}">`).join("")}</datalist>`;
  let card;
  if(d){
    const played=d.holes.filter(h=>h.s>0),strokes=played.reduce((a,h)=>a+h.s,0),diff=played.reduce((a,h)=>a+h.s-h.par,0);
    card=`<h2>${esc(d.course||"Round in progress")}</h2>
    <p class="status" style="margin-top:0">${played.length?`Thru ${played.length} of ${d.holes.length}: <strong>${vsPar(diff)}</strong>, ${strokes} throws.`:`${d.holes.length} holes. Tap + on throws to record each hole.`}</p>
    <div class="scorecard">
      <div class="hole head"><span>#</span><span>Par</span><span>Throws</span><span></span></div>
      ${d.holes.map((h,i)=>`<div class="hole${h.s?" played":""}">
        <span class="hn">${i+1}</span>
        <span class="stepper"><button type="button" data-h="${i}" data-f="par" data-d="-1" aria-label="Hole ${i+1} par down">−</button><b>${h.par}</b><button type="button" data-h="${i}" data-f="par" data-d="1" aria-label="Hole ${i+1} par up">+</button></span>
        <span class="stepper"><button type="button" data-h="${i}" data-f="s" data-d="-1" aria-label="Hole ${i+1} throws down">−</button><b>${h.s||"–"}</b><button type="button" data-h="${i}" data-f="s" data-d="1" aria-label="Hole ${i+1} throws up">+</button></span>
        <span class="hd ${h.s?(h.s-h.par<0?"down":h.s-h.par>0?"up":""):""}">${h.s?vsPar(h.s-h.par):""}</span>
      </div>${holeExtras(h,i)}`).join("")}
    </div>
    <p class="foot">The first tap on + sets throws to par. Pars are remembered for next time you play this course.</p>
    <div class="backup"><button type="button" id="finish">Finish round</button><button type="button" class="quiet" id="discard">Discard</button>${state.track?"":`<button type="button" class="link" id="golfgps">Track this round's walk with GPS</button>`}</div>`;
  }else{
    card=`<h2>Start a round</h2>
    <form id="gstart" autocomplete="off" style="margin:0;border:0;padding:0">
      <div class="fields">
        <label class="wide">Course<input type="text" name="course" list="courselist" maxlength="60" placeholder="Course name" value="${esc(courses()[0]||"")}"></label>
        <label>Holes<select name="holes"><option>18</option><option>9</option><option>24</option><option>27</option></select></label>
        <label>Default par<input type="number" name="par" value="3" min="2" max="6"></label>
      </div>
      <p class="foot">Keeps score hole by hole on your phone. Walk the course instead of riding.</p>
      <button type="submit">Start round</button><span class="saved" id="msg" role="status"></span>
    </form>`;
  }
  const byCourse={};
  rs.forEach(r=>{const k=(r.course||"Unnamed")+"|"+roundHoles(r);(byCourse[k]=byCourse[k]||[]).push(r)});
  const cRows=Object.entries(byCourse).map(([k,list])=>{const[c,h]=k.split("|");const ds=list.map(roundDiff).filter(v=>v!=null);return{c,h,n:list.length,best:ds.length?Math.min(...ds):null,avg:ds.length?avg(ds):null}}).sort((a,b)=>b.n-a.n);
  return`
  <p class="status">${rs.length?`<strong>${roundsInWeek(w)}</strong> round${roundsInWeek(w)===1?"":"s"} this week. ${golfStreak()?`Played ${golfStreak()} week${golfStreak()>1?"s":""} in a row.`:"Play one this week to start a streak."}`:"Your weekly round counts as cardio. Log it here."}</p>
  <p class="pushstats" style="margin-top:8px"><span>Rounds <b>${rs.length}</b></span><span>Best <b>${diffs.length?vsPar(Math.min(...diffs)):"–"}</b></span><span>Last 5 avg <b>${last5!=null?vsPar(Math.round(last5*10)/10):"–"}</b></span><span>Time played <b>${Math.round(rs.reduce((a,r)=>a+(num(r.minutes)||0),0)/6)/10} hr</b></span></p>
  ${cl}
  <div class="grid" style="margin-top:28px">
    <section class="plan">
      ${card}
      <details style="margin-top:28px">
        <summary>Log a finished round</summary>
        <form id="glog" autocomplete="off" style="border:0;padding:0;margin-top:14px">
          <div class="fields">
            <label>Date<input type="date" name="date" value="${t}" max="${t}"></label>
            <label>Course<input type="text" name="course" list="courselist" maxlength="60"></label>
            <label>Holes<input type="number" name="holes" value="18" min="1" max="36"></label>
            <label>Par<input type="number" name="par" value="54"></label>
            <label>Throws<input type="number" name="score" inputmode="numeric"></label>
            <label>Minutes<input type="number" name="minutes" inputmode="numeric"></label>
            <label class="wide">Note<input type="text" name="note" maxlength="120"></label>
          </div>
          <button type="submit" class="quiet" style="margin-top:12px">Save round</button>
        </form>
      </details>
    </section>
    <section>
      <h2>Score vs par</h2>
      ${golfChart(rs)||`<p class="empty">Play two rounds to see a trend. Green is at or under par, amber is over.</p>`}
      <div class="block">
        <h2>Courses</h2>
        ${cRows.length?`<div class="tablewrap"><table><thead><tr><th>Course</th><th>Holes</th><th>Rounds</th><th>Best</th><th>Avg</th></tr></thead>
        <tbody>${cRows.map(r=>`<tr><td>${esc(r.c)}</td><td>${r.h}</td><td>${r.n}</td><td>${vsPar(r.best)}</td><td>${r.avg!=null?vsPar(Math.round(r.avg*10)/10):"–"}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty">Courses you play show up here with your best and average.</p>`}
      </div>
      <div class="history">
        <h2>Recent rounds</h2>
        ${rs.length?`<div class="tablewrap"><table><thead><tr><th>Day</th><th>Course</th><th>Holes</th><th>Throws</th><th>Vs par</th><th>Time</th><th></th><th>Note</th></tr></thead>
        <tbody>${rs.slice(0,25).map(r=>{const df=roundDiff(r);return`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.course||"–")}</td><td>${dash(roundHoles(r))}</td><td>${dash(roundScore(r))}</td><td class="${df==null?"":df<=0?"down":"up"}">${vsPar(df)}</td><td>${r.minutes?r.minutes+" min":"–"}</td><td><button class="link" data-rdel="${r.id}">Delete</button></td><td>${esc(r.note)}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="empty">No rounds yet.</p>`}
      </div>
    </section>
  </div>`;
}

function bindGolf(){
  const st=document.getElementById("gstart");
  if(st)st.addEventListener("submit",ev=>{
    ev.preventDefault();
    const course=st.elements.course.value.trim(),n=parseInt(st.elements.holes.value,10)||18,dp=Math.min(6,Math.max(2,parseInt(st.elements.par.value,10)||3));
    const pars=lastPars(course,n)||Array(n).fill(dp);
    state.draft={course,date:todayIso(),started:Date.now(),holes:pars.map(p=>({par:p,s:0}))};
    saveQuiet();window.scrollTo&&window.scrollTo(0,0);
  });
  document.querySelectorAll("[data-h]").forEach(b=>b.addEventListener("click",()=>{
    const d=state.draft;if(!d)return;const h=d.holes[+b.dataset.h],dv=+b.dataset.d;
    if(b.dataset.f==="par")h.par=Math.min(6,Math.max(2,h.par+dv));
    else h.s=h.s?Math.max(0,Math.min(15,h.s+dv)):(dv>0?h.par:Math.max(1,h.par-1));
    saveQuiet();
  }));
  const fin=document.getElementById("finish");
  if(fin)fin.addEventListener("click",()=>{
    const d=state.draft,played=d.holes.filter(h=>h.s>0);
    if(!played.length){alert("Record at least one hole before finishing.");return}
    if(played.length<d.holes.length&&!confirm("Only "+played.length+" of "+d.holes.length+" holes have scores. Save just those holes?"))return;
    const minutes=Math.max(1,Math.round((Date.now()-d.started)/60000));
    state.rounds.push({id:Date.now(),date:d.date,course:d.course,holesData:played.map(h=>{const o={par:h.par,s:h.s};if(h.fw===true||h.fw===false)o.fw=h.fw;if(h.putts)o.putts=h.putts;return o}),minutes:minutes<=600?minutes:null});
    state.draft=null;persist("Round saved.");
  });
  const gg=document.getElementById("golfgps");if(gg)gg.addEventListener("click",()=>startTrack((state.draft&&state.draft.course)||"Disc golf course"));
  const dis=document.getElementById("discard");
  if(dis)dis.addEventListener("click",()=>{if(confirm("Discard this round? Scores entered so far will be lost.")){state.draft=null;saveQuiet()}});
  const lg=document.getElementById("glog");
  if(lg)lg.addEventListener("submit",ev=>{
    ev.preventDefault();const E=lg.elements,sc=num(E.score.value);
    if(sc==null){alert("Enter your total throws.");return}
    state.rounds.push({id:Date.now(),date:E.date.value||todayIso(),course:E.course.value.trim(),holes:num(E.holes.value),par:num(E.par.value),score:sc,minutes:num(E.minutes.value),note:E.note.value.trim()||undefined});
    persist("Round saved.");
  });
  document.querySelectorAll("[data-rdel]").forEach(b=>b.addEventListener("click",()=>{
    if(!confirm("Delete this round?"))return;state.rounds=state.rounds.filter(r=>String(r.id)!==b.dataset.rdel);persist("Round deleted.");
  }));
}

// ---------- disc golf stats + throw measuring ----------
function golfStats(){
  let fwN=0,fwY=0,putts=0,puttHoles=0;
  for(const r of state.rounds)for(const h of (r.holesData||[])){if(h.fw===true||h.fw===false){fwN++;if(h.fw)fwY++}if(h.putts>0){putts+=h.putts;puttHoles++}}
  const th=state.throws.slice().sort((a,b)=>b.id-a.id),last10=th.slice(0,10).map(t=>t.feet);
  return{fw:fwN?Math.round(fwY/fwN*100):null,fwN,putt:putts?Math.round(puttHoles/putts*100):null,putts,puttHoles,avgPutts:puttHoles?r1(putts/puttHoles):null,
    longest:th.length?Math.max(...th.map(t=>t.feet)):null,avg10:last10.length?Math.round(avg(last10)):null,th};
}
let gm={phase:"idle",tee:null,cur:null,acc:null,samples:[],watch:null,result:null};
function gmStop(){if(gm.watch!=null)navigator.geolocation.clearWatch(gm.watch);gm.watch=null}
function gmAvg(){const good=gm.samples.filter(s=>s.acc<=25);const use=good.length?good:gm.samples;if(!use.length)return null;
  let w=0,la=0,lo=0;use.forEach(s=>{const k=1/Math.max(1,s.acc*s.acc);w+=k;la+=s.lat*k;lo+=s.lon*k});return{p:[la/w,lo/w],acc:Math.round(Math.min(...use.map(s=>s.acc)))}}
function gmWatch(){
  if(!("geolocation" in navigator)){alert("GPS isn't available here.");return false}
  gmStop();gm.watch=navigator.geolocation.watchPosition(p=>{const c=p.coords;gm.acc=Math.round(c.accuracy);gm.cur=[c.latitude,c.longitude];gm.samples.push({lat:c.latitude,lon:c.longitude,acc:c.accuracy});if(gm.samples.length>12)gm.samples.shift();gmLive()},()=>{gm.acc=null;gmLive()},{enableHighAccuracy:true,maximumAge:0,timeout:30000});
  keepAwake();return true;
}
function gmLive(){
  const el=document.getElementById("gmlive");if(!el)return;
  const acc=gm.acc==null?"Looking for GPS…":`GPS ±${gm.acc} m${gm.acc>15?" (wait for it to settle)":""}`;
  if(gm.phase==="walk"&&gm.tee&&gm.cur)el.textContent=`${Math.round(hav(gm.tee.p,gm.cur)*3.28084)} ft from the tee. ${acc}`;else el.textContent=acc;
}
async function gmMark(which){
  const btn=document.getElementById(which==="tee"?"gmtee":"gmdisc");if(btn){btn.disabled=true;btn.textContent="Hold still…"}
  gm.samples=gm.samples.slice(-2);await new Promise(r=>setTimeout(r,4000));
  const a=gmAvg();if(!a){alert("No GPS fix yet. Try again in a few seconds.");render();return}
  if(which==="tee"){gm.tee=a;gm.phase="walk"}else{gm.result={feet:Math.round(hav(gm.tee.p,a.p)*3.28084),err:Math.round((gm.tee.acc+a.acc)*3.28084/2)};gm.phase="done";gmStop()}
  render();
}
function golfExtras(){
  const g=golfStats();
  let meas;
  if(gm.phase==="idle")meas=`<p>Stand on the tee and tap <strong>Mark tee</strong>. Throw, walk to your disc, then tap <strong>Mark disc</strong>.</p><div class="backup"><button type="button" id="gmstart">Mark tee</button></div>`;
  else if(gm.phase==="tee")meas=`<p id="gmlive" class="foot">Looking for GPS…</p><div class="backup"><button type="button" id="gmtee">Mark tee here</button><button type="button" class="link" id="gmcancel">Cancel</button></div>`;
  else if(gm.phase==="walk")meas=`<p>Tee marked. Throw, then walk to your disc.</p><p id="gmlive" class="foot"></p><div class="backup"><button type="button" id="gmdisc">Mark disc here</button><button type="button" class="link" id="gmcancel">Cancel</button></div>`;
  else meas=`<p class="wobig" style="margin:0">${gm.result.feet} ft</p><p class="foot">Give or take about ${gm.result.err} ft (GPS).</p>
    <div class="fields"><label>Disc (optional)<input type="text" id="gmdiscname" maxlength="40" list="disclist"></label><label>Course<input type="text" id="gmcourse" list="courselist" maxlength="60" value="${esc(courses()[0]||"")}"></label></div>
    <datalist id="disclist">${[...new Set(state.throws.map(t=>t.disc).filter(Boolean))].map(d=>`<option value="${esc(d)}">`).join("")}</datalist>
    <div class="backup"><button type="button" id="gmsave">Save throw</button><button type="button" class="quiet" id="gmcancel">Discard</button></div>`;
  return`<div class="grid" style="margin-top:44px">
    <section class="plan">
      <h2>Measure a throw</h2>${meas}
      <p class="foot">Keep the app open while measuring. GPS is usually good to about 10–30 feet, so measure drives rather than putts.</p>
    </section>
    <section>
      <h2>Your stats</h2>
      <div class="targets" style="grid-template-columns:repeat(3,1fr)">
        <div><b>${g.fw!=null?g.fw+"%":"–"}</b>fairways hit${g.fwN?` (${g.fwN})`:""}</div>
        <div><b>${g.putt!=null?g.putt+"%":"–"}</b>circle 1 putting</div>
        <div><b>${g.avgPutts!=null?g.avgPutts:"–"}</b>putts per hole</div>
        <div><b>${g.longest!=null?g.longest+" ft":"–"}</b>longest throw</div>
        <div><b>${g.avg10!=null?g.avg10+" ft":"–"}</b>avg last 10</div>
        <div><b>${g.th.length}</b>throws measured</div>
      </div>
      <p class="foot">Fairway and putting stats come from the Fairway and C1 putts buttons on the scorecard. C1 putting assumes your last putt on each hole went in.</p>
      ${g.th.length?`<div class="tablewrap"><table><thead><tr><th>Day</th><th>Distance</th><th>Disc</th><th>Course</th><th></th></tr></thead>
      <tbody>${g.th.slice(0,15).map(t=>`<tr><td>${fmtDate(t.date)}</td><td>${t.feet} ft</td><td>${esc(t.disc||"–")}</td><td>${esc(t.course||"–")}</td><td><button type="button" class="link" data-tdel="${t.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`:""}
    </section>
  </div>`;
}
function bindGolfExtras(){
  const on=(id,f)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",f)};
  on("gmstart",()=>{if(gmWatch()){gm.phase="tee";gm.samples=[];render()}});
  on("gmtee",()=>gmMark("tee"));on("gmdisc",()=>gmMark("disc"));
  on("gmcancel",()=>{gmStop();gm={phase:"idle",tee:null,cur:null,acc:null,samples:[],watch:null,result:null};render()});
  on("gmsave",()=>{const d=document.getElementById("gmdiscname").value.trim(),c=document.getElementById("gmcourse").value.trim();
    state.throws.push({id:Date.now(),date:todayIso(),feet:gm.result.feet,disc:d||undefined,course:c||undefined});gm={phase:"idle",tee:null,cur:null,acc:null,samples:[],watch:null,result:null};persist("Throw saved.")});
  document.querySelectorAll("[data-tdel]").forEach(b=>b.addEventListener("click",()=>{if(confirm("Delete this throw?")){state.throws=state.throws.filter(t=>String(t.id)!==b.dataset.tdel);persist("Throw deleted.")}}));
  document.querySelectorAll("[data-fw]").forEach(b=>b.addEventListener("click",()=>{const h=state.draft&&state.draft.holes[+b.dataset.fw];if(!h)return;h.fw=h.fw===true?false:h.fw===false?null:true;saveQuiet()}));
  document.querySelectorAll("[data-pt]").forEach(b=>b.addEventListener("click",()=>{const h=state.draft&&state.draft.holes[+b.dataset.pt];if(!h)return;h.putts=Math.max(0,Math.min(6,(h.putts||0)+(+b.dataset.d)));saveQuiet()}));
  gmLive();
}
function holeExtras(h,i){
  if(!h.s)return"";
  const fw=h.fw===true?"Hit":h.fw===false?"Missed":"–";
  return`<div class="hole-x"><span>Fairway <button type="button" class="chip ${h.fw===true?"yes":h.fw===false?"no":""}" data-fw="${i}" aria-label="Hole ${i+1} fairway: ${fw}. Tap to change">${fw}</button></span>
    <span>C1 putts <span class="stepper sm"><button type="button" data-pt="${i}" data-d="-1" aria-label="Hole ${i+1} fewer putts">−</button><b>${h.putts||0}</b><button type="button" data-pt="${i}" data-d="1" aria-label="Hole ${i+1} more putts">+</button></span></span></div>`;
}
