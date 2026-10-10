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

const state = {
  image: null,
  target: 50,
  controller: null,
  stageW: 0,
  stageH: 0,
  stopConfetti: null,
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
    setStatus(`🧩 ${done} of ${total} pieces placed`);
  }
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
  winOverlay.hidden = false;
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
  boardEl.classList.remove('peek');
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

  let bw = stageW * 0.56;
  let bh = bw / aspect;
  const maxH = stageH * 0.64;
  if (bh > maxH) {
    bh = maxH;
    bw = bh * aspect;
  }
  bw = Math.round(bw);
  bh = Math.round(bh);
  const bx = Math.round((stageW - bw) / 2);
  const by = Math.round((stageH - bh) / 2);

  boardEl.style.left = `${bx}px`;
  boardEl.style.top = `${by}px`;
  boardEl.style.width = `${bw}px`;
  boardEl.style.height = `${bh}px`;
  boardEl.classList.add('is-ready');

  const grid = chooseGrid(state.target, aspect);
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
