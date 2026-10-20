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
