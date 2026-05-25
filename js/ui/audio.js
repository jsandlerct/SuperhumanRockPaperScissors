// Central audio manager. All music/SFX goes through this module.
// Audio respects the per-account music/sfx settings stored in localStorage.
//
// Battle theme uses the Web Audio API (AudioBufferSourceNode.loop) for
// gapless looping — HTML5 Audio has an unavoidable gap at the MP3 loop point.
// Win/Lose stings and SFX use plain Audio elements (they don't loop).

import { loadSession, loadAccountSettings } from '../storage.js';

// ── Web Audio API — battle theme ──────────────────────────────────────────────

let _ctx          = null;   // AudioContext (shared)
let _battleBuffer = null;   // decoded AudioBuffer (cached after first load)
let _battleSource = null;   // current AudioBufferSourceNode (replaced on each play)
let _battleGain   = null;   // GainNode for volume

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

async function ensureBattleBuffer() {
  if (_battleBuffer) return;
  const res = await fetch('assets/audio/Battle theme.mp3');
  const ab  = await res.arrayBuffer();
  _battleBuffer = await getCtx().decodeAudioData(ab);
}

// ── HTML5 Audio — stings and SFX ─────────────────────────────────────────────

let _win  = null;
let _lose = null;

const _sfx = { rock: null, paper: null, scissors: null };

function win() {
  if (!_win) { _win = new Audio('assets/audio/Win.ogg'); _win.volume = 0.9; }
  return _win;
}

function lose() {
  if (!_lose) { _lose = new Audio('assets/audio/Lose.ogg'); _lose.volume = 0.9; }
  return _lose;
}

function sfx(throw_) {
  if (!_sfx[throw_]) {
    const file = throw_ === 'scissors' ? 'scissor win' : `${throw_} win`;
    _sfx[throw_] = new Audio(`assets/audio/sfx/${file}.wav`);
    _sfx[throw_].volume = 0.8;
  }
  return _sfx[throw_];
}

// ── Settings helpers ──────────────────────────────────────────────────────────

function getSettings() {
  const session = loadSession();
  if (!session?.loggedInUsername) return { music: true, sfx: true };
  return loadAccountSettings(session.loggedInUsername);
}

function isMusicOn() { return getSettings().music !== false; }
function isSfxOn()   { return getSettings().sfx   !== false; }

// ── Public API ────────────────────────────────────────────────────────────────

// Start battle theme looping. No-op if already playing.
// Returns a Promise (resolves once audio has started or been suppressed).
export async function playBattleTheme() {
  if (!isMusicOn()) return;
  if (_battleSource) return; // already playing
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    await ensureBattleBuffer();

    if (!_battleGain) {
      _battleGain = ctx.createGain();
      _battleGain.gain.value = 0.6;
      _battleGain.connect(ctx.destination);
    }

    _battleSource = ctx.createBufferSource();
    _battleSource.buffer = _battleBuffer;
    _battleSource.loop   = true;
    _battleSource.connect(_battleGain);
    _battleSource.start();
  } catch (_) {}
}

export function stopBattleTheme() {
  if (!_battleSource) return;
  try { _battleSource.stop(); } catch (_) {}
  _battleSource.disconnect();
  _battleSource = null;
}

// Play win sting (stops battle theme first).
export function playWin() {
  stopBattleTheme();
  if (!isMusicOn()) return;
  lose().pause(); lose().currentTime = 0;
  win().currentTime = 0;
  win().play().catch(() => {});
}

// Play lose sting (stops battle theme first).
export function playLose() {
  stopBattleTheme();
  if (!isMusicOn()) return;
  win().pause(); win().currentTime = 0;
  lose().currentTime = 0;
  lose().play().catch(() => {});
}

// Play the throw-win SFX ('rock', 'paper', or 'scissors').
export function playThrowWin(throw_) {
  if (!isSfxOn()) return;
  const s = sfx(throw_);
  s.currentTime = 0;
  s.play().catch(() => {});
}

export function stopAll() {
  stopBattleTheme();
  if (_win)  { _win.pause();  _win.currentTime  = 0; }
  if (_lose) { _lose.pause(); _lose.currentTime = 0; }
  for (const s of Object.values(_sfx)) { if (s) { s.pause(); s.currentTime = 0; } }
}

// Called by settings toggles so changes take effect immediately.
export function setMusicEnabled(enabled) {
  if (!enabled) {
    stopBattleTheme();
    if (_win)  { _win.pause();  _win.currentTime  = 0; }
    if (_lose) { _lose.pause(); _lose.currentTime = 0; }
  }
}

export function setSfxEnabled(enabled) {
  if (!enabled) {
    for (const s of Object.values(_sfx)) { if (s) { s.pause(); s.currentTime = 0; } }
  }
}
