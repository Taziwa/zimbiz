let zbBusinessMap = new Map();
let zbActiveBusinessId = null;
let zbPage = 0;
let zbSort = "recommended";
let zbSearchTimer = null;
let zbLeafletMap = null;
let zbMarkers = [];

const demoImages = {
  "Harare Plumbing Pros":"https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=82",
  "The Garden Bistro":"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82",
  "Mbare Hardware & Supplies":"https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1200&q=82",
  "Borrowdale Medical Centre":"https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=82",
  "Skyline Events & Decor":"https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1200&q=82",
  "Bulawayo Auto Centre":"https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1200&q=82",
  "Harare Legal Associates":"https://images.unsplash.com/photo-1589994965851-a8f479c573a9?auto=format&fit=crop&w=1200&q=82",
  "Lens & Light Photography":"https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=82"
};

function zbEsc(s=""){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function zbApi(path, opts={}) {
  return fetch(path,{headers:{"Content-Type":"application/json"},...opts}).then(async r=>{
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||"Request failed");
    return data;
  });
}
function zbImageFor(b){ return b.image || demoImages[b.name] || ""; }

function zbRenderBizCard(b, compact=false){
  const saved = JSON.parse(localStorage.getItem("zimbiz_saved")||"[]").includes(String(b.id));
  const image = zbImageFor(b);
  const signal = b.signal || (b.category==="Restaurant" ? "var(--emerald)" : b.category==="Automotive" ? "var(--emerald)" : b.category==="Health" ? "var(--blue)" : "var(--aubergine)");
  return `
  <article class="biz-card" role="listitem" tabindex="0" aria-label="${zbEsc(b.name)}" onclick="viewBiz('${zbEsc(b.id)}')" style="--signal:${signal}">
    ${b.isPremium?`<div class="premium-badge">Premium</div>`:""}
    <div class="biz-thumb" style="min-height:${compact?"130px":"160px"}">
      <div class="biz-thumb-bg has-image" style="background-image:url('${zbEsc(image)}');background-color:${zbEsc(b.bg||"#eee8ff")}"><span>${zbEsc(b.emoji||"🏪")}</span></div>
      <div class="biz-thumb-ov"></div>
      <div class="biz-logo" style="background:#fff">${zbEsc(b.logoEmoji||"🏪")}</div>
      <button class="biz-save ${saved?"saved":""}" onclick="event.stopPropagation();toggleSave('${zbEsc(b.id)}',this)" aria-label="Save">${saved?"♥":"♡"}</button>
      <div class="biz-open-badge ${b.isOpen?"open":"closed"}"><div class="biz-od"></div>${b.isOpen?"Open":"Closed"}</div>
    </div>
    <div class="biz-body">
      <div class="biz-top-row"><div class="biz-name">${zbEsc(b.name)}</div>${b.isVerified?`<div class="verified-badge">✓ Verified</div>`:""}</div>
      <div class="biz-cat"><div class="biz-cat-dot" style="background:${signal}"></div>${zbEsc(b.category)}</div>
      <div class="biz-rating"><span class="biz-stars">${starStr(Number(b.rating||0))}</span><span class="biz-rating-num">${Number(b.rating||0).toFixed(1)}</span><span class="biz-review-count">(${Number(b.reviews||0).toLocaleString()} reviews)</span></div>
      <div class="biz-loc">📍 ${zbEsc(b.suburb||"")}${b.suburb?", ":""}${zbEsc(b.city||"")}</div>
      ${!compact?`<p class="biz-excerpt">${zbEsc(b.desc||b.description||"")}</p>`:""}
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px"><span class="biz-price">${zbEsc(b.price||"$$")} · ${zbEsc(priceLabel(b.price||"$$"))}</span>${(b.tags||[]).slice(0,2).map(t=>`<span style="font-size:10.5px;padding:2px 7px;border-radius:4px;background:var(--aubergine-s);color:var(--aubergine);font-weight:600">${zbEsc(t)}</span>`).join("")}</div>
      <div class="biz-footer">
        <button class="btn-view" onclick="event.stopPropagation();viewBiz('${zbEsc(b.id)}')">View</button>
        ${b.hasWa?`<button class="btn-wa" onclick="event.stopPropagation();whatsAppClick('${zbEsc(b.name)}')">💬 WhatsApp</button>`:""}
        <button class="btn-quote" onclick="event.stopPropagation();openQuoteFor('${zbEsc(b.id)}')">📋 Quote</button>
      </div>
    </div>
  </article>`;
}

