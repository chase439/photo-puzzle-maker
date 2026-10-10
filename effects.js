// Sound and sparkle feedback - all generated, no asset files.

let audioCtx = null;

function audio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function unlockAudio() {
  audio();
}

function tone(freq, start, duration, gainValue = 0.12, type = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(gainValue, ac.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

/** Happy click when a piece locks in; pitch rises with progress. */
function playSnap(progress = 0) {
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const base = scale[Math.min(scale.length - 1, Math.floor(progress * scale.length))];
  tone(base, 0, 0.18, 0.13, 'triangle');
  tone(base * 1.5, 0.05, 0.2, 0.07, 'sine');
}

/** Gentle "not yet" blip when a piece is in the right spot but turned wrong. */
function playTurnHint() {
  tone(330, 0, 0.12, 0.06, 'sine');
  tone(247, 0.09, 0.14, 0.05, 'sine');
}

function playRotate() {
  tone(680, 0, 0.06, 0.04, 'square');
}

function playFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, i) => tone(n, i * 0.13, 0.35, 0.12, 'triangle'));
  tone(1318.5, 0.55, 0.7, 0.1, 'sine');
}

/** Burst of little sparkles at a point inside the stage. */
function sparkle(stage, x, y, count = 12) {
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'sparkle';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    stage.appendChild(dot);

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 26 + Math.random() * 46;
    const anim = dot.animate(
      [
        { transform: 'translate(0, 0) scale(0.4)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(1.4)`,
          opacity: 0,
        },
      ],
      { duration: 480 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
    anim.onfinish = () => dot.remove();
  }
}

/** Confetti rain on the win overlay. */
function startConfetti(canvas, durationMs = 7000) {
  const c = canvas.getContext('2d');
  const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#fb7185'];
  let raf = 0;
  let stopped = false;

  const resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const bits = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    w: 7 + Math.random() * 7,
    h: 10 + Math.random() * 10,
    vy: 1.6 + Math.random() * 2.6,
    vx: -1 + Math.random() * 2,
    spin: (Math.random() - 0.5) * 0.25,
    angle: Math.random() * Math.PI,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  const started = performance.now();

  const frame = () => {
    if (stopped) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const fading = performance.now() - started > durationMs;
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.angle += b.spin;
      if (b.y > canvas.height + 20) {
        if (fading) continue;
        b.y = -20;
        b.x = Math.random() * canvas.width;
      }
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.angle);
      c.fillStyle = b.color;
      c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      c.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  frame();

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    c.clearRect(0, 0, canvas.width, canvas.height);
  };
}
