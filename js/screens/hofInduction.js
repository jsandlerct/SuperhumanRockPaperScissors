import { navigate }             from '../main.js';
import {
  loadSession, loadIdentity, loadTrophies, saveTrophies, loadAccountSettings,
} from '../storage.js';
import { showJessieDialogue, tutorialBeatShown } from '../ui/jessieDialogue.js';

// ── HOF Induction Screen ───────────────────────────────────────────────────────
// Entered immediately after the HOF suspense screen's white flash (inducted path).
// Sub-Phase 1: cinematic reveal (auto-advancing, no player tap)
// Sub-Phase 2: M-05 Jessie dialogue (4 boxes, tap-dismissed, one-shot)

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const username = session?.loggedInUsername;
  const identity = loadIdentity(charId);
  const settings = loadAccountSettings(username);

  const jessieOn   = settings?.jessie !== false;
  const playerName = identity?.name?.toUpperCase() ?? '???';
  const portraitId = identity?.portraitId ?? 'male_1';

  // ── Not-inducted branch: M-07 dialogue then career summary ────────────────
  // `options.inducted === false` routes here; the induction cinematic is skipped.

  if (options.inducted === false) {
    if (!jessieOn) { navigate('careerSummary', { charId }); return; }

    const trophies = loadTrophies(charId);
    if (tutorialBeatShown(trophies, 'M-07')) {
      navigate('careerSummary', { charId });
      return;
    }

    const playerDisplayName = identity?.name ?? 'kid';
    const M07_LINES = [
      { text: `I'm sorry, ${playerDisplayName}. You didn't get in.`, expression: 'whisper' },
      { text: "Ten seasons. That's a career — and don't let anyone tell you otherwise. You faced ninety-nine of the best competitors this sport has ever produced, and you held your own across every one of them. I wouldn't trade a minute of it.", expression: 'determined' },
    ];

    showJessieDialogue(container, M07_LINES, 'determined', () => {
      const freshTrophies = loadTrophies(charId);
      if (!freshTrophies.jessieOneShots) freshTrophies.jessieOneShots = [];
      if (!freshTrophies.jessieOneShots.includes('M-07')) freshTrophies.jessieOneShots.push('M-07');
      saveTrophies(charId, freshTrophies);
      navigate('careerSummary', { charId });
    });
    return;
  }

  // Inject keyframes once
  if (!document.getElementById('hof-induction-keyframes')) {
    const style = document.createElement('style');
    style.id = 'hof-induction-keyframes';
    style.textContent = `
      @keyframes hofGoldFlash {
        0%   { opacity: 1; }
        50%  { opacity: 0.8; }
        100% { opacity: 0; }
      }
      @keyframes hofPlaqueReveal {
        from { clip-path: inset(100% 0 0 0); opacity: 0; }
        to   { clip-path: inset(0% 0 0 0);   opacity: 1; }
      }
      @keyframes hofBorderPulse {
        0%, 100% { box-shadow: 0 0 0 4px #f8d020, 0 0 0 8px rgba(248,208,32,0.3); }
        50%       { box-shadow: 0 0 0 6px #f8d020, 0 0 0 14px rgba(248,208,32,0.5); }
      }
      @keyframes hofTitleScale {
        from { transform: scale(0.6); opacity: 0; }
        to   { transform: scale(1);   opacity: 1; }
      }
      @keyframes hofConfetti {
        0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
      }
      @keyframes hofGleam {
        0%   { left: -60%; }
        100% { left: 120%; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Sub-Phase 1: gold flash ─────────────────────────────────────────────────

  function runGoldFlash() {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed;inset:0;background:#f8d020;z-index:9998;pointer-events:none;
      animation:hofGoldFlash 0.4s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => { flash.remove(); runPlaqueMaterialize(); }, 400);
  }

  // ── Sub-Phase 1: plaque materializes ────────────────────────────────────────

  function runPlaqueMaterialize() {
    container.innerHTML = `
      <div style="
        position:fixed;inset:0;background:#000;
        display:flex;align-items:center;justify-content:center;
        flex-direction:column;gap:24px;z-index:100;overflow:hidden;
      ">
        <!-- Title -->
        <div id="hof-title" style="
          text-align:center;opacity:0;
          animation:hofTitleScale 0.6s ease-out 0.3s forwards;
        ">
          <p class="snes-title" style="
            font-size:clamp(12px,4vw,22px);color:#f8d020;
            text-shadow:0 0 20px rgba(248,208,32,0.6);
            letter-spacing:0.1em;line-height:2;
          ">HALL OF FAME<br>INDUCTED.</p>
        </div>

        <!-- Plaque -->
        <div id="hof-plaque" style="
          animation:hofPlaqueReveal 1.5s ease-out 0.5s both,
                   hofBorderPulse  2s  ease-in-out 2s infinite;
          border:4px solid #f8d020;
          padding:20px 24px;max-width:340px;width:90%;
          background:linear-gradient(135deg,#1a1a0a 0%,#2a2a10 100%);
          position:relative;overflow:hidden;
          display:flex;flex-direction:column;align-items:center;gap:14px;
        ">
          <!-- Gleam sweep -->
          <div style="
            position:absolute;top:0;bottom:0;width:40%;
            background:linear-gradient(90deg,transparent,rgba(255,255,220,0.15),transparent);
            animation:hofGleam 2.5s ease-in-out 2.5s infinite;
            pointer-events:none;
          "></div>

          <p class="snes-small snes-muted" style="font-size:5px;letter-spacing:0.2em">★ CLASS OF SEASON 10 ★</p>

          <div class="portrait-frame portrait-frame--lg" style="
            border:3px solid #f8d020;flex-shrink:0;
          ">
            <img src="assets/portraits/${portraitId}.png" alt="${playerName}"
              style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">
          </div>

          <p class="snes-label snes-highlight" style="
            text-align:center;font-size:clamp(8px,2.5vw,13px);
            color:#f8d020;text-shadow:0 0 8px rgba(248,208,32,0.5);
          ">${playerName}</p>

          <div style="width:100%;height:2px;background:linear-gradient(90deg,transparent,#f8d020,transparent)"></div>
          <p class="snes-small snes-muted" style="font-size:5px;letter-spacing:0.15em">HALL OF FAME</p>
        </div>

        <!-- Confetti layer -->
        <div id="hof-confetti" style="position:fixed;inset:0;pointer-events:none;z-index:101"></div>
      </div>
    `;

    // Simple pixel confetti: colored squares raining down
    spawnConfetti();

    // After 2s hold, fire M-05
    setTimeout(runM05, 4000);
  }

  // ── Confetti helper ──────────────────────────────────────────────────────────

  function spawnConfetti() {
    const layer  = document.getElementById('hof-confetti');
    if (!layer) return;
    const COLORS = ['#f8d020', '#ff4444', '#44aaff', '#44ff88', '#ff88ff', '#ffffff'];
    for (let i = 0; i < 48; i++) {
      const el = document.createElement('div');
      const sz = 4 + Math.floor(Math.random() * 6);
      const x  = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const dur   = 1.8 + Math.random() * 1.4;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.style.cssText = `
        position:absolute;top:-${sz}px;left:${x}%;
        width:${sz}px;height:${sz}px;background:${color};
        image-rendering:pixelated;
        animation:hofConfetti ${dur}s ease-in ${delay}s forwards;
      `;
      layer.appendChild(el);
    }
    // TODO polish: full confetti pass with recycling and particle physics
  }

  // ── Sub-Phase 2: M-05 Jessie dialogue ────────────────────────────────────────

  function runM05() {
    if (!jessieOn) {
      navigate('careerSummary', { charId });
      return;
    }

    const trophies = loadTrophies(charId);
    if (tutorialBeatShown(trophies, 'M-05')) {
      console.warn('M-05 already shown — skipping to career summary');
      navigate('careerSummary', { charId });
      return;
    }

    const M05_BOXES = [
      { text: "You did it.",                                                               expression: 'fistpump'  },
      { text: "When I walked into that gym and found you, I had one of those feelings. The kind you don't get very often. The kind that tells you something real is about to happen. I was right.", expression: 'determined' },
      { text: "Hall of Fame. The youngest class in years. And you belong in there with every name on that wall.", expression: 'fistpump'  },
      { text: "I'm proud of you. I want you to know that. Whatever comes next — I'm glad we got to do this together.", expression: 'whisper'   },
    ];

    const lines      = M05_BOXES.map(b => ({ text: b.text, expression: b.expression }));
    const expression = 'fistpump'; // default; per-box expression handled via message objects

    showJessieDialogue(
      container,
      lines,
      expression,
      () => {
        // Record M-05 only AFTER Box 4 tap
        const freshTrophies = loadTrophies(charId);
        if (!freshTrophies.jessieOneShots) freshTrophies.jessieOneShots = [];
        if (!freshTrophies.jessieOneShots.includes('M-05')) {
          freshTrophies.jessieOneShots.push('M-05');
        }
        saveTrophies(charId, freshTrophies);
        navigate('careerSummary', { charId });
      },
    );
  }

  // ── Start ─────────────────────────────────────────────────────────────────

  runGoldFlash();
}
