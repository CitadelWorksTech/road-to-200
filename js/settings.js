// Forgeway: settings.js
// Settings page and phone steps settings.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ----- settings page -----
function phoneStepsHtml(){
  const t=todayIso(),e=state.entries[t]||{},url=location.origin+location.pathname;
  return`<section class="setsec"><h2>Phone steps</h2>
    ${hcPanel()}
    <p style="margin:0 0 12px">${num(e.stepsAuto)!=null?`Today's phone total: <strong>${num(e.stepsAuto).toLocaleString()}</strong>${e.stepsAutoAt?`, updated ${new Date(e.stepsAutoAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`:""}.`:"No phone total for today yet."} When a phone total exists, it replaces the day's other step counts, since your phone already counted those steps.</p>
    <form id="phlog" autocomplete="off" style="border:0;padding:0;margin:0">
      <div class="fields"><label>Date<input type="date" name="date" value="${t}" max="${t}"></label><label>Phone total<input type="number" name="steps" inputmode="numeric" placeholder="Steps"></label></div>
      <div class="backup"><button type="submit" class="quiet">Save phone total</button>${num(e.stepsAuto)!=null?`<button type="button" class="link" id="phclear">Clear today's phone total</button>`:""}</div>
    </form>
    ${NATIVE?"":`<details style="margin-top:12px;border-top:0;padding-top:0"><summary style="font-size:19px">Automatic import with Tasker</summary>
      <p class="foot">Any automation that opens this link with a step count imports it:</p><p><code class="url">${esc(url)}?steps=8423</code> <button type="button" class="link" id="copyurl">Copy link</button></p>
      <p class="foot">Add <code>&amp;date=YYYY-MM-DD</code> to set a different day.</p></details>`}
  </section>`;
}
function settingsPage(){
  const S=state.settings,days=Object.keys(state.entries).length;
  return`<div class="top"><div><button type="button" class="link back" id="setback">← Back</button><h1>Settings</h1></div></div>
  <div class="setgrid">
    <section class="setsec"><h2>Profile</h2>
      <form id="profile" autocomplete="off" style="border:0;padding:0;margin:0"><div class="fields">
        <label class="wide">Name<input type="text" name="name" maxlength="40" value="${esc(S.name||"")}" placeholder="Your name"></label>
        <label>Height (in)<input type="number" name="heightIn" value="${S.heightIn}"></label>
        <label class="wide">Header title<input type="text" name="headline" maxlength="30" value="${esc(S.headline||"Road to 200")}"></label>
      </div><button type="submit" class="quiet" style="margin-top:12px">Save profile</button></form>
      <h3>Account</h3>
      <p class="foot" style="margin-top:0">No sign-in needed. Everything is stored on this phone: ${days} days logged, ${state.rounds.length} rounds, ${state.sessions.length} activity sessions, ${state.workouts.length} guided workouts, ${photoCount} photos, ${state.goals.length} goals.</p>
      <p class="foot">Forgeway · ${NATIVE?"Android app":"Web app"}</p>
    </section>
    <section class="setsec"><h2>Plan</h2>
      <form id="settings" style="border:0;padding:0;margin:0">
        <div class="settings">
          <label>Start date<input type="date" name="startDate" value="${S.startDate}"></label>
          <label>Start weight<input type="number" step="0.1" name="startWeight" value="${S.startWeight}"></label>
          <label>Checkpoint<input type="number" step="0.1" name="checkpoint" value="${S.checkpoint}"></label>
          <label>Goal<input type="number" step="0.1" name="goal" value="${S.goal}"></label>
          <label>Calories/day<input type="number" name="calories" value="${S.calories}"></label>
          <label>Protein (g)<input type="number" name="protein" value="${S.protein}"></label>
          <label>Plan length (weeks)<input type="number" name="weeks" value="${S.weeks}"></label>
          <label>Water goal (oz)<input type="number" name="waterGoal" value="${waterGoal()}"></label>
        </div>
        <button type="submit" class="quiet">Save plan</button>
        <p class="foot">Strength days alternate A and B each week. Steps start at 5,500 and rise by 1,000 every two weeks to 10,000. Push-ups start at 20 and rise by 10 every two weeks to 60.</p>
      </form>
    </section>
    ${phoneStepsHtml()}
    <section class="setsec"><h2>Activities</h2><p class="foot" style="margin-top:0">Showing: ${actList().map(id=>actInfo(id).icon+" "+esc(actInfo(id).name)).join(", ")}</p><button type="button" class="quiet" id="actadd">Choose activities</button></section>
    ${SC?`<section class="setsec">${remindersHtml().replace("<h3>Reminders</h3>","<h2>Reminders</h2>").replace("<h3>Home-screen widget</h3>","<h3>Home-screen widget</h3>")}</section>`:""}
    <section class="setsec"><h2>Backup</h2>
      <p class="foot" style="margin-top:0">Export a backup every week or two. Photos aren't included.</p>
      <div class="backup"><button type="button" class="quiet" id="export">Export backup</button><label class="quiet filebtn">Restore backup<input type="file" id="import" accept="application/json,.json"></label></div>
      ${autoBackupHtml()}
      <span class="saved" id="msg" role="status"></span>
    </section>
  </div>`;
}
function bindSettingsPage(){
  document.getElementById("setback").addEventListener("click",()=>{try{history.back()}catch(e){closeSettings()}});
  document.getElementById("export").addEventListener("click",exportData);
  document.getElementById("import").addEventListener("change",ev=>{const fl=ev.target.files&&ev.target.files[0];if(fl)importData(fl);ev.target.value=""});
  const ad=document.getElementById("actadd");if(ad)ad.addEventListener("click",activityPicker);
  const pf=document.getElementById("profile");
  pf.addEventListener("submit",ev=>{ev.preventDefault();const n={...state.settings};n.name=pf.elements.name.value.trim();n.headline=pf.elements.headline.value.trim()||"Road to 200";const h=num(pf.elements.heightIn.value);if(h&&h>0)n.heightIn=h;state.settings=n;persist("Profile saved.")});
  const s=document.getElementById("settings");
  s.addEventListener("submit",ev=>{ev.preventDefault();const n={...state.settings};if(s.elements.startDate.value)n.startDate=s.elements.startDate.value;
    ["startWeight","checkpoint","goal","calories","protein","weeks","waterGoal"].forEach(k=>{const v=num(s.elements[k].value);if(v!=null&&v>0)n[k]=v});state.settings=n;persist("Plan saved.")});
  bindReminders();bindSteps();
}
