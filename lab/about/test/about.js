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

function makeFadingStroke(svg, svgNS, id) {

  // SVG definitions hold reusable visual effects.
  let defs = svg.querySelector("defs");

  if (!defs) {
    defs = document.createElementNS(svgNS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const gradient = document.createElementNS(svgNS, "linearGradient");

  gradient.id = id;
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");

  // Thirteen brightness control points.
  const stops = [];

  for (let i = 0; i < 13; i++) {
    const stop = document.createElementNS(svgNS, "stop");
    const u = i / 12;

    stop.setAttribute("offset", `${u * 100}%`);
    stop.setAttribute("stop-color", "#56f5e3");

    gradient.appendChild(stop);

    stops.push({
      element: stop,
      u,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.4
    });
  }

  defs.appendChild(gradient);

  return { gradient, stops };
}

function updateGradient(surfaceItem, P1, P2, timeSeconds) {
  const { gradient, stops, pulseConfig } = surfaceItem;

  gradient.setAttribute("x1", P1.x);
  gradient.setAttribute("y1", P1.y);
  gradient.setAttribute("x2", P2.x);
  gradient.setAttribute("y2", P2.y);

  const drift = Math.sin(timeSeconds * pulseConfig.driftSpeed 
    + pulseConfig.driftPhase) * pulseConfig.driftAmount;

  stops.forEach((stop, i) => {
    const movedU = stop.u + drift;

    const band = Math.sin((movedU * pulseConfig.bandFrequency * Math.PI * 2) + stop.phase);

    let opacity = 0.18 + 0.82 * ((band + 1) / 2) ** 2;

    if (i === 0 || i === stops.length - 1) {
      opacity = 0.85;
    }

    stop.element.setAttribute("stop-opacity", opacity.toFixed(2));
  });
}

// Pulse spawning system
const svg = document.querySelector(".holo-waves");
const surfaces = Array.from(document.querySelectorAll(".holo-wave")).map(surface => {
  const pts = Array.from(surface.points, p => ({
    x: p.x, y: p.y
  }));

  return {
    element: surface,
    A: pts[0],
    B: pts[1],
    C: pts[2],
    D: pts[3]
  };
});

const wavefrontLayer = document.querySelector(".wavefronts");
const svgNS = "http://www.w3.org/2000/svg";

const activePulses = [];
const travelDuration = 5000;

let nextSpawnAt = 0;

function spawnPulse(now) {
  const group = document.createElementNS(svgNS, "g");
  group.classList.add("wavefront-group");
  wavefrontLayer.appendChild(group);

  const pulseConfig = {
    amplitude: rand(6, 10),
    frequency: rand(1.8, 2.8),
    speed: rand(2.8, 4.2),
    phase: rand(0, Math.PI *2),

    driftAmount: rand(0.08, 0.18),
    driftSpeed: rand(0.8, 1.5),
    driftPhase: rand(0, Math.PI *2),
    bandFrequency: rand(2.5, 4.5)
  };

  const surfaceItems = surfaces.map((surface, index) => {
    const path = document.createElementNS(svgNS, "path");
    path.classList.add("wavefront-path");

    const { gradient, stops } = makeFadingStroke(
      svg, svgNS,
      `wave-grad-${now}-${index}-${Math.random().toString(36).slice(2)}`
    );

    path.style.stroke = `url(#${gradient.id}`;

    const spark1 = document.createElementNS(svgNS, "circle");
    spark1.classList.add("wavefront-spark");

    const spark2 = document.createElementNS(svgNS, "circle");
    spark2.classList.add("wavefront-spark");

    group.appendChild(path);
    group.appendChild(spark1);
    group.appendChild(spark2);

    return {
      surface, path, gradient, stops,
      spark1, spark2, pulseConfig
    };
  });

  activePulses.push({
    bornAt: now,
    duration: travelDuration, group, surfaceItems, pulseConfig
  });

  nextSpawnAt = now + rand(400, 600);
}

function updatePulse(pulse, now) {
  const age = now - pulse.bornAt;
  const t = age / pulse.duration;
  const timeSeconds = age / 1000;

  pulse.surfaceItems.forEach((item, surfaceIndex) => {
    const { surface, path, spark1, spark2, pulseConfig } =  item;

    const { P1, P2 } = getTravelPoints(surface, t);

    const d = buildWavePath(P1, P2, timeSeconds, pulseConfig);
    path.setAttribute("d", d);

    updateGradient(item, P1, P2, timeSeconds);

    updateSpark(spark1, P1, timeSeconds, surfaceIndex * 0.9 + 0.5);
    updateSpark(spark2, P2, timeSeconds, surfaceIndex * 0.9 + 1.7);
  });
}

function cleanupPulses(now) {
  for (let i = activePulses.length - 1; i >= 0; i--) {
    const pulse = activePulses[i];
    if (now - pulse.bornAt > pulse.duration) {
      pulse.group.remove();
      activePulses.splice(i, 1);
    }
  }
}

// Sparks at the endpoints
const spark1 = document.createElementNS(svgNS, "circle");
spark1.classList.add("wavefront-spark");

const spark2 = document.createElementNS(svgNS, "circle");
spark2.classList.add("wavefront-spark");

waveGroup.appendChild(path);
waveGroup.appendChild(spark1);
waveGroup.appendChild(spark2);

function updateSpark(circle, point, timeSeconds, seed = 0) {
  const pulse = (Math.sin(timeSeconds * 7 + seed) +1) / 2;
  const radius = 2.8 + pulse * 2.4;

  circle.setAttribute("cx", point.x);
  circle.setAttribute("cy", point.y);
  circle.setAttribute("r", radius.toFixed(2));
  circle.setAttribute("opacity", (0.65 + pulse * 0.3).toFixed(2));
}

// One line for each for trapazoids.
const waves = Array.from(surfaces, (surface, index) => {
  const points = Array.from(surface.points, p => ({
    x: p.x, y: p.y
  }));

  const path = document.createElementNS(svgNS, "path");
  path.classList.add("traveling-line");
  waveGroup.appendChild(path);

  const fadedId = `about-energy-${index}`;

  const { gradient, stops } = makeFadingStroke(fadedId);

  path.style.stroke = `url(#${fadedId}`;

  return {
    A: points[0],
    B: points[1],
    C: points[2],
    D: points[3],
    path,
    gradient,
    stops,
    wavesConfig: {
      amplitude: 6 + Math.random() * 5,
      frequency: 1.5 + Math.random() * 1.2,
      speed: 2.2 + Math.random() * 1.0,
      phase: Math.random() * Math.PI * 2,
      segments: 24
    }
  };
});

// Random utility
function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Linear interpolation: start -> finish
function lerp(start, finish, t) {
  return start + (finish - start) * t;
}

// Moving endpoints
function getTravelPoints(surface, t) {
  return {
    P1: {
      x: lerp(surface.D.x, surface.A.x, t),
      y: lerp(surface.D.y, surface.A.y, t)
    },
    P2: {
      x: lerp(surface.C.x, surface.B.x, t),
      y: lerp(surface.C.y, surface.B.y, t)
    }
  };
}

function buildWavePath(P1, P2, timeSeconds, options = {}) {
  const segments = options.segments ?? 24;
  const amplitude = options.amplitude ?? 8;
  const frequency = options.frequency ?? 2.2;
  const speed = options.speed ?? 3.2;
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

    // Align the gradient with the moving endpoints.
    wave.gradient.setAttribute("x1", P1.x);
    wave.gradient.setAttribute("y1", P1.y);
    wave.gradient.setAttribute("x2", P2.x);
    wave.gradient.setAttribute("y2", P2.y);

    // Independently animate brightness along the wave.
    wave.stops.forEach((stop, i) => {
      const oscillation = (Math.sin(timeSeconds * stop.speed + stop.phase) + 1) / 2;

      let opacity = 0.12 + 0.88 * oscillation ** 2;

      // Keep connected wave corners consistently visible.
      if (i === 0 || i === wave.stops.length -1) {
        opacity = 0.85;
      }

      stop.element.setAttribute("stop-opacity", opacity.toFixed(2));
    });
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

function animateProjector(now) {
  if (nextSpawnAt === 0) {
    nextSpawnAt = now;
  }
  
  while (now >= nextSpawnAt) {
    spawnPulse(now);
  }

  activePulses.forEach(pulse => updatePulse(pulse, now));
  cleanupPulses(now);

  requestAnimationFrame(animateProjector);
}

if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
  spawnPulse(0);
  activePulses.forEach(pulse => updatePulse(pulse, travelDuration * 0.5));
} else {
  requestAnimationFrame(animateWaves);
}
