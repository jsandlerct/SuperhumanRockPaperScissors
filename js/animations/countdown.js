// Timing constants (all durations in ms)
const COUNTDOWN_NUM_SCALE_IN_MS = 200;
const COUNTDOWN_NUM_HOLD_MS = 300;
const COUNTDOWN_NUM_DURATION_MS = COUNTDOWN_NUM_SCALE_IN_MS + COUNTDOWN_NUM_HOLD_MS; // 500
const COUNTDOWN_FLASH_DURATION_MS = 100;
const COUNTDOWN_SHOOT_HOLD_MS = 250;
const COUNTDOWN_CLEAR_DELAY_MS = 50;

const COUNTDOWN_SCALE_START = 1.4;
const COUNTDOWN_SCALE_END = 1.0;

const OVERLAY_WIDTH_RATIO = 1.0;
const OVERLAY_HEIGHT_RATIO = 1.0;

const COLOR_NUMBER = '#FFE000';
const COLOR_SHOOT = '#FF3333';
const COLOR_SHADOW = '#000000';
const COLOR_OVERLAY = 'rgba(0,0,0,0.55)';
const COLOR_FLASH = 'rgba(255,255,255,1.0)';

const SHADOW_OFFSET = 3;
const SHOOT_SIZE_RATIO = 0.55;

// Sequence definition: each entry describes one animation segment
// type: 'number' | 'flash' | 'shoot' | 'clear'
function buildSequence() {
    return [
        { type: 'number', label: '3', start: 0,                                                    duration: COUNTDOWN_NUM_DURATION_MS },
        { type: 'flash',              start: COUNTDOWN_NUM_DURATION_MS,                             duration: COUNTDOWN_FLASH_DURATION_MS },
        { type: 'number', label: '2', start: COUNTDOWN_NUM_DURATION_MS + COUNTDOWN_FLASH_DURATION_MS, duration: COUNTDOWN_NUM_DURATION_MS },
        { type: 'flash',              start: COUNTDOWN_NUM_DURATION_MS * 2 + COUNTDOWN_FLASH_DURATION_MS, duration: COUNTDOWN_FLASH_DURATION_MS },
        { type: 'number', label: '1', start: COUNTDOWN_NUM_DURATION_MS * 2 + COUNTDOWN_FLASH_DURATION_MS * 2, duration: COUNTDOWN_NUM_DURATION_MS },
        { type: 'shoot',              start: COUNTDOWN_NUM_DURATION_MS * 3 + COUNTDOWN_FLASH_DURATION_MS * 2, duration: COUNTDOWN_SHOOT_HOLD_MS },
        { type: 'clear',              start: COUNTDOWN_NUM_DURATION_MS * 3 + COUNTDOWN_FLASH_DURATION_MS * 2 + COUNTDOWN_SHOOT_HOLD_MS, duration: COUNTDOWN_CLEAR_DELAY_MS },
    ];
}

export function runCountdown(ctx, canvasWidth, canvasHeight, onComplete) {
    const sequence = buildSequence();
    const totalDuration = sequence[sequence.length - 1].start + sequence[sequence.length - 1].duration;

    const overlayW = Math.floor(canvasWidth * OVERLAY_WIDTH_RATIO);
    const overlayH = Math.floor(canvasHeight * OVERLAY_HEIGHT_RATIO);
    const overlayX = Math.floor((canvasWidth - overlayW) / 2);
    const overlayY = Math.floor((canvasHeight - overlayH) / 2);
    const midX = overlayX + overlayW / 2;
    const midY = overlayY + overlayH / 2;

    const numFontSize = Math.floor(canvasHeight * 0.18);
    const shootFontSize = Math.floor(numFontSize * SHOOT_SIZE_RATIO);
    const fontFamily = "'Press Start 2P', monospace";

    let startTime = null;
    let done = false;

    function drawOverlayBackground() {
        ctx.fillStyle = COLOR_OVERLAY;
        ctx.fillRect(overlayX, overlayY, overlayW, overlayH);
    }

    function drawTextCentered(text, fontSize, color, scale) {
        ctx.save();
        ctx.translate(midX, midY);
        ctx.scale(scale, scale);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Drop shadow
        ctx.fillStyle = COLOR_SHADOW;
        ctx.fillText(text, SHADOW_OFFSET, SHADOW_OFFSET);

        // Main text
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }

    function frame(timestamp) {
        if (done) return;

        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;

        if (elapsed >= totalDuration) {
            // Clear overlay area and fire callback
            ctx.clearRect(overlayX, overlayY, overlayW, overlayH);
            done = true;
            onComplete();
            return;
        }

        // Find the active segment
        let active = null;
        for (let i = sequence.length - 1; i >= 0; i--) {
            if (elapsed >= sequence[i].start) {
                active = sequence[i];
                break;
            }
        }

        if (!active) {
            requestAnimationFrame(frame);
            return;
        }

        const segElapsed = elapsed - active.start;

        ctx.save();
        ctx.beginPath();
        ctx.rect(overlayX, overlayY, overlayW, overlayH);
        ctx.clip();

        if (active.type === 'flash') {
            ctx.fillStyle = COLOR_FLASH;
            ctx.fillRect(overlayX, overlayY, overlayW, overlayH);

        } else if (active.type === 'number') {
            drawOverlayBackground();

            const scaleProgress = Math.min(segElapsed / COUNTDOWN_NUM_SCALE_IN_MS, 1.0);
            // Linear interpolation from SCALE_START down to SCALE_END
            const scale = COUNTDOWN_SCALE_START + (COUNTDOWN_SCALE_END - COUNTDOWN_SCALE_START) * scaleProgress;

            drawTextCentered(active.label, numFontSize, COLOR_NUMBER, scale);

        } else if (active.type === 'shoot') {
            drawOverlayBackground();
            drawTextCentered('SHOOT!', shootFontSize, COLOR_SHOOT, COUNTDOWN_SCALE_END);

        } else if (active.type === 'clear') {
            ctx.clearRect(overlayX, overlayY, overlayW, overlayH);
        }

        ctx.restore();

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}
