(() => {
  "use strict";

  // =========================
  // DOM
  // =========================
  const $ = (id) => document.getElementById(id);

  const canvas = $("matrix");
  const ctx = canvas.getContext("2d");

  const statusPill = $("statusPill");
  const timerEl = $("timer");

  const nameEl = $("name");
  const emailEl = $("email");
  const phoneEl = $("phone");
  const countryEl = $("country");

  const startBtn = $("startBtn");
  const resetBtn = $("resetBtn");

  const outputEl = $("output");
  const logEl = $("log");

  const modeEl = $("mode");
  const progressEl = $("progress");
  const integrityEl = $("integrity");

  const finalEl = $("final");
  const finalClose = $("finalClose");

  // =========================
  // Config
  // =========================
  const DURATION_MS = 60000; // 30 секунд
  const FINAL_IMAGE_URL = "./assets/final.jpg";

  // Matrix rain settings
  const CHARS = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ$#@%&*+-=<>[]{}()";
  let fontSize = 16;
  let columns = 0;
  let drops = [];
  let w = 0, h = 0;

  // Runtime
  let running = false;
  let startAt = 0;
  let rafId = 0;
  let tickId = 0;
  let assembleId = 0;

  // =========================
  // Helpers
  // =========================
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function pad2(n){
    n = Math.floor(n);
    return (n < 10 ? "0" : "") + n;
  }

  function setStatus(text, isRunning){
    statusPill.textContent = text;
    statusPill.classList.toggle("running", !!isRunning);
  }

  function setMode(text){ modeEl.textContent = text; }
  function setIntegrity(text){ integrityEl.textContent = text; }

  function setTimer(msLeft){
    const s = clamp(Math.ceil(msLeft / 1000), 0, 9999);
    timerEl.textContent = `00:${pad2(Math.min(s, 99))}`;
  }

  function log(line){
    const ts = new Date().toLocaleTimeString();
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setOutput(text){
    outputEl.textContent = text;
  }

  function getLeadSeed(){
    const name = (nameEl.value || "Unknown").trim();
    const email = (emailEl.value || "unknown@void.matrix").trim();
    const phone = (phoneEl.value || "+00 000 000 000").trim();
    const country = (countryEl.value || "N/A").trim();

    return { name, email, phone, country };
  }

  function randomHex(n=8){
    const chars = "abcdef0123456789";
    let out = "";
    for(let i=0;i<n;i++) out += chars[(Math.random()*chars.length)|0];
    return out;
  }

  function buildAssemblerText(seed, pct){
    const id = `LD-${randomHex(4).toUpperCase()}-${randomHex(4).toUpperCase()}`;
    const score = Math.round( clamp( (pct/100) * 0.82 + Math.random()*0.18, 0, 1) * 1000 ) / 10;

    const lines = [
      ">> MATRIX LEAD ASSEMBLER",
      `session_id: ${randomHex(12)}`,
      `lead_id: ${id}`,
      `progress: ${pct}%`,
      `candidate.name: ${seed.name}`,
      `candidate.email: ${seed.email}`,
      `candidate.phone: ${seed.phone}`,
      `candidate.country: ${seed.country}`,
      `signal_strength: ${score}`,
      `entropy: ${Math.round( (1 - pct/100) * 1000 ) / 10}`,
      "status: assembling..."
    ];
    return lines.join("\n");
  }

  // =========================
  // Canvas: resize + matrix
  // =========================
  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    ctx.setTransform(dpr,0,0,dpr,0,0);

    // responsive font size
    fontSize = w < 520 ? 14 : 16;

    columns = Math.floor(w / fontSize);
    drops = new Array(columns).fill(0).map(() => (Math.random()*h/fontSize)|0);
  }

  function drawMatrix(intensity=1){
    // fade background
    ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + (1-intensity)*0.06})`;
    ctx.fillRect(0, 0, w, h);

    ctx.font = `${fontSize}px ui-monospace, monospace`;
    ctx.textBaseline = "top";

    for(let i=0;i<drops.length;i++){
      const text = CHARS[(Math.random() * CHARS.length) | 0];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // brighter near running
      const alpha = 0.55 + Math.random()*0.35*intensity;
      ctx.fillStyle = `rgba(53, 255, 122, ${alpha})`;
      ctx.fillText(text, x, y);

      if(y > h && Math.random() > 0.975){
        drops[i] = 0;
      } else {
        drops[i] += 1;
      }
    }
  }

  // =========================
  // Run / Stop
  // =========================
  function hardResetUI(){
    running = false;

    setStatus("IDLE", false);
    setMode("idle");
    setIntegrity("unknown");
    progressEl.textContent = "0";
    setTimer(DURATION_MS);

    startBtn.disabled = false;

    setOutput("ready.");
    logEl.textContent = "";
    finalEl.classList.add("hidden");
  }

  function showFinal(){
    const img = $("finalImg");
    img.src = FINAL_IMAGE_URL;
    finalEl.classList.remove("hidden");
  }

  function stopAllTimers(){
    if(rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    if(tickId) clearInterval(tickId);
    tickId = 0;

    if(assembleId) clearInterval(assembleId);
    assembleId = 0;
  }

  function start(){
    if(running) return;

    const seed = getLeadSeed();
    running = true;
    startAt = Date.now();

    setStatus("GENERATING", true);
    setMode("assembling");
    setIntegrity("checking...");
    startBtn.disabled = true;

    log("boot: matrix_rain::init()");
    log("boot: lead_assembler::start()");
    log(`seed: name="${seed.name}", email="${seed.email}", phone="${seed.phone}", country="${seed.country}"`);

    function frame(){
      if(!running) return;

      const elapsed = Date.now() - startAt;
      const t = clamp(elapsed / DURATION_MS, 0, 1);
      const intensity = 1 - (t * 0.25);
      drawMatrix(intensity);

      rafId = requestAnimationFrame(frame);
    }
    frame();

    tickId = setInterval(() => {
      if(!running) return;

      const elapsed = Date.now() - startAt;
      const left = Math.max(0, DURATION_MS - elapsed);
      setTimer(left);

      const pct = Math.floor(clamp((elapsed / DURATION_MS) * 100, 0, 100));
      progressEl.textContent = String(pct);

      if(pct < 25) setIntegrity("low");
      else if(pct < 60) setIntegrity("medium");
      else if(pct < 90) setIntegrity("high");
      else setIntegrity("almost");

      if(left <= 0){
        finish(seed);
      }
    }, 200);

    assembleId = setInterval(() => {
      if(!running) return;

      const elapsed = Date.now() - startAt;
      const pct = Math.floor(clamp((elapsed / DURATION_MS) * 100, 0, 100));

      setOutput(buildAssemblerText(seed, pct));

      const r = Math.random();
      if(r < 0.22) log("matrix: scanning public signals...");
      else if(r < 0.40) log("assembler: correlating patterns...");
      else if(r < 0.56) log("assembler: normalizing noise...");
      else if(r < 0.70) log("matrix: rerouting green streams...");
      else if(r < 0.82) log("assembler: stitching identity fragments...");
      else log("matrix: verifying checksum...");
    }, 650);
  }

  function finish(seed){
    if(!running) return;

    running = false;
    stopAllTimers();

    setStatus("COMPLETE", false);
    setMode("complete");
    setIntegrity("done");
    progressEl.textContent = "100";
    setTimer(0);

    log("assembler: finalize()");
    log("matrix: render_final_payload()");
    setOutput(
      [
        ">> MATRIX LEAD ASSEMBLER",
        "status: COMPLETE",
        `result: lead_generated=true`,
        `name: ${seed.name}`,
        `email: ${seed.email}`,
        `phone: ${seed.phone}`,
        `country: ${seed.country}`,
        "",
        ">> SHOWING FINAL SCREEN..."
      ].join("\n")
    );

    showFinal();
  }

  // =========================
  // Events
  // =========================
  window.addEventListener("resize", resize);

  startBtn.addEventListener("click", () => {
    if(!finalEl.classList.contains("hidden")) return;
    start();
  });

  resetBtn.addEventListener("click", () => {
    stopAllTimers();
    hardResetUI();
  });

  finalClose.addEventListener("click", () => {
    finalEl.classList.add("hidden");
  });

  // =========================
  // Init
  // =========================
  resize();
  hardResetUI();

  (function idleLoop(){
    if(!running){
      drawMatrix(0.65);
    }
    requestAnimationFrame(idleLoop);
  })();
})();
