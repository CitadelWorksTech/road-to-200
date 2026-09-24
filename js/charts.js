// Forgeway: charts.js
// Weight chart, status line and plan notes.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- chart ----------
function cw(){const w=(document.documentElement.clientWidth||800)-40;return Math.round(Math.min(800,Math.max(340,w)))}
function chart(){
  const S=state.settings,ws=weights();
  const W=cw(),H=W<600?300:330,L=40,R=W<600?40:78,T=16,B=32;
  const s0=dn(S.startDate),span=Math.max(S.weeks*7,(ws.length?ws[ws.length-1].n-s0+7:0));
  const lo=Math.floor(Math.min(S.goal-4,...ws.map(x=>x.w))/5)*5,hi=Math.ceil(Math.max(S.startWeight+3,...ws.map(x=>x.w))/5)*5;
  const X=n=>L+(n-s0)/span*(W-L-R),Y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  let g="";
  for(let v=lo;v<=hi;v+=5){g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="var(--muted)">${v}</text>`}
  for(let wk=0;wk*7<=span;wk+=4){const x=X(s0+wk*7);g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="12" fill="var(--muted)">Wk ${wk+1}</text>`}
  const mile=(v,col,label)=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col}" stroke-width="2"/><text x="${W-R+6}" y="${Y(v)+4}" font-size="13" font-weight="600" fill="${col}">${label}</text>`;
  g+=mile(S.checkpoint,"var(--amber)",W<600?""+S.checkpoint:S.checkpoint+" check");
  g+=mile(S.goal,"var(--sage)",W<600?""+S.goal:S.goal+" goal");
  g+=`<line x1="${X(s0)}" y1="${Y(S.startWeight)}" x2="${X(s0+S.weeks*7)}" y2="${Y(S.goal)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  g+=ws.map(p=>`<circle cx="${X(p.n)}" cy="${Y(p.w)}" r="3" fill="var(--muted)" opacity=".55"><title>${p.d}: ${p.w} lb</title></circle>`).join("");
  if(ws.length){
    const pts=ws.map(p=>[X(p.n),Y(rolling(ws,p.n))]);
    g+=`<path class="avgline" d="M${pts.map(p=>p.map(v=>v.toFixed(1)).join(",")).join(" L")}" fill="none" stroke="var(--route)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last=ws[ws.length-1],la=rolling(ws,last.n),[lx,ly]=pts[pts.length-1];
    g+=`<circle cx="${lx}" cy="${ly}" r="6" fill="var(--paper)" stroke="var(--route)" stroke-width="3"/><text x="${lx}" y="${ly-14}" text-anchor="middle" font-size="14" font-weight="600" fill="var(--route)">${r1(la)}</text>`;
  }else{
    g+=`<circle cx="${X(s0)}" cy="${Y(S.startWeight)}" r="6" fill="var(--paper)" stroke="var(--route)" stroke-width="3"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time with pace line and milestones" font-family="Barlow, system-ui, sans-serif">${g}</svg>`;
}

