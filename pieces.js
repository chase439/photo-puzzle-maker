// Turning the photo + geometry into draggable piece canvases, and laying them out.

// Dedicated context used only for exact outline hit testing. Piece outlines are
// stored in piece-local coordinates so the test points always stay small.
const hitCanvas = document.createElement('canvas');
hitCanvas.width = 256;
hitCanvas.height = 256;
let hitCtx = hitCanvas.getContext('2d');

function ensureHitCanvas(w, h) {
  let grew = false;
  if (hitCanvas.width < w) {
    hitCanvas.width = Math.ceil(w);
    grew = true;
  }
  if (hitCanvas.height < h) {
    hitCanvas.height = Math.ceil(h);
    grew = true;
  }
  if (grew) hitCtx = hitCanvas.getContext('2d');
}

/** Crop/scale any image to exactly fill targetW x targetH (CSS "cover"). */
function coverCrop(image, targetW, targetH) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));
  const ctx = canvas.getContext('2d');
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  const scale = Math.max(canvas.width / sw, canvas.height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  return canvas;
}

/**
 * Render one canvas element per piece.
 * `src` must already be cover-cropped to geo.width x geo.height (times `scale`).
 */
function renderPieces(src, geo, scale = 1) {
  return geo.pieces.map((p) => {
    const w = p.w + geo.pad * 2;
    const h = p.h + geo.pad * 2;

    const el = document.createElement('canvas');
    el.className = 'piece';
    el.width = Math.ceil(w * scale);
    el.height = Math.ceil(h * scale);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    // Same outline, moved into this piece's own canvas coordinates.
    const offsetX = geo.pad - p.x;
    const offsetY = geo.pad - p.y;
    const localPath = new Path2D();
    localPath.addPath(p.path, new DOMMatrix().translate(offsetX, offsetY));
    ensureHitCanvas(w, h);

    const ctx = el.getContext('2d');
    ctx.scale(scale, scale);

    // Baked drop shadow so 100 live CSS filters aren't needed.
    ctx.save();
    ctx.shadowColor = 'rgba(30, 41, 59, 0.45)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#111827';
    ctx.fill(localPath);
    ctx.restore();

    ctx.save();
    ctx.clip(localPath);
    ctx.drawImage(src, offsetX, offsetY, geo.width, geo.height);
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.stroke(localPath);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.stroke(localPath);

    return {
      index: p.index,
      col: p.col,
      row: p.row,
      el,
      path: localPath,
      pad: geo.pad,
      gx: p.x,
      gy: p.y,
      w,
      h,
      cellW: p.w,
      cellH: p.h,
      x: 0,
      y: 0,
      rot: 0,
      homeX: 0,
      homeY: 0,
      locked: false,
    };
  });
}

/** Exact hit test against the piece outline, in piece-local CSS pixels. */
function pointInPiece(piece, lx, ly) {
  return hitCtx.isPointInPath(piece.path, lx, ly);
}

function overlapsBoard(x, y, w, h, board, margin) {
  return (
    x < board.x + board.w + margin &&
    x + w > board.x - margin &&
    y < board.y + board.h + margin &&
    y + h > board.y - margin
  );
}

/**
 * Scatter pieces around (never on top of) the board, with random quarter turns.
 * Pieces may overlap each other - that is what a real pile of pieces looks like.
 */
function scatterPieces(pieces, stage, board, { rotate = true } = {}) {
  const angles = [0, 90, 180, 270];
  for (const piece of pieces) {
    if (piece.locked) continue;

    piece.rot = rotate ? angles[Math.floor(Math.random() * 4)] : 0;

    const maxX = Math.max(0, stage.w - piece.w);
    const maxY = Math.max(0, stage.h - piece.h);
    let x = 0;
    let y = 0;
    let placed = false;

    for (let tries = 0; tries < 120; tries++) {
      x = Math.random() * maxX;
      y = Math.random() * maxY;
      if (!overlapsBoard(x, y, piece.w, piece.h, board, 6)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Fall back to the widest margin around the board.
      const gaps = [
        { side: 'left', size: board.x },
        { side: 'right', size: stage.w - (board.x + board.w) },
        { side: 'top', size: board.y },
        { side: 'bottom', size: stage.h - (board.y + board.h) },
      ].sort((a, b) => b.size - a.size);
      const gap = gaps[0];
      if (gap.side === 'left') {
        x = Math.random() * Math.max(1, board.x - piece.w * 0.4);
        y = Math.random() * maxY;
      } else if (gap.side === 'right') {
        x = board.x + board.w + Math.random() * Math.max(1, gap.size - piece.w * 0.6);
        y = Math.random() * maxY;
      } else if (gap.side === 'top') {
        x = Math.random() * maxX;
        y = Math.random() * Math.max(1, board.y - piece.h * 0.4);
      } else {
        x = Math.random() * maxX;
        y = board.y + board.h + Math.random() * Math.max(1, gap.size - piece.h * 0.6);
      }
    }

    piece.x = Math.min(Math.max(x, -piece.w * 0.15), stage.w - piece.w * 0.85);
    piece.y = Math.min(Math.max(y, -piece.h * 0.15), stage.h - piece.h * 0.85);
  }
}
