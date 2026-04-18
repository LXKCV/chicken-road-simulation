/* ══════════════════════════════════════════════════
   CHICKEN ROAD — Authentication Logic
   Register · Login · Tab switching · Validation
══════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════ */
function switchTab(tab) {
  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLogin     = document.getElementById('tab-login');
  const tabRegister  = document.getElementById('tab-register');

  if (!loginForm || !registerForm) return;

  clearErrors();

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
  }
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
  document.querySelectorAll('.field-input').forEach(el => el.classList.remove('error'));
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

/* ═══════════════════════════════════════
   PASSWORD TOGGLE
═══════════════════════════════════════ */
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁';
  }
}

/* ═══════════════════════════════════════
   PASSWORD STRENGTH
═══════════════════════════════════════ */
function setupPasswordStrength() {
  const input = document.getElementById('regPassword');
  const bar   = document.getElementById('pwdStrengthBar');
  const hint  = document.getElementById('pwdHint');
  if (!input || !bar) return;

  input.addEventListener('input', () => {
    const p = input.value;
    let score = 0;
    if (p.length >= 6)  score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;

    const levels = [
      { w: '0%',   color: 'transparent',  label: '' },
      { w: '25%',  color: '#ff4055',      label: 'Très faible' },
      { w: '50%',  color: '#ff8c42',      label: 'Faible' },
      { w: '75%',  color: '#f5c842',      label: 'Correct' },
      { w: '90%',  color: '#39ff8f',      label: 'Fort' },
      { w: '100%', color: '#39ff8f',      label: 'Très fort' },
    ];
    const lvl = levels[Math.min(score, 5)];
    bar.style.width    = lvl.w;
    bar.style.background = lvl.color;
    if (hint) hint.textContent = lvl.label;
  });
}

/* ═══════════════════════════════════════
   BUTTON LOADING STATE
═══════════════════════════════════════ */
function setLoading(btn, loading, originalText) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Chargement...`;
  } else {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/* ═══════════════════════════════════════
   REGISTER
═══════════════════════════════════════ */
function handleRegister(e) {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const btn      = e.submitter || document.querySelector('#registerForm button[type="submit"]');

  // Validate username
  const unErr = validateUsername(username);
  if (unErr) {
    document.getElementById('regUsername').classList.add('error');
    showError('registerError', unErr);
    return;
  }

  // Check username availability
  if (findUser(username)) {
    document.getElementById('regUsername').classList.add('error');
    showError('registerError', 'Ce nom d\'utilisateur est déjà pris. Choisissez-en un autre.');
    return;
  }

  // Validate password
  const pwErr = validatePassword(password);
  if (pwErr) {
    document.getElementById('regPassword').classList.add('error');
    showError('registerError', pwErr);
    return;
  }

  // Confirm password
  if (password !== confirm) {
    document.getElementById('regConfirm').classList.add('error');
    showError('registerError', 'Les mots de passe ne correspondent pas.');
    return;
  }

  setLoading(btn, true, 'CRÉER UN COMPTE');

  // Simulate network delay for realism
  setTimeout(() => {
    // Create user with welcome bonus
    const users = getUsers();
    const newUser = {
      username: username,
      password: password,          // demo only — no real hashing needed
      createdAt: new Date().toISOString(),
      depositHistory: []
    };
    users.push(newUser);
    saveUsers(users);

    // Set session
    setSession({ username: username, loggedIn: true, loginAt: Date.now() });

    // Redirect
    showToast(`🎉 Bienvenue ${username} ! +$100 offerts !`, 'win');
    setTimeout(() => { window.location.href = 'game.html'; }, 900);
  }, 700);
}

/* ═══════════════════════════════════════
   LOGIN
═══════════════════════════════════════ */
function handleLogin(e) {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = e.submitter || document.querySelector('#loginForm button[type="submit"]');

  if (!username) {
    document.getElementById('loginUsername').classList.add('error');
    showError('loginError', 'Veuillez entrer votre nom d\'utilisateur.');
    return;
  }
  if (!password) {
    document.getElementById('loginPassword').classList.add('error');
    showError('loginError', 'Veuillez entrer votre mot de passe.');
    return;
  }

  setLoading(btn, true, 'LOGIN');

  setTimeout(() => {
    const user = findUser(username);

    if (!user) {
      setLoading(btn, false, 'LOGIN');
      document.getElementById('loginUsername').classList.add('error');
      showError('loginError', 'Aucun compte trouvé avec ce nom d\'utilisateur.');
      return;
    }

    if (user.password !== password) {
      setLoading(btn, false, 'LOGIN');
      document.getElementById('loginPassword').classList.add('error');
      showError('loginError', 'Mot de passe incorrect. Réessayez.');
      return;
    }

    // Update session
    setSession({ username: user.username, loggedIn: true, loginAt: Date.now() });

    showToast(`👋 Bon retour, ${user.username} !`, 'info');
    setTimeout(() => { window.location.href = 'game.html'; }, 700);
  }, 500);
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupPasswordStrength();
});
