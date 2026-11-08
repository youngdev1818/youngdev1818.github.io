const input = document.getElementById("imageInput");
const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const loupe = document.getElementById("loupe");
const loupeCanvas = document.getElementById("loupeCanvas");
const loupeCtx = loupeCanvas.getContext("2d");

let isSampling = false;

const placeholder = document.getElementById("placeholder");
const swatch = document.getElementById("swatch");
const hexValue = document.getElementById("hexValue");
const rgbValue = document.getElementById("rgbValue");
const copyHexButton = document.getElementById("copyHexButton");
const copyRgbButton = document.getElementById("copyRgbButton");

// Load the selected image onto the canvas.
input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
        // Limit large photos to protect mobile performance.
        const scale = Math.min(1, 1800 / Math.max(image.width, image.height));

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.hidden = false;
        placeholder.hidden = true;
        URL.revokeObjectURL(url);
    };

    image.src = url;
});

const LOUPE_SIZE = 120;
const ZOOM = 10;

function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();

    const x = Math.min(canvas.width - 1, Math.max(0,
        Math.floor((event.clientX - rect.left) * canvas.width / rect.width)
    ));

    const y = Math.min(canvas.height - 1, Math.max(0,
        Math.floor((event.clientY - rect.top) * canvas.height / rect.height)
    ));

    return { x, y, rect };
}

function UpdateColorReadout(x,y) {
    const pixel = ctx.getImageData(x, y, 1, 1).data;

    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];

    const hex = "#" + [r, g, b]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    hexValue.textContent = hex;
    rgbValue.textContent = `${r}, ${g}, ${b}`;

    copyHexButton.disabled = false;
    copyRgbButton.disabled = false;
}

function updateLoupe(x, y, event, rect) {
    const center = LOUPE_SIZE / 2;
    const radius = Math.ceil(center / ZOOM);

    // Visible source pixels, clipped to the image bounds.
    const sx = Math.max(0, x - radius);
    const sy = Math.max(0, y - radius);

    const ex = Math.min(canvas.width, x + radius + 1);
    const ey = Math.min(canvas.height, y + radius + 1);

    const sw = ex - sx;
    const sh = ey - sy;

    // Position the selected pixel exactly at the center.
    const dx = center + (x - sx - 0.5) * ZOOM;
    const dy = center + (y - sy - 0.5) * ZOOM;

    // Dark background represents space outside the image.
    loupeCtx.fillStyle = "#0b1923";
    loupeCtx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);

    // Draw enlarged pixels without smoothing.
    loupeCtx.imageSmoothingEnabled = false;

    loupeCtx.drawImage(
        canvas,
        sx, sy, sw, sh,
        dx, dy, sw * ZOOM, sh * ZOOM
    );

    // Draw a subtle grid around individual pixels.
    loupeCtx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    loupeCtx.lineWidth = 1;
    loupeCtx.beginPath();

    const firstLine = (center - ZOOM / 2) % ZOOM;

    for (let p = firstLine; p < LOUPE_SIZE; p += ZOOM) {
        loupeCtx.moveTo(p + 0.5, 0);
        loupeCtx.lineTo(p + 0.5, LOUPE_SIZE);
        loupeCtx.moveTo(0, p + 0.5);
        loupeCtx.lineTo(LOUPE_SIZE, p + 0.5);
    }

    loupeCtx.stroke();

    // Position the loupe near the pointer.
    const gap = 20;
    const margin = 8;
    
    let left = event.clientX + gap;
    let top = event.clientY - LOUPE_SIZE - gap;

    // Flip left when near the right screen edge.
    if (left + LOUPE_SIZE > window.innerWidth - margin) {
        left = event.clientX - LOUPE_SIZE - gap;
    }

    // Flip below when near the top screen edge.
    if (top < margin) {
        top = event.clientY + gap;
    }

    // Keep the loupe within the viewport.
    left = Math.max(margin, Math.min(
        left, window.innerWidth - LOUPE_SIZE - margin
    ));

    top = Math.max(margin, Math.min(
        top, window.innerHeight - LOUPE_SIZE - margin
    ));

    loupe.style.left = `${left}px`;
    loupe.style.top = `${top}px`;
    loupe.hidden = false;
}

function sampleAtEvent(event) {
    const { x, y } = getCanvasCoordinates(event);

    UpdateColorReadout(x, y);
    updateLoupe(x, y, event);
}


// Start sampling on press.
canvas.addEventListener("pointerdown", (event) => {
    if (canvas.hidden) return;

    isSampling = true;
    canvas.setPointerCapture(event.pointerId);
    sampleAtEvent(event);
});

// Continue sampling while dragging.
canvas.addEventListener("pointermove", (event) => {
    if (!isSampling) return;
    sampleAtEvent(event);
});

// Stop sampling on release.
canvas.addEventListener("pointerup", (event) => {
    isSampling = false;
    loupe.hidden = true;
    canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", (event) => {
    isSampling = false;
    loupe.hidden = true;
    canvas.releasePointerCapture(event.pointerId);
});

// Reusable clipboard function
function setupCopyButton(button, valueElement, defaultLabel) {
    let resetTimer;

    button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(valueElement.textContent);
            button.textContent = "Copied!";
        } catch {
            button.textContent = "Copy failed";
        }

        // Cancel an old timer if the button is clicked again.
        clearTimeout(resetTimer);

        // Restore the original button text after time(ms).
        resetTimer = setTimeout(() => {
            button.textContent = defaultLabel;
        }, 1000);
    });
}

// Initialize both buttons.
setupCopyButton(copyHexButton, hexValue, "Copy HEX");
setupCopyButton(copyRgbButton, rgbValue, "Copy RGB");
