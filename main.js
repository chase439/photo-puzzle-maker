// Photo Puzzle Maker - app wiring.
// Plain scripts (no modules) so index.html works straight from the file system.

const el = (id) => document.getElementById(id);

const stageWrap = el('stageWrap');
const stage = el('stage');
const layer = el('piecesLayer');
const boardEl = el('board');
const ghost = el('ghost');
const statusText = el('statusText');
const dropHint = el('dropHint');
const dropOverlay = el('dropOverlay');
const fileInput = el('fileInput');
const sampleBtn = el('sampleBtn');
const startBtn = el('startBtn');
const shuffleBtn = el('shuffleBtn');
const peekBtn = el('peekBtn');
const winOverlay = el('winOverlay');
const winText = el('winText');
const confettiCanvas = el('confetti');
const againBtn = el('againBtn');
const newPhotoBtn = el('newPhotoBtn');
const viewBtn = el('viewBtn');
const winCloseBtn = el('winCloseBtn');

// Gap kept between the board, the tray of loose pieces and the stage edges.
const BOARD_MARGIN = 14;
// Area of the loose-piece tray, as a multiple of the board's area.
const TRAY_AREA_RATIO = 1.15;
// Ignore backdrop taps right after the win card appears so a stray tap can't dismiss it.
const WIN_BACKDROP_GRACE_MS = 700;

const state = {
  image: null,
  target: 50,
  controller: null,
  stageW: 0,
  stageH: 0,
  stopConfetti: null,
  winShownAt: 0,
};

function setStatus(text) {
  statusText.textContent = text;
}

function imageSize(image) {
  return {
    w: image.naturalWidth || image.width,
    h: image.naturalHeight || image.height,
  };
}

function fitStage() {
  if (!state.stageW) return;
  const k = Math.min(
    1,
    stageWrap.clientWidth / state.stageW,
    stageWrap.clientHeight / state.stageH,
  );
  stage.style.transform = `scale(${k})`;
}

function updateProgress(done, total) {
  if (done >= total) {
    setStatus(`🎉 All ${total} pieces placed!`);
  } else {
    setStatus(`🧩 ${done} of ${total} placed`);
  }
}

/**
 * Make the board (photo frame) as big as possible while keeping one roomy tray
 * for the loose pieces: beside the board on wide screens, below it on tall ones.
 */
function layoutBoard(stageW, stageH, aspect, grid) {
  const m = BOARD_MARGIN;
  let best = null;

  for (const beside of [true, false]) {
    // "main" is the axis shared by board and tray; "cross" is the other one.
    const mainLen = beside ? stageW : stageH;
    const crossLen = beside ? stageH : stageW;
    const ratio = beside ? aspect : 1 / aspect; // board main / board cross

    let cross = crossLen - 2 * m;
    let main = cross * ratio;
    if (main > mainLen - 2 * m) {
      main = mainLen - 2 * m;
      cross = main / ratio;
    }

    for (let i = 0; i < 200 && main > 40 && cross > 40; i++) {
      const bw = beside ? main : cross;
      const bh = beside ? cross : main;
      const cellW = bw / grid.cols;
      const cellH = bh / grid.rows;
      const pad = Math.ceil(MAX_TAB * Math.min(cellW, cellH)) + 12;
      const pieceBox = Math.max(cellW, cellH) + pad * 2;
      const tray = mainLen - main - 3 * m;
      if (tray >= pieceBox && tray * crossLen >= TRAY_AREA_RATIO * bw * bh) break;
      main *= 0.98;
      cross *= 0.98;
    }

    const bw = Math.round(beside ? main : cross);
    const bh = Math.round(beside ? cross : main);
    if (!best || bw * bh > best.w * best.h) {
      best = {
        x: beside ? m : Math.round((stageW - bw) / 2),
        y: beside ? Math.round((stageH - bh) / 2) : m,
        w: bw,
        h: bh,
      };
    }
  }

  return best;
}

function closeWin() {
  winOverlay.hidden = true;
  if (state.stopConfetti) {
    state.stopConfetti();
    state.stopConfetti = null;
  }
}

function onWin() {
  const total = state.controller ? state.controller.pieces.length : 0;
  winText.textContent = `You put together a ${total} piece puzzle!`;
  boardEl.classList.remove('peek');
  boardEl.classList.add('is-complete');
  peekBtn.setAttribute('aria-pressed', 'false');
  peekBtn.disabled = true;
  shuffleBtn.disabled = true;
  winOverlay.hidden = false;
  state.winShownAt = performance.now();
  state.stopConfetti = startConfetti(confettiCanvas);
  playFanfare();
}

