(() => {
  "use strict";

  // ============================================================
  // Matrix Lead Generator — Meme MVP
  // - No APIs, no real leads, only random
  // - Two screens: form -> matrix animation
  // - Staged assembly: Name -> Surname -> Email -> Phone
  // - Face scan: fast switching of LOCAL repo images (assets/alt1..alt6)
  // - Final: LOCAL meme image (assets/final.jpg) full screen + text + "Generate again"
  // ============================================================

  // -----------------------------
  // DOM helpers
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  // Screens
  const screenForm = $("screenForm");
  const screenMatrix = $("screenMatrix");
  const btnStart = $("btnStart");
  const btnAgain = $("btnAgain");

  // Topbar
  const sysState = $("sysState");
  const sysSession = $("sysSession");
  const timerValue = $("timerValue");

  // Form
  const firstNameInput = $("firstName");
  const lastNameInput = $("lastName");
  const bootLog = $("bootLog");

  // Assembly HUD
  const progressPct = $("progressPct");
  const progressFill = $("progressFill");

  const outName = $("outName");
  const outSurname = $("outSurname");
  const outEmail = $("outEmail");
  const outPhone = $("outPhone");

  const stName = $("stName");
  const stSurname = $("stSurname");
  const stEmail = $("stEmail");
  const stPhone = $("stPhone");

  // Face scan
  const faceImg = $("faceImg");
  const faceStage = $("faceStage");
  const faceScore = $("faceScore");
  const faceBar = $("faceBar");
  const faceHint = $("faceHint");

  // Ops log
  const opsLog = $("opsLog");

  // Final overlay
  const finalOverlay = $("finalOverlay");
  const finalImg = $("finalImg");

  // Canvas
  const canvas = $("matrixCanvas");
  const ctx = canvas.getContext("2d");

  // -----------------------------
  // Config (ONLY LOCAL ASSETS)
  // -----------------------------
  const CONFIG = {
    // Duration of matrix stage: 30–60 seconds
    DURATION_MS: 60000, // 60 sec

    // Face switching speed (smaller = faster)
    FACE_SWITCH_MS: 55,

    // Matrix rain
    MATRIX: {
      chars: "01ABCDEFGHIJKLMNOPQRSTUVWXYZ$#@%&*+-=<>[]{}()",
      baseFont: 16,
      mobileFont: 14,
      fadeAlphaBase: 0.08
    },

    // Local assets in repo (GitHub Pages friendly)
    FACES: [
      "./assets/alt1.jpg",
      "./assets/alt2.jpg",
      "./assets/alt3.jpg",
      "./assets/alt4.jpg",
      "./assets/alt5.jpg",
      "./assets/alt6.jpg"
    ],
    FINAL_MEME: "./assets/final.jpg",

    // Phases of staged assembly (fractions of total time)
    PHASES: {
      name:    { start: 0.06, end: 0.30 },
      surname: { start: 0.24, end: 0.52 },
      email:   { start: 0.48, end: 0.78 },
      phone:   { start: 0.72, end: 0.94 },
      finalize:{ start: 0.94, end: 1.00 }
    }
  };

  // -----------------------------
  // State
  // -----------------------------
  const State = {
    running: false,
    sessionId: "",
    startAt: 0,

    rafId: 0,
    tickId: 0,
    faceTimerId: 0,

    // lead data
    lead: {
      firstName: "",
      lastName: "",
      email: "",
      phone: ""
    },

    // face scan data
    faceIndex: 0,

    // matrix engine
    w: 0,
    h: 0,
    fontSize: 16,
    columns: 0,
    drops: []
  };

  // -----------------------------
  // Utils
  // -----------------------------
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function rndInt(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr){ return arr[(Math.random() * arr.length) | 0]; }

  function pad2(n){
    n = Math.floor(n);
    return (n < 10 ? "0" : "") + n;
  }

  function msToMMSS(ms){
    const s = Math.max(0, Math.ceil(ms / 1000));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function randomHex(n=12){
    const chars = "abcdef0123456789";
    let out = "";
    for(let i=0;i<n;i++) out += chars[(Math.random()*chars.length)|0];
    return out;
  }

  function setSystem(text){
    sysState.textContent = text;
  }

  function setSession(id){
    sysSession.textContent = id;
  }

  function logBoot(line){
    const ts = new Date().toLocaleTimeString();
    bootLog.textContent += `[${ts}] ${line}\n`;
    bootLog.scrollTop = bootLog.scrollHeight;
  }

  function logOps(line){
    const ts = new Date().toLocaleTimeString();
    opsLog.textContent += `[${ts}] ${line}\n`;
    opsLog.scrollTop = opsLog.scrollHeight;
  }

  function setProgress(pct){
    const p = clamp(pct, 0, 100);
    progressPct.textContent = `${p}%`;
    progressFill.style.width = `${p}%`;
  }

  // -----------------------------
  // Screens + transitions
  // -----------------------------
  function showScreenForm(){
    screenMatrix.classList.remove("screen--active");
    screenMatrix.setAttribute("aria-hidden", "true");
    screenForm.classList.add("screen--active");
    screenForm.setAttribute("aria-hidden", "false");
  }

  function showScreenMatrix(){
    screenForm.classList.remove("screen--active");
    screenForm.setAttribute("aria-hidden", "true");
    screenMatrix.classList.add("screen--active");
    screenMatrix.setAttribute("aria-hidden", "false");
  }

  function fadeOut(el){
    el.classList.remove("fadeIn");
    el.classList.add("fadeOut");
  }

  function fadeIn(el){
    el.classList.remove("fadeOut");
    el.classList.add("fadeIn");
  }

  // -----------------------------
  // Lead generation (random)
  // -----------------------------
  function sanitizeNamePart(s){
    s = (s || "").trim();
    if(!s) return "";
    s = s.replace(/\s+/g, "");
    s = s.replace(/[^\p{L}\p{N}_-]/gu, "");
    return s;
  }

  function normalizeForEmail(s){
    const latin = s
      .toLowerCase()
      .replace(/ё/g, "e")
      .replace(/[^a-z0-9]/g, "");
    return latin;
  }

  function makeRandomPhone(){
    const cc = pick(["+1", "+44", "+49", "+33", "+48", "+420", "+39"]);
    const a = rndInt(100, 999);
    const b = rndInt(100, 999);
    const c = rndInt(10, 99);
    const d = rndInt(10, 99);
    return `${cc} ${a} ${b} ${c} ${d}`;
  }

  function makeRandomEmail(first, last){
    const n1 = normalizeForEmail(first);
    const n2 = normalizeForEmail(last);
    const suffix = rndInt(10, 999);
    const dom = pick(["gmail.com", "proton.me", "outlook.com", "mail.com"]);
    const base =
      (n1 && n2) ? `${n1}.${n2}${suffix}` :
      (n1 || n2) ? `${(n1 || n2)}.${rndInt(100,999)}` :
      `user.${rndInt(1000,9999)}`;
    return `${base}@${dom}`;
  }

  function prepareLeadFromForm(){
    const f = sanitizeNamePart(firstNameInput.value);
    const l = sanitizeNamePart(lastNameInput.value);

    State.lead.firstName = f || pick(["Neo","Trinity","Morpheus","Cipher","Oracle","Agent"]);
    State.lead.lastName  = l || pick(["Anderson","Smith","Mainframe","Redpill","Zion","Matrix"]);
    State.lead.email = makeRandomEmail(State.lead.firstName, State.lead.lastName);
    State.lead.phone = makeRandomPhone();
  }

  // -----------------------------
  // Visual “assembly” helpers
  // -----------------------------
  const SCRAMBLE_CHARS = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ$#@%&*+-=<>[]{}()";

  function scrambleReveal(fullText, pct){
    // pct 0..1
    const max = fullText.length;
    const visible = Math.floor(clamp(pct, 0, 1) * max);

    let out = "";
    for(let i=0;i<max;i++){
      if(i < visible){
        out += fullText[i];
      } else {
        out += SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      }
    }
    // cursor effect
    if(visible < max){
      out = out.slice(0, visible) + "▍" + out.slice(visible+1);
    }
    return out;
  }

  // -----------------------------
  // Face scan: use LOCAL repo images
  // -----------------------------
  function preloadAssets(urls){
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }

  function startFaceScanner(){
    stopFaceScanner();

    State.faceIndex = rndInt(0, CONFIG.FACES.length - 1);
    faceStage.textContent = "SCANNING";
    faceHint.textContent = "detecting landmarks • extracting embeddings • matching identity fragments";
    faceBar.style.width = "0%";
    faceScore.textContent = "0.00";

    // set first immediately
    faceImg.src = CONFIG.FACES[State.faceIndex];

    State.faceTimerId = setInterval(() => {
      State.faceIndex = (State.faceIndex + 1) % CONFIG.FACES.length;
      faceImg.src = CONFIG.FACES[State.faceIndex];

      // fake score + progress bar
      const s = Math.random() * 0.99;
      faceScore.textContent = s.toFixed(2);
      const b = rndInt(10, 100);
      faceBar.style.width = `${b}%`;

      // change hints sometimes
      if(Math.random() < 0.22){
        const hints = [
          "detecting landmarks",
          "extracting embeddings",
          "matching identity fragments",
          "scoring similarity",
          "verifying checksum",
          "reducing entropy"
        ];
        faceHint.textContent = hints[rndInt(0, hints.length - 1)];
      }
    }, CONFIG.FACE_SWITCH_MS);
  }

  function stopFaceScanner(){
    if(State.faceTimerId){
      clearInterval(State.faceTimerId);
      State.faceTimerId = 0;
    }
  }

  // -----------------------------
  // Matrix rain engine
  // -----------------------------
  function resizeCanvas(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    State.w = Math.floor(window.innerWidth);
    State.h = Math.floor(window.innerHeight);

    canvas.width = Math.floor(State.w * dpr);
    canvas.height = Math.floor(State.h * dpr);
    canvas.style.width = State.w + "px";
    canvas.style.height = State.h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    State.fontSize = State.w < 520 ? CONFIG.MATRIX.mobileFont : CONFIG.MATRIX.baseFont;
    State.columns = Math.floor(State.w / State.fontSize);
    State.drops = new Array(State.columns).fill(0).map(() => (Math.random() * (State.h / State.fontSize)) | 0);
  }

  function drawMatrix(intensity){
    const fade = CONFIG.MATRIX.fadeAlphaBase + (1 - intensity) * 0.06;
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
    ctx.fillRect(0, 0, State.w, State.h);

    ctx.font = `${State.fontSize}px ui-monospace, monospace`;
    ctx.textBaseline = "top";

    const chars = CONFIG.MATRIX.chars;

    for(let i=0;i<State.drops.length;i++){
      const text = chars[(Math.random() * chars.length) | 0];
      const x = i * State.fontSize;
      const y = State.drops[i] * State.fontSize;

      const a = 0.50 + Math.random() * 0.40 * intensity;
      ctx.fillStyle = `rgba(57, 255, 121, ${a})`;
      ctx.fillText(text, x, y);

      if(y > State.h && Math.random() > 0.975){
        State.drops[i] = 0;
      } else {
        State.drops[i] += 1;
      }
    }
  }

  function startMatrixLoop(){
    function frame(){
      if(!State.running) return;

      const elapsed = Date.now() - State.startAt;
      const t = clamp(elapsed / CONFIG.DURATION_MS, 0, 1);
      const intensity = 1 - (t * 0.25);

      drawMatrix(intensity);

      State.rafId = requestAnimationFrame(frame);
    }
    frame();
  }

  function stopMatrixLoop(){
    if(State.rafId){
      cancelAnimationFrame(State.rafId);
      State.rafId = 0;
    }
  }

  // -----------------------------
  // Assembly HUD logic
  // -----------------------------
  function resetAssemblyUI(){
    setProgress(0);

    outName.textContent = "—";
    outSurname.textContent = "—";
    outEmail.textContent = "—";
    outPhone.textContent = "—";

    stName.textContent = "waiting…";
    stSurname.textContent = "waiting…";
    stEmail.textContent = "waiting…";
    stPhone.textContent = "waiting…";

    faceImg.removeAttribute("src");
    faceStage.textContent = "IDLE";
    faceScore.textContent = "0.00";
    faceBar.style.width = "0%";
    faceHint.textContent = "waiting for target…";

    opsLog.textContent = "";
  }

  function updateAssembly(elapsed){
    const t = clamp(elapsed / CONFIG.DURATION_MS, 0, 1);
    setProgress(Math.floor(t * 100));

    const P = CONFIG.PHASES;

    // NAME
    const tn = clamp((t - P.name.start) / (P.name.end - P.name.start), 0, 1);
    if(t < P.name.start){
      outName.textContent = "—";
      stName.textContent = "waiting…";
    } else if(t <= P.name.end){
      stName.textContent = "assembling…";
      outName.textContent = scrambleReveal(State.lead.firstName, tn);
    } else {
      outName.textContent = State.lead.firstName;
      stName.textContent = "locked ✓";
    }

    // SURNAME
    const ts = clamp((t - P.surname.start) / (P.surname.end - P.surname.start), 0, 1);
    if(t < P.surname.start){
      outSurname.textContent = "—";
      stSurname.textContent = "waiting…";
    } else if(t <= P.surname.end){
      stSurname.textContent = "assembling…";
      outSurname.textContent = scrambleReveal(State.lead.lastName, ts);
    } else {
      outSurname.textContent = State.lead.lastName;
      stSurname.textContent = "locked ✓";
    }

    // EMAIL
    const te = clamp((t - P.email.start) / (P.email.end - P.email.start), 0, 1);
    if(t < P.email.start){
      outEmail.textContent = "—";
      stEmail.textContent = "waiting…";
    } else if(t <= P.email.end){
      stEmail.textContent = "assembling…";
      outEmail.textContent = scrambleReveal(State.lead.email, te);
    } else {
      outEmail.textContent = State.lead.email;
      stEmail.textContent = "locked ✓";
    }

    // PHONE
    const tp = clamp((t - P.phone.start) / (P.phone.end - P.phone.start), 0, 1);
    if(t < P.phone.start){
      outPhone.textContent = "—";
      stPhone.textContent = "waiting…";
    } else if(t <= P.phone.end){
      stPhone.textContent = "assembling…";
      outPhone.textContent = scrambleReveal(State.lead.phone, tp);
    } else {
      outPhone.textContent = State.lead.phone;
      stPhone.textContent = "locked ✓";
    }

    // Face scan stage text
    if(t > 0.10 && t < 0.90){
      faceStage.textContent = "SCANNING";
      faceHint.textContent = "detecting landmarks • extracting embeddings • matching identity fragments";
    } else if(t >= 0.90 && t < 0.98){
      faceStage.textContent = "MATCHING";
      faceHint.textContent = "scoring similarity • verifying checksum • locking identity…";
    } else if(t >= 0.98){
      faceStage.textContent = "LOCKING";
      faceHint.textContent = "checksum verified • profile locked";
    }

    // ops flavor logs
    if(Math.random() < 0.16){
      const lines = [
        "handshake: ok",
        "uplink: secure",
        "protocol: green-only",
        "trace: none",
        "entropy: decreasing",
        "vector: stabilizing",
        "checksum: pending",
        "clearance: ultra-green",
        "signal: strong",
        "target: acquired?",
        "facescan: correlating patterns...",
        "facescan: rerouting candidates..."
      ];
      logOps(pick(lines));
    }
  }

  // -----------------------------
  // Final overlay
  // -----------------------------
  function showFinalOverlay(){
    finalImg.src = CONFIG.FINAL_MEME;
    finalOverlay.classList.remove("hidden");
    finalOverlay.setAttribute("aria-hidden", "false");
  }

  function hideFinalOverlay(){
    finalOverlay.classList.add("hidden");
    finalOverlay.setAttribute("aria-hidden", "true");
  }

  // -----------------------------
  // Run control
  // -----------------------------
  function stopAll(){
    State.running = false;

    stopMatrixLoop();
    stopFaceScanner();

    if(State.tickId){
      clearInterval(State.tickId);
      State.tickId = 0;
    }
  }

  function resetAppToForm(){
    stopAll();
    hideFinalOverlay();

    setSystem("IDLE");
    timerValue.textContent = msToMMSS(CONFIG.DURATION_MS);

    resetAssemblyUI();

    showScreenForm();
    fadeIn(screenForm);

    bootLog.textContent = "";
    logBoot("boot: ok");
    logBoot("crypto: green-only channel established");
    logBoot("warning: this is a meme MVP");
    logBoot(`assets: faces=${CONFIG.FACES.length}, final=final.jpg`);
    logBoot("ready: waiting for input");

    // set session placeholder
    setSession("—");
  }

  function startRun(){
    if(State.running) return;

    // preload local assets to avoid flicker during fast switching
    preloadAssets([...CONFIG.FACES, CONFIG.FINAL_MEME]);

    prepareLeadFromForm();
    resetAssemblyUI();

    State.sessionId = randomHex(14).toUpperCase();
    setSession(State.sessionId);

    setSystem("ARMING");
    fadeOut(screenForm);

    setTimeout(() => {
      showScreenMatrix();
      fadeIn(screenMatrix);

      setSystem("RUNNING");
      State.running = true;
      State.startAt = Date.now();

      timerValue.textContent = msToMMSS(CONFIG.DURATION_MS);

      logOps("boot: matrix_rain::init()");
      logOps("boot: lead_assembler::start()");
      logOps(`seed: first="${State.lead.firstName}" last="${State.lead.lastName}"`);
      logOps(`facescan: using local assets (${CONFIG.FACES.length})`);
      logOps("facescan: streaming candidates...");

      startFaceScanner();
      startMatrixLoop();

      State.tickId = setInterval(() => {
        if(!State.running) return;

        const elapsed = Date.now() - State.startAt;
        const left = Math.max(0, CONFIG.DURATION_MS - elapsed);

        timerValue.textContent = msToMMSS(left);
        updateAssembly(elapsed);

        if(left <= 0){
          finishRun();
        }
      }, 120);

    }, 360);
  }

  function finishRun(){
    if(!State.running) return;

    // abrupt stop (meme style)
    stopAll();
    setSystem("COMPLETE");

    // freeze the matrix (one last frame)
    drawMatrix(0.9);

    // show final meme from local assets/final.jpg
    showFinalOverlay();
  }

  // -----------------------------
  // Idle background matrix (subtle)
  // -----------------------------
  function idleLoop(){
    if(!State.running){
      drawMatrix(0.65);
    }
    requestAnimationFrame(idleLoop);
  }

  // -----------------------------
  // Events
  // -----------------------------
  window.addEventListener("resize", resizeCanvas);

  btnStart.addEventListener("click", () => {
    startRun();
  });

  btnAgain.addEventListener("click", () => {
    resetAppToForm();
  });

  // -----------------------------
  // Init
  // -----------------------------
  resizeCanvas();
  resetAppToForm();
  idleLoop();
})();
