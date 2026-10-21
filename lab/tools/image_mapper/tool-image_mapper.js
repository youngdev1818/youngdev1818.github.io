"use strict";

// Young Dev Image Mapper — offline polygon editor. All geometry is stored in
// original image pixels; zoom, percentages, and SVG are only representations.
const $ = (selector) => document.querySelector(selector);
const imageInput = $("#image-file");
const imagePreview = $("#image-preview");
const imageStage = $("#image-stage");
const imageDetails = $("#image-details");
const workspace = $("#workspace-viewport");
const overlay = $("#point-overlay");
const defs = $("#gradient-definitions");
const polygonLayer = $("#polygon-layer");
const polygonNumbers = $("#polygon-numbers");
const markerLayer = $("#point-markers");
const polygonList = $("#polygon-list");
const pointList = $("#point-list");
const coordinateResult = $("#coordinate-result");
const coordinateCode = $("#coordinate-code");
const saveStatus = $("#save-status");
const zoomReadout = $("#zoom-readout");
const fitImageButton = $("#fit-image");
const fitPolygonButton = $("#fit-polygon");
const panLock = $("#lock-pan");
const undoButton = $("#undo-point");
const clearButton = $("#clear-points");
const copyButton = $("#copy-svg");
const copyOverlayButton = $("#copy-overlay");
const addPointButton = $("#add-point");
const removePointButton = $("#remove-point");
const addPolygonButton = $("#add-polygon");
const projectSaveButton = $("#save-project");
const saveViewButton = $("#save-view");
const fillColor = $("#fill-color");
const fillColorB = $("#fill-color-b");
const fillOpacity = $("#fill-opacity");
const fillOpacityValue = $("#fill-opacity-value");
const gradientEnabled = $("#gradient-enabled");
const gradientAngle = $("#gradient-angle");
const gradientAngleValue = $("#gradient-angle-value");
const ratioXInput = $("#ratio-x");
const ratioYInput = $("#ratio-y");
const svgNS = "http://www.w3.org/2000/svg";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PALETTE = ["#00ffcc", "#ff88c7", "#6cb8ff", "#ffd166", "#b5e48c", "#ca9dff", "#ff9d6c", "#8ee0e9"];
const MIN_ZOOM = 0.00000001;
const MAX_ZOOM = 64;
const POINT_LIMIT_MULTIPLIER = 1_000_000;
const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY = 350;

const view = {zoom: 1, panX: 0, panY: 0};
let imageURL = null;
let imageBlob = null;
let imageName = "image";
let lastCustomRatio = null;
let workspaceRatio = {x: 1, y: 1};
let coordinateMode = "svg";
let addPointArmed = false;
let polygons = [makePolygon(1)];
let activeId = 1;
let nextId = 2;
let history = [];
let saveTimer = null;
let storageWarningShown = false;

function makePolygon(id) {
  return {
    id, points: [], visible: true,
    color: PALETTE[(id - 1) % PALETTE.length],
    colorB: "#537dff", gradient: false, angle: 0, opacity: 0.18
  };
}
function activePolygon() { return polygons.find(p => p.id === activeId) || polygons[0]; }
function hasImage() { return !!(imageBlob && imagePreview.naturalWidth); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function fmt(value, digits = 4) { return Number(value.toFixed(digits)).toString(); }
function snapshotGeometry() { return JSON.stringify({polygons, activeId, nextId}); }
function recordHistory(before) {
  if (before === snapshotGeometry()) return false;
  history.push(before);
  if (history.length > HISTORY_LIMIT) history.shift();
  scheduleSave();
  return true;
}
function editGeometry(change) {
  const before = snapshotGeometry();
  change();
  recordHistory(before);
  render();
}
function setSaveStatus(message) { saveStatus.textContent = message; }
function getCoords(event) {
  const rect = imagePreview.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) * imagePreview.naturalWidth / rect.width);
  const y = Math.round((event.clientY - rect.top) * imagePreview.naturalHeight / rect.height);
  return {
    x: clamp(x, -imagePreview.naturalWidth * POINT_LIMIT_MULTIPLIER, imagePreview.naturalWidth * POINT_LIMIT_MULTIPLIER),
    y: clamp(y, -imagePreview.naturalHeight * POINT_LIMIT_MULTIPLIER, imagePreview.naturalHeight * POINT_LIMIT_MULTIPLIER)
  };
}
function pointScreenPosition(point) {
  const rect = imagePreview.getBoundingClientRect();
  return {
    x: rect.left + point.x / imagePreview.naturalWidth * rect.width,
    y: rect.top + point.y / imagePreview.naturalHeight * rect.height
  };
}
function findMarker(event) {
  let chosen = null;
  let distanceMin = 24 * 24;
  for (const poly of [activePolygon(), ...polygons.filter(p => p.id !== activeId)]) {
    if (!poly.visible) continue;
    poly.points.forEach((point, index) => {
      const loc = pointScreenPosition(point);
      const distance = (event.clientX - loc.x) ** 2 + (event.clientY - loc.y) ** 2;
      if (distance < distanceMin) { distanceMin = distance; chosen = {id: poly.id, index}; }
    });
  }
  return chosen;
}
function isInsidePolygon(x, y, points) {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function selectPolygonAt(event) {
  const pt = getCoords(event);
  // The most recently created polygon appears visually on top.
  for (let i = polygons.length - 1; i >= 0; i--) {
    const poly = polygons[i];
    if (poly.visible && poly.id !== activeId && isInsidePolygon(pt.x, pt.y, poly.points)) {
      activeId = poly.id;
      addPointArmed = false;
      render();
      scheduleSave();
      return true;
    }
  }
  return false;
}
function addPointAt(event) {
  // Do not switch layers while placing points; overlapping polygons must be drawable.
  if (!addPointArmed && activePolygon().points.length >= 4 && selectPolygonAt(event)) return;
  const poly = activePolygon();
  if (poly.points.length >= 26 || (poly.points.length >= 4 && !addPointArmed)) return;
  editGeometry(() => { poly.points.push(getCoords(event)); });
  addPointArmed = false;
  renderActions();
}
function setWorkspaceRatio(x, y, persist = true) {
  const ratio = x / y;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    coordinateResult.textContent = "Please enter a valid positive X:Y ratio.";
    return;
  }
  workspaceRatio = {x, y};
  workspace.style.aspectRatio = `${x} / ${y}`;
  workspace.style.width = `min(100%, ${70 * ratio}svh)`;
  ratioXInput.value = x;
  ratioYInput.value = y;
  if (hasImage()) draw();
  if (persist) scheduleSave();
}
$("#ratio-image").addEventListener("click", () => {
  if (hasImage()) setWorkspaceRatio(imagePreview.naturalWidth, imagePreview.naturalHeight);
});
$("#ratio-square").addEventListener("click", () => setWorkspaceRatio(1, 1));
$("#ratio-apply").addEventListener("click", () => {
  const x = Number(ratioXInput.value), y = Number(ratioYInput.value);
  if (!(x > 0 && y > 0 && Number.isFinite(x / y))) {
    coordinateResult.textContent = "Please enter a valid positive ratio.";
    return;
  }
  lastCustomRatio = {x, y};
  $("#ratio-applied").disabled = false;
  setWorkspaceRatio(x, y);
});
$("#ratio-applied").addEventListener("click", () => {
  if (lastCustomRatio) setWorkspaceRatio(lastCustomRatio.x, lastCustomRatio.y);
});

