import { navigate }      from '../main.js';
import {
  loadSession, loadAccountSettings,
} from '../storage.js';
import { evaluateHOF }   from '../systems/seasonEngine.js';

// ── HOF Suspense Screen ────────────────────────────────────────────────────────
// Shared pre-reveal for both inducted and not-inducted paths.
// Three auto-advancing phases:
//   A — Blackout with "SEASON 10 COMPLETE." text crawl
//   B — Committee panel with Jessie line; evaluateHOF() runs here
//   C — White flash → branch to induction screen or M-07 → career summary

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const username = session?.loggedInUsername;

  const jessieOn = loadAccountSettings(username)?.jessie !== false;

  // Inject CSS animation keyframes once
  if (!document.getElementById('hof-keyframes')) {
    const style = document.createElement('style');
    style.id = 'hof-keyframes';
    style.textContent = `
      @keyframes slideInFromBottom {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      @keyframes hofFlashWhite {
        0%   { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes hofTrophyPulse {
        0%, 100% { opacity: 0.25; }
        50%       { opacity: 0.70; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Phase A — Blackout text crawl ─────────────────────────────────────────

  function runPhaseA() {
    container.innerHTML = `
      <div style="
        position:fixed;inset:0;background:#000;
        display:flex;align-items:center;justify-content:center;
        flex-direction:column;z-index:100;
      ">
        <p id="hof-crawl" class="snes-title" style="
          text-align:center;font-size:clamp(10px,3vw,18px);
          color:#fff;line-height:2;white-space:pre-line;letter-spacing:0.05em;
        "></p>
      </div>
    `;

    const fullText = 'SEASON 10\nCOMPLETE.';
    const textEl   = document.getElementById('hof-crawl');
    let charIdx = 0;

    const ticker = setInterval(() => {
      if (charIdx < fullText.length) {
        textEl.textContent = fullText.slice(0, charIdx + 1);
        charIdx++;
      } else {
        clearInterval(ticker);
        setTimeout(runPhaseB, 1200);
      }
    }, 80);
  }

  // ── Phase B — Committee panel ─────────────────────────────────────────────

  function runPhaseB() {
    container.innerHTML = `
      <div style="
        position:fixed;inset:0;background:#000;
        display:flex;align-items:flex-end;justify-content:center;
        z-index:100;
      ">
        <div class="snes-panel" style="
          width:100%;max-width:560px;box-sizing:border-box;
          display:flex;flex-direction:column;gap:20px;
          padding:24px 20px 32px;
          border-radius:0;border-bottom:none;
          animation:slideInFromBottom 0.5s ease-out both;
        ">
          <p class="snes-small snes-muted" style="text-align:center;line-height:2">
            HALL OF FAME COMMITTEE<br>REVIEWING YOUR 10-SEASON RECORD...
          </p>

          <div style="display:flex;justify-content:center;align-items:center;gap:12px">
            <span style="
              font-size:28px;display:inline-block;
              animation:hofTrophyPulse 1.6s ease-in-out infinite;
            ">🏆</span>
            <p class="snes-small snes-muted" id="hof-dots" style="letter-spacing:4px">...</p>
          </div>

          ${jessieOn ? `
          <div class="snes-panel" style="display:flex;align-items:flex-start;gap:14px">
            <div class="portrait-frame portrait-frame--lg" style="flex-shrink:0">
              <img src="assets/portraits/jessie/Jessie_determined.png" alt="Jessie"
                style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:8px">
              <p class="snes-small snes-highlight">JESSIE</p>
              <p class="snes-small" id="hof-jessie-text" style="line-height:1.8"></p>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    // Animated ellipsis
    const dotsEl  = document.getElementById('hof-dots');
    let dotCount  = 3;
    const dotTimer = setInterval(() => {
      dotCount = (dotCount % 3) + 1;
      if (dotsEl) dotsEl.textContent = '.'.repeat(dotCount);
    }, 500);

    let hofResult = null;

    function onPhaseBDone() {
      clearInterval(dotTimer);
      if (hofResult === null) hofResult = evaluateHOF(charId);
      setTimeout(() => runPhaseC(hofResult), 2000);
    }

    const JESSIE_LINE =
      "Ten seasons. The committee has your full record in front of them right now. Whatever they decide — you gave them something real to look at.";

    if (jessieOn) {
      const jessieTextEl = document.getElementById('hof-jessie-text');
      let charIdx = 0;

      // Start evaluateHOF midway through the crawl so result is ready for Phase C
      setTimeout(() => { hofResult = evaluateHOF(charId); }, 600);

      const crawlTimer = setInterval(() => {
        if (!jessieTextEl) { clearInterval(crawlTimer); onPhaseBDone(); return; }
        if (charIdx < JESSIE_LINE.length) {
          jessieTextEl.textContent = JESSIE_LINE.slice(0, charIdx + 1);
          charIdx++;
        } else {
          clearInterval(crawlTimer);
          onPhaseBDone();
        }
      }, 35);
    } else {
      hofResult = evaluateHOF(charId);
      setTimeout(() => {
        clearInterval(dotTimer);
        runPhaseC(hofResult);
      }, 3500);
    }
  }

  // ── Phase C — White flash then branch ─────────────────────────────────────
  // Both paths navigate through hofInduction so the screen is properly
  // reset by navigate() before any dialogue is rendered.

  function runPhaseC(inducted) {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed;inset:0;background:#fff;z-index:9999;pointer-events:none;
      animation:hofFlashWhite 0.3s ease-out forwards;
    `;
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.remove();
      navigate('hofInduction', { charId, inducted });
    }, 300);
  }

  // ── Start ─────────────────────────────────────────────────────────────────

  runPhaseA();
}
