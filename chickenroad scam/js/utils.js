/* ══════════════════════════════════════════════════
   CHICKEN ROAD — Shared Utilities
   Auth · Balance · Nav · Toast · Particles
══════════════════════════════════════════════════ */

'use strict';

// ── Storage Keys ──────────────────────────────────
const KEY_USERS   = 'cr_users';
const KEY_SESSION = 'cr_session';

/* ═══════════════════════════════════════
   USER MANAGEMENT
═══════════════════════════════════════ */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS) || '[]'); }
  catch { return []; }
}
function saveUsers(users) {
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
}
function findUser(username) {
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

/* ═══════════════════════════════════════
   SESSION
═══════════════════════════════════════ */
function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY_SESSION)); }
  catch { return null; }
}
function setSession(data) {
  localStorage.setItem(KEY_SESSION, JSON.stringify(data));
}
function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}
function isLoggedIn() {
  const s = getSession();
  return !!(s && s.loggedIn && s.username);
}
function getUsername() {
  const s = getSession();
  return s ? s.username : null;
}

/* ═══════════════════════════════════════
   BALANCE (per user, stored in user obj)
═══════════════════════════════════════ */
function getBalance() {
  const s = getSession();
  if (!s) return 0;
  const users = getUsers();
  const user = users.find(u => u.username === s.username);
  return user ? (parseFloat(user.balance) || 0) : 0;
}
function setBalance(amount) {
  const s = getSession();
  if (!s) return;
  const users = getUsers();
  const idx = users.findIndex(u => u.username === s.username);
  if (idx >= 0) {
    users[idx].balance = Math.max(0, parseFloat(amount.toFixed(2)));
    saveUsers(users);
    refreshNavBalance();
  }
}
function addBalance(amount) {
  setBalance(getBalance() + amount);
}
function subtractBalance(amount) {
  const bal = getBalance();
  if (amount > bal) return false;
  setBalance(bal - amount);
  return true;
}

/* ═══════════════════════════════════════
   AUTH GUARD
═══════════════════════════════════════ */
function requireAuth(redirect = 'auth.html') {
  if (!isLoggedIn()) {
    window.location.href = redirect;
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════
   LOGOUT
═══════════════════════════════════════ */
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

/* ═══════════════════════════════════════
   NAV RENDERING
═══════════════════════════════════════ */
function renderNav(activePage = '') {
  const navEl = document.getElementById('main-nav');
  if (!navEl) return;

  const loggedIn = isLoggedIn();
  const username = getUsername() || '';
  const balance  = getBalance();
  const initial  = username ? username[0].toUpperCase() : '?';

  navEl.innerHTML = `
    <div class="nav-inner">
      <a class="nav-logo" href="index.html">🐔 CHICKEN ROAD</a>

      <nav class="nav-links">
        <a href="index.html"     class="nav-link ${activePage === 'home'  ? 'active' : ''}">Accueil</a>
        ${loggedIn ? `<a href="game.html"      class="nav-link ${activePage === 'game'  ? 'active' : ''}">Jouer</a>` : ''}
        ${loggedIn ? `<a href="add-funds.html" class="nav-link ${activePage === 'funds' ? 'active' : ''}">Ajouter Fonds</a>` : ''}
      </nav>

      <div class="nav-right">
        ${loggedIn ? `
          <div class="nav-wallet">
            <span class="wallet-dot"></span>
            $<span id="nav-balance">${balance.toFixed(2)}</span>
          </div>
          <div class="nav-user">
            <div class="user-avatar">${initial}</div>
            <span class="user-name">${username}</span>
          </div>
          <button class="nav-logout" onclick="logout()">Déconnexion</button>
        ` : `
          <a href="auth.html" class="btn-outline-sm">Connexion</a>
          <a href="auth.html?tab=register" class="btn-neon-sm">S'inscrire</a>
        `}
      </div>

      <button class="nav-hamburger" onclick="toggleMobileNav()" aria-label="Menu">☰</button>
    </div>

    <div class="nav-mobile" id="navMobile">
      <a href="index.html">🏠 Accueil</a>
      ${loggedIn ? `<a href="game.html">🎮 Jouer</a>` : ''}
      ${loggedIn ? `<a href="add-funds.html">💰 Ajouter Fonds</a>` : ''}
      ${loggedIn
        ? `<button onclick="logout()">🚪 Déconnexion (${username})</button>`
        : `<a href="auth.html">🔑 Connexion / Inscription</a>`
      }
    </div>
  `;
}

function toggleMobileNav() {
  const m = document.getElementById('navMobile');
  if (m) m.classList.toggle('open');
}

function refreshNavBalance() {
  const el = document.getElementById('nav-balance');
  if (el) el.textContent = getBalance().toFixed(2);
}

/* ═══════════════════════════════════════
   TOAST NOTIFICATION
═══════════════════════════════════════ */
let _toastTimer = null;

function showToast(msg, type = 'info') {
  // Remove existing
  let toast = document.getElementById('cr-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cr-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `cr-toast cr-toast-${type}`;
  // Force reflow
  void toast.offsetWidth;
  toast.classList.add('cr-toast-show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('cr-toast-show');
  }, 3800);
}

/* ═══════════════════════════════════════
   PARTICLE BURST
═══════════════════════════════════════ */
function particleBurst(cx, cy, type = 'win') {
  const icons = type === 'win'
    ? ['💰', '⭐', '🥚', '🐔', '✨', '🪙', '🎉']
    : ['💥', '🔥', '😵', '💨', '🍳'];

  for (let i = 0; i < 18; i++) {
    const el = document.createElement('span');
    const angle = Math.random() * Math.PI * 2;
    const dist  = 70 + Math.random() * 140;
    el.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999;
      font-size:${1 + Math.random() * 0.8}rem;
      left:${cx}px; top:${cy}px;
      --tx:${Math.cos(angle) * dist}px;
      --ty:${Math.sin(angle) * dist - 60}px;
      animation: crBurst 1.2s forwards ease-out;
    `;
    el.textContent = icons[Math.floor(Math.random() * icons.length)];
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

/* ═══════════════════════════════════════
   SCREEN SHAKE
═══════════════════════════════════════ */
function shakeElement(el, intensity = 8) {
  if (!el) return;
  el.style.animation = `shake .5s ease both`;
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

/* ═══════════════════════════════════════
   VALIDATION HELPERS
═══════════════════════════════════════ */
function validateUsername(u) {
  if (!u || u.length < 3)  return 'Le nom d\'utilisateur doit contenir au moins 3 caractères.';
  if (u.length > 20)       return 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Lettres, chiffres et _ uniquement.';
  return null;
}
function validatePassword(p) {
  if (!p || p.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
  return null;
}
