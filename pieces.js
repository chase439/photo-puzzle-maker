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
 * Scatter pieces with random quarter turns. Normally they go around (never on top
 * of) the board. With `onBoard` they fill the open space first, then spill onto
 * the board's outer edge, going deeper only when they must, and never land near
 * their own home spot, so nothing looks solved by accident.
 * Each piece takes the best of several random spots - the one farthest from the
 * pieces already dropped - so the pile spreads evenly over the free space.
 * Pieces may still overlap each other - that is what a real pile of pieces looks like.
 */
function scatterPieces(pieces, stage, board, { rotate = true, onBoard = false } = {}) {
  const angles = [0, 90, 180, 270];
  const centers = [];
  const CANDIDATES = onBoard ? 40 : 14;
  // Score lost per pixel a piece's center sits inside the board (onBoard only).
  const DEPTH_COST = 1.6;
  const diag = Math.hypot(stage.w, stage.h);

  const allowed = (x, y, piece) => {
    if (!onBoard) return !overlapsBoard(x, y, piece.w, piece.h, board, 6);
    const keepAway = Math.max(piece.cellW, piece.cellH) * 1.5;
    return Math.hypot(x - piece.homeX, y - piece.homeY) > keepAway;
  };

  const depthInBoard = (cx, cy) =>
    Math.max(0, Math.min(cx - board.x, board.x + board.w - cx, cy - board.y, board.y + board.h - cy));

  const score = (x, y, piece) => {
    const cx = x + piece.w / 2;
    const cy = y + piece.h / 2;
    let nearest = Infinity;
    for (const c of centers) {
      const d = (c.x - cx) ** 2 + (c.y - cy) ** 2;
      if (d < nearest) nearest = d;
    }
    const room = Math.min(Math.sqrt(nearest), diag);
    return onBoard ? room - DEPTH_COST * depthInBoard(cx, cy) : room;
  };

  for (const piece of pieces) {
    if (piece.locked) continue;

    piece.rot = rotate ? angles[Math.floor(Math.random() * 4)] : 0;

    // On-board layouts may tuck pieces slightly past the stage edge (same limit as dragging).
    const minX = onBoard ? -piece.w * 0.15 : 0;
    const minY = onBoard ? -piece.h * 0.15 : 0;
    const maxX = Math.max(minX, onBoard ? stage.w - piece.w * 0.85 : stage.w - piece.w);
    const maxY = Math.max(minY, onBoard ? stage.h - piece.h * 0.85 : stage.h - piece.h);
    let x = 0;
    let y = 0;
    let placed = false;
    let bestScore = -Infinity;
    let found = 0;

    for (let tries = 0; tries < 300 && found < CANDIDATES; tries++) {
      const cx = minX + Math.random() * (maxX - minX);
      const cy = minY + Math.random() * (maxY - minY);
      if (!allowed(cx, cy, piece)) continue;
      found += 1;
      const s = score(cx, cy, piece);
      if (s > bestScore) {
        bestScore = s;
        x = cx;
        y = cy;
        placed = true;
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
    centers.push({ x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 });
  }
}
