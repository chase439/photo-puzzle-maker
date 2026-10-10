// Dragging, turning, snapping and locking of puzzle pieces.

const TAP_SLOP = 8; // px of movement still counted as a tap
const TAP_TIME = 600; // ms

function createController({ stage, pieces, board, stageSize, onProgress, onWin }) {
  let topZ = 100;
  let drag = null;
  let hovered = null;
  let destroyed = false;

  // Hit-test order, lowest first. The last entry is the topmost piece.
  const order = pieces.filter((p) => !p.locked);
  order.forEach((p, i) => {
    p.el.style.zIndex = String(10 + i);
  });

  const apply = (p) => {
    p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;
  };

  pieces.forEach(apply);

  const lockedCount = () => pieces.filter((p) => p.locked).length;

  const toStage = (event) => {
    const rect = stage.getBoundingClientRect();
    const k = rect.width / stage.offsetWidth || 1;
    return {
      x: (event.clientX - rect.left) / k,
      y: (event.clientY - rect.top) / k,
    };
  };

  const hitTest = (pt) => {
    for (let i = order.length - 1; i >= 0; i--) {
      const p = order[i];
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const a = (p.rot * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const lx = dx * cos + dy * sin + p.w / 2;
      const ly = -dx * sin + dy * cos + p.h / 2;
      if (lx < 0 || ly < 0 || lx > p.w || ly > p.h) continue;
      if (pointInPiece(p, lx, ly)) return p;
    }
    return null;
  };

  const raise = (p) => {
    const i = order.indexOf(p);
    if (i >= 0) order.splice(i, 1);
    order.push(p);
    topZ += 1;
    p.el.style.zIndex = String(topZ);
  };

  const withTransition = (p, run) => {
    p.el.classList.add('snapping');
    // Flush styles so the transition actually starts from the current transform.
    void p.el.offsetWidth;
    run();
    apply(p);
    window.setTimeout(() => p.el.classList.remove('snapping'), 200);
  };

  const lock = (p) => {
    const i = order.indexOf(p);
    if (i >= 0) order.splice(i, 1);
    p.locked = true;
    p.el.classList.add('locked');
    p.el.style.zIndex = '2';

    withTransition(p, () => {
      p.x = p.homeX;
      p.y = p.homeY;
      p.rot = 0;
    });

    const done = lockedCount();
    playSnap(done / pieces.length);
    sparkle(stage, p.homeX + p.w / 2, p.homeY + p.h / 2);
    p.el.classList.add('pop');
    window.setTimeout(() => p.el.classList.remove('pop'), 400);

    if (onProgress) onProgress(done, pieces.length);
    if (done === pieces.length && onWin) window.setTimeout(onWin, 350);
  };

  const attemptSnap = (p) => {
    if (p.locked) return false;
    const tol = Math.max(20, Math.min(p.cellW, p.cellH) * 0.45);
    const near = Math.hypot(p.x - p.homeX, p.y - p.homeY) < tol;
    if (!near) return false;

    if (((p.rot % 360) + 360) % 360 !== 0) {
      p.el.classList.add('wiggle');
      window.setTimeout(() => p.el.classList.remove('wiggle'), 420);
      playTurnHint();
      return false;
    }

    lock(p);
    return true;
  };

  const rotate = (p) => {
    if (!p || p.locked) return;
    withTransition(p, () => {
      p.rot = (p.rot + 90) % 360;
    });
    playRotate();
    window.setTimeout(() => attemptSnap(p), 170);
  };

  const clamp = (p) => {
    p.x = Math.min(Math.max(p.x, -p.w * 0.25), stageSize.w - p.w * 0.75);
    p.y = Math.min(Math.max(p.y, -p.h * 0.25), stageSize.h - p.h * 0.75);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    unlockAudio();
    const pt = toStage(event);
    const p = hitTest(pt);
    if (!p) return;
    event.preventDefault();
    raise(p);
    drag = {
      piece: p,
      id: event.pointerId,
      grabX: pt.x - p.x,
      grabY: pt.y - p.y,
      startX: pt.x,
      startY: pt.y,
      time: performance.now(),
      moved: false,
    };
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* capture is best-effort */
    }
  };

  const onPointerMove = (event) => {
    const pt = toStage(event);
    if (!drag || drag.id !== event.pointerId) {
      hovered = hitTest(pt);
      return;
    }
    if (!drag.moved && Math.hypot(pt.x - drag.startX, pt.y - drag.startY) > TAP_SLOP) {
      drag.moved = true;
      drag.piece.el.classList.add('dragging');
      drag.piece.el.classList.remove('snapping');
    }
    if (!drag.moved) return;
    event.preventDefault();
    drag.piece.x = pt.x - drag.grabX;
    drag.piece.y = pt.y - drag.grabY;
    clamp(drag.piece);
    apply(drag.piece);
  };

  const endDrag = (event) => {
    if (!drag || (event && drag.id !== event.pointerId)) return;
    const { piece, moved, time } = drag;
    drag = null;
    piece.el.classList.remove('dragging');
    if (!moved && performance.now() - time < TAP_TIME) {
      rotate(piece);
    } else {
      attemptSnap(piece);
    }
  };

  const onContextMenu = (event) => {
    const p = hitTest(toStage(event));
    if (!p) return;
    event.preventDefault();
    rotate(p);
  };

  const onKeyDown = (event) => {
    if (event.key !== 'r' && event.key !== 'R' && event.key !== ' ') return;
    const target = drag ? drag.piece : hovered;
    if (!target) return;
    event.preventDefault();
    rotate(target);
  };

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);

  return {
    pieces,
    shuffle() {
      scatterPieces(pieces, stageSize, board, { rotate: true });
      pieces.forEach((p) => {
        if (!p.locked) {
          p.el.classList.add('snapping');
          void p.el.offsetWidth;
          apply(p);
          window.setTimeout(() => p.el.classList.remove('snapping'), 220);
        }
      });
    },
    progress() {
      return { done: lockedCount(), total: pieces.length };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
