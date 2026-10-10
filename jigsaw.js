// Jigsaw geometry: grid selection, interlocking edges and per-piece outlines.

// Unit-edge knob profile. Each entry is a cubic bezier [c1x, c1y, c2x, c2y, x, y]
// where x runs 0..1 along the edge and y is the outward offset (tab height).
const KNOB = [
  [0.22, 0.0, 0.32, 0.035, 0.42, 0.035],
  [0.26, 0.26, 0.74, 0.26, 0.58, 0.035],
  [0.68, 0.035, 0.78, 0.0, 1.0, 0.0],
];

const MAX_TAB = 0.26 * 1.2; // tallest knob point, as a fraction of the tab scale

/**
 * Pick a cols x rows grid for a target piece count and image aspect ratio.
 * Counts are treated as targets: the grid that keeps pieces closest to square
 * while staying near the target wins, so the real count can differ a little.
 */
function chooseGrid(target, aspect) {
  let best = null;
  for (let cols = 2; cols <= 30; cols++) {
    for (let rows = 2; rows <= 30; rows++) {
      const count = cols * rows;
      if (count < target * 0.75 || count > target * 1.22) continue;
      const pieceAspect = (aspect * rows) / cols;
      const shapePenalty = Math.abs(Math.log(pieceAspect)) * 3;
      const countPenalty = (Math.abs(count - target) / target) * (count > target ? 4.5 : 3);
      const score = shapePenalty + countPenalty;
      if (!best || score < best.score) best = { cols, rows, count, score };
    }
  }
  if (best) return best;
  const side = Math.max(2, Math.round(Math.sqrt(target)));
  return { cols: side, rows: side, count: side * side, score: 0 };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function straightSegments(ax, ay, bx, by) {
  return [{
    c1: [ax + (bx - ax) / 3, ay + (by - ay) / 3],
    c2: [ax + (2 * (bx - ax)) / 3, ay + (2 * (by - ay)) / 3],
    to: [bx, by],
  }];
}

function tabSegments(ax, ay, bx, by, sign, tabScale, rng) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Left-hand normal of the edge direction.
  const nx = -uy;
  const ny = ux;
  const shift = (rng() - 0.5) * 0.07;
  const height = 0.88 + rng() * 0.3;

  const pt = (u, v) => {
    const uu = u > 0.04 && u < 0.96 ? u + shift : u;
    const off = sign * v * height * tabScale;
    return [ax + ux * uu * len + nx * off, ay + uy * uu * len + ny * off];
  };

  return KNOB.map((s) => ({
    c1: pt(s[0], s[1]),
    c2: pt(s[2], s[3]),
    to: pt(s[4], s[5]),
  }));
}

function makeEdge(ax, ay, bx, by, sign, tabScale, rng) {
  return {
    start: [ax, ay],
    end: [bx, by],
    segs: sign === 0
      ? straightSegments(ax, ay, bx, by)
      : tabSegments(ax, ay, bx, by, sign, tabScale, rng),
  };
}

// Walk an edge backwards: same curve, opposite direction, so neighbouring
// pieces share exactly the same outline and always interlock.
function reversedSegments(edge) {
  const out = [];
  for (let i = edge.segs.length - 1; i >= 0; i--) {
    const seg = edge.segs[i];
    out.push({
      c1: seg.c2,
      c2: seg.c1,
      to: i === 0 ? edge.start : edge.segs[i - 1].to,
    });
  }
  return out;
}

function addSegments(path, segs) {
  for (const s of segs) {
    path.bezierCurveTo(s.c1[0], s.c1[1], s.c2[0], s.c2[1], s.to[0], s.to[1]);
  }
}

/**
 * Build the full puzzle geometry in board-space CSS pixels.
 * Returns { width, height, cols, rows, cellW, cellH, pad, pieces[] }
 * where each piece has its grid position, cell rect and a Path2D outline.
 */
function buildPuzzle({ width, height, cols, rows, seed = Date.now() }) {
  const rng = mulberry32(seed);
  const cellW = width / cols;
  const cellH = height / rows;
  const tabScale = Math.min(cellW, cellH);
  // Room for the tallest tab, plus a margin for the baked drop shadow.
  const pad = Math.ceil(MAX_TAB * tabScale) + 12;

  // Horizontal edges: h[r][c] spans cell (c, r) along its top side.
  const h = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const sign = r === 0 || r === rows ? 0 : rng() < 0.5 ? -1 : 1;
      row.push(makeEdge(c * cellW, r * cellH, (c + 1) * cellW, r * cellH, sign, tabScale, rng));
    }
    h.push(row);
  }

  // Vertical edges: v[r][c] spans cell (c, r) along its left side.
  const v = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const sign = c === 0 || c === cols ? 0 : rng() < 0.5 ? -1 : 1;
      row.push(makeEdge(c * cellW, r * cellH, c * cellW, (r + 1) * cellH, sign, tabScale, rng));
    }
    v.push(row);
  }

  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = h[r][c];
      const right = v[r][c + 1];
      const bottom = h[r + 1][c];
      const left = v[r][c];

      const path = new Path2D();
      path.moveTo(top.start[0], top.start[1]);
      addSegments(path, top.segs);
      addSegments(path, right.segs);
      addSegments(path, reversedSegments(bottom));
      addSegments(path, reversedSegments(left));
      path.closePath();

      pieces.push({
        index: pieces.length,
        col: c,
        row: r,
        x: c * cellW,
        y: r * cellH,
        w: cellW,
        h: cellH,
        path,
      });
    }
  }

  return { width, height, cols, rows, cellW, cellH, pad, pieces };
}
