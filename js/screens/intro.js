import { navigate } from '../main.js';

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
  "BIOTECH IMPLANTS COULD UNLOCK",
  "SUPERHUMAN ABILITIES —",
  "",
  "MICROSCOPIC REACTION TIMES.",
  "PRETERNATURAL PATTERN RECOGNITION.",
  "THE UNCANNY SENSE OF WHAT ANOTHER",
  "PERSON WAS ABOUT TO DO —",
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

// ~200 words/minute: 200 words * 5 chars/word / 60 sec ≈ 16.7 chars/sec ≈ 60ms/char
const MS_PER_CHAR = 60;
const START_DELAY_MS = 600;

export function mount(container, options = {}) {
  let done = false;
  let timerId = null;

  container.innerHTML = `
    <div class="screen fade-in" id="intro-wrap" style="
      justify-content: center;
      align-items: flex-start;
      position: relative;
      padding-bottom: 64px;
    ">
      <div id="intro-text" style="width:100%"></div>

      <div id="intro-prompt" style="display:none; width:100%; text-align:center; margin-top:32px">
        <span class="snes-highlight" style="font-size:10px">▶ PRESS ANY KEY</span>
        <span class="cursor-blink snes-highlight"> ▌</span>
      </div>

      <button
        id="btn-skip"
        class="snes-btn snes-small"
        style="position:absolute; bottom:24px; right:0; opacity:0.5; font-size:6px; padding:8px 10px"
      >SKIP</button>
    </div>
  `;

  const textEl   = document.getElementById('intro-text');
  const promptEl = document.getElementById('intro-prompt');
  const skipBtn  = document.getElementById('btn-skip');

  function goToLogin() {
    if (timerId) clearTimeout(timerId);
    navigate('login');
  }

  function onRevealComplete() {
    done = true;
    promptEl.style.display = 'block';
    document.addEventListener('keydown', goToLogin, { once: true });
    promptEl.addEventListener('click', goToLogin, { once: true });
  }

  skipBtn.addEventListener('click', goToLogin);

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
