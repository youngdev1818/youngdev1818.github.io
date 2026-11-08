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

// The most recent accepted color.
let currentColor = [0, 0, 0];

// Convert and synchronize HEX, RGB, and swatch values.
function setColor(r, g, b) {
    currentColor = [r, g, b];

    const hex = "#" + [r, g, b]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    hexValue.value = hex;
    rgbValue.value = `${r}, ${g}, ${b}`;

    swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    
    copyHexButton.disabled = false;
    copyRgbButton.disabled = false;
}

function UpdateColorReadout(x,y) {
    const pixel = ctx.getImageData(x, y, 1, 1).data;

    setColor(pixel[0], pixel[1], pixel[2]);
}

// Accept manually entered HEX values.
hexValue.addEventListener("change", () => {
    const hex = hexValue.value.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        setColor(r, g, b);
    } else {
        // Restore last valid color.
        setColor(...currentColor);
    }
});

// Accept manually entered RGB values.
rgbValue.addEventListener("change", () => {
    const parts = rgbValue.value
    .split(",")
    .map(value => value.trim());

    const valid = parts.length === 3 && parts.every(value =>
        /^\d{1,3}$/.test(value) && Number(value) <= 255
    );

    if (valid) {
        const [r, g, b] = parts.map(Number);
        setColor(r, g, b);
    } else {
        // Restore last valid color.
        setColor(...currentColor);
    }
});

// Initialize the editor without requiring an image.
setColor(0, 0, 0);

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
    const dx = center + (sx - x - 0.5) * ZOOM;
    const dy = center + (sy - y - 0.5) * ZOOM;

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
            await navigator.clipboard.writeText(valueElement.value);
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
