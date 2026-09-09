const UI = {
  escape(text="") {
    return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  },
  plain(html="") {
    const d=document.createElement("div"); d.innerHTML=html; return d.textContent || "";
  },
  formatDate(date, opts={}) {
    return new Intl.DateTimeFormat(undefined, opts).format(new Date(date+"T12:00:00"));
  },
  formatLong(date) {
    return this.formatDate(date,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  },
  group(entries) {
    return entries.reduce((m,e)=>(m[e.date]??=[]).push(e),m);
  }
};
