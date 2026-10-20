const image = document.querySelector(".about-art");
const face = document.querySelector(".holo-face");
const display = document.querySelector(".about-display");

function positionAboutText() {

  // Small screens use normal text layout.
  if (window.matchMedia("(max-width: 720px)").matches) {
    display.style.transform = "";
    return;
  }

  if (!image.naturalWidth || !image.naturalHeight) return;

  // Find how much the image has been resized.
  const scaleX = image.clientWidth / image.naturalWidth;
  const scaleY = image.clientHeight / image.naturalHeight;

  // Read the SVG polygon's four corners.
  const corners = face.getAttribute("points")
  .trim()
  .split(/\s+/)
  .map(pair => pair.split(",").map(Number))
  .map(([x,y]) => [x * scaleX, y * scaleY]);

  if (corners.length !== 4) return;

  // Clockwise starting at top-left
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;

  // Calculate the perspective transormation.
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;

  const dx1 = x1 - x2;
  const dy1 = y1 - y2;
  const dx2 = x3 - x2;
  const dy2 = y3 - y2;

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 0.00001) return;

  const g = (sx * dy2 - dx2 * sy) / det;
  const h = (dx1 * sy - sx * dy1) / det;

  const w = display.offsetWidth;
  const ht = display.offsetHeight;

  const a = (x1 - x0 + g * x1) / w;
  const b = (x3 - x0 + h * x3) / ht;
  const d = (y1 - y0 + g * y1) / w;
  const e = (y3 - y0 + h * y3) / ht;

  // Project the rectangle ontothe SVG face.
  display.style.transform = `matrix3d(${[
    a, d, 0, g / w,
    b, e, 0, h / ht,
    0, 0, 1, 0,
    x0, y0, 0, 1
  ].join(",")})`;
}

// Recalculate if the image or window resizes.
window.addEventListener("resize", positionAboutText);
image.addEventListener("load", positionAboutText)

// Initial positioning.
positionAboutText();

// Traveling lines.
const surfaces = document.querySelectorAll(".holo-wave");
const waveGroup = document.querySelector(".traveling-lines");

const svgNS = "http://www.w3.org/2000/svg";

// One line for each for trapazoids.
const waves = Array.from(surfaces, surface => {
  const points = Array.from(surface.points, p => ({
    x: p.x, y: p.y
  }));

  const path = document.createElementNS(svgNS, "path");
  path.classList.add("traveling-line");
  waveGroup.appendChild(path);

  return {
    A: points[0],
    B: points[1],
    C: points[2],
    D: points[3],
    path,
    wavesConfig: {
      amplitude: 6 + Math.random() * 5,
      frequency: 1.5 + Math.random() * 1.2,
      speed: 2.2 + Math.random() * 1.0,
      phase: Math.random() * Math.PI * 2,
      segments: 24
    }
  };
});

// Linear interpolation: start -> finish
function lerp(start, finish, t) {
  return start + (finish - start) * t;
}

function buildWavePath(P1, P2, time, options = {}) {
  const segments = options.segments ?? 24;
  const amplitude = options.amplitude ?? 8;
  const frequency = options.frequency ?? 2;
  const speed = options.speed ?? 1.2;
  const phase = options.phase ?? 0;

  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return `M ${P1.x} ${P1.y} L ${P2.x} ${P2.y}`;
  }

  // Unit direction along the line
  const tx = dx / length;
  const ty = dy / length;

  // Unit perpendicular to the line
  const nx = -ty;
  const ny = tx;

  let d = "";

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;

    // Base point along the line
    const x = P1.x + dx * u;
    const y = P1.y + dy * u;

    // Keep endpoints exact
    let offset = 0;

    if (i !== 0 && i !== segments) {
      offset = Math.sin((u * frequency * Math.PI * 2) - (time * speed) + phase) * amplitude;
    }

    const px = x + nx * offset;
    const py = y + ny * offset;

    d += (i === 0 ? "M" : "L") + `${px} ${py}`;
  }

  return d;
}

function drawWaves(t, timeSeconds) {
  for (const wave of waves) {
    const { A, B, C, D, path, wavesConfig } = wave;

    const P1 = {
      x: lerp(D.x, A.x, t),
      y: lerp(D.y, A.y, t)
    };

    const P2 = {
      x: lerp(C.x, B.x, t),
      y: lerp(C.y, B.y, t)
    };

    const d = buildWavePath(P1, P2, timeSeconds, wavesConfig);

    path.setAttribute("d", d);
  }
}

// Five seconds to travel from AB to DC.
const duration = 5000;
let startTime;

function animateWaves(now) {
  if (startTime === undefined) startTime = now;

  const elapsed = now - startTime;
  const t = (elapsed % duration) / duration;
  const timeSeconds = elapsed / 1000;

  drawWaves(t, timeSeconds);
  requestAnimationFrame(animateWaves);
}

if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
  drawWaves(0.5, 0);
} else {
  requestAnimationFrame(animateWaves);
}
