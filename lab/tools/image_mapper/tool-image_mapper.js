const imageInput = document.querySelector("#image-file");
const imagePreview = document.querySelector("#image-preview");
const imageStage = document.querySelector("#image-stage");
const imageDetails = document.querySelector("#image-details");

const imageRatioButton = document.querySelector("#ratio-image");
const squareButton = document.querySelector("#ratio-square");
const ratioXInput = document.querySelector("#ratio-x");
const ratioYInput = document.querySelector("#ratio-y");
const applyRatioButton = document.querySelector("#ratio-apply");
const appliedRatioButton = document.querySelector("#ratio-applied");

const fitImageButton = document.querySelector("#fit-image");
const zoomReadout = document.querySelector("#zoom-readout");
const view = {zoom: 1, panX: 0, panY: 0};
const MIN_ZOOM = 0.00000001;
const MAX_ZOOM = 64;
const fitPolygonButton = document.querySelector("#fit-polygon");
const panLock = document.querySelector("#lock-pan");

const workspace = document.querySelector("#workspace-viewport");

const overlay = document.querySelector("#point-overlay");
const polygon = document.querySelector("#selected-polygon");
const markerLayer = document.querySelector("#point-markers");
const pointList = document.querySelector("#point-list");
const coordinateResult = document.querySelector("#coordinate-result");
const POINT_LIMIT_MULTIPLIER = 1_000_000;

const undoButton = document.querySelector("#undo-point");
const clearButton = document.querySelector("#clear-points");
const copyButton = document.querySelector("#copy-svg");

const points = [];
const letters = ["A", "B", "C", "D"];

const svgNS = "http://www.w3.org/2000/svg";

let imageURL = null;
let lastCustomRatio = null;

function setWorkspaceRatio(x,y) {
  const ratio = x / y;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    coordinateResult.textContent = "Please enter a valid positive X:Y ratio";
    return;
  }

  // Change the workspace shape
  workspace.style.aspectRatio = `${x} / ${y}`;

  workspace.style.width = `min(90%, ${70 * ratio}svh)`;

  ratioXInput.value = x;
  ratioYInput.value = y;
}

imageRatioButton.addEventListener("click", () => {
  if (!imagePreview.naturalWidth) return;

  setWorkspaceRatio(imagePreview.naturalWidth, imagePreview.naturalHeight);
});

squareButton.addEventListener("click", () => {
  setWorkspaceRatio(1,1);
});

applyRatioButton.addEventListener("click", () => {
  const x = Number(ratioXInput.value);
  const y = Number(ratioYInput.value);

  if (
    !Number.isFinite(x) || !Number.isFinite(y) ||
    x <= 0 || y <= 0 || !Number.isFinite(x / y)
  ) {
    coordinateResult.textContent = "please enter a valid ratio";
    return;
    }

  lastCustomRatio = {x,y};

  appliedRatioButton.disabled = false;
  
  setWorkspaceRatio(x,y);
});

appliedRatioButton.addEventListener("click", () => {
  if (!lastCustomRatio) return;

  setWorkspaceRatio(lastCustomRatio.x, lastCustomRatio.y);
});

function applyView() {
  imageStage.style.transform =
    `translate(-50%, -50%) ` +
    `translate(${view.panX}px, ${view.panY}px) ` +
    `scale(${view.zoom})`;

  // Display current zoom percentage
  const percent = view.zoom * 100;

  zoomReadout.textContent = percent < 0.01
    ? `${percent.toExponential(2)}% ` : percent < 10
      ? `${percent.toFixed(1)}% ` : `${Math.round(percent)}%`;

  // Redraw markers without rebuilding coordinate fields
  drawPoints(false);
}

function fitImage() {
  if (!imagePreview.naturalWidth) return;

  const availableWidth = workspace.clientWidth;
  const availableHeight = workspace.clientHeight;

  const imageWidth = imageStage.offsetWidth;
  const imageHeight = imageStage.offsetHeight;

  if (!imageWidth || !imageHeight) return;

  // Fit the entire image inside the viewport
  view.zoom = Math.min(
    availableWidth / imageWidth,
    availableHeight / imageHeight
  );

  // Return to image center
  view.panX = 0;
  view.panY = 0;

  applyView();
}