function applyView(save = false) {
  imageStage.style.transform = `translate(-50%, -50%) translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
  const percent = view.zoom * 100;
  zoomReadout.textContent = percent < 0.01 ? `${percent.toExponential(2)}%` :
    percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
  draw();
  if (save) scheduleSave();
}
function fitImage() {
  if (!hasImage()) return;
  const sw = imageStage.offsetWidth, sh = imageStage.offsetHeight;
  if (!sw || !sh) return;
  view.zoom = clamp(Math.min(workspace.clientWidth / sw, workspace.clientHeight / sh), MIN_ZOOM, MAX_ZOOM);
  view.panX = view.panY = 0;
  applyView(true);
}
function fitPolygon() {
  const points = activePolygon().points;
  if (!hasImage() || points.length < 2) return;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sw = imageStage.offsetWidth, sh = imageStage.offsetHeight;
  if (!sw || !sh) return;
  const w = (maxX - minX) * sw / imagePreview.naturalWidth;
  const h = (maxY - minY) * sh / imagePreview.naturalHeight;
  view.zoom = clamp(Math.min(Math.max(1, workspace.clientWidth - 64) / Math.max(1, w),
                             Math.max(1, workspace.clientHeight - 64) / Math.max(1, h)), MIN_ZOOM, MAX_ZOOM);
  view.panX = -(((minX + maxX) / 2 / imagePreview.naturalWidth) - .5) * sw * view.zoom;
  view.panY = -(((minY + maxY) / 2 / imagePreview.naturalHeight) - .5) * sh * view.zoom;
  applyView(true);
}
fitImageButton.addEventListener("click", fitImage);
fitPolygonButton.addEventListener("click", fitPolygon);
workspace.addEventListener("wheel", (event) => {
  if (!hasImage()) return;
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1);
  const oldZoom = view.zoom;
  const newZoom = clamp(oldZoom * Math.exp(-delta * 0.001), MIN_ZOOM, MAX_ZOOM);
  if (oldZoom === newZoom) return;
  const rect = workspace.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const change = newZoom / oldZoom;
  view.panX = x - (x - view.panX) * change;
  view.panY = y - (y - view.panY) * change;
  view.zoom = newZoom;
  applyView(true);
}, {passive: false});

function svgNode(tag, attrs = {}, content = null) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (content !== null) node.textContent = content;
  return node;
}
function gradientStops(poly) {
  const angle = poly.angle * Math.PI / 180;
  const dx = Math.cos(angle) * 50, dy = Math.sin(angle) * 50;
  return {
    x1: `${fmt(50 - dx)}%`, y1: `${fmt(50 - dy)}%`,
    x2: `${fmt(50 + dx)}%`, y2: `${fmt(50 + dy)}%`
  };
}
function draw() {
  defs.replaceChildren(); polygonLayer.replaceChildren(); polygonNumbers.replaceChildren(); markerLayer.replaceChildren();
  if (!hasImage()) return;
  const displayWidth = imagePreview.getBoundingClientRect().width;
  const scale = displayWidth ? clamp(imagePreview.naturalWidth / displayWidth, .000001, 1e9) : 1;
  for (const poly of polygons) {
    if (!poly.visible) continue;
    const coords = poly.points.map(p => `${fmt(p.x)} ${fmt(p.y)}`).join(" ");
    if (poly.gradient) {
      const gradient = svgNode("linearGradient", {id: `gradient-${poly.id}`, ...gradientStops(poly)});
      gradient.append(svgNode("stop", {offset: "0%", "stop-color": poly.color}),
                      svgNode("stop", {offset: "100%", "stop-color": poly.colorB}));
      defs.append(gradient);
    }
    if (poly.points.length >= 2) {
      const attrs = {
        points: coords, stroke: poly.color, "stroke-width": poly.id === activeId ? 2.5 : 1.6,
        "stroke-opacity": poly.id === activeId ? 1 : .76,
        fill: poly.points.length >= 3 ? (poly.gradient ? `url(#gradient-${poly.id})` : poly.color) : "none",
        "fill-opacity": poly.opacity
      };
      polygonLayer.append(svgNode(poly.points.length >= 3 ? "polygon" : "polyline", attrs));
    }
    if (poly.points.length >= 2) {
      const x = poly.points.reduce((sum, p) => sum + p.x, 0) / poly.points.length;
      const y = poly.points.reduce((sum, p) => sum + p.y, 0) / poly.points.length;
      const mark = svgNode("g");
      mark.append(svgNode("circle", {cx: x, cy: y, r: 13 * scale, fill: poly.color}),
                  svgNode("text", {x, y, "font-size": 14 * scale}, String(poly.id)));
      polygonNumbers.append(mark);
    }
  }
  const active = activePolygon();
  if (active.visible) active.points.forEach((point, index) => {
    markerLayer.append(svgNode("circle", {cx: point.x, cy: point.y, r: 7 * scale}));
    markerLayer.append(svgNode("text", {
      x: point.x + 11 * scale, y: point.y - 11 * scale, "font-size": 16 * scale
    }, LETTERS[index]));
  });
}
function inputNumberFromPoint(point, axis) {
  return coordinateMode === "svg" ? fmt(point[axis]) :
    fmt(point[axis] / (axis === "x" ? imagePreview.naturalWidth : imagePreview.naturalHeight) * 100, 6);
}
function updatePointList() {
  pointList.replaceChildren();
  if (!hasImage()) return;
  const poly = activePolygon();
  poly.points.forEach((point, index) => {
    const row = document.createElement("li");
    const heading = document.createElement("strong"); heading.textContent = `${LETTERS[index]}:`;
    row.append(heading);
    for (const axis of ["x", "y"]) {
      const label = document.createElement("label");
      label.textContent = `${axis.toUpperCase()}${coordinateMode === "percent" ? "%" : ""} `;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      const limit = coordinateMode === "percent" ? 100 * POINT_LIMIT_MULTIPLIER :
        (axis === "x" ? imagePreview.naturalWidth : imagePreview.naturalHeight) * POINT_LIMIT_MULTIPLIER;
      input.min = -limit; input.max = limit; input.required = true;
      input.value = inputNumberFromPoint(point, axis);
      input.setAttribute("aria-label", `${LETTERS[index]} ${axis.toUpperCase()} ${coordinateMode === "percent" ? "percentage" : "coordinate"}`);
      let beforeFocus = null;
      input.addEventListener("focus", () => { beforeFocus = snapshotGeometry(); });
      input.addEventListener("input", () => {
        if (!input.validity.valid || !Number.isFinite(Number(input.value))) return;
        const raw = Number(input.value);
        poly.points[index][axis] = coordinateMode === "svg" ? raw :
          raw / 100 * (axis === "x" ? imagePreview.naturalWidth : imagePreview.naturalHeight);
        draw(); updateOutput();
      });
      input.addEventListener("blur", () => {
        if (!input.validity.valid || input.value.trim() === "") input.value = inputNumberFromPoint(poly.points[index], axis);
        if (beforeFocus) recordHistory(beforeFocus);
        beforeFocus = null;
        renderActions();
      });
      label.append(input); row.append(label);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "−";
    remove.title = `Remove vertex ${LETTERS[index]}`;
    remove.setAttribute("aria-label", `Remove vertex ${LETTERS[index]}`);
    remove.disabled = poly.points.length <= 2;
    remove.addEventListener("click", () => editGeometry(() => poly.points.splice(index, 1)));
    row.append(remove);
    pointList.append(row);
  });
}
function updatePolygonList() {
  polygonList.replaceChildren();
  for (const poly of polygons) {
    const row = document.createElement("li");
    row.className = `polygon-row${poly.id === activeId ? " active" : ""}`;
    const select = document.createElement("button");
    select.type = "button"; select.className = "polygon-select";
    select.setAttribute("aria-pressed", String(poly.id === activeId));
    select.setAttribute("aria-label", `Edit polygon ${poly.id}`);
    const swatch = document.createElement("span"); swatch.className = "layer-swatch";
    swatch.style.backgroundColor = poly.color;
    const words = document.createElement("span"); words.className = "layer-text";
    const title = document.createElement("span"); title.textContent = `Polygon ${poly.id}`;
    const count = document.createElement("small"); count.textContent = `${poly.points.length} point${poly.points.length === 1 ? "" : "s"}`;
    words.append(title, count); select.append(swatch, words);
    select.addEventListener("click", () => { activeId = poly.id; addPointArmed = false; render(); scheduleSave(); });
    const label = document.createElement("label"); label.className = "layer-visible";
    label.title = `Show polygon ${poly.id}`;
    const visible = document.createElement("input"); visible.type = "checkbox";
    visible.checked = poly.visible;
    visible.setAttribute("aria-label", `Show polygon ${poly.id}`);
    visible.addEventListener("change", () => editGeometry(() => {poly.visible = visible.checked;}));
    label.append(visible);
    const del = document.createElement("button"); del.className = "layer-delete";
    del.type = "button"; del.textContent = "×";
    del.title = `Delete polygon ${poly.id}`;
    del.setAttribute("aria-label", `Delete polygon ${poly.id}`);
    del.disabled = polygons.length <= 1;
    del.addEventListener("click", () => editGeometry(() => {
      polygons = polygons.filter(p => p.id !== poly.id);
      if (activeId === poly.id) activeId = polygons[0].id;
      addPointArmed = false;
    }));
    row.append(select, label, del);
    polygonList.append(row);
  }
}
function updateFillControls() {
  const poly = activePolygon();
  for (const input of [fillColor, fillColorB, gradientEnabled, gradientAngle, fillOpacity]) input.disabled = !hasImage();
  fillColor.value = poly.color;
  fillColorB.value = poly.colorB;
  gradientEnabled.checked = poly.gradient;
  gradientAngle.value = String(poly.angle);
  fillOpacity.value = String(Math.round(poly.opacity * 100));
  fillColorB.disabled = !hasImage() || !poly.gradient;
  gradientAngle.disabled = !hasImage() || !poly.gradient;
  gradientAngleValue.textContent = `${poly.angle}°`;
  fillOpacityValue.textContent = `${Math.round(poly.opacity * 100)}%`;
}
function updateOutput() {
  if (!hasImage()) {coordinateCode.value = ""; return;}
  const points = activePolygon().points;
  if (!points.length) {coordinateCode.value = "Place points to generate coordinates."; return;}
  if (coordinateMode === "svg") {
    coordinateCode.value = `points="${points.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(" ")}"`;
  } else if (points.length >= 3) {
    coordinateCode.value = `clip-path: polygon(${points.map(p =>
      `${fmt(p.x / imagePreview.naturalWidth * 100, 6)}% ${fmt(p.y / imagePreview.naturalHeight * 100, 6)}%`).join(", ")});`;
  } else {
    coordinateCode.value = points.map((p, i) =>
      `${LETTERS[i]}: ${fmt(p.x / imagePreview.naturalWidth * 100, 6)}% ${fmt(p.y / imagePreview.naturalHeight * 100, 6)}%`).join("\n");
  }
}
function renderActions() {
  const poly = activePolygon();
  const len = poly.points.length;
  const loaded = hasImage();
  undoButton.disabled = history.length === 0;
  clearButton.disabled = !loaded || !len;
  copyButton.disabled = !loaded || !len;
  copyOverlayButton.disabled = !loaded || polygons.every(p => !p.visible || p.points.length < 2);
  fitPolygonButton.disabled = !loaded || len < 2;
  removePointButton.disabled = !loaded || len <= 2;
  addPointButton.disabled = !loaded || len >= 26;
  addPointButton.classList.toggle("armed", addPointArmed);
  addPointButton.textContent = addPointArmed ? "Cancel Add Point" : "Add Point";
  if (loaded) {
    coordinateResult.textContent = len < 2 ? `${len}/4 starting corners — tap the image to place points.` :
      len < 4 ? `${len}/4 starting corners. Two points draw a line; three make a polygon.` :
      `${len}/26 vertices — ${poly.id === activeId ? "editing" : "viewing"} polygon ${poly.id}.`;
    if (addPointArmed) coordinateResult.textContent = "Tap the image to place the next vertex (A–Z).";
  }
}
function render() {
  updatePolygonList(); updateFillControls(); updatePointList(); draw(); updateOutput(); renderActions();
}

$("#add-polygon").addEventListener("click", () => {
  if (!hasImage()) return;
  editGeometry(() => {const poly = makePolygon(nextId++); polygons.push(poly); activeId = poly.id; addPointArmed = false;});
});
addPointButton.addEventListener("click", () => {
  if (!hasImage() || activePolygon().points.length === 26) return;
  addPointArmed = !addPointArmed;
  renderActions();
});
removePointButton.addEventListener("click", () => {
  if (activePolygon().points.length > 2) editGeometry(() => {activePolygon().points.pop(); addPointArmed = false;});
});
clearButton.addEventListener("click", () => editGeometry(() => {activePolygon().points = []; addPointArmed = false;}));
undoButton.addEventListener("click", () => {
  if (!history.length) return;
  const previous = JSON.parse(history.pop());
  polygons = previous.polygons; activeId = previous.activeId; nextId = previous.nextId;
  addPointArmed = false;
  render(); scheduleSave();
});
for (const input of document.querySelectorAll('input[name="coordinate-mode"]')) {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    coordinateMode = input.value;
    updatePointList(); updateOutput(); scheduleSave();
  });
}
for (const [element, field, transform] of [
  [fillColor, "color", v => v],
  [fillColorB, "colorB", v => v],
  [gradientEnabled, "gradient", v => v],
  [gradientAngle, "angle", v => Number(v)],
  [fillOpacity, "opacity", v => Number(v) / 100]
]) {
  // Slider drags and color picker changes are one undo action per editing gesture.
  let before = null;
  element.addEventListener("pointerdown", () => {before = snapshotGeometry();});
  element.addEventListener("focus", () => {if (!before) before = snapshotGeometry();});
  element.addEventListener("input", () => {
    if (!hasImage()) return;
    activePolygon()[field] = transform(element.type === "checkbox" ? element.checked : element.value);
    draw(); updateFillControls(); updatePolygonList();
    scheduleSave();
  });
  element.addEventListener("change", () => {
    if (before) recordHistory(before);
    before = null;
    render();
  });
  element.addEventListener("blur", () => {
    if (before) recordHistory(before);
    before = null;
    renderActions();
  });
}

