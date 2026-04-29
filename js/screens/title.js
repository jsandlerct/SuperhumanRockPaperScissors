import { navigate } from '../main.js';

export function mount(container, options = {}) {
  container.innerHTML = `
    <div
      id="title-wrap"
      style="
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #000;
        padding: 16px;
        cursor: pointer;
        position: relative;
        user-select: none;
      "
    >
      <img
        src="assets/SRPS Title screen.png"
        alt="Superhuman Rock Paper Scissors"
        style="
          max-width: min(100%, 560px);
          max-height: 80dvh;
          width: 100%;
          object-fit: contain;
          image-rendering: pixelated;
          display: block;
        "
        draggable="false"
      >

      <p
        class="snes-small snes-highlight cursor-blink"
        style="position:absolute;bottom:40px;text-align:center;letter-spacing:2px"
      >▶ PRESS ANY KEY TO START</p>
    </div>
  `;

  function advance() {
    document.removeEventListener('keydown', advance);
    navigate('login');
  }

  document.getElementById('title-wrap').addEventListener('click', advance, { once: true });
  document.addEventListener('keydown', advance, { once: true });
}
