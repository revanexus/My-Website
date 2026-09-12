document.addEventListener("DOMContentLoaded",()=>{
const $=s=>document.querySelector(s), toast=m=>{let e=$("#toast");if(e){e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2600)}};
let lang=localStorage.getItem("revaLang")||"en";
function get(o,k){return k.split(".").reduce((a,b)=>a?.[b],o)}
function applyLang(){const d=REVA_I18N[lang]||REVA_I18N.en;document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";
document.querySelectorAll("[data-i18n]").forEach(e=>{let v=get(d,e.dataset.i18n);if(v!==undefined)e.innerHTML=v});
const b=$("#langBtn");if(b)b.textContent=lang==="en"?"EN":lang==="ar"?"ع":"FR"; localStorage.setItem("revaLang",lang);
document.querySelectorAll("[data-year]").forEach(e=>e.textContent=new Date().getFullYear())}
$("#langBtn")?.addEventListener("click",()=>{lang=lang==="en"?"ar":lang==="ar"?"fr":"en";applyLang()});
$(".menu-btn")?.addEventListener("click",()=>$(".nav-links")?.classList.toggle("open"));
document.querySelectorAll(".nav-links a").forEach(a=>a.addEventListener("click",()=>$(".nav-links")?.classList.remove("open")));
applyLang();

$("#engineRun")?.addEventListener("click",()=>{const x=$("#engineInput")?.value.trim()||"general business workflow";$("#engineOutput").textContent=
`REVA AI WORKFLOW BLUEPRINT\n\n01  Understand\n   → ${x}\n\n02  Structure\n   → Inputs • rules • knowledge • desired outcome\n\n03  Agent actions\n   → classify → generate → validate → hand off\n\n04  Automation\n   → trigger → AI step → approval → notification\n\n05  Measure\n   → time saved • conversion • quality • human review\n\nNEXT: Connect your preferred AI/API to make this workflow live.`;toast("Workflow blueprint generated.")});
document.querySelectorAll("[data-demo-btn]").forEach(btn=>btn.addEventListener("click",()=>{const box=btn.parentElement,input=box.querySelector("[data-demo-input]");if(input?.value.trim()){box.querySelector(".chatmsg").textContent="REVA: Demo response prepared for: "+input.value.trim();input.value=""}}));
$("#contactForm")?.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target),email=(window.REVA_CONFIG||{}).contactEmail||"";if(!email||email.includes("YOUR_EMAIL")){toast("Add your destination email in assets/config.js.");return}location.href=`mailto:${email}?subject=${encodeURIComponent("Reva Nexus V11 Project Brief")}&body=${encodeURIComponent(`Name: ${f.get("name")}\nEmail: ${f.get("email")}\nBudget: ${f.get("budget")}\n\n${f.get("message")}`)}`});
});