/* ══════════════════════════════════════════════════
   CHICKEN ROAD — Add Funds Logic
   Amount selection · Method selector · Deposit sim
══════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
const fundsState = {
  selectedAmount: null,
  selectedMethod: 'paypal',
};

/* ═══════════════════════════════════════
   AMOUNT SELECTION
═══════════════════════════════════════ */
function selectPresetAmount(btn, amount) {
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fundsState.selectedAmount = parseFloat(amount);
  document.getElementById('customAmountInput').value = '';
  updateSummary();
}

function onCustomAmountInput(e) {
  const val = parseFloat(e.target.value);
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
  fundsState.selectedAmount = (val > 0) ? val : null;
  updateSummary();
}

/* ═══════════════════════════════════════
   METHOD SELECTION
═══════════════════════════════════════ */
function selectMethod(el, method) {
  document.querySelectorAll('.method-item').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
  fundsState.selectedMethod = method;
}

/* ═══════════════════════════════════════
   SUMMARY UPDATE
═══════════════════════════════════════ */
function updateSummary() {
  const amt      = fundsState.selectedAmount;
  const sumAmt   = document.getElementById('sumAmount');
  const sumTotal = document.getElementById('sumTotal');
  const depBtn   = document.getElementById('depositBtn');

  if (amt && amt > 0) {
    sumAmt.textContent   = `$${amt.toFixed(2)}`;
    sumTotal.textContent = `$${amt.toFixed(2)}`;
    depBtn.disabled = false;
  } else {
    sumAmt.textContent   = '—';
    sumTotal.textContent = '$0.00';
    depBtn.disabled = true;
  }
}

/* ═══════════════════════════════════════
   SIMULATE DEPOSIT
═══════════════════════════════════════ */
function simulateDeposit() {
  const amt = fundsState.selectedAmount;
  if (!amt || amt <= 0) return;

  const btn = document.getElementById('depositBtn');
  const originalText = btn.textContent;

  // Loading state
  btn.disabled = true;
  btn.innerHTML = `<span style="display:inline-block;width:18px;height:18px;border:2px solid rgba(8,9,16,.3);border-top-color:#080910;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px;"></span> Traitement...`;

  const method = fundsState.selectedMethod;
  const methodNames = { paypal: 'PayPal', crypto: 'Crypto' };

  // Simulate processing delay
  setTimeout(() => {
    addBalance(amt);
    updateDisplayBalance();
    saveDepositHistory(amt, method);
    renderDepositHistory();

    // Reset button
    btn.disabled = false;
    btn.textContent = originalText;

    // Particle burst on button
    const rect = btn.getBoundingClientRect();
    particleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'win');


    // Reset selection
    document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('customAmountInput').value = '';
    fundsState.selectedAmount = null;
    updateSummary();

  }, 1200 + Math.random() * 600);
}

/* ═══════════════════════════════════════
   DEPOSIT HISTORY (per user)
═══════════════════════════════════════ */
function saveDepositHistory(amount, method) {
  const s = getSession();
  if (!s) return;
  const users = getUsers();
  const idx = users.findIndex(u => u.username === s.username);
  if (idx < 0) return;

  if (!users[idx].depositHistory) users[idx].depositHistory = [];
  users[idx].depositHistory.unshift({
    amount, method,
    timestamp: Date.now(),
    date: new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  });
  // Keep last 10
  users[idx].depositHistory = users[idx].depositHistory.slice(0, 10);
  saveUsers(users);
}

function getDepositHistory() {
  const s = getSession();
  if (!s) return [];
  const users = getUsers();
  const user = users.find(u => u.username === s.username);
  return user ? (user.depositHistory || []) : [];
}

function renderDepositHistory() {
  const list = document.getElementById('depositHistoryList');
  if (!list) return;

  const history = getDepositHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="dh-empty">Aucun dépôt effectué pour l\'instant.</div>';
    return;
  }

  const methodIcons = { paypal: '🅿️', crypto: '₿' };
  const methodNames = { paypal: 'PayPal', crypto: 'Crypto' };

  list.innerHTML = history.map(h => `
    <div class="dh-item">
      <span class="dh-icon">${methodIcons[h.method] || '💳'}</span>
      <div class="dh-info">
        <div class="dh-method">${methodNames[h.method] || h.method}</div>
        <div class="dh-time">${h.date}</div>
      </div>
      <span class="dh-amount">+$${parseFloat(h.amount).toFixed(2)}</span>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════
   DISPLAY BALANCE
═══════════════════════════════════════ */
function updateDisplayBalance() {
  const el = document.getElementById('displayBalance');
  if (el) {
    el.textContent = getBalance().toFixed(2);
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'popIn .4s cubic-bezier(.34,1.56,.64,1) both';
  }
  refreshNavBalance();
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  updateSummary();
  updateDisplayBalance();
  renderDepositHistory();

  // Set PayPal as default active
  const defaultMethod = document.querySelector('.method-item[data-method="paypal"]');
  if (defaultMethod) defaultMethod.classList.add('active');
});
