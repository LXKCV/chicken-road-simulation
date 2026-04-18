/* ══════════════════════════════════════════════════
   CHICKEN ROAD — Game Engine
   Canvas · Jump mechanics · Multipliers · Animations
══════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════ */
const MULTIPLIERS = [1.30, 1.70, 2.20, 3.00, 4.20, 6.00, 8.50, 12.00, 18.00, 27.00];
const PAN_COUNT   = MULTIPLIERS.length;

// Fail chance per jump, per difficulty
const RISK = {
  easy:   [0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.20, 0.23, 0.26, 0.30],
  medium: [0.14, 0.17, 0.21, 0.25, 0.29, 0.33, 0.37, 0.42, 0.47, 0.52],
  hard:   [0.24, 0.29, 0.34, 0.39, 0.44, 0.49, 0.54, 0.59, 0.64, 0.70],
};

/* ═══════════════════════════════════════
   GAME STATE
═══════════════════════════════════════ */
const G = {
  phase:     'idle',   // idle | playing | dead | cashout
  diff:      'easy',
  bet:       10,
  jump:      0,        // how many pans cleared
  mult:      1.00,
  history:   [],
  jumpAnim:  false,
  jumpProg:  0,
  jumpFrom:  { x:0, y:0 },
  jumpTo:    { x:0, y:0 },
  jumpPeak:  60,
  pendingLand: null,   // { landed, panIdx }
};

/* ═══════════════════════════════════════
   CANVAS
═══════════════════════════════════════ */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let W = 0, H = 0;

const GROUND_RATIO = 0.70;
const START_W = 60, START_H = 44;
const PAN_W = 54, PAN_H = 38;

let platforms = []; // [{x,y,w,h,type}]
let panStates = []; // 'idle'|'cleared'|'burning'

const chicken = { x:0, y:0, dead:false, celebrate:false };

let rafId = null;

/* ── Resize & build layout ── */
function resize() {
  const container = canvas.parentElement;
  W = container.clientWidth || 560;
  H = Math.max(200, Math.min(280, W * 0.42));
  canvas.width  = W;
  canvas.height = H;
  buildPlatforms();
  placeChickenOnStart();
}

function buildPlatforms() {
  platforms = [];
  panStates = Array(PAN_COUNT).fill('idle');

  const groundY = H * GROUND_RATIO;

  // Start platform
  const sx = 18;
  platforms.push({ x: sx, y: groundY - START_H, w: START_W, h: START_H, type: 'start' });

  // Pans spread across remaining space
  const usable  = W - sx - START_W - 28;
  const spacing = usable / PAN_COUNT;

  for (let i = 0; i < PAN_COUNT; i++) {
    const px = sx + START_W + spacing * (i + 0.5) - PAN_W / 2;
    platforms.push({ x: px, y: groundY - PAN_H, w: PAN_W, h: PAN_H, type: 'pan', idx: i });
  }
}

function placeChickenOnStart() {
  const sp = platforms[0];
  if (!sp) return;
  chicken.x = sp.x + sp.w / 2;
  chicken.y = sp.y - 26;
  chicken.dead = false;
  chicken.celebrate = false;
}

/* ═══════════════════════════════════════
   RENDER LOOP
═══════════════════════════════════════ */
function gameLoop() {
  if (G.jumpAnim) tickJump();
  draw();
  rafId = requestAnimationFrame(gameLoop);
}

function tickJump() {
  G.jumpProg = Math.min(G.jumpProg + 0.05, 1);
  const t = G.jumpProg;

  // Ease in-out cubic
  const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  chicken.x = G.jumpFrom.x + (G.jumpTo.x - G.jumpFrom.x) * ease;
  // Parabolic arc
  const arc = -Math.sin(Math.PI * t) * G.jumpPeak;
  chicken.y = G.jumpFrom.y + (G.jumpTo.y - G.jumpFrom.y) * ease + arc;

  if (G.jumpProg >= 1) {
    G.jumpAnim = false;
    G.jumpProg = 0;
    chicken.x = G.jumpTo.x;
    chicken.y = G.jumpTo.y;
    onJumpLanded();
  }
}