// Mouse / pen: click to add, drag a marker to move it. No history during frames.
let activePointerId = null;
let dragged = null;
let dragBefore = null;
workspace.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" || !hasImage()) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (activePointerId !== null) return;
  const hit = findMarker(event);
  if (hit) {
    if (activeId !== hit.id) {activeId = hit.id; render(); scheduleSave();}
    dragBefore = snapshotGeometry(); dragged = hit;
    activePointerId = event.pointerId;
    workspace.setPointerCapture(event.pointerId);
    workspace.style.cursor = "grabbing";
    return;
  }
  addPointAt(event);
});
workspace.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || !hasImage()) return;
  if (activePointerId === null) {
    workspace.style.cursor = findMarker(event) ? "grab" : "crosshair";
    return;
  }
  if (event.pointerId !== activePointerId || !dragged) return;
  const poly = polygons.find(p => p.id === dragged.id);
  if (!poly) return;
  poly.points[dragged.index] = getCoords(event);
  draw(); syncInputs(dragged.index); updateOutput();
});
function finishMouse(event) {
  if (event.pointerId !== activePointerId) return;
  if (dragBefore) recordHistory(dragBefore);
  activePointerId = null; dragged = null; dragBefore = null;
  if (workspace.hasPointerCapture(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
  workspace.style.cursor = "crosshair";
  render();
}
workspace.addEventListener("pointerup", finishMouse);
workspace.addEventListener("pointercancel", finishMouse);
workspace.addEventListener("lostpointercapture", finishMouse);
function syncInputs(index) {
  const row = pointList.children[index];
  const poly = activePolygon();
  if (!row || !poly.points[index]) return;
  const inputs = row.querySelectorAll('input[type="number"]');
  if (inputs.length === 2) {
    inputs[0].value = inputNumberFromPoint(poly.points[index], "x");
    inputs[1].value = inputNumberFromPoint(poly.points[index], "y");
  }
}

// Touch: one finger taps or drags corners/pans; two fingers pinch+pan.
const touchPointers = new Map();
let touchMode = "none";
let touchMarker = null;
let touchStart = null;
let previousPinch = null;
let touchDragBefore = null;
function pinchInfo() {
  const [a, b] = [...touchPointers.values()];
  return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
    distance: Math.hypot(b.x - a.x, b.y - a.y)};
}
workspace.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || !hasImage() || touchPointers.size >= 2) return;
  touchPointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  workspace.setPointerCapture(event.pointerId);
  if (touchPointers.size === 2) {
    if (touchDragBefore) recordHistory(touchDragBefore);
    touchDragBefore = null; touchMode = "pinch"; previousPinch = pinchInfo();
    touchMarker = null; touchStart = null;
    return;
  }
  if (touchMode === "pinch") return;
  touchMarker = findMarker(event);
  if (touchMarker && activeId !== touchMarker.id) {
    activeId = touchMarker.id; render(); scheduleSave();
  }
  touchStart = {id: event.pointerId, x: event.clientX, y: event.clientY,
    lastX: event.clientX, lastY: event.clientY};
  touchMode = touchMarker ? "drag" : "tap";
  touchDragBefore = touchMarker ? snapshotGeometry() : null;
});
workspace.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId)) return;
  touchPointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  if (touchMode === "pinch") {
    if (touchPointers.size < 2 || !previousPinch) return;
    const current = pinchInfo();
    const oldZoom = view.zoom;
    const newZoom = clamp(oldZoom * current.distance / Math.max(1, previousPinch.distance), MIN_ZOOM, MAX_ZOOM);
    const factor = newZoom / oldZoom;
    const rect = workspace.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    view.panX = current.x - centerX - (previousPinch.x - centerX - view.panX) * factor;
    view.panY = current.y - centerY - (previousPinch.y - centerY - view.panY) * factor;
    view.zoom = newZoom; previousPinch = current;
    applyView();
    return;
  }
  if (touchMode === "drag" && touchMarker) {
    const poly = polygons.find(p => p.id === touchMarker.id);
    if (poly) {
      poly.points[touchMarker.index] = getCoords(event);
      draw(); syncInputs(touchMarker.index); updateOutput();
    }
    return;
  }
  if ((touchMode === "tap" || touchMode === "pan") && touchStart) {
    const dx = event.clientX - touchStart.lastX;
    const dy = event.clientY - touchStart.lastY;
    if (touchMode === "tap" && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 8) {
      touchMode = panLock.checked ? "ignore" : "pan";
    }
    if (touchMode === "pan") {view.panX += dx; view.panY += dy; applyView();}
    touchStart.lastX = event.clientX; touchStart.lastY = event.clientY;
  }
});
function finishTouch(event) {
  if (!touchPointers.has(event.pointerId)) return;
  if (event.type === "pointerup" && touchMode === "tap" && touchPointers.size === 1 &&
      touchStart && touchStart.id === event.pointerId) addPointAt(event);
  if (touchDragBefore) recordHistory(touchDragBefore);
  touchDragBefore = null;
  const movedView = touchMode === "pan" || touchMode === "pinch";
  touchPointers.delete(event.pointerId);
  if (touchPointers.size < 2) previousPinch = null;
  if (touchPointers.size === 0) {
    touchMode = "none"; touchMarker = null; touchStart = null;
    render();
    if (movedView) scheduleSave();
  }
}
workspace.addEventListener("pointerup", finishTouch);
workspace.addEventListener("pointercancel", finishTouch);
workspace.addEventListener("lostpointercapture", finishTouch);