function zbRenderFeaturedImages(){
  const fw=document.querySelector(".featured-wide .fw-visual-bg");
  if(fw){
    const b=[...zbBusinessMap.values()].find(x=>x.name==="Victoria Falls Safari Lodge") || [...zbBusinessMap.values()][0];
    const image=zbImageFor(b||{});
    if(image) fw.classList.add("has-image"), fw.style.backgroundImage=`url("${image}")`;
  }
}

async function zbLoadBusinesses(reset=true){
  if(reset) zbPage=0;
  const q=(document.getElementById("bar-search")?.value||"").trim();
  const loc=(document.getElementById("location-search")?.value||"").trim();
  const mainQ=(document.getElementById("main-search")?.value||"").trim();
  const effectiveQ=q||mainQ;
  const params=new URLSearchParams({q:effectiveQ,city:loc,limit:30,skip:zbPage*30,sort:zbSort});
  if(activeFilters.has("open")) params.set("open","1");
  if(activeFilters.has("verified")) params.set("verified","1");
  if(activeFilters.has("wa")) params.set("whatsapp","1");
  if(activeFilters.has("deals")) params.set("deals","1");
  if(activeFilters.has("top")) params.set("top","1");
  try{
    const data=await zbApi(`/api/businesses?${params}`);
    if(reset){
      businesses.splice(0,businesses.length,...data.items);
    }else{
      businesses.push(...data.items);
    }
    businesses.forEach(b=>zbBusinessMap.set(String(b.id),b));
    renderBizGrid();
    document.getElementById("trending-grid").innerHTML=businesses.filter(b=>b.isTrending).slice(0,4).map(b=>zbRenderBizCard(b,true)).join("");
    document.getElementById("biz-shown-count").textContent=`${Math.min(businesses.length,data.total||businesses.length)} businesses`;
    zbUpdateMap(data.items);
    if(data.total) showToast(`🔎 ${data.total.toLocaleString()} businesses match your search`);
  }catch(err){
    console.warn(err);
    showToast("⚠️ Using demo data — database not connected yet.");
  }
}

function renderBizGrid(){ 
  const grid=document.getElementById("biz-grid");
  if(!grid)return;
  const visible=businesses.slice(0,visibleBizCount);
  grid.innerHTML=visible.length?visible.map(b=>zbRenderBizCard(b)).join(""):`<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><div style="font-size:48px">🔍</div><div style="font-family:var(--fn-d);font-size:20px;font-weight:800">No businesses found</div><div style="color:var(--ink-muted);margin:8px 0 20px">Try another search or clear filters.</div><button onclick="clearFilters()" style="padding:10px 24px;border-radius:8px;background:var(--aubergine);color:#fff;font-weight:700">Clear Filters</button></div>`;
  document.getElementById("biz-shown-count").textContent=`${visible.length} businesses`;
}
function renderAll(){
  // Preserve the original renderer for categories/locations/deals/testimonials, but replace business cards with real API data.
  try{
    categories && (document.getElementById("cat-grid").innerHTML=categories.map(c=>`
      <div class="cat-card" role="listitem" tabindex="0" aria-label="${zbEsc(c.name)}" onclick="filterByCat('${zbEsc(c.name)}')">
        <div class="cat-bg" style="background:${c.bg}">${c.emoji}</div><div class="cat-ov"></div>
        <div class="cat-body"><div class="cat-name">${zbEsc(c.name)}</div><div class="cat-count">${c.count} businesses</div></div>
      </div>`).join(""));
    renderSubCats(0);
  }catch(e){}
  renderBizGrid();
  const t=document.getElementById("trending-grid"); if(t) t.innerHTML=businesses.filter(b=>b.isTrending).slice(0,4).map(b=>zbRenderBizCard(b,true)).join("");
  try{
    document.getElementById("location-grid").innerHTML=locations.map(l=>`
      <div class="loc-card ${l.featured?"featured":""}" onclick="filterByLocation('${zbEsc(l.name)}')" role="listitem"><div class="loc-icon">${l.emoji}</div><div class="loc-name">${zbEsc(l.name)}</div><div class="loc-count">${l.count} businesses</div></div>`).join("");
    document.getElementById("deals-grid").innerHTML=deals.map(d=>`<div class="deal-card" onclick="quickSearch('${zbEsc(d.biz)}')"><div class="dc-bg" style="background:${d.bg}">${d.emoji}</div><div class="dc-ov"></div><div class="dc-discount">${zbEsc(d.discount)}</div><div class="dc-timer">⏱ ${zbEsc(d.timer)}</div><div class="dc-body"><div class="dc-biz">${zbEsc(d.biz)}</div><div class="dc-title">${zbEsc(d.title)}</div></div></div>`).join("");
  }catch(e){}
  zbRenderFeaturedImages();
}

