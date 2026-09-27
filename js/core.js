// Forgeway: core.js
// App state, storage, date and number helpers. Loaded first.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

const DEF={settings:{startDate:"2026-09-23",startWeight:285,goal:255,checkpoint:270,calories:2300,protein:180,weeks:24,heightIn:72},entries:{},rounds:[],draft:null,walks:[],track:null,savedAt:0};
const LS="road255-state";
const STR_A=["Chair squats, 10–15","Incline push-ups (counter), 8–12","Glute bridges, 15","Plank, 20–40 sec"];
const STR_B=["Reverse lunges, 8 per leg","Table or doorframe rows, 10–12","Step-ups (stairs), 10 per leg","Dead bugs, 10 per side"];

function norm(s){
  s=s&&typeof s==="object"?s:{};
  return {settings:Object.assign({},DEF.settings,s.settings||{}),entries:Object.assign({},s.entries||{}),rounds:Array.isArray(s.rounds)?s.rounds:[],draft:s.draft&&Array.isArray(s.draft.holes)?s.draft:null,walks:Array.isArray(s.walks)?s.walks:[],track:s.track&&Array.isArray(s.track.route)?s.track:null,workouts:Array.isArray(s.workouts)?s.workouts:[],throws:Array.isArray(s.throws)?s.throws:[],milestones:s.milestones&&typeof s.milestones==="object"?s.milestones:{},goals:Array.isArray(s.goals)?s.goals:[],sessions:Array.isArray(s.sessions)?s.sessions:[],acts:s.acts&&typeof s.acts==="object"?s.acts:{list:["steps","golf"],custom:[]},foods:s.foods&&typeof s.foods==="object"?s.foods:{saved:[],log:{},scans:0},inbox:s.inbox&&typeof s.inbox==="object"?s.inbox:{items:[],keys:[],init:false},savedAt:s.savedAt||0};
}
function load(){
  let s=null;
  try{s=JSON.parse(document.getElementById("state").textContent)}catch(e){}
  s=norm(s);
  try{const l=JSON.parse(localStorage.getItem(LS)||"null");if(l&&(l.savedAt||0)>s.savedAt)s=norm(l)}catch(e){}
  return s;
}
let state=load();
let readOnly=false;

// ---------- dates ----------
function dn(iso){const[y,m,d]=iso.split("-").map(Number);return Math.round(Date.UTC(y,m-1,d)/864e5)}
function iso(n){const d=new Date(n*864e5);return d.toISOString().slice(0,10)}
function todayIso(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function weekOf(date){return Math.floor((dn(date)-dn(state.settings.startDate))/7)+1}
function fmtDate(date){const d=new Date(dn(date)*864e5);return d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"})}
function phase(w){return w<=4?"Foundation":w<=12?"Build":"Push"}
function stepsTarget(w){w=Math.max(1,w);return Math.min(10000,5500+1000*Math.floor((w-1)/2))}
function pushTarget(w){w=Math.max(1,w);return Math.min(60,20+10*Math.floor((w-1)/2))}
const SURF={counter:"Counter",chair:"Chair or bench",floor:"Floor"};
function parseSets(v){return String(v||"").split(/[^0-9]+/).map(Number).filter(n=>n>0&&n<1000)}
function pushTotal(e){if(!e)return null;if(e.pushSets&&e.pushSets.length)return e.pushSets.reduce((a,b)=>a+b,0);return num(e.pushups)}
function pushHit(d){const t=pushTotal(state.entries[d]);return t!=null&&t>=pushTarget(weekOf(d))}
function pushStreak(){let n=dn(todayIso());if(!pushHit(iso(n)))n--;let c=0;while(pushHit(iso(n))){c++;n--}return c}
// ---------- fight program ----------
// 5-week home prep (Tue + Sun rounds), then Muay Thai classes Tue/Sun, then BJJ on Mondays.
const FIGHT={prepStart:"2026-09-28",classStart:"2026-11-03",bjjStart:"2027-01-04",rest:60,
  weeks:[{r:3,m:2},{r:4,m:2},{r:4,m:3},{r:5,m:3},{r:5,m:3,test:1}]};
function fightPrep(date,dow){
  const n=dn(date)-dn(FIGHT.prepStart);if(n<0||n>=35)return null;
  const wi=Math.floor(n/7),w=FIGHT.weeks[wi];
  if(w.test&&dow===0)return{week:wi+1,rounds:3,mins:2,easy:true};
  return{week:wi+1,rounds:w.r,mins:w.m,test:!!(w.test&&dow===2)};
}
function isHoliday(date){const md=date.slice(5);return md>="11-23"||md<="01-02"}
function dayPlan(date){
  const w=Math.max(1,weekOf(date));const dow=new Date(dn(date)*864e5).getUTCDay();
  const odd=w%2===1;
  const A={label:"Strength A + walk",moves:STR_A},B={label:"Strength B + walk",moves:STR_B};
  if(dow===2||dow===0){
    const f=fightPrep(date,dow);
    if(f)return{label:(f.test?"Fight prep test: ":f.easy?"Easy fight prep: ":"Fight prep: ")+`${f.rounds} × ${f.mins}-min rounds`+(dow===2?" + walk":""),moves:[],fight:f};
    if(date>=FIGHT.classStart)return{label:dow===2?"Muay Thai class, 6:15 PM":"Muay Thai class, 12:30 PM",moves:[],cls:{type:"MT",name:"Muay Thai class",mins:dow===2?75:60}};
  }
  if(dow===1&&date>=FIGHT.bjjStart)return{label:"BJJ gi class, 6:00 PM",moves:[],cls:{type:"BJJ",name:"BJJ class",mins:120}};
  switch(dow){
    case 1:return odd?A:B;
    case 3:return odd?B:A;
    case 5:return odd?A:B;
    case 2:return{label:"Long walk, 30–45 min",moves:[]};
    case 4:return{label:"Walk",moves:[]};
    case 6:return{label:"Disc golf. Walk the course.",moves:[]};
    default:return{label:"Rest or an easy walk. Review the week.",moves:[]};
  }
}

// ---------- numbers ----------
const r1=v=>Math.round(v*10)/10;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function sortedDates(){return Object.keys(state.entries).sort()}
function weights(){return sortedDates().filter(d=>num(state.entries[d].weight)!=null).map(d=>({d,n:dn(d),w:num(state.entries[d].weight)}))}
function num(v){const n=parseFloat(v);return isFinite(n)?n:null}
function rolling(ws,n){const a=ws.filter(x=>x.n<=n&&x.n>n-7).map(x=>x.w);return avg(a)}
function weekly(){
  const by={};
  for(const d of [...new Set([...sortedDates(),...state.walks.map(x=>x.date)])].sort()){const w=weekOf(d);(by[w]=by[w]||[]).push(Object.assign({_hit:pushHit(d),_steps:dayStepsTotal(d)},state.entries[d]||{}))}
  return Object.keys(by).map(Number).sort((a,b)=>a-b).map(w=>{
    const es=by[w];const pick=k=>avg(es.map(e=>num(e[k])).filter(v=>v!=null));
    return{w,weight:pick("weight"),cal:pick("calories"),pro:pick("protein"),steps:pick("_steps"),push:pick("pushups"),waist:(es.map(e=>num(e.waist)).filter(v=>v!=null).pop()??null),weighins:es.filter(e=>num(e.weight)!=null).length,pushHits:es.filter(e=>e._hit).length,pushDays:es.filter(e=>pushTotal(e)!=null).length,sessions:es.filter(e=>e.session).length,days:es.length};
  });
}

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
