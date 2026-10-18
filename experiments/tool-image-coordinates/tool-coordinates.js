const imageInput = document.querySelector("#image-file");
const imagePreview = document.querySelector("#image-preview");
const imageStage = document.querySelector("#image-stage");
const imageDetails = document.querySelector("#image-details")

const overlay = document.querySelector("#point-overlay");
const polygon = document.querySelector("#selected-polygon");
const markerLayer = document.querySelector("#point-markers");
const pointList = document.querySelector("#point-list");
const coordinateResult = document.querySelector("#coordinate-result");

const undoButton = document.querySelector("#undo-point");
const clearButton = document.querySelector("#clear-points");
const copyButton = document.querySelector("#copy-svg");

const points = [];
const letters = ["A", "B", "C", "D"];

const svgNS = "http://www.w3.org/2000/svg";

let imageURL = null;

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

    // Limit width by container, original size, and 70vh height
    const widthFromHeight = 70 * imagePreview.naturalWidth / imagePreview.naturalHeight;

    imageStage.computedStyleMap.width = `min(100%, ${imagePreview.naturalWidth}px, ${widthFromHeight}vh`;

    // Match SVG coordinates to original image resolution
    overlay.setAttribute("viewBox",
      `0 0 ${imagePreview.naturalWidth} ${imagePreview.naturalHeight}`);

    // New image means a new set of points
    points.length = 0;
    drawPoints();

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

  return {
    x: Math.max(0, Math.min(imagePreview.naturalWidth, x)),
    y: Math.max(0, Math.min(imagePreview.naturalHeight, y))
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

imagePreview.addEventListener("pointerdown", (event) => {

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

    imagePreview.setPointerCapture(event.pointerId);
    imagePreview.style.cursor = "grabbing";

    return;
  }

  // Otherwise, add new point if space remains
  if (points.length >= 4) return;

  const newPoint = getImageCoordinates(event);

  points.push(newPoint);
  drawPoints();
});

imagePreview.addEventListener("pointermove", (event) => {

  // Change the cursor when hovering over a marker
  if (activePointerId === null) {
    imagePreview.style.cursor = findMarker(event) !== -1 ? "grab" : "crosshair";

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
  if (imagePreview.hasPointerCapture(event.pointerId)) {
    imagePreview.releasePointerCapture(event.pointerId);
  }

  imagePreview.style.cursor = "crosshair";

  drawPoints(false);
}

imagePreview.addEventListener("pointerup", endDrag);
imagePreview.addEventListener("pointercancel", endDrag);
imagePreview.addEventListener("lostpointercapture", endDrag);

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
        const limit = axis === "x"
          ? imagePreview.naturalWidth : imagePreview.naturalHeight;
        const extension = limit * 0.5;
        input.type = "number";
        input.min = String(-Math.round(extension));
        input.max = String(Math.round(limit + extension));
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
