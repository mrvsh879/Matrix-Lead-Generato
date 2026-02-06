(() => {
  "use strict";

  // ============================================================
  // MEME MVP — Matrix Lead Generator
  // - No APIs, no real data, everything random
  // - Two screens: form -> matrix
  // - Staged "assembly": name -> surname -> email -> phone
  // - Fast face scanning: super fast switching between generated faces (no external assets needed)
  // - Final: gorilla meme full screen + "LEAD GENERATED SUCCESSFULLY"
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

  // Form fields
  const firstNameInput = $("firstName");
  const lastNameInput = $("lastName");
  const bootLog = $("bootLog");

  // Matrix UI (output)
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

  const faceImg = $("faceImg");
  const faceStage = $("faceStage");
  const faceScore = $("faceScore");
  const faceBar = $("faceBar");
  const faceHint = $("faceHint");

  const opsLog = $("opsLog");

  // Final overlay
  const finalOverlay = $("finalOverlay");
  const finalImg = $("finalImg");
  const finalFallback = $("finalFallback");

  // Canvas
  const canvas = $("matrixCanvas");
  const ctx = canvas.getContext("2d");

  // -----------------------------
  // Config
  // -----------------------------
  const CONFIG = {
    // Duration of matrix stage (30–60 sec). Set anywhere in this range.
    DURATION_MS: 45000, // 45 sec by default

    // How fast the face "scanner" switches faces (ms). Smaller = faster.
    FACE_SWITCH_MS: 55,

    // Internal phases timings (fractions of total)
    PHASES: {
      name:   { start: 0.07, end: 0.33 },
      surname:{ start: 0.28, end: 0.55 },
      email:  { start: 0.50, end: 0.78 },
      phone:  { start: 0.72, end: 0.95 },
      finalize:{start: 0.94, end: 1.00 }
    },

    // Matrix rain
    MATRIX: {
      chars: "01ABCDEFGHIJKLMNOPQRSTUVWXYZ$#@%&*+-=<>[]{}()",
      baseFont: 16,
      mobileFont: 14,
      fadeAlphaBase: 0.08
    },

    // Final gorilla meme image (remote).
    // If it fails to load (blocked/hotlink) — fallback overlay is shown.
    GORILLA_URL: "https://i.pinimg.com/originals/a2/36/20/a23620bbf4143ab4b90a462e59c25dad.jpg"
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
    faceId: 0,

    // Generated lead result
    lead: {
      firstName: "",
      lastName: "",
      email: "",
      phone: ""
    },

    // Face scanning generated images (data URLs)
    faces: [],
    faceIndex: 0,

    // Matrix engine
    w: 0,
    h: 0,
    fontSize: 16,
    columns: 0,
    drops: []
  };

  // -----------------------------
  // Utilities
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

  function setSystem(stateText){
    sysState.textContent = stateText;
  }

  function setSession(id){
    sysSession.textContent = id;
  }

  function setProgress(pct){
    const p = clamp(pct, 0, 100);
    progressPct.textContent = `${p}%`;
    progressFill.style.width = `${p}%`;
  }

  function setCardStatus(el, text){
    el.textContent = text;
  }

  function typewriter(targetEl, fullText, pct){
    // pct 0..1 controls how many chars are visible
    const max = fullText.length;
    const visible = Math.floor(clamp(pct, 0, 1) * max);
    targetEl.textContent = fullText.slice(0, visible) + (visible < max ? "▍" : "");
  }

  // -----------------------------
  // Screen transitions
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
  // Fake lead generation
  // -----------------------------
  function sanitizeNamePart(s){
    s = (s || "").trim();
    if(!s) return "";
    // Keep letters/numbers, replace spaces with nothing
    s = s.replace(/\s+/g, "");
    s = s.replace(/[^\p{L}\p{N}_-]/gu, "");
    return s;
  }

  function normalizeForEmail(s){
    // basic latin-ish for email; keep digits and lowercase
    // If non-latin remains, we fallback with random "user"
    const latin = s
      .toLowerCase()
      .replace(/ё/g, "e")
      .replace(/[^a-z0-9]/g, "");

    return latin;
  }

  function makeRandomPhone(){
    // intentionally “international-ish”
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
    const base = (n1 && n2) ? `${n1}.${n2}${suffix}` :
                 (n1 || n2) ? `${(n1||n2)}.${rndInt(100,999)}` :
                 `user.${rndInt(1000,9999)}`;
    return `${base}@${dom}`;
  }

  function prepareLeadFromForm(){
    const f = sanitizeNamePart(firstNameInput.value);
    const l = sanitizeNamePart(lastNameInput.value);

    State.lead.firstName = f || pick(["Neo","Trinity","Morpheus","Agent","Cipher","Oracle"]);
    State.lead.lastName = l || pick(["Anderson","Smith","Matrix","Redpill","Zion","Mainframe"]);
    State.lead.email = makeRandomEmail(State.lead.firstName, State.lead.lastName);
    State.lead.phone = makeRandomPhone();
  }

  // -----------------------------
  // Face scan: generate fake faces (data URLs)
  // No external assets required.
  // -----------------------------
  function generateFaceDataURL(seed){
    const c = document.createElement("canvas");
    c.width = 420;
    c.height = 420;
    const g = c.getContext("2d");

    // background
    g.fillStyle = "#0a0f0b";
    g.fillRect(0,0,c.width,c.height);

    // green-ish gradient
    const grd = g.createRadialGradient(200,140,30, 210,210,260);
    grd.addColorStop(0, "rgba(80,255,150,0.25)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0,0,c.width,c.height);

    // noise pattern
    for(let i=0;i<1600;i++){
      const x = (Math.random()*c.width)|0;
      const y = (Math.random()*c.height)|0;
      const a = Math.random()*0.22;
      g.fillStyle = `rgba(57,255,121,${a})`;
      g.fillRect(x,y,1,1);
    }

    // pseudo face blob
    const cx = 210 + rndInt(-10,10);
    const cy = 215 + rndInt(-10,10);
    const rx = 125 + rndInt(-12,12);
    const ry = 150 + rndInt(-12,12);

    g.save();
    g.translate(cx, cy);
    g.beginPath();
    g.ellipse(0, 0, rx, ry, rndInt(-8,8)*Math.PI/180, 0, Math.PI*2);
    g.closePath();
    g.clip();

    // inside "face" texture
    for(let i=0;i<220;i++){
      const x = rndInt(-rx, rx);
      const y = rndInt(-ry, ry);
      const r = rndInt(1,4);
      const a = Math.random()*0.20;
      g.fillStyle = `rgba(57,255,121,${a})`;
      g.beginPath();
      g.arc(x,y,r,0,Math.PI*2);
      g.fill();
    }

    // eyes
    g.fillStyle = "rgba(235,255,245,0.65)";
    g.beginPath(); g.arc(-45, -20, 10, 0, Math.PI*2); g.fill();
    g.beginPath(); g.arc( 45, -20, 10, 0, Math.PI*2); g.fill();

    // pupils
    g.fillStyle = "rgba(0,0,0,0.85)";
    g.beginPath(); g.arc(-45 + rndInt(-2,2), -20 + rndInt(-2,2), 4, 0, Math.PI*2); g.fill();
    g.beginPath(); g.arc( 45 + rndInt(-2,2), -20 + rndInt(-2,2), 4, 0, Math.PI*2); g.fill();

    // mouth
    g.strokeStyle = "rgba(235,255,245,0.35)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 55, 38, 0.15*Math.PI, 0.85*Math.PI);
    g.stroke();

    g.restore();

    // overlay id text
    g.fillStyle = "rgba(170,255,195,0.65)";
    g.font = "14px ui-monospace, monospace";
    g.fillText(`FACE-ID:${seed}`, 16, 26);

    return c.toDataURL("image/png");
  }

  function buildFacePool(){
    // build 10–16 generated faces for fast switching
    const count = rndInt(10, 16);
    const faces = [];
    for(let i=0;i<count;i++){
      faces.push(generateFaceDataURL(randomHex(8).toUpperCase()));
    }
    State.faces = faces;
    State.faceIndex = 0;
  }

  function startFaceScanner(){
    stopFaceScanner();

    faceStage.textContent = "SCANNING";
    faceHint.textContent = "detecting landmarks • extracting embeddings • matching identity fragments";
    faceBar.style.width = "0%";
    faceScore.textContent = "0.00";

    State.faceId = setInterval(() => {
      if(!State.faces.length) return;

      State.faceIndex = (State.faceIndex + 1) % State.faces.length;
      faceImg.src = State.faces[State.faceIndex];

      // Fake score + bar
      const s = Math.random() * 0.99;
      faceScore.textContent = s.toFixed(2);
      const b = rndInt(10, 100);
      faceBar.style.width = `${b}%`;
    }, CONFIG.FACE_SWITCH_MS);
  }

  function stopFaceScanner(){
    if(State.faceId){
      clearInterval(State.faceId);
      State.faceId = 0;
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
    // background fade
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
  // Staged assembly (UI)
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

  function setStageText(){
    // "serious" log flavor
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
      "target: acquired?"
    ];
    logOps(pick(lines));
  }

  function updateAssembly(elapsed){
    const t = clamp(elapsed / CONFIG.DURATION_MS, 0, 1);
    setProgress(Math.floor(t * 100));

    // phases
    const P = CONFIG.PHASES;

    // NAME
    const tn = clamp((t - P.name.start) / (P.name.end - P.name.start), 0, 1);
    if(t < P.name.start){
      outName.textContent = "—";
      stName.textContent = "waiting…";
    } else if(t <= P.name.end){
      stName.textContent = "assembling…";
      typewriter(outName, State.lead.firstName, tn);
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
      typewriter(outSurname, State.lead.lastName, ts);
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
      typewriter(outEmail, State.lead.email, te);
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
      typewriter(outPhone, State.lead.phone, tp);
    } else {
      outPhone.textContent = State.lead.phone;
      stPhone.textContent = "locked ✓";
    }

    // Face scanning always active in matrix stage (for drama)
    // but we “increase intensity” near end
    if(t > 0.12 && t < 0.98){
      faceStage.textContent = (t < 0.85) ? "SCANNING" : "MATCHING";
      if(t > 0.85){
        faceHint.textContent = "scoring similarity • verifying checksum • locking identity…";
      }
    }

    // periodic ops logs
    if(Math.random() < 0.16) setStageText();
  }

  // -----------------------------
  // Final overlay (gorilla meme)
  // -----------------------------
  function showFinalOverlay(){
    finalOverlay.classList.remove("hidden");
    finalOverlay.setAttribute("aria-hidden", "false");

    // try load gorilla
    finalFallback.classList.add("hidden");
    finalImg.style.display = "block";
    finalImg.src = CONFIG.GORILLA_URL;

    // fallback if blocked / failed
    finalImg.onload = () => {
      // ok
    };
    finalImg.onerror = () => {
      finalImg.style.display = "none";
      finalFallback.classList.remove("hidden");
    };
  }

  function hideFinalOverlay(){
    finalOverlay.classList.add("hidden");
    finalOverlay.setAttribute("aria-hidden", "true");
  }

  // -----------------------------
  // Run / Stop
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
    timerValue.textContent = "00:00";

    resetAssemblyUI();

    showScreenForm();
    fadeIn(screenForm);

    // mini boot log
    bootLog.textContent = "";
    logBoot("boot: ok");
    logBoot("crypto: green-only channel established");
    logBoot("warning: this is a meme MVP");
    logBoot("ready: waiting for input");
  }

  function startRun(){
    if(State.running) return;

    // Prepare
    prepareLeadFromForm();
    buildFacePool();

    State.sessionId = randomHex(14).toUpperCase();
    setSession(State.sessionId);

    resetAssemblyUI();

    // Transition form -> matrix
    setSystem("ARMING");
    fadeOut(screenForm);

    setTimeout(() => {
      showScreenMatrix();
      fadeIn(screenMatrix);

      // Start
      setSystem("RUNNING");
      State.running = true;
      State.startAt = Date.now();

      timerValue.textContent = msToMMSS(CONFIG.DURATION_MS);

      logOps("boot: matrix_rain::init()");
      logOps("boot: lead_assembler::start()");
      logOps(`seed: first="${State.lead.firstName}" last="${State.lead.lastName}"`);
      logOps("facescan: init()");
      logOps("facescan: streaming candidates...");

      startFaceScanner();
      startMatrixLoop();

      // Tick loop
      State.tickId = setInterval(() => {
        if(!State.running) return;

        const elapsed = Date.now() - State.startAt;
        const left = Math.max(0, CONFIG.DURATION_MS - elapsed);

        timerValue.textContent = msToMMSS(left);
        updateAssembly(elapsed);

        // finish
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

    // Freeze matrix background (one last draw to feel “stopped”)
    drawMatrix(0.9);

    // Show final meme
    showFinalOverlay();
  }

  // -----------------------------
  // Idle matrix (subtle)
  // -----------------------------
  function idleLoop(){
    if(!State.running){
      // draw gentle idle background
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
    // regenerate: go back to screen 1 (form) like a “fresh session”
    resetAppToForm();
  });

  // -----------------------------
  // Init
  // -----------------------------
  resizeCanvas();
  resetAppToForm();
  idleLoop();
})();