function build() {
  if (!state.image) return;
  closeWin();

  if (state.controller) {
    state.controller.destroy();
    state.controller = null;
  }
  layer.innerHTML = '';
  boardEl.classList.remove('peek', 'is-complete');
  peekBtn.setAttribute('aria-pressed', 'false');

  const stageW = Math.max(360, stageWrap.clientWidth);
  const stageH = Math.max(320, stageWrap.clientHeight);
  state.stageW = stageW;
  state.stageH = stageH;
  stage.style.width = `${stageW}px`;
  stage.style.height = `${stageH}px`;
  fitStage();

  const size = imageSize(state.image);
  const aspect = size.w / size.h;
  const grid = chooseGrid(state.target, aspect);

  const { x: bx, y: by, w: bw, h: bh } = layoutBoard(stageW, stageH, aspect, grid);

  boardEl.style.left = `${bx}px`;
  boardEl.style.top = `${by}px`;
  boardEl.style.width = `${bw}px`;
  boardEl.style.height = `${bh}px`;
  boardEl.classList.add('is-ready');

  // Crisper pieces on high-DPI screens, but keep memory sane at high piece counts.
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(grid.count > 60 ? 1.5 : 2, dpr);
  const src = coverCrop(state.image, bw * scale, bh * scale);

  ghost.width = src.width;
  ghost.height = src.height;
  ghost.getContext('2d').drawImage(src, 0, 0);

  const geo = buildPuzzle({
    width: bw,
    height: bh,
    cols: grid.cols,
    rows: grid.rows,
    seed: Math.floor(Math.random() * 1e9),
  });

  const pieces = renderPieces(src, geo, scale);
  const fragment = document.createDocumentFragment();
  for (const piece of pieces) {
    piece.homeX = bx + piece.gx - geo.pad;
    piece.homeY = by + piece.gy - geo.pad;
    fragment.appendChild(piece.el);
  }
  layer.appendChild(fragment);

  const board = { x: bx, y: by, w: bw, h: bh };
  scatterPieces(pieces, { w: stageW, h: stageH }, board);

  state.controller = createController({
    stage,
    pieces,
    board,
    stageSize: { w: stageW, h: stageH },
    onProgress: updateProgress,
    onWin,
  });

  dropHint.hidden = true;
  shuffleBtn.disabled = false;
  peekBtn.disabled = false;
  startBtn.disabled = false;
  updateProgress(0, pieces.length);
}

function buildSoon() {
  setStatus('✂️ Cutting the photo…');
  window.setTimeout(build, 30);
}

function useImage(image) {
  state.image = image;
  startBtn.disabled = false;
  buildSoon();
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('😕 That file is not a picture');
    return;
  }
  setStatus('📥 Loading your photo…');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    useImage(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('😕 Could not read that picture');
  };
  img.src = url;
}

/* ---------- controls ---------- */

fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) loadFile(file);
  fileInput.value = '';
});

sampleBtn.addEventListener('click', () => {
  unlockAudio();
  useImage(createSampleImage());
});

startBtn.addEventListener('click', () => {
  unlockAudio();
  buildSoon();
});

shuffleBtn.addEventListener('click', () => {
  if (state.controller) state.controller.shuffle();
});

peekBtn.addEventListener('click', () => {
  const on = boardEl.classList.toggle('peek');
  peekBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    state.target = Number(chip.dataset.count);
    if (state.image) buildSoon();
  });
});

againBtn.addEventListener('click', () => {
  closeWin();
  buildSoon();
});

newPhotoBtn.addEventListener('click', () => {
  closeWin();
  fileInput.click();
});

viewBtn.addEventListener('click', closeWin);
winCloseBtn.addEventListener('click', closeWin);

winOverlay.addEventListener('click', (e) => {
  if (e.target !== winOverlay) return;
  if (performance.now() - state.winShownAt < WIN_BACKDROP_GRACE_MS) return;
  closeWin();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !winOverlay.hidden) closeWin();
});

/* ---------- touch screens: no accidental page zoom ---------- */

// iOS Safari ignores user-scalable=no, so block double-tap and pinch zoom directly.
// Buttons rely on CSS touch-action instead so quick repeat taps still click.
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = performance.now();
    const quick = now - lastTouchEnd < 400;
    lastTouchEnd = now;
    const t = e.target;
    const control = t && t.closest && t.closest('button, label, input, a, select, textarea');
    if (quick && e.cancelable && !control) e.preventDefault();
  },
  { passive: false },
);

document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1 && e.cancelable) e.preventDefault();
  },
  { passive: false },
);

['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});

document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

/* ---------- drag & drop / paste ---------- */

let dragDepth = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth += 1;
  dropOverlay.classList.add('is-on');
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropOverlay.classList.remove('is-on');
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove('is-on');
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) loadFile(file);
});

window.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      loadFile(item.getAsFile());
      break;
    }
  }
});

window.addEventListener('resize', fitStage);
window.addEventListener('pointerdown', unlockAudio, { once: true });
