// Forgeway: food.js
// Food log, barcode lookup, water tracker and mood insights.
// All app scripts share one global scope and load in the order listed in index.html.
'use strict';

// ---------- v4: food log, water, mood insights, share cards, automatic backup ----------
const MEALS=[["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snack","Snacks"]];
function foodsState(){const f=state.foods||{};return{saved:Array.isArray(f.saved)?f.saved:[],log:f.log&&typeof f.log==="object"?f.log:{},scans:f.scans||0}}
function foodDay(d){return foodsState().log[d]||[]}
function foodTotals(d){const l=foodDay(d);return{cal:Math.round(l.reduce((a,x)=>a+(x.cal||0)*(x.qty||1),0)),pro:Math.round(l.reduce((a,x)=>a+(x.pro||0)*(x.qty||1),0)),n:l.length}}
function mealNow(){const h=new Date().getHours()+new Date().getMinutes()/60;return h<10.5?"breakfast":h<15?"lunch":h<20.5?"dinner":"snack"}
function waterGoal(){return num(state.settings.waterGoal)||100}
function setFoods(f){state.foods=f}
function syncFoodEntry(d){
  const t=foodTotals(d),e=Object.assign({},state.entries[d]||{});
  if(t.n){e.calories=t.cal;e.protein=t.pro;e.foodAuto=true}else if(e.foodAuto){delete e.calories;delete e.protein;delete e.foodAuto}
  commit(d,e);
}
function addFood(d,item){const f=foodsState();const l=(f.log[d]||[]).slice();l.push(Object.assign({id:Date.now()+Math.floor(Math.random()*1000)},item));f.log=Object.assign({},f.log,{[d]:l});setFoods(f);syncFoodEntry(d)}
function removeFood(d,id){const f=foodsState();const l=(f.log[d]||[]).filter(x=>String(x.id)!==String(id));const log=Object.assign({},f.log);if(l.length)log[d]=l;else delete log[d];f.log=log;setFoods(f);syncFoodEntry(d)}
function saveFavorite(item){const f=foodsState();if(f.saved.some(s=>s.name.toLowerCase()===item.name.toLowerCase()))return false;f.saved=f.saved.concat([{id:Date.now(),name:item.name,cal:item.cal,pro:item.pro||0,uses:0}]);setFoods(f);return true}
function addWater(d,oz){const e=Object.assign({},state.entries[d]||{});e.waterOz=Math.max(0,(num(e.waterOz)||0)+oz);e.water=e.waterOz>=waterGoal();if(!e.waterOz){delete e.waterOz;delete e.water}commit(d,e)}

