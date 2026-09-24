// Forgeway: share.js
// Milestone share cards and automatic backup.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ----- share cards -----
async function shareCard(icon,title,sub){
  const c=document.createElement("canvas");c.width=1080;c.height=1080;const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,1080,1080);g.addColorStop(0,"#1D3440");g.addColorStop(1,"#131B1F");x.fillStyle=g;x.fillRect(0,0,1080,1080);
  x.strokeStyle="rgba(109,176,208,.22)";x.lineWidth=18;x.lineJoin="round";x.lineCap="round";x.beginPath();[[80,180],[300,330],[450,290],[660,560],[790,520],[1000,860]].forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.stroke();
  x.strokeStyle="rgba(230,174,69,.55)";x.lineWidth=6;x.beginPath();x.moveTo(240,745);x.lineTo(840,745);x.stroke();
  x.textAlign="center";x.textBaseline="middle";x.font="220px sans-serif";x.fillStyle="#fff";x.fillText(icon,540,380);
  const fam=`"Barlow Condensed","Arial Narrow",sans-serif`;
  x.fillStyle="#E4EBE8";x.font=`700 88px ${fam}`;
  const words=title.split(" "),lines=[];let cur="";for(const w of words){const t=cur?cur+" "+w:w;if(x.measureText(t).width>900&&cur){lines.push(cur);cur=w}else cur=t}lines.push(cur);
  lines.slice(0,3).forEach((l,i)=>x.fillText(l,540,610+i*96-(lines.length-1)*48));
  x.fillStyle="#97A8AB";x.font=`500 44px ${fam}`;x.fillText(sub,540,820);
  x.fillStyle="#6DB0D0";x.font=`700 46px ${fam}`;x.fillText("FORGEWAY",540,960);
  const blob=await new Promise(r=>c.toBlob(r,"image/png")),fname="forgeway-"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)+".png";
  try{
    if(NATIVE&&FS&&SH){const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(",")[1]);fr.readAsDataURL(blob)});
      const w=await FS.writeFile({path:"share/"+fname,data:b64,directory:"CACHE",recursive:true});await SH.share({title,files:[w.uri],dialogTitle:"Share your milestone"});return}
    const file=new File([blob],fname,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title});return}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();a.remove();
  }catch(e){if(!/cancel|abort/i.test(errText(e)))alert("Couldn't share: "+errText(e))}
}
function shareSub(){const a=currentAvg(),S=state.settings;return a!=null?`${r1(Math.max(0,S.startWeight-a))} lb down · ${fmtDate(todayIso())}`:fmtDate(todayIso())}
function bindShares(){
  document.querySelectorAll("[data-share-ms]").forEach(b=>b.addEventListener("click",()=>{const m=allMilestones().find(x=>x.id===b.dataset.shareMs);if(m)shareCard(m.icon,m.name,shareSub())}));
  document.querySelectorAll("[data-share-goal]").forEach(b=>b.addEventListener("click",()=>{const g=state.goals.find(x=>String(x.id)===b.dataset.shareGoal);if(g)shareCard("🏆",goalLabel(g),"Goal reached · "+fmtDate(g.doneDate||todayIso()))}));
}

// ----- automatic backup (Android: app file that Android backs up to Google) -----
let abT=null;
function autoBackup(){
  if(!(NATIVE&&FS))return;clearTimeout(abT);
  abT=setTimeout(async()=>{try{await FS.writeFile({path:"backups/road200-latest.json",data:JSON.stringify(state),directory:"DATA",encoding:"utf8",recursive:true});try{localStorage.setItem("road200-ab",String(Date.now()))}catch(e){}}catch(e){}},2500);
}
async function checkRestore(){
  if(!(NATIVE&&FS))return;
  const empty=!Object.keys(state.entries).length&&!state.rounds.length&&!state.sessions.length&&!state.goals.length;if(!empty)return;
  try{const r=await FS.readFile({path:"backups/road200-latest.json",directory:"DATA",encoding:"utf8"});const d=JSON.parse(r.data),n=Object.keys(d.entries||{}).length;
    if(n&&confirm(`Found a backup with ${n} days of data. Restore it?`)){state=norm(d);persist("Restored "+n+" days from backup.")}}catch(e){}
}
function autoBackupHtml(){
  if(!(NATIVE&&FS))return"";
  let last=0;try{last=+localStorage.getItem("road200-ab")||0}catch(e){}
  return`<h3>Automatic backup</h3><p class="foot" style="margin-top:0">On. A copy of your data is saved after every change, and Android backs it up to your Google account. Last saved: <strong>${last?new Date(last).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"not yet"}</strong>.</p>
  <p class="foot">Make sure it's allowed: Android <strong>Settings → Google → Backup</strong> (or <strong>Accounts and backup</strong> on Samsung), with <strong>Backup by Google One</strong> turned on. On a new phone, install Forgeway from the Play Store with the same Google account and it offers to restore. Photos aren't included.</p>`;
}