fitImageButton.addEventListener("click", fitImage);

function fitPolygon() {
  if (points.length !== 4) return;

  // Find polygon boundaries
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Find the polygon center
  const centerX = (minX +maxX) / 2;
  const centerY = (minY + maxY) /2;

  // Original image dimensions
  const originalWidth = imagePreview.naturalWidth;
  const originalHeight = imagePreview.naturalHeight;

  // image stage dimensions before zoom
  const stageWidth = imageStage.offsetWidth;
  const stageHeight = imageStage.offsetHeight;

  if (!stageWidth || !stageHeight) return;

  // Convert polygon dimensions into stage CSS pixels
  const polygonWidth = (maxX - minX) * stageWidth / originalWidth;
  const polygonHeight = (maxY - minY) * stageHeight / originalHeight;

  // Leave 32px of breathing room on every side
  const availableWidth = Math.max(1, workspace.clientWidth - 64);
  const availableHeight = Math.max(1, workspace.clientHeight - 64);

  // Calculate the zoom necessary to fit
  const targetZoom = Math.min(
    availableWidth / Math.max(1, polygonWidth),
    availableHeight / Math.max(1, polygonHeight)
  );

  view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));

  // Center the polygon instead of the image
  const offsetX = (centerX / originalWidth - 0.5) * stageWidth;
  const offsetY = (centerY / originalHeight - 0.5) * stageHeight;

  view.panX = -offsetX * view.zoom;
  view.panY = -offsetY * view.zoom;

  applyView();
}

fitPolygonButton.addEventListener("click", fitPolygon);

workspace.addEventListener("wheel", (event) => {
  if (!imagePreview.naturalWidth) return;

  // Prevent the wheel from scrolling the page
  event.preventDefault();

  // Normalize different wheel delta units
  const delta = event.deltaY *
    (event.deltaMode === 1 ? 16 :
    event.deltaMode === 2 ? workspace.clientHeight : 1)

  // Exponential scaling feels smooth
  const factor = Math.exp(-delta * 0.001);
  const oldZoom = view.zoom;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));

  if (newZoom === oldZoom) return;

  // Cursor position relative to viewport center
  const rect = workspace.getBoundingClientRect();
  const anchorX = event.clientX - (rect.left + rect.width / 2);
  const anchorY = event.clientY - (rect.top + rect.height / 2);
  const change = newZoom / oldZoom;

  // Preserve the point underneath the cursor
  view.panX = anchorX - (anchorX - view.panX) * change;
  view.panY = anchorY - (anchorY - view.panY) * change;
  view.zoom = newZoom

  applyView();
  
}, {passive: false});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    imageDetails.textContent = "Please select an image.";
    return;
  }

  // Releases the previous temporary URL
  if (imageURL) {URL.revokeObjectURL(imageURL)}

  // Creates a temporary browser URL
  imageURL = URL.createObjectURL(file);

  // Wait until the image loads
  imagePreview.onload = () => {
    imageStage.hidden = false;

    // Establish the workspace's natural image ratio
    workspace.classList.add("has-image");

    setWorkspaceRatio(imagePreview.naturalWidth, imagePreview.naturalHeight);

    // Capture the image's inital fitted display width
    imageStage.style.width = `${workspace.clientWidth}px`;

    // Match SVG coordinates to original image resolution
    overlay.setAttribute("viewBox",
      `0 0 ${imagePreview.naturalWidth} ${imagePreview.naturalHeight}`);

    // New image means a new set of points
    points.length = 0;

    // Establish the initial fitted view
    fitImage();

    // Rebuild the coordinate list
    drawPoints();

    fitImageButton.disabled = false;

    imageDetails.textContent = 
      `${file.name} — ` +
      `${imagePreview.naturalWidth} x ` +
      `${imagePreview.naturalHeight} pixels`;
  };

  imagePreview.onerror = () => {
    imageStage.hidden = true;
    imageDetails.textContent = "Unable to display this image.";
  };

  // Load the image
  imagePreview.src = imageURL;
});