let fDate=todayIso(),foodPrefill=null;
function foodPanel(){
  const S=state.settings,t=todayIso(),d=fDate,f=foodsState(),tot=foodTotals(d),e=state.entries[d]||{};
  const calLeft=S.calories-tot.cal,oz=num(e.waterOz)||0,wg=waterGoal();
  const favs=f.saved.slice().sort((a,b)=>(b.uses||0)-(a.uses||0)||a.name.localeCompare(b.name));
  const pf=foodPrefill||{};
  const bar=(v,max,cls)=>`<div class="pbar ${cls||""}"><i style="width:${Math.min(100,Math.round(v/Math.max(1,max)*100))}%"></i></div>`;
  return`<div class="daynav"><button type="button" class="quiet" data-fday="-1" aria-label="Previous day">‹</button><b>${d===t?"Today":fmtDate(d)}</b><button type="button" class="quiet" data-fday="1" aria-label="Next day" ${d>=t?"disabled":""}>›</button></div>
  <div class="grid" style="margin-top:18px">
    <section class="plan">
      <h2>${calLeft>=0?`${calLeft.toLocaleString()} calories left`:`${(-calLeft).toLocaleString()} calories over`}</h2>
      ${bar(tot.cal,S.calories,calLeft<0?"over":"")}
      <p class="gmeta"><span>${tot.cal.toLocaleString()} eaten</span><span>Target ${S.calories.toLocaleString()}</span></p>
      <p style="margin:14px 0 4px"><strong>${tot.pro} g</strong> protein of ${S.protein} g${tot.pro>=S.protein?" ✓":""}</p>
      ${bar(tot.pro,S.protein,"pro")}
      <div class="block" style="margin-top:28px">
        <h2>Water</h2>
        <p style="margin:0 0 6px"><strong>${oz} oz</strong> of ${wg} oz${oz>=wg?" ✓":""}</p>
        ${bar(oz,wg,"water")}
        <div class="backup" style="margin-top:10px"><button type="button" class="quiet" data-water="8">+8 oz</button><button type="button" class="quiet" data-water="16">+16 oz</button><button type="button" class="quiet" data-water="24">+24 oz</button>${oz?`<button type="button" class="link" data-water="-8">Undo 8</button>`:""}</div>
      </div>
      ${favs.length?`<div class="block"><h2>Quick add</h2><p class="foot" style="margin-top:0">Tap a favorite to add it to ${MEALS.find(m=>m[0]===mealNow())[1].toLowerCase()}.</p>
        <div class="favs">${favs.slice(0,16).map(x=>`<button type="button" class="chip fav" data-fav="${x.id}"><b>${esc(x.name)}</b><small>${x.cal} cal${x.pro?` · ${x.pro} g`:""}</small></button>`).join("")}</div></div>`:""}
      <form id="foodadd" autocomplete="off" class="block">
        <h2>Add food</h2>
        <div class="backup" style="margin:0 0 12px"><label class="filebtn quiet">📷 Scan barcode<input type="file" id="barcodepic" accept="image/*" capture="environment"></label><button type="button" class="link" id="barcodetype">Type a barcode number</button></div>
        ${pf.note?`<p class="note" style="margin:0 0 12px">${esc(pf.note)}</p>`:""}
        <div class="fields">
          <label class="wide">Food<input type="text" name="name" maxlength="60" required value="${esc(pf.name||"")}" list="foodlist"></label>
          <label>Calories<input type="number" name="cal" inputmode="numeric" required value="${pf.cal!=null?pf.cal:""}"></label>
          <label>Protein (g)<input type="number" name="pro" inputmode="decimal" value="${pf.pro!=null?pf.pro:""}"></label>
          <label>Servings<input type="number" name="qty" step="0.25" min="0.25" value="1" inputmode="decimal"></label>
          <label>Meal<select name="meal">${MEALS.map(([k,l])=>`<option value="${k}" ${k===mealNow()?"selected":""}>${l}</option>`).join("")}</select></label>
        </div>
        <datalist id="foodlist">${favs.map(x=>`<option value="${esc(x.name)}">`).join("")}</datalist>
        <div class="checks"><label><input type="checkbox" name="fav" ${pf.name?"checked":""}>Save as a favorite</label></div>
        <button type="submit">Add</button><span class="saved" id="msg" role="status"></span>
      </form>
    </section>
    <section>
      <h2>${d===t?"Today's":fmtDate(d)} food</h2>
      ${MEALS.map(([k,l])=>{const items=foodDay(d).filter(x=>(x.meal||"snack")===k);if(!items.length)return"";const mc=items.reduce((a,x)=>a+(x.cal||0)*(x.qty||1),0);
        return`<div class="meal"><div class="mealhead"><h3>${l}</h3><span>${Math.round(mc)} cal</span></div>${items.map(x=>`<div class="fitem"><span><b>${esc(x.name)}</b>${x.qty&&x.qty!==1?` <small>× ${x.qty}</small>`:""}<small>${Math.round(x.cal*(x.qty||1))} cal${x.pro?` · ${Math.round(x.pro*(x.qty||1))} g protein`:""}</small></span><span class="factions">${f.saved.some(s=>s.name.toLowerCase()===x.name.toLowerCase())?"":`<button type="button" class="link" data-favit="${x.id}" aria-label="Save ${esc(x.name)} as favorite">★</button>`}<button type="button" class="link" data-fdel="${x.id}" aria-label="Remove ${esc(x.name)}">✕</button></span></div>`).join("")}</div>`}).join("")||`<p class="empty">Nothing logged ${d===t?"yet today":"on this day"}. Scan a barcode, tap a favorite, or type it in.</p>`}
      ${f.saved.length?`<details class="block" style="border-top:0"><summary style="font-size:19px">Manage favorites (${f.saved.length})</summary>${f.saved.map(x=>`<div class="fitem"><span><b>${esc(x.name)}</b><small>${x.cal} cal · ${x.pro||0} g</small></span><button type="button" class="link" data-favdel="${x.id}">Remove</button></div>`).join("")}</details>`:""}
    </section>
  </div>`;
}
async function lookupBarcode(code){
  code=String(code||"").replace(/\D/g,"");if(code.length<8){alert("That doesn't look like a full barcode number.");return}
  say("Looking up "+code+"…");
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`);
    const j=await r.json();
    if(!j||j.status!==1||!j.product){foodPrefill={note:`No match for ${code} in Open Food Facts. Enter it by hand, and save it as a favorite for next time.`};render();return}
    const p=j.product,n=p.nutriments||{},sq=num(p.serving_quantity);
    const kcal=k=>{const v=num(n["energy-kcal"+k]);if(v!=null)return v;const kj=num(n["energy"+k]);return kj!=null?kj/4.184:null};
    let cal=kcal("_serving"),pro=num(n.proteins_serving),basis=p.serving_size?`per serving (${p.serving_size})`:"per serving";
    if(cal==null){const c100=kcal("_100g"),p100=num(n.proteins_100g);if(c100!=null&&sq){cal=c100*sq/100;pro=p100!=null?p100*sq/100:null}else if(c100!=null){cal=c100;pro=p100;basis="per 100 g (no serving size listed, so adjust servings)"}}
    const name=[p.brands&&p.brands.split(",")[0].trim(),p.product_name].filter(Boolean).join(" ")||("Barcode "+code);
    const f=foodsState();f.scans=(f.scans||0)+1;setFoods(f);
    foodPrefill={name,cal:cal!=null?Math.round(cal):null,pro:pro!=null?Math.round(pro*10)/10:null,note:`Found: ${name}, ${basis}. Check the numbers, set servings, then tap Add.`};
    state.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}
    render();try{const ff=document.getElementById("foodadd");if(ff&&ff.scrollIntoView)ff.scrollIntoView({block:"start"})}catch(e){}
  }catch(e){foodPrefill={note:"Couldn't reach Open Food Facts. Check your connection, or enter the food by hand."};render()}
}
async function scanPhoto(file){
  if(!("BarcodeDetector" in window)){const c=prompt("This phone can't read barcodes from photos. Type the barcode number instead:");if(c)lookupBarcode(c);return}
  try{
    say("Reading barcode…");
    const bmp=await createImageBitmap(file),det=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e"]});
    const r=await det.detect(bmp);
    if(!r.length){const c=prompt("No barcode found in that photo. Try again closer and in good light, or type the number:");if(c)lookupBarcode(c);return}
    lookupBarcode(r[0].rawValue);
  }catch(e){const c=prompt("Couldn't read the barcode. Type the number instead:");if(c)lookupBarcode(c)}
}
function bindFood(){
  document.querySelectorAll("[data-fday]").forEach(b=>b.addEventListener("click",()=>{const n=dn(fDate)+(+b.dataset.fday);if(n>dn(todayIso()))return;fDate=iso(n);foodPrefill=null;render()}));
  document.querySelectorAll("[data-water]").forEach(b=>b.addEventListener("click",()=>{addWater(fDate,+b.dataset.water);persist(+b.dataset.water>0?"Water added.":"Water updated.")}));
  document.querySelectorAll("[data-fav]").forEach(b=>b.addEventListener("click",()=>{const f=foodsState(),x=f.saved.find(s=>String(s.id)===b.dataset.fav);if(!x)return;x.uses=(x.uses||0)+1;setFoods(f);
    addFood(fDate,{name:x.name,cal:x.cal,pro:x.pro||0,qty:1,meal:mealNow()});persist(x.name+" added.")}));
  document.querySelectorAll("[data-fdel]").forEach(b=>b.addEventListener("click",()=>{removeFood(fDate,b.dataset.fdel);persist("Removed.")}));
  document.querySelectorAll("[data-favit]").forEach(b=>b.addEventListener("click",()=>{const x=foodDay(fDate).find(i=>String(i.id)===b.dataset.favit);if(x&&saveFavorite(x))persist("Saved to favorites.")}));
  document.querySelectorAll("[data-favdel]").forEach(b=>b.addEventListener("click",()=>{if(!confirm("Remove this favorite?"))return;const f=foodsState();f.saved=f.saved.filter(s=>String(s.id)!==b.dataset.favdel);setFoods(f);persist("Favorite removed.")}));
  const pic=document.getElementById("barcodepic");if(pic)pic.addEventListener("change",ev=>{const fl=ev.target.files&&ev.target.files[0];if(fl)scanPhoto(fl);ev.target.value=""});
  const bt=document.getElementById("barcodetype");if(bt)bt.addEventListener("click",()=>{const c=prompt("Barcode number (the digits under the bars):");if(c)lookupBarcode(c)});
  const f=document.getElementById("foodadd");
  if(f){
    f.elements.name.addEventListener("change",()=>{const x=foodsState().saved.find(s=>s.name.toLowerCase()===f.elements.name.value.trim().toLowerCase());if(x){f.elements.cal.value=x.cal;f.elements.pro.value=x.pro||""}});
    f.addEventListener("submit",ev=>{ev.preventDefault();const E=f.elements,name=E.name.value.trim(),cal=num(E.cal.value);
      if(!name||cal==null){say("Enter a food and its calories.");return}
      const item={name,cal:Math.round(cal),pro:num(E.pro.value)||0,qty:num(E.qty.value)||1,meal:E.meal.value};
      if(E.fav.checked)saveFavorite(item);
      addFood(fDate,item);foodPrefill=null;persist(name+" added.");});
  }
}

// ----- mood insights -----
function moodInsights(){
  const t=dn(todayIso()),days=[];
  for(let n=t-89;n<=t;n++){const d=iso(n),e=state.entries[d];if(e&&e.mood)days.push({d,e})}
  const counts={};MOODS.forEach(([m])=>counts[m]=0);
  days.filter(x=>dn(x.d)>t-30).forEach(x=>{if(counts[x.e.mood]!=null)counts[x.e.mood]++});
  const hi=days.filter(x=>x.e.mood==="🔥"||x.e.mood==="😄"),lo=days.filter(x=>x.e.mood==="😕"||x.e.mood==="😫");
  const lines=[];
  if(hi.length>=3&&lo.length>=3){
    const st=g=>avg(g.map(x=>dayStepsTotal(x.d)).filter(v=>v!=null));
    const pct=(g,f)=>Math.round(g.filter(f).length/g.length*100);
    const sh=st(hi),sl=st(lo);
    if(sh!=null&&sl!=null&&Math.abs(sh-sl)>=800)lines.push(sh>sl?`On 🔥/😄 days you average <strong>${Math.round(sh-sl).toLocaleString()} more steps</strong> than on 😕/😫 days.`:`Your 😕/😫 days actually average ${Math.round(sl-sh).toLocaleString()} more steps. Busy days may be wearing you out.`);
    const sph=pct(hi,x=>x.e.sleep),spl=pct(lo,x=>x.e.sleep);
    if(Math.abs(sph-spl)>=20)lines.push(`You slept 7+ hours on <strong>${sph}%</strong> of good days vs <strong>${spl}%</strong> of rough days.`);
    const wh=pct(hi,x=>x.e.session),wl=pct(lo,x=>x.e.session);
    if(Math.abs(wh-wl)>=20)lines.push(`You worked out on ${wh}% of good days vs ${wl}% of rough days.`);
    const ch=pct(hi,x=>{const c=num(x.e.calories);return c!=null&&c<=state.settings.calories+100}),cl=pct(lo,x=>{const c=num(x.e.calories);return c!=null&&c<=state.settings.calories+100});
    if(Math.abs(ch-cl)>=20)lines.push(`Calories stayed on target ${ch}% of good days vs ${cl}% of rough days.`);
    const wa=pct(hi,x=>x.e.water),wb=pct(lo,x=>x.e.water);
    if(Math.abs(wa-wb)>=20)lines.push(`You hit your water goal ${wa}% of good days vs ${wb}% of rough days.`);
    if(!lines.length)lines.push("No strong patterns yet. Your good and rough days look similar on steps, sleep, workouts and food.");
  }
  const wos=state.workouts.filter(w=>w.mood);
  if(wos.length>=4){const good=wos.filter(w=>w.mood==="🔥"||w.mood==="😄").length;lines.push(`${Math.round(good/wos.length*100)}% of your guided workouts were rated 🔥 or 😄.`)}
  const need=Math.max(0,3-hi.length)+Math.max(0,3-lo.length);
  return`<div class="block"><h2>Mood insights</h2>
    <div class="moodstrip">${MOODS.map(([m,l])=>`<div><span class="em">${m}</span><b>${counts[m]}</b><small>${l}</small></div>`).join("")}</div>
    <p class="foot">Last 30 days of day ratings.</p>
    ${lines.length?`<ul class="insights">${lines.map(x=>`<li>${x}</li>`).join("")}</ul>`:`<p class="empty">Rate your days with an emoji for a couple of weeks. Insights appear once there are at least 3 good (🔥/😄) and 3 rough (😕/😫) days${need?`, about ${need} more to go`:""}.</p>`}
  </div>`;
}
