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

// MULTI-WAVE HOLOGRAPHIC PROJECTOR
// Replaces the older one-line-per-surface animation.
// SVG polygon point order: A, B, C, D (clockwise).
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.querySelector(".holo-waves");

const surfaces = Array.from(svg.querySelectorAll(".holo-wave"), polygon => {
  const [A, B, C, D] = Array.from(polygon.points, point => ({
    x: point.x,
    y: point.y
  }));
  return { A, B, C, D };
});

// Make the SVG layer here; no HTML change is needed.
// Appending after the face renders traveling pulses above it.
const wavefrontLayer = document.createElementNS(svgNS, "g");
wavefrontLayer.classList.add("wavefronts");
svg.appendChild(wavefrontLayer);

let definitions = svg.querySelector("defs");
if (!definitions) {
  definitions = document.createElementNS(svgNS, "defs");
  svg.insertBefore(definitions, svg.firstChild);
}

const activePulses = [];
const travelDuration = 5000;  // 5 seconds from inner to outer edges
let nextSpawnAt;
let pulseNumber = 0;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

// D and C are the inner edge; A and B are the outer edge.
function getTravelPoints(surface, t) {
  return {
    P1: { x: lerp(surface.D.x, surface.A.x, t),
          y: lerp(surface.D.y, surface.A.y, t) },
    P2: { x: lerp(surface.C.x, surface.B.x, t),
          y: lerp(surface.C.y, surface.B.y, t) }
  };
}

// Draw a sine wave perpendicular to the moving P1-P2 line.
// sin(PI*u) tapers the waviness to zero at both endpoints.
function buildWavePath(P1, P2, ageSeconds, config) {
  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return `M ${P1.x} ${P1.y}`;

  const nx = -dy / length;
  const ny = dx / length;
  const commands = [];

  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const taper = Math.sin(Math.PI * u);
    const wave = Math.sin(
      u * config.frequency * Math.PI * 2
      - ageSeconds * config.speed + config.phase
    ) * config.amplitude * taper;

    const x = P1.x + dx * u + nx * wave;
    const y = P1.y + dy * u + ny * wave;
    commands.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return commands.join(" ");
}

function createGradient(id) {
  const gradient = document.createElementNS(svgNS, "linearGradient");
  gradient.id = id;
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");

  const stops = Array.from({ length: 13 }, (_, i) => {
    const element = document.createElementNS(svgNS, "stop");
    element.setAttribute("offset", `${i / 12 * 100}%`);
    element.setAttribute("stop-color", "#4baaa6");
    gradient.appendChild(element);
    return { element, u: i / 12, phase: rand(-0.5, 0.5) };
  });

  definitions.appendChild(gradient);
  return { gradient, stops };
}

function updateGradient(item, P1, P2, seconds) {
  const { gradient, stops, config } = item;
  gradient.setAttribute("x1", P1.x);
  gradient.setAttribute("y1", P1.y);
  gradient.setAttribute("x2", P2.x);
  gradient.setAttribute("y2", P2.y);

  // Slide the brighter regions back and forth along the wave.
  const drift = Math.sin(seconds * config.driftSpeed + config.driftPhase)
    * config.driftAmount;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const band = Math.sin(
      (stop.u + drift) * config.bandFrequency * 2 * Math.PI
      + stop.phase
    );
    let opacity = 0.12 + 0.88 * Math.pow((band + 1) / 2, 2);
    if (i === 0 || i === stops.length - 1) opacity = 0.85;
    stop.element.setAttribute("stop-opacity", opacity.toFixed(2));
  }
}

function updateSpark(circle, point, seconds, seed) {
  const brightness = (Math.sin(seconds * 8 + seed) + 1) / 2;
  circle.setAttribute("cx", point.x);
  circle.setAttribute("cy", point.y);
  circle.setAttribute("r", (2.8 + brightness * 2.2).toFixed(2));
  circle.setAttribute("opacity", (0.5 + brightness * 0.4).toFixed(2));
}

function spawnPulse(bornAt) {
  const group = document.createElementNS(svgNS, "g");
  group.classList.add("wavefront-group");
  wavefrontLayer.appendChild(group);

  const config = {
    amplitude: rand(6, 10),
    frequency: rand(1.8, 2.8),
    speed: rand(2.8, 4.2),
    phase: rand(0, Math.PI * 2),
    driftAmount: rand(0.08, 0.18),
    driftSpeed: rand(0.8, 1.5),
    driftPhase: rand(0, Math.PI * 2),
    bandFrequency: rand(2.5, 4.5)
  };

  const pulseId = pulseNumber++;
  const items = surfaces.map((surface, index) => {
    const path = document.createElementNS(svgNS, "path");
    path.classList.add("wavefront-path");

    const { gradient, stops } = createGradient(`about-pulse-${pulseId}-${index}`);
    path.setAttribute("stroke", `url(#${gradient.id})`);
    group.appendChild(path);

    return { surface, path, gradient, stops, config };
  });

  // Adjacent faces already share corners: 4 sparks, not 8 duplicates.
  const sparks = surfaces.map(() => {
    const circle = document.createElementNS(svgNS, "circle");
    circle.classList.add("wavefront-spark");
    group.appendChild(circle);
    return circle;
  });

  activePulses.push({ bornAt, group, items, sparks });
}

function updatePulse(pulse, now) {
  const age = now - pulse.bornAt;
  const t = Math.max(0, Math.min(1, age / travelDuration));
  const seconds = age / 1000;

  pulse.items.forEach((item, i) => {
    const { P1, P2 } = getTravelPoints(item.surface, t);
    item.path.setAttribute("d", buildWavePath(P1, P2, seconds, item.config));
    updateGradient(item, P1, P2, seconds);
    updateSpark(pulse.sparks[i], P1, seconds, i * 1.3);
  });
}

function cleanupPulses(now) {
  for (let i = activePulses.length - 1; i >= 0; i--) {
    const pulse = activePulses[i];
    if (now - pulse.bornAt >= travelDuration) {
      pulse.group.remove();
      // Remove the per-pulse gradients, too, so they do not accumulate.
      pulse.items.forEach(item => item.gradient.remove());
      activePulses.splice(i, 1);
    }
  }
}

function animateProjector(now) {
  if (nextSpawnAt === undefined) nextSpawnAt = now;

  // A backgrounded tab can jump several seconds; skip expired launches.
  if (now - nextSpawnAt > travelDuration) {
    nextSpawnAt = now - travelDuration;
  }

  while (now >= nextSpawnAt) {
    spawnPulse(nextSpawnAt);
    nextSpawnAt += rand(400, 600);
  }

  cleanupPulses(now);
  activePulses.forEach(pulse => updatePulse(pulse, now));
  requestAnimationFrame(animateProjector);
}

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // One stationary pulse for viewers who prefer reduced motion.
  spawnPulse(-travelDuration / 2);
  updatePulse(activePulses[0], 0);
} else {
  requestAnimationFrame(animateProjector);
}
