import { navigate } from '../main.js';
import { loadMeta, saveMeta } from '../storage.js';

const INTRO_TEXT = [
  "THE YEAR IS 2050.",
  "",
  "HUMANITY SOLVED A LOT OF PROBLEMS.",
  "",
  "CLIMATE CHANGE.",
  "DISEASE.",
  "THE ETERNAL DEBATE OVER WHETHER",
  "A HOT DOG IS A SANDWICH.",
  "",
  "BUT ONE OBSESSION CONSUMED US",
  "ABOVE ALL OTHERS.",
  "",
  "WHEN SCIENTISTS DISCOVERED THAT",
  "BIOTECH IMPLANTS UTILIZING QUANTUM",
  "MECHANICS COULD UNLOCK SUPERHUMAN ABILITIES —",
  "",
  "MICROSCOPIC PERCEPTION AND REACTION TIMES.",
  "THE ABILITY TO INFLUENCE THOUGHTS AND ACTIONS.",
  "EVEN THE ABILITY TO CREATE ORDER FROM WHAT",
  "WAS SEEMINGLY RANDOM CHAOS.",
  "",
  "THE WORLD'S GOVERNMENTS,",
  "CORPORATIONS, AND MILITARIES",
  "IMMEDIATELY RECOGNIZED",
  "THE IMPLICATIONS.",
  "",
  "THEY USED THIS TECHNOLOGY",
  "EXCLUSIVELY TO GET BETTER",
  "AT ROCK PAPER SCISSORS.",
  "",
  "BY 2042, THE UN HAD FORMALLY ADOPTED",
  "RPS AS THE UNIVERSAL FRAMEWORK",
  "FOR RESOLVING ALL DISPUTES.",
  "",
  "ELECTIONS.",
  "TRADE WARS.",
  "TERRITORIAL BOUNDARIES.",
  "",
  "THE WORLD CHAMPION HELD MORE INFORMAL",
  "POWER THAN ANY HEAD OF STATE.",
  "",
  "CHILDREN DRESSED AS THEM FOR HALLOWEEN.",
  "",
  "YOU HAVE SPENT YOUR WHOLE LIFE",
  "DREAMING OF THAT TITLE.",
  "",
  "TODAY, IN A SMALL GYMNASIUM",
  "THAT SMELLS FAINTLY OF",
  "LINOLEUM AND AMBITION,",
  "",
  "YOUR JOURNEY BEGINS.",
].join('\n');

// ~300 words/minute: 300 words * 5 chars/word / 60 sec = 25 chars/sec = 40ms/char
const MS_PER_CHAR = 40;
const START_DELAY_MS = 600;

// How long to pause at the end before auto-advancing to title
const POST_REVEAL_DELAY_MS = 1500;
// How long after mount before the skip button fades in
const SKIP_FADE_IN_MS = 2000;

export function mount(container, options = {}) {
  let done = false;
  let timerId = null;
  let autoAdvanceId = null;

  container.innerHTML = `
    <div class="screen fade-in" id="intro-wrap" style="
      justify-content: center;
      align-items: flex-start;
      position: relative;
      padding-bottom: 64px;
    ">
      <div class="content-card">
        <div id="intro-text"></div>
      </div>

      <button
        id="btn-skip"
        class="snes-btn snes-small"
        style="position:absolute; bottom:24px; right:clamp(16px,4vw,64px); opacity:0; font-size:6px; padding:8px 10px; transition: opacity 0.4s ease"
      >SKIP ▶</button>
    </div>
  `;

  const textEl  = document.getElementById('intro-text');
  const skipBtn = document.getElementById('btn-skip');

  function markIntroSeen() {
    const meta = loadMeta();
    meta.introSeen = true;
    saveMeta(meta);
  }

  function goToTitle() {
    if (timerId)        clearTimeout(timerId);
    if (autoAdvanceId)  clearTimeout(autoAdvanceId);
    markIntroSeen();
    navigate('title');
  }

  function onRevealComplete() {
    done = true;
    document.addEventListener('keydown', goToTitle, { once: true });
    document.getElementById('intro-wrap')?.addEventListener('click', goToTitle, { once: true });
    // Auto-advance after a short pause — no "press any key" prompt needed
    autoAdvanceId = setTimeout(goToTitle, POST_REVEAL_DELAY_MS);
  }

  skipBtn.addEventListener('click', goToTitle);

  // Fade the skip button in after a delay so the opening atmosphere lands first
  setTimeout(() => {
    const btn = document.getElementById('btn-skip');
    if (btn) btn.style.opacity = '0.7';
  }, SKIP_FADE_IN_MS);

  // Typewriter reveal
  let charIndex = 0;

  function renderText() {
    const visible = INTRO_TEXT.slice(0, charIndex);
    textEl.innerHTML = visible
      .split('\n')
      .map(line => `<p class="snes-label" style="min-height:1.6em">${line || ''}</p>`)
      .join('');
  }

  function tick() {
    if (charIndex >= INTRO_TEXT.length) {
      renderText();
      onRevealComplete();
      return;
    }
    charIndex++;
    renderText();
    timerId = setTimeout(tick, MS_PER_CHAR);
  }

  timerId = setTimeout(tick, START_DELAY_MS);
}