function getImageCoordinates(event) {
  const rect = imagePreview.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) * imagePreview.naturalWidth / rect.width)
  const y = Math.round((event.clientY - rect.top) * imagePreview.naturalHeight / rect.height);

  const xLimit = imagePreview.naturalWidth * POINT_LIMIT_MULTIPLIER;
  const yLimit = imagePreview.naturalHeight * POINT_LIMIT_MULTIPLIER;

  return {
    x: Math.max(-xLimit, Math.min(xLimit, x)),
    y: Math.max(-yLimit, Math.min(yLimit, y))
  };
}

function findMarker(event) {
  const rect = imagePreview.getBoundingClientRect();

  let closestIndex = -1;
  let smallestDistance = 24 * 24;

  points.forEach((point, index) => {

    // Convert the marker's original coordinates
    // into its displayed screen position
    const markerX = rect.left + point.x / imagePreview.naturalWidth * rect.width;
    const markerY = rect.top + point.y / imagePreview.naturalHeight * rect.height;
    const dx = event.clientX - markerX;
    const dy = event.clientY - markerY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared < smallestDistance) {
      smallestDistance = distanceSquared;
      closestIndex = index;
    }
  });

  return closestIndex;
}

let activePointerId = null;
let draggedPoint = -1;

workspace.addEventListener("pointerdown", (event) => {

  if (event.pointerType === "touch") return;
  if (!imagePreview.naturalWidth) return;

  // Only respond to primary mouse button
  if (event.pointerType === "mouse" && event.button !==0) {
    return;
  }

  // Ignore additional fingers while dragging
  if (activePointerId !== null) return;

  // Check whether we touched an existing marker
  const markerIndex = findMarker(event);

  if (markerIndex !== -1) {
    draggedPoint = markerIndex;
    activePointerId = event.pointerId;

    workspace.setPointerCapture(event.pointerId);
    workspace.style.cursor = "grabbing";

    return;
  }

  // Otherwise, add new point if space remains
  if (points.length >= 4) return;

  const newPoint = getImageCoordinates(event);

  points.push(newPoint);
  drawPoints();
});

workspace.addEventListener("pointermove", (event) => {

  if (event.pointerType === "touch") return;

  // Change the cursor when hovering over a marker
  if (activePointerId === null) {
    workspace.style.cursor = findMarker(event) !== -1 ? "grab" : "crosshair";

    return;
  }

  // Only the active pointer can drag the point
  if (event.pointerId !== activePointerId) return;

  const newPosition = getImageCoordinates(event);

  points[draggedPoint].x = newPosition.x;
  points[draggedPoint].y = newPosition.y;

  // Redraw without destroying the coordinate inputs
  drawPoints(false);

  // Update the existing editable coordinate fields
  const row = pointList.children[draggedPoint];

  if (row) {
    const inputs = row.querySelectorAll("input");

    if (inputs.length === 2) {
      inputs[0].value = newPosition.x;
      inputs[1].value = newPosition.y;
    }
  }

  coordinateResult.textContent =
    `Dragging ${letters[draggedPoint]}: ` +
    `X ${newPosition.x}, Y ${newPosition.y}`;
});

function endDrag(event) {

  if (event.pointerId !== activePointerId) return;

  activePointerId = null;
  draggedPoint = -1;

  // Release pointer capture if still active
  if (workspace.hasPointerCapture(event.pointerId)) {
    workspace.releasePointerCapture(event.pointerId);
  }

  workspace.style.cursor = "crosshair";

  drawPoints(false);
}

workspace.addEventListener("pointerup", endDrag);
workspace.addEventListener("pointercancel", endDrag);
workspace.addEventListener("lostpointercapture", endDrag);

