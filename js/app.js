const App = {
  entries: [],
  filter: {journal:"all",view:"all",query:""},
  async init() {
    this.entries=await DB.getAll();
    if(!this.entries.length) await this.seed();
    this.entries=await DB.getAll();
    this.bind();
    this.render();
    this.applyTheme();
  },
  async seed() {
    const today=new Date().toISOString().slice(0,10);
    const yesterday=new Date(Date.now()-864e5).toISOString().slice(0,10);
    await DB.put({id:"welcome",title:"A quiet morning",content:"<p>I woke up a little earlier than usual today. The apartment was quiet, and the first light came through the window.</p><p>There is something nice about beginning the day without rushing.</p>",date:today,journal:"Personal",favorite:false,photos:[],tags:["morning"],createdAt:Date.now(),updatedAt:Date.now()});
    await DB.put({id:"welcome2",title:"Small things worth remembering",content:"<p>Coffee. A good conversation. A walk without anywhere to be.</p>",date:yesterday,journal:"Personal",favorite:true,photos:[],tags:["life"],createdAt:Date.now()-864e5,updatedAt:Date.now()-864e5});
  },
  bind() {
    document.getElementById("newEntryBtn").onclick=()=>Editor.open();
    document.getElementById("saveEntryBtn").onclick=()=>Editor.save();
    document.getElementById("searchInput").oninput=e=>{this.filter.query=e.target.value.toLowerCase();this.render()};
    document.getElementById("themeBtn").onclick=()=>this.toggleTheme();
    document.getElementById("themeTopBtn").onclick=()=>this.toggleTheme();
    document.getElementById("exportBtn").onclick=()=>this.export();
    document.getElementById("todayBtn").onclick=()=>{this.filter={journal:"all",view:"all",query:""};document.getElementById("searchInput").value="";this.render()};
    document.getElementById("menuBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
    document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();document.getElementById("searchInput").focus()}if(e.key.toLowerCase()==="n"&&document.activeElement.tagName!=="INPUT"&&document.activeElement.contentEditable!=="true"){Editor.open()}if(e.key==="Escape")Editor.close()});
    document.querySelectorAll(".nav-item[data-journal]").forEach(b=>b.onclick=()=>{this.filter={journal:b.dataset.journal,view:"all",query:this.filter.query};this.renderNav();this.render()});
    document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.onclick=()=>{this.filter={journal:"all",view:b.dataset.view,query:this.filter.query};this.renderNav();this.render()});
  },
  async refresh(){this.entries=await DB.getAll();this.render()},
  filtered() {
    return this.entries.filter(e=>{
      const j=this.filter.journal==="all"||e.journal===this.filter.journal;
      const v=this.filter.view==="all"||(this.filter.view==="favorites"&&e.favorite)||(this.filter.view==="photos"&&e.photos?.length);
      const q=!this.filter.query || [e.title,e.content,e.journal,(e.tags||[]).join(" ")].join(" ").toLowerCase().includes(this.filter.query);
      return j&&v&&q;
    }).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt-a.updatedAt);
  },
  renderNav(){
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    const sel=this.filter.view!=="all"?`[data-view="${this.filter.view}"]`:`[data-journal="${this.filter.journal}"]`;
    document.querySelector(sel)?.classList.add("active");
  },
  render() {
    const entries=this.filtered();
    document.getElementById("allCount").textContent=this.entries.length;
    const title=this.filter.view==="calendar"?"Calendar":this.filter.view==="favorites"?"Favorites":this.filter.view==="photos"?"Photos":this.filter.journal==="all"?"All entries":this.filter.journal;
    document.getElementById("viewTitle").textContent=title;
    document.getElementById("viewEyebrow").textContent=this.filter.view==="all"?"YOUR JOURNAL":"COLLECTION";
    const view=document.getElementById("appView");
    if(this.filter.view==="calendar"){view.innerHTML=this.calendar();return}
    if(this.filter.view==="photos"){view.innerHTML=this.photos(entries);return}
    if(!entries.length){view.innerHTML=`<div class="empty"><div class="empty-icon">✧</div><h2>Nothing here yet</h2><p>Start with a few words about today.</p><button class="primary-btn" onclick="Editor.open()">Write an entry</button></div>`;return}
    const groups={};entries.forEach(e=>(groups[e.date]??=[]).push(e));
    view.innerHTML=Object.entries(groups).map(([date,items])=>`<section class="day"><div class="day-label"><strong>${UI.formatDate(date,{weekday:"long"})}</strong><span></span><small>${UI.formatDate(date,{month:"long",day:"numeric"})}</small></div>${items.map(e=>this.card(e)).join("")}</section>`).join("");
    view.querySelectorAll(".entry-card").forEach(c=>c.onclick=()=>Editor.open(this.entries.find(e=>e.id===c.dataset.id)));
  },
  card(e){
    const excerpt=UI.plain(e.content).slice(0,280);
    const photo=e.photos?.[0]?`<img class="photo-thumb" src="${e.photos[0]}" alt="">`:"";
    return `<article class="entry-card" data-id="${e.id}"><h2>${UI.escape(e.title)}</h2><p class="entry-excerpt">${UI.escape(excerpt)}${excerpt.length>=280?"…":""}</p>${photo}<div class="entry-footer"><span>${new Date(e.updatedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</span><span>·</span><span>${UI.escape(e.journal)}</span>${e.favorite?'<span style="margin-left:auto">♥</span>':''}${(e.tags||[]).map(t=>`<span class="tag">${UI.escape(t)}</span>`).join("")}</div></article>`;
  },
  calendar(){
    const now=new Date(), y=now.getFullYear(), m=now.getMonth(), first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
    const map={};this.entries.forEach(e=>map[e.date]=(map[e.date]||0)+1);
    let cells=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="cal-head">${x}</div>`).join("");
    for(let i=0;i<first;i++)cells+=`<div class="cal-day muted"></div>`;
    for(let d=1;d<=days;d++){const key=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;cells+=`<div class="cal-day ${map[key]?"has-entry":""}"><button onclick="App.openDate('${key}')">${d}</button>${map[key]?'<div class="cal-dot"></div>':''}</div>`}
    return `<div class="calendar">${cells}</div>`;
  },
  openDate(date){const e=this.entries.find(x=>x.date===date);if(e)Editor.open(e);},
  photos(entries){const imgs=entries.flatMap(e=>(e.photos||[]).map(src=>({src,e})));return imgs.length?`<div class="photo-grid">${imgs.map(x=>`<img src="${x.src}" alt="" onclick="Editor.open(App.entries.find(e=>e.id==='${x.e.id}'))">`).join("")}</div>`:`<div class="empty"><div class="empty-icon">▧</div><h2>No photos yet</h2><p>Attach a photo to an entry and it will appear here.</p></div>`},
  toggleTheme(){const dark=document.body.classList.toggle("dark");localStorage.setItem("journal-theme",dark?"dark":"light")},
  applyTheme(){if(localStorage.getItem("journal-theme")==="dark")document.body.classList.add("dark")},
  export(){
    const data=JSON.stringify(this.entries,null,2), blob=new Blob([data],{type:"application/json"}), a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="journal-export.json";a.click();URL.revokeObjectURL(a.href);
  }
};
App.init();
