document.addEventListener("DOMContentLoaded",()=>{
const page=$("#editPage"), lng=$("#editLang"), fields=$("#editorFields"), stamp=$("#lastUpdate"), KEY="revaV11Edits";
const base={};
Object.keys(REVA_I18N).forEach(l=>base[l]=JSON.parse(JSON.stringify(REVA_I18N[l])));
function edits(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return {}}}
function getVal(data,key){return key.split(".").reduce((a,b)=>a?.[b],data)}
function setVal(data,key,val){const p=key.split(".");let x=data;for(let i=0;i<p.length-1;i++)x=x[p[i]]||(x[p[i]]={});x[p.at(-1)]=val}
const keys={index:["hero.title","hero.text","hero.primary","hero.secondary","what.title","what.text","cards.agents.title","cards.agents.text","cards.engine.title","cards.engine.text","cards.editor.title","cards.editor.text","creator.title","creator.text","creator.cta","ready.title"],agents:["agents.title","agents.text","agents.med.title","agents.med.text","agents.real.title","agents.real.text","agents.hotel.title","agents.hotel.text"],engine:["engine.text","engine.prompt","engine.run"],influencers:["influencers.title","influencers.text","influencers.zayn","influencers.maya"],demos:["demos.title","demos.text"],agency:["agency.title","agency.text","agency.a","agency.b","agency.c"],about:["about.title","about.text"],contact:["contact.title","contact.text","contact.send"]};
function render(){const l=lng.value,p=page.value,data=edits()[l]||{};fields.innerHTML=(keys[p]||[]).map(k=>`<label class="edit-field"><span>${k}</span><textarea data-key="${k}" rows="4">${escapeHtml(getVal(data,k)??getVal(base[l],k)??"")}</textarea></label>`).join("");stamp.textContent=localStorage.getItem(KEY+"_time")||"—"}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function save(){const all=edits(),l=lng.value;all[l]=all[l]||{};fields.querySelectorAll("[data-key]").forEach(e=>setVal(all[l],e.dataset.key,e.value));localStorage.setItem(KEY,JSON.stringify(all));const t=new Date().toLocaleString();localStorage.setItem(KEY+"_time",t);stamp.textContent=t;toast("Changes saved locally.")}
$("#saveContent").onclick=save;
$("#resetContent").onclick=()=>{if(confirm("Reset all saved edits?")){localStorage.removeItem(KEY);localStorage.removeItem(KEY+"_time");render();toast("Saved edits reset.")}};
$("#exportContent").onclick=()=>{const blob=new Blob([JSON.stringify({version:"V11",exportedAt:new Date().toISOString(),edits:edits()},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="reva-nexus-v11-backup.json";a.click();URL.revokeObjectURL(a.href)};
$("#importContent").onclick=()=>$("#importFile").click();
$("#importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);localStorage.setItem(KEY,JSON.stringify(j.edits||{}));localStorage.setItem(KEY+"_time",new Date().toLocaleString());render();toast("Backup imported.")}catch{toast("Invalid backup file.")}};r.readAsText(f)};
page.onchange=lng.onchange=render;render();
});