function drawPoints(rebuildList = true) {
  markerLayer.replaceChildren();
  if (rebuildList) {pointList.replaceChildren();}

  // Keep marker labels readable at different screen sizes
  const displayWidth = imagePreview.getBoundingClientRect().width;
  const scale = displayWidth ? imagePreview.naturalWidth / displayWidth : 1;

  points.forEach((point, index) => {

    // Create SVG circle
    const circle = document.createElementNS(svgNS, "circle");

    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 7 * scale);

    // Create SVG letter
    const letter = document.createElementNS(svgNS, "text");

    letter.setAttribute("x", point.x + 11 * scale);
    letter.setAttribute("y", point.y - 11 * scale);
    letter.setAttribute("font-size", 16 * scale);
    letter.textContent = letters[index];

    markerLayer.append(circle, letter);

    // Add point to the HTML list
    if (rebuildList) {
      const item = document.createElement("li");
      const label = document.createElement("strong");
    
      label.textContent = `${letters[index]}:`;
      item.append(label);

      // Create seperate editable X and Y fields
      for (const axis of ["x","y"]) {
        const fieldLabel = document.createElement("label");
        fieldLabel.textContent = axis.toUpperCase() + " ";

        const input = document.createElement("input");
        input.type = "number";
        
        const limit = axis === "x"
          ? imagePreview.naturalWidth : imagePreview.naturalHeight;
        input.min = String(-limit * POINT_LIMIT_MULTIPLIER);
        input.max = String(limit * POINT_LIMIT_MULTIPLIER);
        input.step = "1";
        input.required = true;
        input.value = point[axis];

        input.setAttribute("aria-label",
          `${letters[index]} ${axis.toUpperCase()} coordinate`);
        input.addEventListener("input", () => {
          if (!input.validity.valid) return;

          points[index][axis] = Number(input.value);

          // Redraw SVG without replacing the inputs
          drawPoints(false);
        });

        // Restore the last valid value if editing ends invalid
        input.addEventListener("blur", () => {
          if (!input.validity.valid) {
            input.value = points[index][axis];
          }
        });

        fieldLabel.append(input);
        item.append(" ", fieldLabel);
      }

      pointList.append(item);
    }
  });

  // Show polygon only when all four corners exist
  const coordinates = points.map(point => `${point.x},${point.y}`).join(" ");

  polygon.setAttribute("points", points.length === 4 ? coordinates : "");

  undoButton.disabled = points.length === 0;
  clearButton.disabled = points.length === 0;
  copyButton.disabled = points.length !== 4;
  fitPolygonButton.disabled = points.length !== 4;

  coordinateResult.textContent = points.length === 4
    ? "4/4 points — Polygon complete!" : `${points.length}/4 points selected`;
}

undoButton.addEventListener("click", () => {
  points.pop();
  drawPoints();
});

clearButton.addEventListener("click", () => {
  points.length = 0;
  drawPoints();
});

copyButton.addEventListener("click", async () => {
  if (points.length !== 4) return;

  // Converts points into SVG coordinate format
  const coordinates = points.map(point => `${point.x},${point.y}`).join(" ");

  // Build the SVG attribute
  const svgCode = `points="${coordinates}"`;

  // Copy to the device clipboard
  try{
    await navigator.clipboard.writeText(svgCode);

    coordinateResult.textContent = "SVG points coppied to clipboard!";
  } catch (error) {
    coordinateResult.textContent = "Copy failed. Clipboard permission may be blocked.";

    console.error(error);
  }
});

// Keep marker sizes readable after screen rotation
window.addEventListener("resize", () => {
  drawPoints(false);
});

// Track active fingers by their pointer IDs
const touchPointers = new Map();

let touchMode = "none";
let touchMarker = -1;
let touchStart = null;
let previousPinch = null;

function getPinchInfo() {
  const [a, b] = [...touchPointers.values()];

  return{
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot(b.x - a.x, b.y - a.y)
  };
}

