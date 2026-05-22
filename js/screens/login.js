import { navigate } from '../main.js';
import { loadMeta, saveMeta, loadAccount, saveAccount } from '../storage.js';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function mount(container, options = {}) {
  const meta     = loadMeta();
  const accounts = meta.accountUsernames || [];

  let mode            = accounts.length === 0 ? 'create' : 'login';
  let selectedAccount = accounts[0] ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────

  function render() {
    container.innerHTML = mode === 'login' ? buildLoginHTML() : buildCreateHTML();
    attachListeners();
  }

  function buildLoginHTML() {
    const items = accounts.map(u => {
      const sel = u === selectedAccount;
      return `
        <div class="account-row ${sel ? 'account-row--selected' : ''}"
             data-user="${u}"
             style="
               padding: 10px 8px;
               cursor: pointer;
               display: flex;
               align-items: center;
               gap: 4px;
               min-height: 44px;
               transition: background 0s;
               ${sel ? 'background: var(--snes-border);' : ''}
             ">
          <span class="snes-highlight" style="width:12px;display:inline-block">
            ${sel ? '▶' : ''}
          </span>
          <span class="snes-label">${u.toUpperCase()}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="screen fade-in" style="justify-content:center">
        <div class="content-card" style="gap:20px">
          <p class="snes-title" style="text-align:center">SRPS</p>
          <p class="snes-small snes-muted" style="text-align:center">SUPERHUMAN ROCK PAPER SCISSORS</p>

          <div class="snes-panel">
            <p class="snes-small snes-highlight" style="margin-bottom:10px">SELECT ACCOUNT</p>
            <div id="account-list">${items}</div>
          </div>

          <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
            <label class="snes-small snes-muted" for="inp-password">PASSWORD</label>
            <input
              class="snes-input"
              id="inp-password"
              type="password"
              maxlength="32"
              autocomplete="current-password"
              placeholder="••••••••"
            >
            <p class="snes-label snes-error" id="login-error" style="display:none;margin-top:4px"></p>
          </div>

          <button class="snes-btn snes-btn-yellow" id="btn-login" style="width:100%">
            ▶ LOGIN
          </button>
          <button class="snes-btn" id="btn-new-account" style="width:100%;opacity:0.7">
            + NEW ACCOUNT
          </button>
        </div>
      </div>
    `;
  }

  function buildCreateHTML() {
    const hasBack = accounts.length > 0;
    return `
      <div class="screen fade-in" style="justify-content:center">
        <div class="content-card" style="gap:20px">
          <p class="snes-title" style="text-align:center">SRPS</p>
          <p class="snes-small snes-muted" style="text-align:center">SUPERHUMAN ROCK PAPER SCISSORS</p>

          <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
            <p class="snes-small snes-highlight" style="margin-bottom:2px">CREATE ACCOUNT</p>

            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <label class="snes-small snes-muted" for="inp-username">USERNAME</label>
              <span class="snes-small snes-muted" id="username-counter" style="font-size:5px">0 / 16</span>
            </div>
            <input
              class="snes-input"
              id="inp-username"
              type="text"
              maxlength="16"
              autocomplete="username"
              placeholder="3-16 CHARS"
              spellcheck="false"
            >

            <label class="snes-small snes-muted" for="inp-pass1">PASSWORD</label>
            <input
              class="snes-input"
              id="inp-pass1"
              type="password"
              maxlength="32"
              autocomplete="new-password"
              placeholder="4+ CHARS"
            >

            <label class="snes-small snes-muted" for="inp-pass2">CONFIRM</label>
            <input
              class="snes-input"
              id="inp-pass2"
              type="password"
              maxlength="32"
              autocomplete="new-password"
              placeholder="REPEAT PASSWORD"
            >

            <p class="snes-label snes-error" id="create-error" style="display:none;margin-top:4px"></p>
          </div>

          <button class="snes-btn snes-btn-yellow" id="btn-create" style="width:100%">
            ▶ CREATE &amp; PLAY
          </button>
          ${hasBack
            ? `<button class="snes-btn" id="btn-back" style="width:100%;opacity:0.7">← BACK</button>`
            : ''}
        </div>
      </div>
    `;
  }

  // ── Listeners ───────────────────────────────────────────────────────────────

  function attachListeners() {
    if (mode === 'login') {
      document.querySelectorAll('.account-row').forEach(el => {
        el.addEventListener('click', () => {
          selectedAccount = el.dataset.user;
          render();
          document.getElementById('inp-password')?.focus();
        });
        // Hover highlight for mouse users
        el.addEventListener('mouseenter', () => {
          if (el.dataset.user !== selectedAccount)
            el.style.background = 'rgba(80,80,184,0.3)';
        });
        el.addEventListener('mouseleave', () => {
          if (el.dataset.user !== selectedAccount)
            el.style.background = '';
        });
      });

      const pwInput = document.getElementById('inp-password');
      // Clear error as soon as the player starts typing a new password
      pwInput?.addEventListener('input', () => {
        const errorEl = document.getElementById('login-error');
        if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
      });
      pwInput?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
      pwInput?.focus();

      document.getElementById('btn-login')?.addEventListener('click', handleLogin);
      document.getElementById('btn-new-account')?.addEventListener('click', () => {
        mode = 'create';
        render();
      });
    } else {
      const usernameInput = document.getElementById('inp-username');
      const counter = document.getElementById('username-counter');
      usernameInput?.addEventListener('input', () => {
        const len = usernameInput.value.length;
        if (counter) {
          counter.textContent = `${len} / 16`;
          counter.style.color = len >= 16 ? 'var(--snes-red)' : '';
        }
        // Clear error on any input change
        const errorEl = document.getElementById('create-error');
        if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
      });

      document.getElementById('inp-pass2')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleCreate();
      });
      usernameInput?.focus();

      document.getElementById('btn-create')?.addEventListener('click', handleCreate);
      document.getElementById('btn-back')?.addEventListener('click', () => {
        mode = 'login';
        render();
      });
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleLogin() {
    const errorEl  = document.getElementById('login-error');
    const password = document.getElementById('inp-password').value;

    if (!selectedAccount) {
      showError(errorEl, 'SELECT AN ACCOUNT');
      return;
    }
    if (!password) {
      showError(errorEl, 'ENTER YOUR PASSWORD');
      return;
    }

    const account = loadAccount(selectedAccount);
    if (!account) {
      showError(errorEl, 'INVALID USERNAME OR PASSWORD');
      return;
    }

    const hash = await sha256(password);
    if (hash !== account.passwordHash) {
      showError(errorEl, 'INVALID USERNAME OR PASSWORD');
      document.getElementById('inp-password').value = '';
      document.getElementById('inp-password').focus();
      return;
    }

    navigate('characterSelect', { username: selectedAccount });
  }

  async function handleCreate() {
    const errorEl = document.getElementById('create-error');
    const username = document.getElementById('inp-username').value.trim().toLowerCase();
    const pass1    = document.getElementById('inp-pass1').value;
    const pass2    = document.getElementById('inp-pass2').value;

    if (!username || username.length < 3) {
      showError(errorEl, 'USERNAME: 3 CHARS MINIMUM');
      return;
    }
    if (/\s/.test(username)) {
      showError(errorEl, 'NO SPACES IN USERNAME');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      showError(errorEl, 'LETTERS, NUMBERS, _ ONLY');
      return;
    }
    if (loadAccount(username)) {
      showError(errorEl, 'USERNAME ALREADY TAKEN');
      return;
    }
    if (!pass1 || pass1.length < 4) {
      showError(errorEl, 'PASSWORD: 4 CHARS MINIMUM');
      return;
    }
    if (pass1 !== pass2) {
      showError(errorEl, 'PASSWORDS DO NOT MATCH');
      document.getElementById('inp-pass2').value = '';
      document.getElementById('inp-pass2').focus();
      return;
    }

    const hash = await sha256(pass1);
    saveAccount(username, { username, passwordHash: hash, characterIds: [] });

    const updatedMeta = loadMeta();
    updatedMeta.accountUsernames = updatedMeta.accountUsernames || [];
    if (!updatedMeta.accountUsernames.includes(username)) {
      updatedMeta.accountUsernames.push(username);
      saveMeta(updatedMeta);
    }

    navigate('characterSelect', { username });
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  // ── Go ───────────────────────────────────────────────────────────────────────

  render();
}