function pushChart(){
  const t=dn(todayIso()),s0=dn(state.settings.startDate),end=Math.max(t,s0+13),days=42,from=Math.max(s0,end-days+1),n=end-from+1;
  const W=cw(),H=190,L=36,R=12,T=12,B=28,bw=(W-L-R)/n;
  let mx=0;for(let i=0;i<n;i++){const d=iso(from+i);mx=Math.max(mx,pushTarget(weekOf(d)),pushTotal(state.entries[d])||0)}
  mx=Math.ceil((mx+5)/10)*10;const Y=v=>T+(mx-v)/mx*(H-T-B);
  let g="";
  for(let v=0;v<=mx;v+=mx>60?20:10)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="var(--muted)">${v}</text>`;
  let path="";
  for(let i=0;i<n;i++){
    const d=iso(from+i),x=L+i*bw,tot=pushTotal(state.entries[d]),tg=pushTarget(weekOf(d));
    path+=(i?" L":"M")+x.toFixed(1)+","+Y(tg).toFixed(1)+" L"+(x+bw).toFixed(1)+","+Y(tg).toFixed(1);
    if(tot!=null){const hit=tot>=tg;g+=`<rect x="${(x+bw*.15).toFixed(1)}" y="${Y(tot).toFixed(1)}" width="${(bw*.7).toFixed(1)}" height="${(Y(0)-Y(tot)).toFixed(1)}" rx="2" fill="${hit?"var(--sage)":"var(--amber)"}"><title>${d}: ${tot} of ${tg}</title></rect>`}
    if(new Date((from+i)*864e5).getUTCDay()===1)g+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="var(--muted)">${new Date((from+i)*864e5).toLocaleDateString(undefined,{month:"short",day:"numeric",timeZone:"UTC"})}</text>`;
  }
  g+=`<path d="${path}" fill="none" stroke="var(--route)" stroke-width="2.5"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily push-ups against target, last six weeks" font-family="Barlow, system-ui, sans-serif">${g}</svg>`;
}
function pushStatsHtml(){
  const ds=sortedDates().filter(d=>pushTotal(state.entries[d])!=null);
  if(!ds.length)return`<p class="empty">Log sets to see bars here. Green means the day hit its target, amber means it fell short. The blue line is the target.</p>`;
  const best=Math.max(...ds.map(d=>pushTotal(state.entries[d])));
  const hits=ds.filter(pushHit).length;
  const lastSurf=ds.slice().reverse().map(d=>state.entries[d].surface).find(Boolean);
  let bestStreak=0,run=0,prev=null;
  for(const d of ds){const n=dn(d);if(pushHit(d)){run=(prev!=null&&n===prev+1&&run)?run+1:1}else run=0;prev=n;bestStreak=Math.max(bestStreak,run)}
  return`<p class="pushstats"><span>Current streak <b>${pushStreak()}</b></span><span>Best streak <b>${bestStreak}</b></span><span>Days on target <b>${hits}/${ds.length}</b></span><span>Best day <b>${best}</b></span><span>Surface <b>${lastSurf?SURF[lastSurf]:"not set"}</b></span></p>`;
}

// ---------- status & notes ----------
function status(){
  const S=state.settings,ws=weights();
  if(!ws.length)return`Starting at <strong>${S.startWeight} lb</strong>. Log a morning weigh-in to start your line.`;
  const last=ws[ws.length-1],a=r1(rolling(ws,last.n));
  const lost=r1(S.startWeight-a);
  const toCheck=r1(a-S.checkpoint),toGoal=r1(a-S.goal);
  let next=toCheck>0?`<strong>${toCheck} lb</strong> to the ${S.checkpoint} checkpoint`:toGoal>0?`Checkpoint passed. <strong>${toGoal} lb</strong> to ${S.goal}`:`Goal reached. Time to set the next one`;
  return`7-day average <strong>${a} lb</strong>, ${lost>=0?"down "+lost:"up "+(-lost)} from the start. ${next}.`;
}
function notes(){
  const out=[],wk=weekly().filter(x=>x.weight!=null),cur=weekOf(todayIso());
  const done=wk.filter(x=>x.w<cur);
  if(done.length>=3){
    const a=done[done.length-1].weight,b=done[done.length-3].weight;
    if(a-b>-0.5)out.push("Weekly average hasn't dropped in two weeks. Check your logging first, especially weekends. If it's accurate, cut 150–200 calories or add 2,000 daily steps.");
  }
  if(done.length>=2&&done[done.length-1].w>4){
    const d=done[done.length-2].weight-done[done.length-1].weight;
    if(d>2.5)out.push("You lost more than 2.5 lb last week. Add about 200 calories to protect muscle and energy.");
  }
  if(isHoliday(todayIso()))out.push("Holiday stretch. Aim to hold your weight steady until January. That counts as a win.");
  return out.map(t=>`<p class="note">${t}</p>`).join("");
}
