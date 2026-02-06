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
  const finalImg = $("finalImg");

  // FaceScan HUD elements
  const scanStageEl = $("scanStage");
  const scanPctEl = $("scanPct");
  const scanMsgEl = $("scanMsg");
  const scanBarEl = $("scanBar");

  // =========================
  // Config
  // =========================
  const DURATION_MS = 60000; // 60 секунд
  const FINAL_IMAGE_URL = "./assets/final.jpg";

  // 6 альтов + (опционально) финал
  const SHUFFLE_IMAGES = [
    "./assets/alt1.jpg",
    "./assets/alt2.jpg",
    "./assets/alt3.jpg",
    "./assets/alt4.jpg",
    "./assets/alt5.jpg",
    "./assets/alt6.jpg"
  ];

  // когда включать “сканер лиц” (последние N мс)
  const SCAN_WINDOW_MS = 9000;     // последние 9 секунд
  const SHUFFLE_INTERVAL_MS = 55;  // очень быстро (55мс)

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

  // FaceScan runtime
  let shuffleId = 0;
  let scanStartAt = 0;
  let scanIndex = 0;

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
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    timerEl.textContent = `${pad2(mm)}:${pad2(ss)}`;
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

  function setScanHUD(stage, pct, msg){
    if(scanStageEl) scanStageEl.textContent = stage;
    if(scanPctEl) scanPctEl.textContent = `${pct}%`;
    if(scanMsgEl) scanMsgEl.textContent = msg;
    if(scanBarEl) scanBarEl.style.width = `${pct}%`;
  }

  function preloadImages(urls){
    // Не критично, но уменьшает “мигание” от загрузки на старте scan
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
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

    fontSize = w < 520 ? 14 : 16;

    columns = Math.floor(w / fontSize);
    drops = new Array(columns).fill(0).map(() => (Math.random()*h/fontSize)|0);
  }

  function drawMatrix(intensity=1){
    ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + (1-intensity)*0.06})`;
    ctx.fillRect(0, 0, w, h);

    ctx.font = `${fontSize}px ui-monospace, monospace`;
    ctx.textBaseline = "top";

    for(let i=0;i<drops.length;i++){
      const text = CHARS[(Math.random() * CHARS.length) | 0];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

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
  // Face Scan (перебор фото)
  // =========================
  function showFinal(){
    finalImg.src = FINAL_IMAGE_URL;
    finalEl.classList.remove("hidden");
  }

  function startFaceScan(){
    if(shuffleId) return;

    // Открываем финальный оверлей, но начинаем “скан”
    showFinal();

    scanStartAt = Date.now();
    scanIndex = 0;

    finalEl.classList.add("isScanning");
    setScanHUD("SCAN", 0, "initializing");

    log("facescan: init()");
    log("facescan: loading candidates...");
    log("facescan: analyzing facial vectors...");

    shuffleId = setInterval(() => {
      // Перебор 6 фоток “как сканер”
      finalImg.src = SHUFFLE_IMAGES[scanIndex % SHUFFLE_IMAGES.length];
      scanIndex++;

      const elapsed = Date.now() - scanStartAt;
      const pct = Math.floor(clamp((elapsed / SCAN_WINDOW_MS) * 100, 0, 99));

      const msgs = [
        "detecting landmarks",
        "extracting embeddings",
        "matching identity fragments",
        "scoring similarity",
        "verifying checksum",
        "reducing entropy"
      ];
      const msg = msgs[scanIndex % msgs.length];

      setScanHUD("SCAN", pct, msg);
    }, SHUFFLE_INTERVAL_MS);
  }

  function stopFaceScanAndLockFinal(){
    if(shuffleId) clearInterval(shuffleId);
    shuffleId = 0;

    finalEl.classList.remove("isScanning");

    // фиксируем итог
    finalImg.src = FINAL_IMAGE_URL;
    setScanHUD("LOCK", 100, "match locked");
    log("facescan: match locked");
    log("facescan: final frame locked");
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

    // reset final overlay + scan hud
    finalEl.classList.add("hidden");
    finalEl.classList.remove("isScanning");
    finalImg.src = FINAL_IMAGE_URL;
    setScanHUD("IDLE", 0, "waiting");
  }

  function stopAllTimers(){
    if(rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    if(tickId) clearInterval(tickId);
    tickId = 0;

    if(assembleId) clearInterval(assembleId);
    assembleId = 0;

    if(shuffleId) clearInterval(shuffleId);
    shuffleId = 0;
  }

  function start(){
    if(running) return;

    // на старте прелоадим alt-фото и финал, чтобы скан был “быстрый”
    preloadImages([...SHUFFLE_IMAGES, FINAL_IMAGE_URL]);

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

      // Запускаем Face Scan в последние SCAN_WINDOW_MS
      if(left <= SCAN_WINDOW_MS && left > 0 && !shuffleId){
        setMode("facescan");
        log(`facescan: window opened (${Math.ceil(SCAN_WINDOW_MS/1000)}s)`);
        startFaceScan();
      }

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

    // останавливаем таймеры, но оставляем финальный экран
    if(rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if(tickId) clearInterval(tickId);
    tickId = 0;
    if(assembleId) clearInterval(assembleId);
    assembleId = 0;

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

    // Если скан шел — фиксируем финал, если нет — просто показываем финал
    if(shuffleId){
      stopFaceScanAndLockFinal();
    }else{
      showFinal();
      setScanHUD("LOCK", 100, "match locked");
    }
  }

  // =========================
  // Events
  // =========================
  window.addEventListener("resize", resize);

  startBtn.addEventListener("click", () => {
    // если уже открыт финал — не стартуем
    if(!finalEl.classList.contains("hidden")) return;
    start();
  });

  resetBtn.addEventListener("click", () => {
    stopAllTimers();
    hardResetUI();
  });

  finalClose.addEventListener("click", () => {
    finalEl.classList.add("hidden");
    // если пользователь закрыл во время скана — стопаем скан и фиксируем
    if(shuffleId){
      stopFaceScanAndLockFinal();
    }
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
