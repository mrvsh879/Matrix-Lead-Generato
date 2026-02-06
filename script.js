:root{
  --bg: #050b07;
  --panel: rgba(5, 20, 10, 0.72);
  --panel2: rgba(6, 26, 12, 0.62);
  --line: rgba(64, 255, 128, 0.22);
  --text: rgba(190, 255, 210, 0.92);
  --muted: rgba(170, 255, 195, 0.65);
  --green: #35ff7a;
  --green2: #12c84f;
  --danger: #ff3b3b;
}

*{ box-sizing: border-box; }
html,body{ height:100%; }
body{
  margin:0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  background: radial-gradient(1200px 700px at 40% 15%, rgba(30,255,120,0.10), transparent 60%),
              radial-gradient(900px 600px at 75% 60%, rgba(30,255,120,0.08), transparent 55%),
              var(--bg);
  color: var(--text);
  overflow:hidden;
}

#matrix{
  position:fixed;
  inset:0;
  width:100%;
  height:100%;
  z-index:0;
}

.topbar{
  position:relative;
  z-index:2;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 18px;
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(6px);
  background: rgba(0,0,0,0.22);
}

.brand{
  display:flex;
  align-items:center;
  gap:12px;
}
.brand__dot{
  width:10px;
  height:10px;
  border-radius:50%;
  background: var(--green);
  box-shadow: 0 0 14px rgba(53,255,122,0.65);
}
.brand__title{
  letter-spacing: 0.08em;
  font-weight: 700;
}
.brand__sub{
  font-size: 12px;
  color: var(--muted);
  margin-top:2px;
}

.status{
  display:flex;
  align-items:center;
  gap:12px;
}
.status__pill{
  font-size:12px;
  padding:6px 10px;
  border:1px solid var(--line);
  border-radius:999px;
  background: rgba(0,0,0,0.28);
  color: var(--muted);
  letter-spacing:0.12em;
}
.status__pill.running{
  color: rgba(230,255,240,0.95);
  border-color: rgba(64,255,128,0.38);
  box-shadow: 0 0 18px rgba(53,255,122,0.10);
}
.status__timer{
  min-width:64px;
  text-align:right;
  font-weight:700;
  color: rgba(230,255,240,0.95);
}

.layout{
  position:relative;
  z-index:2;
  height: calc(100% - 58px);
  padding:18px;
  display:grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap:18px;
}

.panel{
  border: 1px solid var(--line);
  background: linear-gradient(180deg, var(--panel), var(--panel2));
  border-radius: 14px;
  padding:16px;
  box-shadow: 0 12px 50px rgba(0,0,0,0.45);
  overflow:hidden;
}

.panel--right{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.panel__title{
  margin:0 0 6px 0;
  font-size:22px;
  letter-spacing:0.06em;
}
.panel__hint{
  margin:0 0 14px 0;
  color: var(--muted);
  line-height:1.35;
  font-size:13px;
}

.form{
  display:grid;
  gap:12px;
}

.field{
  display:grid;
  gap:6px;
}
.field__label{
  font-size:12px;
  color: var(--muted);
  letter-spacing:0.08em;
}
.field__input{
  width:100%;
  padding:11px 12px;
  border-radius:12px;
  border:1px solid rgba(64,255,128,0.22);
  background: rgba(0,0,0,0.45);
  color: rgba(230,255,240,0.95);
  outline:none;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.22);
}
.field__input:focus{
  border-color: rgba(64,255,128,0.55);
  box-shadow: 0 0 0 3px rgba(53,255,122,0.14);
}

.actions{
  display:flex;
  gap:10px;
  margin-top:6px;
}

.btn{
  cursor:pointer;
  border-radius: 12px;
  padding: 11px 14px;
  border:1px solid rgba(64,255,128,0.22);
  background: rgba(0,0,0,0.40);
  color: rgba(230,255,240,0.92);
  font-weight:700;
  letter-spacing:0.04em;
  transition: transform .06s ease, box-shadow .15s ease, border-color .15s ease;
  user-select:none;
}
.btn:active{ transform: translateY(1px); }
.btn--primary{
  border-color: rgba(64,255,128,0.55);
  background: linear-gradient(180deg, rgba(19,120,55,0.65), rgba(0,0,0,0.55));
  box-shadow: 0 12px 30px rgba(16,200,79,0.10);
}
.btn--primary:hover{
  box-shadow: 0 14px 36px rgba(16,200,79,0.16);
}
.btn--ghost{
  color: var(--muted);
}
.btn[disabled]{
  cursor:not-allowed;
  opacity:0.55;
  transform:none;
}

.divider{
  height:1px;
  background: var(--line);
  margin:16px 0;
}

.result__title{
  font-size:12px;
  color: var(--muted);
  letter-spacing:0.10em;
  margi