/* ═══════════════════════════════════════
   DRAW
═══════════════════════════════════════ */
function draw() {
  ctx.clearRect(0, 0, W, H);

  const groundY = H * GROUND_RATIO;

  // Ground glow
  const gGrad = ctx.createLinearGradient(0, groundY, 0, H);
  gGrad.addColorStop(0, 'rgba(245,200,66,.04)');
  gGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Ground line
  ctx.strokeStyle = 'rgba(245,200,66,.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

  // Dotted path
  if (G.phase !== 'idle') {
    ctx.save();
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = 'rgba(245,200,66,.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const cx_ = p.x + p.w / 2;
      if (i === 0) ctx.moveTo(cx_, p.y - 4);
      else ctx.lineTo(cx_, platforms[i].y - 4);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Platforms
  drawStart(platforms[0]);
  for (let i = 1; i < platforms.length; i++) {
    drawPan(platforms[i], panStates[i - 1], i - 1);
  }

  // Chicken
  const t = Date.now() / 1000;
  if (!chicken.dead) {
    drawChicken(chicken.x, chicken.y, chicken.celebrate, t);
  } else {
    drawDeadChicken(chicken.x, chicken.y, t);
  }
}

function drawStart(p) {
  if (!p) return;
  ctx.save();
  ctx.shadowColor = 'rgba(245,200,66,.25)';
  ctx.shadowBlur  = 14;

  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#2a2d1a'); g.addColorStop(1, '#181a0e');
  ctx.fillStyle = g;
  rrect(p.x, p.y, p.w, p.h, 8); ctx.fill();

  ctx.strokeStyle = 'rgba(245,200,66,.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(p.x + 8, p.y + 1); ctx.lineTo(p.x + p.w - 8, p.y + 1); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(245,200,66,.65)';
  ctx.font = 'bold 8px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START', p.x + p.w / 2, p.y + p.h / 2 + 3);
}

function drawPan(p, state, idx) {
  if (!p) return;
  const isCleared = state === 'cleared';
  const isBurning = state === 'burning';

  ctx.save();
  ctx.shadowColor = isBurning ? 'rgba(255,64,85,.5)' : isCleared ? 'rgba(57,255,143,.2)' : 'rgba(255,140,66,.1)';
  ctx.shadowBlur  = isBurning ? 20 : isCleared ? 12 : 6;

  const g = ctx.createLinearGradient(p.x, p.y + 8, p.x, p.y + p.h);
  if      (isCleared) { g.addColorStop(0, '#142a1c'); g.addColorStop(1, '#0e1d15'); }
  else if (isBurning) { g.addColorStop(0, '#2a1010'); g.addColorStop(1, '#180808'); }
  else                { g.addColorStop(0, '#1c1e2c'); g.addColorStop(1, '#13141e'); }

  ctx.fillStyle = g;
  rrect(p.x, p.y + 8, p.w, p.h - 8, 10); ctx.fill();

  // Pan handle
  ctx.fillStyle = isBurning ? '#3a1212' : isCleared ? '#1a3822' : '#222534';
  ctx.fillRect(p.x + p.w - 4, p.y + p.h / 2 - 3, 14, 6);

  // Inner circle
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2 - 4, p.y + 16, p.w / 2 - 10, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = isBurning ? 'rgba(255,64,85,.3)' : isCleared ? 'rgba(57,255,143,.15)' : 'rgba(0,0,0,.4)';
  ctx.fill();

  // Top edge
  ctx.strokeStyle = isCleared ? 'rgba(57,255,143,.7)' : isBurning ? 'rgba(255,64,85,.9)' : 'rgba(90,100,150,.35)';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(p.x + 9, p.y + 8); ctx.lineTo(p.x + p.w - 13, p.y + 8); ctx.stroke();
  ctx.restore();

  // Multiplier label
  ctx.save();
  ctx.font = 'bold 11px Bebas Neue, sans-serif';
  ctx.textAlign = 'center';
  if      (isCleared) { ctx.fillStyle = 'rgba(57,255,143,.95)'; ctx.shadowColor = 'rgba(57,255,143,.6)'; ctx.shadowBlur = 8; }
  else if (isBurning) { ctx.fillStyle = 'rgba(255,64,85,.95)';  ctx.shadowColor = 'rgba(255,64,85,.6)';  ctx.shadowBlur = 8; }
  else                { ctx.fillStyle = `rgba(180,190,230,${G.phase === 'playing' && idx === G.jump ? 0.9 : 0.45})`; }
  ctx.fillText(MULTIPLIERS[idx].toFixed(2) + '×', p.x + p.w / 2 - 4, p.y - 5);
  ctx.restore();

  // Step number
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.font = '600 7.5px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`#${idx + 1}`, p.x + p.w / 2 - 4, p.y + p.h - 1);

  // Idle flames during play
  if (!isCleared && G.phase === 'playing') {
    drawFlames(p, isBurning);
  }
}

