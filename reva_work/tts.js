/* REVA Nexus V11 — Automatic multilingual TTS v7 + concise stateful demo replies
   The page language controls the demo's initial response.
   Typed/speech input can then auto-detect Arabic, English or French.
   TTS is hard-locked to a matching browser voice; no cross-language fallback.
*/
(() => {
  "use strict";

  const LANGS = {
    ar: { code: "ar-IQ", bases:["ar"], fallbacks:["ar-SA","ar-AE","ar-XA"], label:"العربية", dir:"rtl" },
    en: { code: "en-US", bases:["en"], fallbacks:["en-GB","en-AU","en-CA"], label:"English", dir:"ltr" },
    fr: { code: "fr-FR", bases:["fr"], fallbacks:["fr-CA","fr-BE","fr-CH"], label:"Français", dir:"ltr" }
  };

  const hasTTS = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let voices = [];

  function pageLang() {
    const l = String(document.documentElement.lang || localStorage.getItem("revaLang") || "en").toLowerCase().split("-")[0];
    return LANGS[l] ? l : "en";
  }

  function detectLanguage(text) {
    const s = String(text || "").trim();
    if (!s) return pageLang();
    const ar = (s.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g)||[]).length;
    const latin = (s.match(/[A-Za-zÀ-ÖØ-öø-ÿŒœ]/g)||[]).length;
    if (ar >= 2 && ar >= Math.max(2, latin * 0.15)) return "ar";
    const fr = /\b(je|j'ai|j’aime|j'aime|bonjour|salut|merci|vous|nous|avec|pour|dans|une|des|les|le|la|et|est|être|êtes|comment|quel|quelle|prix|chambre|rendez-vous|médecin|hôtel|maison|bienvenue|votre|besoin|suis|peux|pouvez|réservation|demande|séjour)\b|[àâçéèêëîïôùûüÿœ]/i;
    return fr.test(s) ? "fr" : "en";
  }

  function refreshVoices() {
    if (hasTTS) voices = (speechSynthesis.getVoices() || []).slice();
  }
  if (hasTTS) {
    refreshVoices();
    speechSynthesis.onvoiceschanged = refreshVoices;
    [100,500,1200,2500,4000].forEach(ms=>setTimeout(refreshVoices,ms));
  }

  function matches(v, lang) {
    const vl=String(v?.lang||"").toLowerCase();
    return LANGS[lang].bases.some(b=>vl===b || vl.startsWith(b+"-"));
  }

  function pickVoice(lang) {
    const cfg=LANGS[lang];
    const exact=cfg.code.toLowerCase();
    const candidates=voices.filter(v=>matches(v,lang));
    if (!candidates.length) return null;
    return candidates.slice().sort((a,b)=>{
      const score=v=>{
        const vl=String(v.lang||"").toLowerCase(), n=String(v.name||"").toLowerCase();
        let s=0;
        if(vl===exact) s+=1000;
        if(cfg.fallbacks.some(x=>vl===x.toLowerCase())) s+=500;
        if(n.includes("natural")) s+=100;
        if(n.includes("online")) s+=50;
        if(n.includes("microsoft")) s+=20;
        return s;
      };
      return score(b)-score(a);
    })[0];
  }

  function notice(lang, detail="") {
    let el=document.getElementById("revaVoiceNotice");
    if(!el){el=document.createElement("div");el.id="revaVoiceNotice";el.className="reva-voice-notice";document.body.appendChild(el);}
    el.dir=LANGS[lang].dir;
    el.textContent=`REVA TTS: ${LANGS[lang].label} — لا يوجد صوت ${LANGS[lang].label} متاح في Edge حالياً. لم يتم استخدام صوت بلغة أخرى.${detail?` (${detail})`:""}`;
    clearTimeout(el._timer); el._timer=setTimeout(()=>el.remove(),9000);
  }

  async function speak(text, lang) {
    if(!hasTTS || !String(text||"").trim()) return false;
    lang = LANGS[lang] ? lang : detectLanguage(text);
    refreshVoices();
    if(!voices.length){
      await new Promise(r=>setTimeout(r,700)); refreshVoices();
    }
    const voice=pickVoice(lang);
    if(!voice){ notice(lang); return false; }

    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(text));
    u.lang=voice.lang; u.voice=voice; u.rate=.96; u.pitch=1;
    speechSynthesis.speak(u);
    return true;
  }

  const INITIAL={
    medical:{
      en:"Hello. How can I help prepare your request?",
      ar:"أهلًا بك. كيف يمكنني مساعدتك في تجهيز طلبك؟",
      fr:"Bonjour. Comment puis-je vous aider à préparer votre demande ?"
    },
    realty:{
      en:"Tell me your preferred area and budget.",
      ar:"أخبرني بالمنطقة المفضلة لديك وميزانيتك.",
      fr:"Indiquez-moi la zone souhaitée et votre budget."
    },
    hotel:{
      en:"Welcome. What would you like to know about your stay?",
      ar:"أهلًا بك. ماذا تود أن تعرف عن إقامتك؟",
      fr:"Bienvenue. Que souhaitez-vous savoir sur votre séjour ?"
    }
  };

  const NAME={
    medical:{en:"Lumevira AI",ar:"لومـافيرا AI",fr:"Lumevira AI"},
    realty:{en:"Vera AI",ar:"فيرا AI",fr:"Vera AI"},
    hotel:{en:"Velluxa AI",ar:"فيلوكسا AI",fr:"Velluxa AI"}
  };

  function responseFor(agent,text,lang,state){
    const t=String(text||"").trim(), lower=t.toLowerCase();
    const n=NAME[agent]||NAME.hotel;
    state=state||{};
    const reset=/^(إلغاء|الغاء|خلاص|cancel|stop|annuler)$/i.test(t);
    if(reset){ state.step=0; return lang==="ar"?"حسنًا. لنبدأ من جديد. كيف يمكنني مساعدتك؟":lang==="fr"?"D’accord. Reprenons depuis le début. Comment puis-je vous aider ?":"Okay. Let’s start again. How can I help you?"; }

    if(lang==="ar"){
      if(/^(مرحبا|مرحباً|اهلا|أهلا|أهلًا|السلام عليكم|هلو|هاي|يا هلا|هلا)(\s|!|؟|،|$)/i.test(t)) return "أهلًا وسهلًا بك! كيف يمكنني مساعدتك اليوم؟";
      if(/كيف حالك|شلونك|شخبارك|هل أنت بخير|انت بخير|أنت بخير|كيفك/i.test(t)) return "أنا بخير، شكرًا لسؤالك. كيف يمكنني مساعدتك اليوم؟";
      if(/شكرا|شكرًا|مشكور|ممنون/i.test(t)) return "على الرحب والسعة! يسعدني مساعدتك.";
      if(/من أنت|من انتي|من انت|شنو انت|ما أنت/i.test(t)) return `أنا ${n.ar}، وكيل الذكاء الاصطناعي. كيف يمكنني مساعدتك؟`;
      if(agent==="medical"){
        if(state.step===1){ state.step=2; return "بالتأكيد. هل لديك طبيب محدد، أم تفضل اختيار طبيب مناسب من العيادة؟"; }
        if(state.step===2){ state.step=3; return "حسنًا. ما اليوم أو الوقت الذي تفضله للموعد؟"; }
        if(state.step===3){ state.step=0; return "ممتاز. تم تسجيل تفاصيل الموعد للتجربة."; }
        if(/حجز|احجز|أحجز|موعد|مواعيد|عيادة|طبيب|دكتور|مراجعة|زيارة/i.test(t)){ state.step=1; return "بالتأكيد، أستطيع مساعدتك في حجز موعد. هل تبحث عن طبيب محدد في العيادة؟"; }
        if(/ألم|وجع|اعراض|أعراض|حرارة|حمى|دوخة|سعال|صداع|مرض|علاج|دواء/i.test(t)) return "يمكنني تنظيم المعلومات الأولية وتوجيهك إلى الخطوة المناسبة، لكن التشخيص والعلاج من اختصاص الطبيب.";
        return "بالتأكيد. أستطيع مساعدتك بالمعلومات الأولية وحجز المواعيد.";
      }
      if(agent==="realty"){
        if(state.step===1){state.step=2;return "حسنًا. ما الميزانية التقريبية التي تناسبك؟";}
        if(state.step===2){state.step=3;return "ممتاز. ما نوع العقار الذي تبحث عنه؟";}
        if(state.step===3){state.step=0;return "ممتاز. سأرتب لك الخيارات المناسبة للتجربة.";}
        if(/عقار|عقارات|بيت|منزل|شقة|دار|أرض|ارض|إيجار|ايجار|شراء|للبيع|ميزانية|منطقة|موقع/i.test(t)){state.step=1;return "بالتأكيد، أستطيع مساعدتك في العثور على العقار المناسب. ما المنطقة التي تفضلها؟";}
        return "بالتأكيد. أستطيع مساعدتك في العقارات والخيارات المتاحة.";
      }
      if(state.step===1){state.step=2;return "بالتأكيد. ما تاريخ المغادرة؟";}
      if(state.step===2){state.step=3;return "حسنًا. كم عدد الضيوف؟";}
      if(state.step===3){state.step=0;return "ممتاز. تم تسجيل طلب الحجز للتجربة.";}
      if(/حجز|احجز|أحجز|غرفة|غرف|فندق|إقامة|اقامة|ليلة|ليالي|منتجع/i.test(t)){state.step=1;return "بالتأكيد، أستطيع مساعدتك في حجز إقامتك. ما تاريخ الوصول؟";}
      return "أهلًا بك. أستطيع مساعدتك في الغرف والخدمات وطلبات الحجز.";
    }
    if(lang==="fr"){
      if(/^(bonjour|salut|bonsoir|coucou)(\s|!|\?|,|$)/i.test(t)) return "Bonjour et bienvenue ! Comment puis-je vous aider aujourd’hui ?";
      if(/comment allez[- ]vous|comment vas[- ]tu|ça va|ca va|vous allez bien|tu vas bien/i.test(lower)) return "Je vais bien, merci ! Comment puis-je vous aider aujourd’hui ?";
      if(/merci/i.test(lower)) return "Avec plaisir ! Je suis là pour vous aider.";
      if(/qui êtes[- ]vous|qui es[- ]tu|vous êtes qui/i.test(lower)) return `Je suis ${n.fr}, votre agent IA. Comment puis-je vous aider ?`;
      if(agent==="medical"){
        if(state.step===1){state.step=2;return "Bien sûr. Avez-vous un médecin précis en tête, ou souhaitez-vous choisir un médecin de la clinique ?";}
        if(state.step===2){state.step=3;return "Très bien. Quel jour ou quelle heure vous conviendrait ?";}
        if(state.step===3){state.step=0;return "Parfait. Les détails du rendez-vous sont enregistrés pour la démonstration.";}
        if(/rendez[- ]vous|prendre rendez|réserver|réservation|médecin|docteur|clinique|consultation/i.test(lower)){state.step=1;return "Bien sûr, je peux vous aider à prendre rendez-vous. Avez-vous un médecin précis en tête ?";}
        return "Bien sûr. Je peux vous aider avec les informations et les rendez-vous.";
      }
      if(agent==="realty"){
        if(state.step===1){state.step=2;return "Très bien. Quel est votre budget approximatif ?";}
        if(state.step===2){state.step=3;return "Parfait. Quel type de bien recherchez-vous ?";}
        if(state.step===3){state.step=0;return "Parfait. Je vais organiser les options adaptées pour la démonstration.";}
        if(/immobilier|maison|appartement|terrain|location|louer|acheter|vente|budget|quartier|zone|prix/i.test(lower)){state.step=1;return "Bien sûr, je peux vous aider à trouver le bien adapté. Quelle zone préférez-vous ?";}
        return "Bien sûr. Je peux vous aider avec les biens et les options disponibles.";
      }
      if(state.step===1){state.step=2;return "Bien sûr. Quelle est votre date de départ ?";}
      if(state.step===2){state.step=3;return "Très bien. Combien de personnes séjourneront ?";}
      if(state.step===3){state.step=0;return "Parfait. La demande de réservation est enregistrée pour la démonstration.";}
      if(/réserver|réservation|chambre|hôtel|séjour|nuit|nuits|resort/i.test(lower)){state.step=1;return "Bien sûr, je peux vous aider à réserver votre séjour. Quelle est votre date d’arrivée ?";}
      return "Bienvenue. Je peux vous aider avec les chambres, les services et les réservations.";
    }
    if(/^(hello|hi|hey|good morning|good afternoon|good evening)(\s|!|\?|,|$)/i.test(t)) return "Hello and welcome! How can I help you today?";
    if(/how are you|are you okay|are you well|how's it going|hows it going/i.test(lower)) return "I’m doing well, thank you! How can I help you today?";
    if(/^(thanks|thank you|thx)(\s|!|\.|$)/i.test(t)) return "You’re very welcome! I’m happy to help.";
    if(/who are you|what are you/i.test(lower)) return `I’m ${n.en}, your AI Agent. How can I help you?`;
    if(agent==="medical"){
      if(state.step===1){state.step=2;return "Absolutely. Do you have a specific doctor in mind, or would you like to choose a suitable doctor from the clinic?";}
      if(state.step===2){state.step=3;return "Great. What day or time would you prefer for the appointment?";}
      if(state.step===3){state.step=0;return "Perfect. The appointment details are recorded for this demo.";}
      if(/appointment|book|booking|schedule|doctor|clinic|visit|check[- ]?up/i.test(lower)){state.step=1;return "Absolutely. I can help you book an appointment. Do you have a specific doctor in mind?";}
      return "Absolutely. I can help with information and appointment requests.";
    }
    if(agent==="realty"){
      if(state.step===1){state.step=2;return "Great. What is your approximate budget?";}
      if(state.step===2){state.step=3;return "Perfect. What type of property are you looking for?";}
      if(state.step===3){state.step=0;return "Perfect. I’ll organize suitable options for this demo.";}
      if(/property|real estate|house|home|apartment|land|rent|rental|buy|purchase|sale|budget|area|neighborhood|location|price/i.test(lower)){state.step=1;return "Absolutely. I can help you find the right property. Which area do you prefer?";}
      return "Absolutely. I can help with properties and available options.";
    }
    if(state.step===1){state.step=2;return "Absolutely. What is your check-out date?";}
    if(state.step===2){state.step=3;return "Great. How many guests will be staying?";}
    if(state.step===3){state.step=0;return "Perfect. The booking request is recorded for this demo.";}
    if(/book|booking|room|hotel|stay|night|resort/i.test(lower)){state.step=1;return "Absolutely. I can help you book your stay. What is your check-in date?";}
    return "Welcome. I can help with rooms, services and booking requests.";
  }

  function setInitial(box){
    const msg=box.querySelector(".chatmsg"); if(!msg) return;
    const agent=box.closest(".demo")?.id||"hotel";
    const lang=pageLang();
    msg.textContent=`${NAME[agent]?.[lang] || "AI Agent"}: ${INITIAL[agent]?.[lang] || INITIAL.hotel[lang]}`;
    msg.dir=LANGS[lang].dir;
  }

  function initBox(box){
    if(box.dataset.voiceV4) return;
    const input=box.querySelector("[data-demo-input]"), send=box.querySelector("[data-demo-btn]"), msg=box.querySelector(".chatmsg");
    if(!input||!send||!msg) return;
    box.dataset.voiceV4="1";
    const agent=box.closest(".demo")?.id||"hotel";
    const state={step:0};

    const controls=document.createElement("div");
    controls.className="voice-controls";
    controls.innerHTML=`<button type="button" class="voice-btn" data-mic>🎙 <span>Speak</span></button><button type="button" class="voice-btn" data-speak>🔊 <span>Speak response</span></button><span class="voice-lang" data-voice-lang></span>`;
    box.appendChild(controls);

    function update(){
      const typed=input.value.trim();
      const lang=typed?detectLanguage(typed):pageLang();
      controls.querySelector("[data-voice-lang]").textContent=`Auto · ${LANGS[lang].label}`;
      input.dir=LANGS[lang].dir;
    }
    setInitial(box); update();

    window.addEventListener("reva:languagechange",()=>{
      setInitial(box); update();
    });

    async function sendMessage(){
      const text=input.value.trim(); if(!text) return;
      const lang=detectLanguage(text);
      const answer=responseFor(agent,text,lang,state);
      msg.textContent=`REVA: ${answer}`; msg.dir=LANGS[lang].dir;
      input.value=""; update(); await speak(answer,lang);
    }
    send.addEventListener("click",sendMessage);
    input.addEventListener("input",update);
    input.addEventListener("keydown",e=>{if(e.key==="Enter")sendMessage();});

    controls.querySelector("[data-speak]").addEventListener("click",()=>{
      const raw=msg.textContent.replace(/^REVA:\s*/i,"").trim();
      const lang=detectLanguage(raw);
      controls.querySelector("[data-voice-lang]").textContent=`Auto · ${LANGS[lang].label}`;
      speak(raw,lang);
    });

    const mic=controls.querySelector("[data-mic]");
    if(!SR){mic.disabled=true;mic.querySelector("span").textContent="Mic unavailable";return;}
    mic.addEventListener("click",()=>{
      const rec=new SR();
      const l=pageLang();
      rec.lang=l==="ar"?"ar-IQ":l==="fr"?"fr-FR":"en-US";
      rec.interimResults=false; rec.maxAlternatives=3;
      mic.classList.add("listening"); mic.querySelector("span").textContent="Listening…";
      rec.onresult=e=>{input.value=e.results[0][0].transcript||"";update();sendMessage();};
      rec.onend=()=>{mic.classList.remove("listening");mic.querySelector("span").textContent="Speak";};
      rec.onerror=()=>{};
      try{rec.start();}catch(_){}
    });
  }

  function init(){
    document.querySelectorAll(".chatbox").forEach(initBox);
    window.REVA_TTS={speak,detectLanguage,responseFor,LANGS,pickVoice,supported:hasTTS};
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
