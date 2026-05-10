// Shared Jessie dialogue utilities used by all screens.
// showJessieDialogue: full-screen tap-through dialogue box.
// jessieInlinePanel: returns HTML for the static inline panel variant (used in offSeason).

// opts.autoDismissMs: if set, the last message auto-dismisses after that many ms (still tappable).
export function showJessieDialogue(container, messages, expression, onComplete, opts = {}) {
  if (!messages || messages.length === 0) {
    onComplete();
    return;
  }
  const autoDismissMs = opts.autoDismissMs ?? null;
  let idx = 0;

  function showMessage() {
    const isLast    = idx === messages.length - 1;
    const msg       = messages[idx];
    const isNarration = typeof msg === 'object' && msg.narration === true;
    const text      = typeof msg === 'string' ? msg : msg.text;
    const expr      = isNarration ? null
      : typeof msg === 'string' ? expression
      : (msg.expression ?? expression ?? 'default');

    const counterHtml = messages.length > 1 ? `
      <p class="snes-small snes-muted" style="text-align:right">${idx + 1} / ${messages.length}</p>
    ` : '';

    const btnLabel = (autoDismissMs && isLast) ? '▶ SKIP' : isLast ? '▶ CONTINUE' : '▼ NEXT';

    const skipBtn = `
      <button id="btn-jessie-skip"
              class="snes-btn"
              style="position:fixed;bottom:16px;right:16px;z-index:9999;font-size:6px;padding:6px 10px;opacity:0.65">
        SKIP TUTORIAL
      </button>
    `;

    if (isNarration) {
      container.innerHTML = `
        <div class="screen fade-in" style="justify-content:center">
          <div class="content-card" style="gap:20px">
            <div class="snes-panel" style="text-align:center;padding:28px 16px">
              <p class="snes-small snes-muted" style="line-height:2.2;font-style:italic">${text}</p>
            </div>
            ${counterHtml}
            <button class="snes-btn snes-btn-yellow" id="btn-jessie-next" style="width:100%">
              ${btnLabel}
            </button>
          </div>
        </div>
        ${skipBtn}
      `;
    } else {
      container.innerHTML = `
        <div class="screen fade-in" style="justify-content:center">
          <div class="content-card" style="gap:20px">

            <div class="snes-panel" style="display:flex;align-items:flex-start;gap:16px">
              <div class="portrait-frame portrait-frame--lg" style="flex-shrink:0">
                <img src="assets/portraits/jessie/Jessie_${expr}.png" alt="Jessie"
                  style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">
              </div>
              <div style="flex:1;display:flex;flex-direction:column;gap:10px">
                <p class="snes-small snes-highlight">JESSIE</p>
                <p class="snes-small" style="line-height:1.8">${text}</p>
              </div>
            </div>

            ${counterHtml}

            <button class="snes-btn snes-btn-yellow" id="btn-jessie-next" style="width:100%">
              ${btnLabel}
            </button>

          </div>
        </div>
        ${skipBtn}
      `;
    }

    const advance = () => {
      idx++;
      if (idx < messages.length) showMessage();
      else onComplete();
    };

    let autoDismissTimer = null;
    if (autoDismissMs && isLast) {
      autoDismissTimer = setTimeout(onComplete, autoDismissMs);
    }

    document.getElementById('btn-jessie-next').addEventListener('click', () => {
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
      advance();
    });

    document.getElementById('btn-jessie-skip').addEventListener('click', () => {
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
      onComplete();
    });
  }

  showMessage();
}

// Returns an HTML string for the inline Jessie panel (no tap-through, single line).
export function jessieInlinePanel(text, expression = 'default') {
  return `
    <div class="snes-panel" style="display:flex;align-items:flex-start;gap:14px">
      <div class="portrait-frame portrait-frame--lg" style="flex-shrink:0">
        <img src="assets/portraits/jessie/Jessie_${expression}.png" alt="Jessie"
          style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p class="snes-small snes-highlight">JESSIE</p>
        <p class="snes-small" style="line-height:1.8">${text}</p>
      </div>
    </div>
  `;
}

// Returns true if a one-shot tutorial beat has already been shown.
export function tutorialBeatShown(trophyData, beatId) {
  return (trophyData?.jessieOneShots ?? []).includes(beatId);
}

// Marks a one-shot beat as shown (mutates trophyData in place).
export function markTutorialBeat(trophyData, beatId) {
  if (!trophyData.jessieOneShots) trophyData.jessieOneShots = [];
  if (!trophyData.jessieOneShots.includes(beatId)) {
    trophyData.jessieOneShots.push(beatId);
  }
}
