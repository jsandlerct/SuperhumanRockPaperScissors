// All randomness in the game goes through this function. Never call Math.random() directly.
// This makes the RNG mockable for testing.
let _rollFn = Math.random;

export function roll() {
  return _rollFn();
}

// Test use only — restore to Math.random after each test that calls this.
export function setRollFn(fn) {
  _rollFn = fn;
}

export function resetRoll() {
  _rollFn = Math.random;
}