function filterByLocation(city){
  const input=document.getElementById("location-search"); if(input) input.value=city;
  zbLoadBusinesses(true);
  document.getElementById("biz-grid")?.closest("section")?.scrollIntoView({behavior:"smooth"});
}
function doSearch(){
  const q=document.getElementById("main-search").value, loc=document.getElementById("location-search").value;
  if(!q&&!loc){showToast("💡 Enter a business type or location to search");return;}
  document.getElementById("bar-search").value=q;
  zbLoadBusinesses(true);
  document.getElementById("biz-grid")?.closest("section")?.scrollIntoView({behavior:"smooth"});
}
function quickSearch(term){document.getElementById("main-search").value=term;document.getElementById("bar-search").value=term;doSearch();}
function filterBusinesses(){clearTimeout(zbSearchTimer);zbSearchTimer=setTimeout(()=>zbLoadBusinesses(true),350);}
function toggleFilter(btn,key){
  if(key==="all"){activeFilters.clear();document.querySelectorAll(".fc").forEach(x=>x.classList.remove("active","emerald"));btn.classList.add("active");zbLoadBusinesses(true);return;}
  if(activeFilters.has(key)){activeFilters.delete(key);btn.classList.remove("active");}
  else {activeFilters.add(key);btn.classList.add("active");}
  zbLoadBusinesses(true);
}
function clearFilters(){activeFilters.clear();document.querySelectorAll(".fc").forEach(b=>b.classList.remove("active","emerald"));zbLoadBusinesses(true);}
function sortBusinesses(method){zbSort=method;zbLoadBusinesses(true);}
function loadMore(){visibleBizCount+=6;zbPage+=1;zbLoadBusinesses(false);}
function selectIntent(btn,type){document.querySelectorAll(".intent-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");const map={service:"Plumber",shop:"Shopping",eat:"Restaurant",stay:"Hotel",pro:"Lawyer"};document.getElementById("main-search").value=map[type]||"";doSearch();}
function filterByCat(cat){document.getElementById("bar-search").value=cat;document.getElementById("main-search").value=cat;zbLoadBusinesses(true);document.getElementById("biz-grid")?.closest("section")?.scrollIntoView({behavior:"smooth"});}
function selectSubCat(btn){document.querySelectorAll(".cat-sub").forEach(b=>b.classList.remove("active"));btn.classList.add("active");if(btn.textContent!=="All"){document.getElementById("bar-search").value=btn.textContent;zbLoadBusinesses(true);}}

