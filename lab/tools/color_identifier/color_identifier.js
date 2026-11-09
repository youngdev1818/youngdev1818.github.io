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

// Results swatch transparency and backdrop.
let swatchAlpha = 1;
let stripeAngle = 0;

// Render the current color over the striped background.
function updateSwatch() {
    const [r, g, b] = currentColor;
    swatch.style.setProperty("--overlay-color", `rgba(${r}, ${g}, ${b}, ${swatchAlpha})`);
    swatch.style.setProperty("--stripe-angle", `${stripeAngle}deg`);
}

// Update the results swatch opacity.
const alphaSlider = document.getElementById("alphaSlider");
const alphaOutput = document.getElementById("alphaOutput");

alphaSlider.addEventListener("input", () => {
    const percent = Number(alphaSlider.value);
    swatchAlpha = percent / 100;
    alphaOutput.textContent = `${percent}%`;
    updateSwatch();
});

// Rotate the grayscale preview background.
const stripeAngleSlider = document.getElementById("stripeAngleSlider");
const stripeAngleOutput = document.getElementById("stripeAngleOutput");

stripeAngleSlider.addEventListener("input", () => {
    stripeAngle = Number(stripeAngleSlider.value);
    stripeAngleOutput.textContent = `${stripeAngle}°`;
    updateSwatch();
});

// Convert and synchronize HEX, RGB, and swatch values.
function setColor(r, g, b, fromPicker = false) {
    currentColor = [r, g, b];

    const hex = "#" + [r, g, b]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    hexValue.value = hex;
    rgbValue.value = `${r}, ${g}, ${b}`;

    updateSwatch();

    copyHexButton.disabled = false;
    copyRgbButton.disabled = false;

    if (!fromPicker) syncPickerToColor();
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

// HSV popup controls
const pickerToggle = document.getElementById("pickerToggle");
const hsvPanel = document.getElementById("hsvPanel");
const pickerClose = document.getElementById("pickerClose");

const svSquare = document.getElementById("svSquare");
const svCursor = document.getElementById("svCursor");
const hueSlider = document.getElementById("hueSlider");

let hsv = { h: 180, s: 1, v: 1 };

function closePicker() {
    hsvPanel.hidden = true;
    pickerToggle.setAttribute("aria-expanded", "false");
}

function positionPicker() {
    const button = pickerToggle.getBoundingClientRect();
    const panel = hsvPanel.getBoundingClientRect();
    const margin = 8;
    const gap = 12;

    const left = Math.max(margin, Math.min(
        button.left,
        window.innerWidth - panel.width - margin
    ));
    let top = button.top - panel.height - gap;

    // Open below if there isnt enough room above.
    if (top < margin) {
        top = button.bottom + gap;
    }

    hsvPanel.style.left = `${left}px`;
    hsvPanel.style.top = `${top}px`;
}

pickerToggle.addEventListener("click", () => {
    if (!hsvPanel.hidden) {
        closePicker();
        return;
    }

    hsvPanel.hidden = false;
    pickerToggle.setAttribute("aria-expanded", "true");

    syncPickerToColor();
    positionPicker();
});

pickerClose.addEventListener("click", closePicker);

// Close when clicking outside the picker.
document.addEventListener("pointerdown", (event) => {
    if (!hsvPanel.hidden &&
        !hsvPanel.contains(event.target) &&
        !pickerToggle.contains(event.target) &&
        !canvas.contains(event.target) &&
        !hexValue.contains(event.target) &&
        !rgbValue.contains(event.target)
    ) {
        closePicker();
    }
});

// Close with escape.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePicker();
});

// keep HSV panel positioned after viewport changes.
window.addEventListener("resize", () => {
    if (!hsvPanel.hidden) positionPicker();
});

// ======= HSV COLOR ENGINE =======

// Convert RGB to HSV.
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;

    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }
        
        h = (h * 60 + 360) % 360;
    }

    return {
        h: h,
        s: max === 0 ? 0 : delta / max,
        v: max
    };
}

// Convert HSV back to RGB.
function hsvToRgb(h, s, v) {
    const c = v * s;
    const sector = (h % 360) / 60;
    const x = c * (1 - Math.abs(sector % 2 - 1));
    const m = v - c;
    let rgb;

    if (sector < 1) rgb = [c, x, 0];
    else if (sector < 2) rgb = [x, c, 0];
    else if (sector < 3) rgb = [0, c, x];
    else if (sector < 4) rgb = [0, x, c];
    else if (sector < 5) rgb = [x, 0, c];
    else rgb = [c, 0, x];

    return rgb.map(n => Math.round((n + m) * 255));
}

// Update the square's colors and cursor.
function updatePickerVisual() {
    svSquare.style.background = `
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent),
    hsl(${hsv.h}, 100%, 50%)`;

    svCursor.style.left = `${hsv.s * 100}%`;
    svCursor.style.top = `${(1 - hsv.v) * 100}%`;

    hueSlider.value = Math.round(hsv.h);
}

// Read the current RGB color when opening the picker.
function syncPickerToColor() {
    const converted = rgbToHsv(...currentColor);

    // Gray and black have no unique hue.
    // Preserve our last selected hue in those cases.
    if (converted.s === 0) {
        converted.h = hsv.h;
    }

    hsv = converted;
    updatePickerVisual();
}

// Apply the current HSV color to HEX, RGB and swatch.
function applyHsvColor() {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

    setColor(...rgb, true);
    updatePickerVisual();
}

// Read a point within the gradient square.
function sampleSquare(event) {
    const rect = svSquare.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    hsv.s = Math.max(0, Math.min(1, x));
    hsv.v = 1 - Math.max(0, Math.min(1, y));

    applyHsvColor();
}

// Dragging inside the gradient square.
let squarePointer = null;

svSquare.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    if (squarePointer !== null) return;

    squarePointer = event.pointerId;
    svSquare.setPointerCapture(event.pointerId);
    sampleSquare(event);
});

svSquare.addEventListener("pointermove", event => {
    if (event.pointerId === squarePointer) {
        sampleSquare(event);
    }
});

function stopSquareDrag(event) {
    if (event.pointerId === squarePointer) {
        squarePointer = null;
    }
}

svSquare.addEventListener("pointerup", stopSquareDrag);
svSquare.addEventListener("pointercancel", stopSquareDrag);

// Change hue using the rainbow slider.
hueSlider.addEventListener("input", () => {
    hsv.h = Number(hueSlider.value);

    // Make the slider immediately useful when
    // starting from black, white, or gray.
    if (hsv.s === 0) hsv.s = 1;
    if (hsv.v === 0) hsv.v = 1;

    applyHsvColor();
});

// =====================

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

// Initialize the editor without requiring an image.
setColor(0, 0, 0);