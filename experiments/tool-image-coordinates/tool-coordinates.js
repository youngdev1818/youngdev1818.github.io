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

imagePreview.addEventListener("pointerdown", (event) => {

  // Only collect four points
  if (points.length >= 4) return;

  // Find the image's possition and display size
  const rect = imagePreview.getBoundingClientRect();

  // Find the touch possition relative to the image
  const displayX = event.clientX - rect.left;
  const displayY = event.clientY - rect.top;

  // Convert to original image coordinates
  const x = Math.round(displayX * (imagePreview.naturalWidth / rect.width));
  const y = Math.round(displayY * (imagePreview.naturalHeight / rect.height));

  // Save the new coordinate
  points.push({x,y});

  // Redraw the overlay
  drawPoints();
});

function drawPoints() {
  markerLayer.replaceChildren();
  pointList.replaceChildren();

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
    const item = document.createElement("li");
    const label = document.createElement("strong");
    
    label.textContent = `${letters[index]}:`;
    item.append(label, ` X ${point.x}, Y ${point.y}`);

    pointList.append(item);
  });

  // Show polygon only when all four corners exist
  const coordinates = points.map(point => `${point.x},${point.y}`).join(" ");

  polygon.setAttribute("points", points.length === 4 ? coordinates : "");

  undoButton.disabled = points.length === 0;
  clearButton.disabled = points.length === 0;

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

// Keep marker sizes readable after screen rotation
window.addEventListener("resize", drawPoints);
