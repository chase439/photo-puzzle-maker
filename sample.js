// A bright, generated sample picture so the app is playable without a photo.

function createSampleImage(width = 1200, height = 900) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');

  // Sky
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#38bdf8');
  sky.addColorStop(0.55, '#bae6fd');
  sky.addColorStop(1, '#fef3c7');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);

  // Sun with rays
  const sunX = width * 0.82;
  const sunY = height * 0.18;
  c.save();
  c.translate(sunX, sunY);
  c.strokeStyle = 'rgba(253, 224, 71, 0.85)';
  c.lineWidth = 10;
  c.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    c.beginPath();
    c.moveTo(Math.cos(a) * 95, Math.sin(a) * 95);
    c.lineTo(Math.cos(a) * 130, Math.sin(a) * 130);
    c.stroke();
  }
  c.restore();
  const sunGrad = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 90);
  sunGrad.addColorStop(0, '#fff7ae');
  sunGrad.addColorStop(1, '#facc15');
  c.fillStyle = sunGrad;
  c.beginPath();
  c.arc(sunX, sunY, 88, 0, Math.PI * 2);
  c.fill();

  // Rainbow
  const bands = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#8b5cf6'];
  c.lineWidth = 26;
  bands.forEach((color, i) => {
    c.strokeStyle = color;
    c.globalAlpha = 0.75;
    c.beginPath();
    c.arc(width * 0.3, height * 0.78, 300 - i * 26, Math.PI, Math.PI * 2);
    c.stroke();
  });
  c.globalAlpha = 1;

  // Clouds
  const cloud = (x, y, s) => {
    c.fillStyle = 'rgba(255, 255, 255, 0.95)';
    [[0, 0, 46], [42, -16, 36], [-44, -8, 34], [16, 14, 34], [-18, 16, 30]].forEach(([dx, dy, r]) => {
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      c.fill();
    });
  };
  cloud(width * 0.18, height * 0.16, 1.1);
  cloud(width * 0.52, height * 0.1, 0.8);

  // Hills
  const hill = (cx, cy, rx, ry, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
    c.fill();
  };
  hill(width * 0.2, height * 0.88, width * 0.45, height * 0.3, '#4ade80');
  hill(width * 0.78, height * 0.9, width * 0.42, height * 0.26, '#34d399');

  // Grass
  c.fillStyle = '#22c55e';
  c.fillRect(0, height * 0.86, width, height * 0.14);

  // Trees
  const tree = (x, y, s) => {
    c.fillStyle = '#92400e';
    c.fillRect(x - 11 * s, y - 60 * s, 22 * s, 80 * s);
    c.fillStyle = '#16a34a';
    [[0, -120, 62], [-42, -78, 52], [42, -78, 52], [0, -60, 56]].forEach(([dx, dy, r]) => {
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      c.fill();
    });
  };
  tree(width * 0.11, height * 0.95, 1.05);
  tree(width * 0.9, height * 0.97, 0.85);

  // Balloons
  const balloon = (x, y, color) => {
    c.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y + 44);
    c.quadraticCurveTo(x + 14, y + 100, x - 6, y + 150);
    c.stroke();
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, 34, 42, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.45)';
    c.beginPath();
    c.ellipse(x - 11, y - 14, 9, 13, -0.4, 0, Math.PI * 2);
    c.fill();
  };
  balloon(width * 0.4, height * 0.33, '#f43f5e');
  balloon(width * 0.47, height * 0.26, '#8b5cf6');
  balloon(width * 0.54, height * 0.36, '#f59e0b');

  // Flowers
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * width;
    const y = height * 0.88 + Math.random() * height * 0.11;
    const petal = ['#fda4af', '#fde047', '#a5f3fc', '#f9a8d4'][i % 4];
    c.fillStyle = petal;
    for (let k = 0; k < 5; k++) {
      const a = (Math.PI * 2 * k) / 5;
      c.beginPath();
      c.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fbbf24';
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.fill();
  }

  return canvas;
}