function drawFlames(p, intense) {
  const t   = Date.now() / 1000;
  const cx  = p.x + p.w / 2 - 4;
  const cy  = p.y + 14;
  const cnt = intense ? 5 : 2;

  for (let i = 0; i < cnt; i++) {
    const ph = t * 3.5 + i * 2.1;
    const fH = intense ? 10 + Math.sin(ph) * 5 : 5 + Math.sin(ph) * 3;
    const fx = cx + (i - cnt / 2) * 7 + Math.sin(t * 4.2 + i) * 2;

    const fg = ctx.createLinearGradient(fx, cy, fx, cy - fH);
    if (intense) {
      fg.addColorStop(0, 'rgba(255,64,85,.9)');
      fg.addColorStop(0.5, 'rgba(255,130,40,.6)');
      fg.addColorStop(1, 'rgba(255,210,50,0)');
    } else {
      fg.addColorStop(0, 'rgba(255,110,20,.45)');
      fg.addColorStop(1, 'rgba(255,190,20,0)');
    }
    ctx.save();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(fx, cy, 3.5, fH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawChicken(x, y, celebrating, t) {
  const bob   = celebrating ? Math.sin(t * 7) * 5 : Math.sin(t * 1.8) * 2;
  const scale = celebrating ? 1.18 : 1;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);

  if (celebrating) { ctx.shadowColor = 'rgba(245,200,66,.9)'; ctx.shadowBlur = 22; }
  else             { ctx.shadowColor = 'rgba(245,200,66,.3)'; ctx.shadowBlur = 10; }

  // Body
  ctx.fillStyle = celebrating ? '#ffd700' : '#f5c842';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();

  // Head
  ctx.beginPath(); ctx.arc(11, -8, 8, 0, Math.PI * 2); ctx.fill();

  // Eye
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.arc(14, -9, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(14.5, -9.5, .9, 0, Math.PI * 2); ctx.fill();

  // Beak
  ctx.fillStyle = '#ff8c42';
  ctx.beginPath(); ctx.moveTo(18, -8); ctx.lineTo(23, -9); ctx.lineTo(18, -6); ctx.fill();

  // Comb
  ctx.fillStyle = '#ff4055';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(8 + i * 3, -15 + (i % 2) * 2, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Wing
  ctx.fillStyle = '#e8b030';
  ctx.beginPath(); ctx.ellipse(-3, 2, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill();

  // Legs
  ctx.strokeStyle = '#e8b030'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2, 10); ctx.lineTo(-4, 18); ctx.lineTo(-8, 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, 10);  ctx.lineTo(5, 18);  ctx.lineTo(9, 20);  ctx.stroke();

  ctx.restore();
}

function drawDeadChicken(x, y, t) {
  ctx.save();
  ctx.translate(x, y + 8);
  ctx.rotate(Math.PI / 2 * 0.85);
  ctx.globalAlpha = 0.6;

  // Stars
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.font = '14px serif';
    ctx.fillStyle = 'rgba(255,200,50,.8)';
    ctx.fillText('⭐', Math.cos(t * 2.5 + i * 2.1) * 18, Math.sin(t * 2 + i * 2.1) * 14);
    ctx.restore();
  }

  ctx.fillStyle = '#777';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#666';
  ctx.beginPath(); ctx.arc(11, -8, 8, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ═══════════════════════════════════════
   MULTIPLIER TRAIL UI
═══════════════════════════════════════ */
function buildTrail() {
  const trail = document.getElementById('multTrail');
  if (!trail) return;
  trail.innerHTML = MULTIPLIERS.map((m, i) => `
    <div class="trail-step" id="ts-${i}">
      <span class="ts-num">#${i + 1}</span>
      <span class="ts-mult">${m.toFixed(2)}×</span>
    </div>
  `).join('');
}

function updateTrail() {
  MULTIPLIERS.forEach((_, i) => {
    const el = document.getElementById(`ts-${i}`);
    if (!el) return;
    el.classList.toggle('passed',  i < G.jump - 1);
    el.classList.toggle('current', i === G.jump - 1);
    if (el.classList.contains('current')) el.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  });
}

/* ═══════════════════════════════════════
   STATS UI
═══════════════════════════════════════ */
function updateStats() {
  const nextMult = G.jump < PAN_COUNT ? MULTIPLIERS[G.jump] : null;
  document.getElementById('statMult').textContent   = G.mult.toFixed(2) + '×';
  document.getElementById('statWin').textContent    = '$' + (G.bet * G.mult).toFixed(2);
  document.getElementById('statJumps').textContent  = G.jump;
  document.getElementById('statNext').textContent   = nextMult ? nextMult.toFixed(2) + '×' : 'MAX!';
}

/* ═══════════════════════════════════════
   CONTROLS
═══════════════════════════════════════ */
function addBet(n) {
  if (G.phase === 'playing') return;
  const inp = document.getElementById('betInput');
  inp.value = Math.max(1, parseFloat(inp.value || 0) + n);
}
function setBet(mode) {
  if (G.phase === 'playing') return;
  const inp = document.getElementById('betInput');
  const v = parseFloat(inp.value || 0);
  if (mode === 'half')   inp.value = Math.max(1, (v / 2).toFixed(2));
  if (mode === 'double') inp.value = Math.min(getBalance(), (v * 2).toFixed(2));
}
function setDiff(btn) {
  if (G.phase === 'playing') return;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  G.diff = btn.dataset.diff;
}

/* ═══════════════════════════════════════
   GAME ACTIONS
═══════════════════════════════════════ */
function startGame() {
  const inp = document.getElementById('betInput');
  const bet = parseFloat(inp.value);
  const bal = getBalance();

  if (!bet || bet <= 0) { showToast('⚠️ Entrez un montant de mise valide.', 'loss'); return; }
  if (bet > bal)        { showToast('⚠️ Solde insuffisant ! Ajoutez des fonds.', 'loss'); return; }

  // Deduct bet immediately
  subtractBalance(bet);
  refreshNavBalance();

  G.bet   = bet;
  G.jump  = 0;
  G.mult  = 1.00;
  G.phase = 'playing';
  panStates = Array(PAN_COUNT).fill('idle');

  placeChickenOnStart();

  // UI
  document.getElementById('startBtn').style.display    = 'none';
  document.getElementById('jumpBtn').style.display     = 'block';
  document.getElementById('cashoutBtn').style.display  = 'block';
  document.getElementById('jumpBtn').disabled          = false;
  document.getElementById('cashoutBtn').disabled       = false;
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('betInput').disabled = true;
  document.querySelectorAll('.diff-btn, .chip').forEach(b => b.disabled = true);

  updateTrail();
  updateStats();
}

function doJump() {
  if (G.phase !== 'playing' || G.jumpAnim) return;

  if (G.jump >= PAN_COUNT) { doCashout(); return; }

  const panIdx        = G.jump;
  const targetPlat    = platforms[panIdx + 1];
  const risk          = RISK[G.diff][panIdx];
  const landed        = Math.random() >= risk;

  G.jumpFrom = { x: chicken.x, y: chicken.y };
  G.jumpTo   = { x: targetPlat.x + targetPlat.w / 2 - 4, y: targetPlat.y - 26 };
  G.jumpPeak = 50 + Math.random() * 25;
  G.jumpAnim = true;
  G.jumpProg = 0;
  G.pendingLand = { landed, panIdx };

  document.getElementById('jumpBtn').disabled    = true;
  document.getElementById('cashoutBtn').disabled = true;
}

function onJumpLanded() {
  if (!G.pendingLand) return;
  const { landed, panIdx } = G.pendingLand;
  G.pendingLand = null;

  if (!landed) {
    // Burned!
    panStates[panIdx] = 'burning';
    chicken.dead = true;
    G.phase = 'dead';

    addHistory('loss', G.bet, G.mult, G.jump);
    setTimeout(() => showOverlay('loss', panIdx), 700);

  } else {
    // Cleared!
    panStates[panIdx] = 'cleared';
    G.jump++;
    G.mult = MULTIPLIERS[panIdx];

    updateTrail();
    updateStats();

    chicken.celebrate = true;
    setTimeout(() => { chicken.celebrate = false; }, 700);

    if (G.jump >= PAN_COUNT) {
      // All fryers cleared — auto cashout
      setTimeout(doCashout, 600);
    } else {
      document.getElementById('jumpBtn').disabled    = false;
      document.getElementById('cashoutBtn').disabled = false;
    }
  }
}

function doCashout() {
  if (G.phase !== 'playing') return;
  if (G.jump === 0) { resetGame(); return; }

  G.phase = 'cashout';
  const winAmt = G.bet * G.mult;
  addBalance(winAmt);
  refreshNavBalance();

  chicken.celebrate = true;
  addHistory('win', G.bet, G.mult, G.jump);
  showOverlay('win', -1);
}

function showOverlay(type, panIdx) {
  const ov  = document.getElementById('overlay');
  const btn = document.getElementById('jumpBtn');
  const cob = document.getElementById('cashoutBtn');

  btn.style.display = 'none';
  cob.style.display = 'none';

  if (type === 'win') {
    const win = (G.bet * G.mult).toFixed(2);
    document.getElementById('ov-emoji').textContent  = '🎉';
    document.getElementById('ov-title').textContent  = 'ENCAISSÉ !';
    document.getElementById('ov-title').style.color  = 'var(--green)';
    document.getElementById('ov-sub').textContent    = `Encaissé à ${G.mult.toFixed(2)}× après ${G.jump} saut${G.jump > 1 ? 's' : ''}`;
    document.getElementById('ov-amount').textContent = `+$${win}`;
    document.getElementById('ov-amount').style.color = 'var(--green)';

    const r = canvas.getBoundingClientRect();
    particleBurst(r.left + W / 2, r.top + H / 2, 'win');
    showToast(`💰 +$${win} encaissé ! Nouveau solde : $${getBalance().toFixed(2)}`, 'win');

  } else {
    document.getElementById('ov-emoji').textContent  = '🍳';
    document.getElementById('ov-title').textContent  = 'GRILLÉ !';
    document.getElementById('ov-title').style.color  = 'var(--red)';
    document.getElementById('ov-sub').textContent    = `La poule a atterri dans la friteuse #${panIdx + 1} !`;
    document.getElementById('ov-amount').textContent = `-$${G.bet.toFixed(2)}`;
    document.getElementById('ov-amount').style.color = 'var(--red)';

    showToast(`💥 Grillé sur la friteuse #${panIdx + 1} ! -$${G.bet.toFixed(2)}`, 'loss');
    shakeElement(document.getElementById('arenaWrap'));
  }

  ov.classList.add('show');
}

function resetGame() {
  G.phase    = 'idle';
  G.jump     = 0;
  G.mult     = 1.00;
  panStates  = Array(PAN_COUNT).fill('idle');

  placeChickenOnStart();

  document.getElementById('startBtn').style.display   = 'block';
  document.getElementById('jumpBtn').style.display    = 'none';
  document.getElementById('cashoutBtn').style.display = 'none';
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('betInput').disabled = false;
  document.querySelectorAll('.diff-btn, .chip').forEach(b => b.disabled = false);

  updateTrail();
  updateStats();
}

/* ═══════════════════════════════════════
   HISTORY
═══════════════════════════════════════ */
function addHistory(type, bet, mult, jumps) {
  G.history.unshift({ type, bet, mult, jumps, time: Date.now() });
  if (G.history.length > 10) G.history.pop();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  if (G.history.length === 0) {
    list.innerHTML = '<div class="h-empty">Aucune partie jouée.</div>';
    return;
  }

  list.innerHTML = G.history.map(h => {
    const win  = (h.bet * h.mult).toFixed(2);
    const diff = h.type === 'win' ? `+$${win}` : `-$${h.bet.toFixed(2)}`;
    return `
      <div class="h-item ${h.type}">
        <span class="h-mult">${h.mult.toFixed(2)}×</span>
        <span class="h-jumps">${h.jumps} saut${h.jumps !== 1 ? 's' : ''}</span>
        <span class="h-amount">${diff}</span>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════
   KEYBOARD
═══════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowRight') {
    e.preventDefault();
    if (G.phase === 'idle')    startGame();
    if (G.phase === 'playing' && !G.jumpAnim) doJump();
  }
  if (e.code === 'KeyC' && G.phase === 'playing') doCashout();
  if (e.code === 'Enter' && G.phase === 'idle')   startGame();
});

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
window.addEventListener('resize', () => {
  resize();
});

document.addEventListener('DOMContentLoaded', () => {
  resize();
  buildTrail();
  updateStats();
  renderHistory();
  if (rafId) cancelAnimationFrame(rafId);
  gameLoop();
});
