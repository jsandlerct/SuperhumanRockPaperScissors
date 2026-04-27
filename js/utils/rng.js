// All randomness in the game goes through this function. Never call Math.random() directly.
// This makes the RNG mockable for testing.
export function roll() {
  return Math.random();
}