workspace.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  if (!imagePreview.naturalWidth) return;

  // This version tracks a maximum of two fingers
  if (touchPointers.size >=2)  return;

  touchPointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  });

  workspace.setPointerCapture(event.pointerId);

  // Two fingers: switch to pinch navigation
  if (touchPointers.size === 2) {
    touchMode = "pinch";
    previousPinch = getPinchInfo();
    touchMarker = -1;
    touchStart = null;
    return;
  }

  // If finishing a pinch, ignore the remaining finger
  if (touchMode === "pinch") return;

  // One finger: prepare a tap or marker drag
  touchMarker = findMarker(event);

  touchStart = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    
    lastX: event.clientX,
    lastY: event.clientY
  };

  touchMode = touchMarker === - 1 ? "tap" : "drag";
});

workspace.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "touch") return;
  if (!touchPointers.has(event.pointerId)) return;

  // Update this finger's position
  touchPointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  });

  // Handle a two-finger pinch
  if (touchMode === "pinch") {
    if (touchPointers.size < 2 || !previousPinch) return;

    const current = getPinchInfo();
    const oldZoom = view.zoom;
    const factor = current.distance / Math.max(1, previousPinch.distance);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    const change = newZoom / oldZoom;

    // Find the viewport's center
    const rect = workspace.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Previous and current finger midpoints
    const oldX = previousPinch.x - centerX;
    const oldY = previousPinch.y - centerY;
    const newX = current.x - centerX;
    const newY = current.y - centerY;

    // Preserve the anchored image position
    view.panX = newX - (oldX - view.panX) * change;
    view.panY = newY - (oldY - view.panY) * change;
    view.zoom = newZoom;
    previousPinch = current;

    applyView();
    return;
  }

  // Handle a single-finger vertex drag
  if (touchMode === "drag" && touchMarker !== -1) {
    const position = getImageCoordinates(event);

    points[touchMarker].x = position.x;
    points[touchMarker].y = position.y;

    drawPoints(false);

    // Synchronize editable X/Y fields
    const row = pointList.children[touchMarker];

    if (row) {
      const inputs = row.querySelectorAll("input");

      if (inputs.length === 2) {
        inputs[0].value = position.x;
        inputs[1].value = position.y;
      }
    }

    return;
  }

  // Ignore a swipe that began on empty workspace
  if (touchMode === "tap" || touchMode === "pan" && touchStart) {

    // Movement since the previous event
    const dx = event.clientX - touchStart.lastX;
    const dy = event.clientY - touchStart.lastY;
    
    // Total movement since the gesture began
    const distance = Math.hypot(
      event.clientX - touchStart.x,
      event.clientY - touchStart.y
    );

    // Decide whether the gesture becomes a pan
    if (touchMode === "tap" && distance >  8) {
      touchMode = panLock.checked ? "ignore" : "pan";
    }

    // Pan only when unlocked
    if (touchMode === "pan") {
      view.panX += dx;
      view.panY += dy;

      applyView();
    }

    // Remember this finger's latest position
    touchStart.lastX = event.clientX;
    touchStart.lastY = event.clientY;
  }
});

function finishTouch(event) {
  if (!touchPointers.has(event.pointerId)) return;

  // A completed single-finger tap creates a point
  if (
    event.type === "pointerup"  &&
    touchMode === "tap" &&
    touchPointers.size === 1 &&
    touchStart?.id === event.pointerId &&
    points.length < 4
  ) {
    points.push(getImageCoordinates(event));
    drawPoints();
  }

  // Remove the released finger
  touchPointers.delete(event.pointerId);

  if (touchPointers.size < 2) {
    previousPinch = null;
  }

  // Reset only when every tracked finger has lifted
  if (touchPointers.size === 0) {
    touchMode = "none";
    touchMarker = -1;
    touchStart = null;
  }
}

workspace.addEventListener("pointerup", finishTouch);
workspace.addEventListener("pointercancel", finishTouch);
workspace.addEventListener("lostpointercapture", finishTouch);