function toggleSave(id,btn){
  const key="zimbiz_saved";
  const set=new Set(JSON.parse(localStorage.getItem(key)||"[]").map(String));
  id=String(id);
  if(set.has(id)){set.delete(id);btn.textContent="♡";btn.classList.remove("saved");showToast("Removed from saved businesses");}
  else{set.add(id);btn.textContent="♥";btn.classList.add("saved");showToast("💾 Saved to your businesses");}
  localStorage.setItem(key,JSON.stringify([...set]));
}
function whatsAppClick(name){
  const b=[...zbBusinessMap.values()].find(x=>x.name===name);
  if(b && b.whatsapp){
    const digits=String(b.whatsapp).replace(/[^\d]/g,"");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent("Hi "+b.name+", I found you on ZimBiz.")}`,"_blank");
  }else showToast(`WhatsApp number not available for ${name}`);
}
function openQuoteFor(id){zbActiveBusinessId=String(id);openModal("quoteModal");}
function openBookingFor(id){
  zbActiveBusinessId=String(id);
  const b=zbBusinessMap.get(zbActiveBusinessId);
  if(b && b.services?.length){
    document.getElementById("book-service").innerHTML=b.services.map(s=>`<option>${zbEsc(s)}</option>`).join("");
  }
  openModal("bookingModal");
}

function injectDetailModal(){
  if(document.getElementById("detailModal"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-overlay" id="detailModal"><div class="modal zb-detail"><div class="modal-hd"><span class="modal-title">Business profile</span><button class="modal-close" onclick="closeModal('detailModal')">×</button></div><div class="modal-body" id="detailBody"></div></div></div>`);
  document.getElementById("detailModal").addEventListener("click",e=>{if(e.target.id==="detailModal")closeModal("detailModal")});
}
async function viewBiz(id){
  id=String(id);zbActiveBusinessId=id;
  const cached=zbBusinessMap.get(id);
  if(cached) zbShowDetails({business:cached,reviews:[]});
  try{
    const data=await zbApi(`/api/businesses/${id}`);
    zbBusinessMap.set(id,data.business);
    zbShowDetails(data);
    await zbApi(`/api/businesses/${id}/click`,{method:"POST",body:"{}"}).catch(()=>{});
  }catch(e){}
}
function zbShowDetails(data){
  injectDetailModal();
  const b=data.business,reviews=data.reviews||[];
  const image=zbImageFor(b);
  document.getElementById("detailBody").innerHTML=`
    <div class="zb-detail-hero">
      <div class="zb-detail-cover">${image?`<img src="${zbEsc(image)}" alt="${zbEsc(b.name)}" loading="lazy">`:""}</div>
      <div>
        <div class="zb-detail-name">${zbEsc(b.name)}</div>
        <div class="zb-detail-meta"><span>⭐ ${Number(b.rating||0).toFixed(1)} (${Number(b.reviews||0)} reviews)</span><span>📍 ${zbEsc(b.suburb||"")}${b.suburb?", ":""}${zbEsc(b.city)}</span><span>${b.isOpen?"🟢 Open now":"🔴 Closed"}</span>${b.isVerified?"<span>✅ Verified</span>":""}</div>
        <p style="color:var(--ink-muted);margin-top:10px;line-height:1.65">${zbEsc(b.desc||b.description||"")}</p>
        <div class="zb-detail-actions">
          <button class="zb-action primary" onclick="window.open('tel:${zbEsc(b.phone||"")}')">📞 Call</button>
          ${b.hasWa?`<button class="zb-action wa" onclick="whatsAppClick('${zbEsc(b.name)}')">💬 WhatsApp</button>`:""}
          <button class="zb-action quote" onclick="closeModal('detailModal');openQuoteFor('${zbEsc(b.id)}')">📋 Request Quote</button>
          <button class="zb-action" onclick="closeModal('detailModal');openBookingFor('${zbEsc(b.id)}')">📅 Book</button>
          ${b.lat&&b.lng?`<button class="zb-action" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}','_blank')">🧭 Directions</button>`:""}
        </div>
      </div>
    </div>
    <div class="zb-detail-grid">
      <div class="zb-panel"><h4>Services</h4><div class="zb-list">${(b.services||b.tags||[]).map(s=>`<div>• ${zbEsc(s)}</div>`).join("")||"<div>Contact this business for service details.</div>"}</div></div>
      <div class="zb-panel"><h4>Hours</h4><div class="zb-list">${Object.entries(b.hours||{}).map(([d,h])=>`<div style="display:flex;justify-content:space-between;gap:10px"><span>${zbEsc(d)}</span><strong style="color:var(--ink)">${zbEsc(h)}</strong></div>`).join("")||"<div>Hours not supplied.</div>"}</div></div>
      <div class="zb-panel" style="grid-column:1/-1"><h4>Latest reviews</h4>${reviews.length?reviews.map(r=>`<div class="zb-review"><strong>${zbEsc(r.name)}</strong> · <span style="color:var(--amber)">★★★★★</span> ${Number(r.rating).toFixed(0)}<div style="color:var(--ink-muted);margin-top:3px">${zbEsc(r.text)}</div></div>`).join(""):"<div style='color:var(--ink-muted)'>No reviews loaded yet. Be one of the first.</div>"}
        <div class="zb-form"><button class="btn-submit" style="margin-top:12px" onclick="zbReviewPrompt('${zbEsc(b.id)}')">⭐ Leave a review</button></div>
      </div>
    </div>`;
  openModal("detailModal");
}
function zbReviewPrompt(id){
  const name=prompt("Your name"); if(!name)return;
  const rating=Number(prompt("Rating from 1 to 5","5")); if(!(rating>=1&&rating<=5))return;
  const text=prompt("Your review"); if(!text)return;
  zbApi("/api/reviews",{method:"POST",body:JSON.stringify({businessId:id,name,rating,text})})
    .then(()=>{showToast("⭐ Review submitted");viewBiz(id)})
    .catch(e=>showToast("⚠️ "+e.message));
}

function submitQuote(){
  const payload={
    businessId:zbActiveBusinessId,
    service:document.getElementById("quote-service").value.trim(),
    description:document.getElementById("quote-desc").value.trim(),
    budget:document.getElementById("quote-budget").value.trim(),
    location:document.getElementById("quote-loc").value.trim(),
    phone:document.getElementById("quote-phone").value.trim(),
    preferredDate:document.getElementById("quote-date").value
  };
  if(!payload.businessId){showToast("Open a business profile first.");return;}
  if(!payload.service||!payload.phone){showToast("Please add the service and phone number.");return;}
  zbApi("/api/quotes",{method:"POST",body:JSON.stringify(payload)})
    .then(()=>{closeModal("quoteModal");showToast("🚀 Quote request sent to the business.");})
    .catch(e=>showToast("⚠️ "+e.message));
}
function submitBooking(){
  const payload={businessId:zbActiveBusinessId,service:document.getElementById("book-service").value,date:document.getElementById("book-date").value,time:document.getElementById("book-time").value,name:document.getElementById("book-name").value.trim(),phone:document.getElementById("book-phone").value.trim()};
  if(!payload.businessId){showToast("Open a business profile first.");return;}
  zbApi("/api/bookings",{method:"POST",body:JSON.stringify(payload)})
    .then(()=>{closeModal("bookingModal");showToast("✅ Booking request sent. The business can now confirm it.");})
    .catch(e=>showToast("⚠️ "+e.message));
}
function submitListBiz(){
  const payload={name:document.getElementById("reg-name").value.trim(),category:document.getElementById("reg-category").value,city:document.getElementById("reg-city").value,phone:document.getElementById("reg-phone").value.trim(),whatsapp:document.getElementById("reg-whatsapp").value.trim(),description:document.getElementById("reg-desc").value.trim()};
  if(Object.values(payload).some(v=>!v&&["whatsapp"].indexOf(v)===-1)){showToast("Please complete the required fields.");return;}
  zbApi("/api/businesses",{method:"POST",body:JSON.stringify(payload)})
    .then(()=>{closeModal("listModal");showToast("🎉 Listing submitted for verification.");})
    .catch(e=>showToast("⚠️ "+e.message));
}

function doSmartSearch(){
  const q=document.getElementById("smart-input").value.trim().toLowerCase(); if(!q)return;
  document.getElementById("bar-search").value=q;
  zbLoadBusinesses(true).then(()=>{
    const results=businesses.slice(0,3);
    document.getElementById("smart-results").innerHTML=results.map(b=>zbRenderBizCard(b,true)).join("");
    document.getElementById("smart-results").classList.add("visible");
    showToast(`✨ Smart Search found ${results.length} likely matches`);
  });
}

// Real map using Leaflet + OpenStreetMap
function initLiveMap(){
  const container=document.getElementById("map-canvas");
  if(!container || typeof L==="undefined") return;
  const old=container.querySelector("#live-map");
  if(old)return;
  const div=document.createElement("div"); div.id="live-map"; container.appendChild(div);
  zbLeafletMap=L.map(div,{zoomControl:true}).setView([-17.8252,31.0335],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(zbLeafletMap);
}
function zbUpdateMap(items){
  if(!zbLeafletMap)return;
  zbMarkers.forEach(m=>m.remove()); zbMarkers=[];
  items.filter(b=>Number.isFinite(b.lat)&&Number.isFinite(b.lng)).forEach(b=>{
    const m=L.marker([b.lat,b.lng]).addTo(zbLeafletMap).bindPopup(`<strong>${zbEsc(b.name)}</strong><br>${zbEsc(b.category)} · ${zbEsc(b.city)}<br><button onclick="viewBiz('${zbEsc(b.id)}')">View profile</button>`);
    zbMarkers.push(m);
  });
  if(zbMarkers.length) zbLeafletMap.fitBounds(L.featureGroup(zbMarkers).getBounds().pad(0.2));
}
function selectMapBiz(el,idx){const b=mapBizItems[idx];if(b){quickSearch(b.name);}}

window.addEventListener("DOMContentLoaded",()=>{
  // Make the original fake map clearly turn into the live map.
  initLiveMap();
  // Load actual backend data and keep the original demo dataset as fallback.
  zbLoadBusinesses(true).then(()=>{renderAll();});
  zbRenderFeaturedImages();
  // Smart search on Enter
  document.getElementById("smart-input")?.addEventListener("keydown",e=>{if(e.key==="Enter")doSmartSearch()});
  document.getElementById("main-search")?.addEventListener("keydown",e=>{if(e.key==="Enter")doSearch()});
  document.getElementById("location-search")?.addEventListener("keydown",e=>{if(e.key==="Enter")doSearch()});
});