// An SVG overlay copy is useful for preserving visible fills and gradients.
function buildSVGOverlay() {
  const w = imagePreview.naturalWidth, h = imagePreview.naturalHeight;
  const gradients = [], shapes = [];
  for (const poly of polygons) {
    if (!poly.visible || poly.points.length < 2) continue;
    if (poly.gradient && poly.points.length >= 3) {
      const g = gradientStops(poly);
      gradients.push(`<linearGradient id="gradient-${poly.id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"><stop offset="0%" stop-color="${poly.color}"/><stop offset="100%" stop-color="${poly.colorB}"/></linearGradient>`);
    }
    const tag = poly.points.length < 3 ? "polyline" : "polygon";
    const fill = tag === "polyline" ? "none" : poly.gradient ? `url(#gradient-${poly.id})` : poly.color;
    shapes.push(`<${tag} points="${poly.points.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(" ")}" fill="${fill}" fill-opacity="${fmt(poly.opacity)}" stroke="${poly.color}" stroke-width="2"/>`);
  }
  return `<svg xmlns="${svgNS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<defs>${gradients.join("")}</defs>\n${shapes.join("\n")}\n</svg>`;
}
async function copyText(value) {
  try {await navigator.clipboard.writeText(value); setSaveStatus("Copied to clipboard.");}
  catch (error) {setSaveStatus("Copy failed; browser clipboard permission may be unavailable."); console.error(error);}
}
copyButton.addEventListener("click", () => copyText(coordinateCode.value));
copyOverlayButton.addEventListener("click", () => copyText(buildSVGOverlay()));
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = fileName;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function fileStem(name) { return name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 55) || "image"; }
function drawViewToCanvas() {
  const w = workspace.clientWidth, h = workspace.clientHeight;
  const resolution = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * resolution));
  canvas.height = Math.max(1, Math.round(h * resolution));
  const ctx = canvas.getContext("2d");
  ctx.scale(resolution, resolution);
  ctx.fillStyle = "#3e4044"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#505257"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 32) {ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); ctx.stroke();}
  for (let y = 0; y < h; y += 32) {ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke();}
  const naturalW = imagePreview.naturalWidth, naturalH = imagePreview.naturalHeight;
  const drawW = imageStage.offsetWidth * view.zoom;
  const drawH = imageStage.offsetHeight * view.zoom;
  const imageX = (w - drawW) / 2 + view.panX;
  const imageY = (h - drawH) / 2 + view.panY;
  ctx.drawImage(imagePreview, imageX, imageY, drawW, drawH);
  const toX = x => imageX + x / naturalW * drawW;
  const toY = y => imageY + y / naturalH * drawH;
  for (const poly of polygons) {
    if (!poly.visible || poly.points.length < 2) continue;
    ctx.beginPath();
    poly.points.forEach((p, i) => i ? ctx.lineTo(toX(p.x), toY(p.y)) : ctx.moveTo(toX(p.x), toY(p.y)));
    if (poly.points.length >= 3) {
      ctx.closePath();
      if (poly.gradient) {
        const xs = poly.points.map(p => toX(p.x)), ys = poly.points.map(p => toY(p.y));
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const dx = (Math.max(...xs) - Math.min(...xs)) / 2 * Math.cos(poly.angle * Math.PI / 180);
        const dy = (Math.max(...ys) - Math.min(...ys)) / 2 * Math.sin(poly.angle * Math.PI / 180);
        const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx + (dx === 0 ? .00001 : 0), cy + dy + (dy === 0 ? .00001 : 0));
        g.addColorStop(0, poly.color); g.addColorStop(1, poly.colorB);
        ctx.fillStyle = g;
      } else ctx.fillStyle = poly.color;
      ctx.globalAlpha = poly.opacity; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.lineWidth = poly.id === activeId ? 2.5 : 1.6;
    ctx.strokeStyle = poly.color; ctx.stroke();
    const mx = poly.points.reduce((v, p) => v + toX(p.x), 0) / poly.points.length;
    const my = poly.points.reduce((v, p) => v + toY(p.y), 0) / poly.points.length;
    ctx.beginPath(); ctx.arc(mx, my, 13, 0, 2 * Math.PI);
    ctx.fillStyle = poly.color; ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeStyle = "#111"; ctx.lineWidth = 3;
    ctx.strokeText(String(poly.id), mx, my);
    ctx.fillStyle = "#fff"; ctx.fillText(String(poly.id), mx, my);
  }
  if (activePolygon().visible) activePolygon().points.forEach((p, i) => {
    const x = toX(p.x), y = toY(p.y);
    ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffd166"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#111"; ctx.stroke();
    ctx.font = "bold 16px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.strokeText(LETTERS[i], x + 11, y - 11);
    ctx.fillStyle = "#ffd166"; ctx.fillText(LETTERS[i], x + 11, y - 11);
  });
  return canvas;
}
saveViewButton.addEventListener("click", () => {
  if (!hasImage()) return;
  try {
    drawViewToCanvas().toBlob(blob => {
      if (blob) {downloadBlob(blob, `${fileStem(imageName)}-mapper-view.png`); setSaveStatus("PNG viewpoint exported.");}
      else setSaveStatus("Unable to export the canvas.");
    }, "image/png");
  } catch (error) {setSaveStatus("PNG export failed. Try another image format."); console.error(error);}
});

