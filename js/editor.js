const Editor = {
  panel: document.getElementById("editorPanel"),
  title: document.getElementById("titleInput"),
  body: document.getElementById("editor"),
  date: document.getElementById("editorDate"),
  status: document.getElementById("saveStatus"),
  journal: document.getElementById("journalName"),
  favoriteBtn: document.getElementById("favoriteEditor"),
  photos: [],
  currentId: null,
  currentJournal: "Personal",

  open(entry=null) {
    this.currentId = entry?.id || null;
    this.currentJournal = entry?.journal || "Personal";
    this.photos = entry?.photos ? [...entry.photos] : [];
    const d = entry?.date || new Date().toISOString().slice(0,10);
    this.date.textContent = UI.formatLong(d);
    this.title.value = entry?.title || "";
    this.body.innerHTML = entry?.content || "";
    this.journal.textContent = this.currentJournal;
    this.favoriteBtn.textContent = entry?.favorite ? "♥" : "♡";
    this.renderPhotos();
    this.updateWords();
    this.status.textContent = "Saved";
    this.panel.classList.add("open");
    this.panel.setAttribute("aria-hidden","false");
    document.getElementById("overlay").classList.add("show");
    setTimeout(()=>this.body.focus(),250);
  },
  close() {
    this.panel.classList.remove("open");
    this.panel.setAttribute("aria-hidden","true");
    document.getElementById("overlay").classList.remove("show");
  },
  async save() {
    const existing = (await DB.getAll()).find(e=>e.id===this.currentId);
    const now = Date.now();
    const entry = {
      id: this.currentId || "entry_"+now,
      title: this.title.value.trim() || "Untitled entry",
      content: this.body.innerHTML.trim(),
      date: existing?.date || new Date().toISOString().slice(0,10),
      journal: this.currentJournal,
      favorite: this.favoriteBtn.textContent==="♥",
      photos: this.photos,
      tags: existing?.tags || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await DB.put(entry);
    this.currentId=entry.id;
    this.status.textContent="Saved just now";
    await App.refresh();
  },
  renderPhotos() {
    const wrap=document.getElementById("photoPreview");
    wrap.innerHTML=this.photos.map((src,i)=>`<div style="position:relative"><img src="${src}" alt="Attached photo"><button onclick="Editor.removePhoto(${i})" style="position:absolute;right:5px;top:5px;background:#222c;color:#fff;border-radius:50%;width:22px;height:22px">×</button></div>`).join("");
  },
  removePhoto(i){this.photos.splice(i,1);this.renderPhotos()},
  addPhotos(files) {
    [...files].forEach(file=>{
      const reader=new FileReader();
      reader.onload=e=>{this.photos.push(e.target.result);this.renderPhotos()};
      reader.readAsDataURL(file);
    });
  },
  updateWords() {
    const text=UI.plain(this.body.innerHTML).trim();
    document.getElementById("wordCount").textContent=(text?text.split(/\s+/).length:0)+" words";
  }
};

document.querySelectorAll(".toolbar button[data-cmd]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.execCommand(btn.dataset.cmd,false,btn.dataset.value||null);
    Editor.body.focus(); Editor.updateWords();
  });
});
Editor.body.addEventListener("input",()=>Editor.updateWords());
document.getElementById("photoBtn").onclick=()=>document.getElementById("photoInput").click();
document.getElementById("photoInput").onchange=e=>Editor.addPhotos(e.target.files);
document.getElementById("closeEditor").onclick=()=>Editor.close();
document.getElementById("overlay").onclick=()=>Editor.close();
document.getElementById("saveEntryBtn").onclick=()=>Editor.save();
document.getElementById("favoriteEditor").onclick=()=>Editor.favoriteBtn.textContent=Editor.favoriteBtn.textContent==="♥"?"♡":"♥";
document.getElementById("journalPicker").onclick=()=>{
  const choices=["Personal","Work","Travel"];
  const next=choices[(choices.indexOf(Editor.currentJournal)+1)%choices.length];
  Editor.currentJournal=next; Editor.journal.textContent=next;
};
