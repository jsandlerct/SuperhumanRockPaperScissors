// Central audio manager. All music/SFX goes through this module.
// Audio respects the per-account music/sfx settings stored in localStorage.

import { loadSession, loadAccountSettings } from '../storage.js';

let _battle = null;
let _win    = null;
let _lose   = null;

const _sfx = { rock: null, paper: null, scissors: null };

function battle() {
  if (!_battle) {
    _battle = new Audio('assets/audio/Battle theme.mp3');
    _battle.loop   = true;
    _battle.volume = 0.6;
  }
  return _battle;
}

function win() {
  if (!_win) {
    _win = new Audio('assets/audio/Win.ogg');
    _win.volume = 0.9;
  }
  return _win;
}

function lose() {
  if (!_lose) {
    _lose = new Audio('assets/audio/Lose.ogg');
    _lose.volume = 0.9;
  }
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

function getSettings() {
  const session = loadSession();
  if (!session?.loggedInUsername) return { music: true, sfx: true };
  return loadAccountSettings(session.loggedInUsername);
}

function isMusicOn() { return getSettings().music !== false; }
function isSfxOn()   { return getSettings().sfx   !== false; }

// Start battle theme looping. No-op if already playing.
export function playBattleTheme() {
  if (!isMusicOn()) return;
  const b = battle();
  if (!b.paused) return;
  win().pause();  win().currentTime  = 0;
  lose().pause(); lose().currentTime = 0;
  b.play().catch(() => {});
}

export function stopBattleTheme() {
  if (!_battle) return;
  _battle.pause();
  _battle.currentTime = 0;
}

// Play win sting (stops battle theme first).
export function playWin() {
  stopBattleTheme();
  if (!isMusicOn()) return;
  const w = win();
  lose().pause(); lose().currentTime = 0;
  w.currentTime = 0;
  w.play().catch(() => {});
}

// Play lose sting (stops battle theme first).
export function playLose() {
  stopBattleTheme();
  if (!isMusicOn()) return;
  const l = lose();
  win().pause(); win().currentTime = 0;
  l.currentTime = 0;
  l.play().catch(() => {});
}

// Play the throw-win SFX for the winning throw ('rock', 'paper', 'scissors').
export function playThrowWin(throw_) {
  if (!isSfxOn()) return;
  const s = sfx(throw_);
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {});
}

export function stopAll() {
  if (_battle) { _battle.pause(); _battle.currentTime = 0; }
  if (_win)    { _win.pause();    _win.currentTime    = 0; }
  if (_lose)   { _lose.pause();   _lose.currentTime   = 0; }
  for (const s of Object.values(_sfx)) { if (s) { s.pause(); s.currentTime = 0; } }
}

// Called by settings toggles so changes take effect immediately.
export function setMusicEnabled(enabled) {
  if (!enabled) {
    if (_battle) { _battle.pause(); _battle.currentTime = 0; }
    if (_win)    { _win.pause();    _win.currentTime    = 0; }
    if (_lose)   { _lose.pause();   _lose.currentTime   = 0; }
  }
}

export function setSfxEnabled(enabled) {
  if (!enabled) {
    for (const s of Object.values(_sfx)) { if (s) { s.pause(); s.currentTime = 0; } }
  }
}