// IndexedDB is used rather than localStorage, which is unsuitable for images.
const databaseReady = new Promise(resolve => {
  if (!("indexedDB" in window)) {resolve(null); return;}
  const request = indexedDB.open("YoungDevImageMapper", 1);
  request.onupgradeneeded = () => {if (!request.result.objectStoreNames.contains("projects")) request.result.createObjectStore("projects");};
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
  request.onblocked = () => resolve(null);
});
function documentState() {
  return {
    polygons, activeId, nextId, view: {...view},
    ratio: {...workspaceRatio}, lastCustomRatio,
    coordinateMode, panLocked: panLock.checked
  };
}
function scheduleSave() {
  if (!imageBlob) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {saveNow();}, AUTOSAVE_DELAY);
}
async function saveNow() {
  if (!imageBlob) return;
  const db = await databaseReady;
  if (!db) {
    if (!storageWarningShown) setSaveStatus("Browser autosave unavailable. Use Save Project JSON for backup.");
    storageWarningShown = true;
    return;
  }
  try {
    const transaction = db.transaction("projects", "readwrite");
    transaction.objectStore("projects").put({blob: imageBlob, name: imageName, doc: documentState()}, "autosave");
    transaction.oncomplete = () => setSaveStatus("Autosaved locally in this browser. JSON backup recommended.");
    transaction.onerror = () => setSaveStatus("Autosave failed (storage quota or browser settings). Save a JSON backup.");
  } catch (error) {setSaveStatus("Autosave unavailable. Save a JSON backup."); console.error(error);}
}
function validHex(v, fallback) {return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;}
function positiveNumber(v, fallback) {return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;}
function restoreDocument(doc) {
  let validated = [];
  if (Array.isArray(doc?.polygons)) {
    const used = new Set();
    for (const candidate of doc.polygons.slice(0, 100)) {
      const id = candidate?.id;
      if (!Number.isSafeInteger(id) || id < 1 || used.has(id)) continue;
      used.add(id);
      const p = makePolygon(id);
      p.points = Array.isArray(candidate.points) ? candidate.points.slice(0, 26).filter(q =>
        q && Number.isFinite(q.x) && Number.isFinite(q.y) && Math.abs(q.x) < 1e12 && Math.abs(q.y) < 1e12
      ).map(q => ({x: q.x, y: q.y})) : [];
      p.visible = candidate.visible !== false;
      p.color = validHex(candidate.color, p.color);
      p.colorB = validHex(candidate.colorB, p.colorB);
      p.gradient = candidate.gradient === true;
      p.angle = clamp(Number(candidate.angle) || 0, 0, 360);
      p.opacity = clamp(Number(candidate.opacity) || 0, 0, 1);
      validated.push(p);
    }
  }
  polygons = validated.length ? validated : [makePolygon(1)];
  activeId = polygons.some(p => p.id === doc?.activeId) ? doc.activeId : polygons[0].id;
  nextId = Math.max(...polygons.map(p => p.id)) + 1;
  const v = doc?.view || {};
  view.zoom = clamp(positiveNumber(v.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  view.panX = Number.isFinite(v.panX) ? clamp(v.panX, -1e9, 1e9) : 0;
  view.panY = Number.isFinite(v.panY) ? clamp(v.panY, -1e9, 1e9) : 0;
  coordinateMode = doc?.coordinateMode === "percent" ? "percent" : "svg";
  document.querySelector(`input[name="coordinate-mode"][value="${coordinateMode}"]`).checked = true;
  panLock.checked = doc?.panLocked === true;
  lastCustomRatio = doc?.lastCustomRatio && positiveNumber(doc.lastCustomRatio.x, 0) && positiveNumber(doc.lastCustomRatio.y, 0)
    ? {x: doc.lastCustomRatio.x, y: doc.lastCustomRatio.y} : null;
  $("#ratio-applied").disabled = !lastCustomRatio;
  const ratio = doc?.ratio;
  setWorkspaceRatio(positiveNumber(ratio?.x, imagePreview.naturalWidth),
    positiveNumber(ratio?.y, imagePreview.naturalHeight), false);
}
async function loadImage(blob, name, restoredDocument = null) {
  if (!blob || !blob.type.startsWith("image/")) throw new Error("Not a supported image file.");
  window.clearTimeout(saveTimer);
  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = URL.createObjectURL(blob);
  // Only retain the selected blob after decoding succeeds.
  imagePreview.onload = () => {
    imageBlob = blob; imageName = name || "image";
    imageStage.hidden = false; workspace.classList.add("has-image");
    if (restoredDocument) restoreDocument(restoredDocument);
    else {
      polygons = [makePolygon(1)]; activeId = 1; nextId = 2;
      coordinateMode = "svg";
      $('input[name="coordinate-mode"][value="svg"]').checked = true;
      lastCustomRatio = null; $("#ratio-applied").disabled = true;
      setWorkspaceRatio(imagePreview.naturalWidth, imagePreview.naturalHeight, false);
    }
    imageStage.style.width = `${workspace.clientWidth}px`;
    overlay.setAttribute("viewBox", `0 0 ${imagePreview.naturalWidth} ${imagePreview.naturalHeight}`);
    history = []; addPointArmed = false;
    fitImageButton.disabled = false;
    for (const button of [addPolygonButton, projectSaveButton, saveViewButton]) button.disabled = false;
    imageDetails.textContent = `${imageName} — ${imagePreview.naturalWidth} × ${imagePreview.naturalHeight} pixels`;
    if (restoredDocument) applyView(); else fitImage();
    render(); scheduleSave();
  };
  imagePreview.onerror = () => {
    imageBlob = null; imageStage.hidden = true; workspace.classList.remove("has-image");
    imageDetails.textContent = "Unable to display this image.";
    setSaveStatus("Image decoding failed.");
  };
  imagePreview.src = imageURL;
}
imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  try {await loadImage(file, file.name);}
  catch (error) {imageDetails.textContent = error.message;}
  imageInput.value = "";
});
async function restoreAutosave() {
  const db = await databaseReady;
  if (!db) {setSaveStatus("Browser autosave unavailable. Save JSON project backups."); return;}
  try {
    const request = db.transaction("projects", "readonly").objectStore("projects").get("autosave");
    request.onsuccess = () => {
      if (request.result?.blob && !imageBlob && !imagePreview.src) {
        loadImage(request.result.blob, request.result.name, request.result.doc)
          .then(() => setSaveStatus("Restored last browser project."))
          .catch(() => setSaveStatus("Saved project could not be restored."));
      } else if (!imageBlob) setSaveStatus("Projects autosave here after an image is selected.");
    };
    request.onerror = () => setSaveStatus("Unable to read stored project.");
  } catch (error) {setSaveStatus("Browser project storage is not accessible."); console.error(error);}
}
async function blobDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
projectSaveButton.addEventListener("click", async () => {
  if (!imageBlob) return;
  try {
    const dataURL = await blobDataURL(imageBlob);
    const project = {format: "youngdev-image-mapper", version: 1,
      image: {name: imageName, dataURL}, document: documentState()};
    downloadBlob(new Blob([JSON.stringify(project)], {type: "application/json"}), `${fileStem(imageName)}-mapper.json`);
    setSaveStatus("Portable project downloaded, including the original image.");
  } catch (error) {setSaveStatus("Unable to create project backup."); console.error(error);}
});
$("#load-project").addEventListener("click", () => $("#project-file").click());
$("#project-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const project = JSON.parse(await file.text());
    if (project.format !== "youngdev-image-mapper" || project.version !== 1 ||
        typeof project.image?.dataURL !== "string" || !project.image.dataURL.startsWith("data:image/")) {
      throw new Error("Not a valid Image Mapper project JSON file.");
    }
    const response = await fetch(project.image.dataURL);
    const blob = await response.blob();
    await loadImage(blob, project.image.name || "restored-image", project.document);
    setSaveStatus("Project loaded.");
  } catch (error) {setSaveStatus(`Project import failed: ${error.message}`);}
  event.target.value = "";
});
panLock.addEventListener("change", scheduleSave);
window.addEventListener("resize", () => {draw();});
window.addEventListener("pagehide", () => {if (saveTimer !== null) {window.clearTimeout(saveTimer); saveNow();}});
window.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" &&
      !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    event.preventDefault(); if (!undoButton.disabled) undoButton.click();
  }
});
render();
restoreAutosave();
