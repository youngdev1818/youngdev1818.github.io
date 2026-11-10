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
const hsvValue = document.getElementById("hsvValue");
const hslValue = document.getElementById("hslValue");

const copyHexButton = document.getElementById("copyHexButton");
const copyRgbButton = document.getElementById("copyRgbButton");
const copyHsvButton = document.getElementById("copyHsvButton");
const copyHslButton = document.getElementById("copyHslButton");

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

// ======= Precise alpha and angle controls =======
const alphaSlider = document.getElementById("alphaSlider");
const alphaPercentInput = document.getElementById("alphaPercentInput");

const stripeAngleSlider = document.getElementById("StripeAngleSlider");
const stripeAngleInput = document.getElementById("StripeAngleInput");

// Accept 0.01% increments and limit opacity to 0-100%
function setOpacityPercent(value) {
    const percent = Math.round(Math.max(0, Math.min(100, Number(value))) * 100) / 100;
    
    if (!Number.isFinite(percent)) return;

    swatchAlpha = percent / 100;
    alphaSlider.value = percent;
    alphaPercentInput.value = percent;

    updateSwatch();
    updateColorValues();
}

alphaSlider.addEventListener("input", () => setOpacityPercent(alphaSlider.value));
alphaPercentInput.addEventListener("change", () => {
    if (alphaPercentInput.value.trim() === "") {
        alphaPercentInput.value = swatchAlpha * 100;
        return;
    }
    setOpacityPercent(alphaPercentInput.value);
});

// Rotate the stripe background in 0.1° increments.
function setStripeAngle(value) {
    const angle = Math.round(Math.max(0, Math.min(360, Number(value))) * 10) / 10;

    if (!Number.isFinite(angle)) return;

    stripeAngle = angle;
    stripeAngleSlider.value = angle;
    stripeAngleInput.value = angle;

    updateSwatch();
}

stripeAngleSlider.addEventListener("input", () => setStripeAngle(stripeAngleSlider.value));
stripeAngleInput.addEventListener("change", () => {
    if (stripeAngleInput.value.trim() === "") {
        stripeAngleInput.value = stripeAngle;
        return;
    }
    setStripeAngle(stripeAngleInput.value);
});
// ============================================= 

// Convert and synchronize HEX, RGB, and swatch values.
function setColor(r, g, b, fromPicker = false) {
    currentColor = [r, g, b];

    updateSwatch();

    if (!fromPicker) {
        syncPickerToColor();
    }

    updateColorValues();

    copyHexButton.disabled = false;
    copyRgbButton.disabled = false;
    copyHsvButton.disabled = false;
    copyHslButton.disabled = false;
}

function UpdateColorReadout(x,y) {
    const pixel = ctx.getImageData(x, y, 1, 1).data;

    setColor(pixel[0], pixel[1], pixel[2]);
}

// ======= EDITABLE COLOR VALUES =======
// Validate a CSS alpha value between 0 and 1.
function parseAlpha(text) {
    const value = text.trim();

    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
        return null;
    }

    const alpha = Number(value);
    return alpha >= 0 && alpha <= 1 ? alpha : null;
}

// Read color values from CSS functions or plain lists.
function parseColorArguments(text, allowedNames) {
    const value = text.trim();

    // Match rgb(...), rgba(...), hsl(...), or hsla(...).
    const match = value.match(/^([a-z]+)\s*\(([^()]*)\)$/i);

    if (match) {
        const name = match[1].toLowerCase();

        if (!allowedNames.includes(name)) return null;

        const parts = match[2].split(",").map(s => s.trim());

        // Check the number of arguments in CSS functions.
        if ((name === "rgb" || name === "hsl") && parts.length !== 3) return null;

        if ((name === "rgba" || name === "hsla") && parts.length !== 4) return null;

        return parts;
    }

    // Reject unmatched or unknown function syntax.
    if (/[()]/.test(value)) return null;

    // Keep compatibility with our original number-list format.
    return value.split(",").map(s => s.trim());
}

// Hex: #RRGGBB or #RRGGBBAA
hexValue.addEventListener("change", () => {
    const hex = hexValue.value.trim();
    
    if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(hex)) {
        updateColorValues();
        return;
    }

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const alpha = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;

    setOpacityPercent(alpha * 100);
    setColor(r, g, b);
});

// RGB: r, g, b, optional alpha
rgbValue.addEventListener("change", () => {
    const parts = parseColorArguments(rgbValue.value, ["rgb", "rgba"]);

    const validRGB = parts !== null &&
        (parts.length === 3 || parts.length === 4) &&
        parts.slice(0, 3).every(s =>
            /^\d{1,3}$/.test(s) && Number(s) <= 255
        );

    const alpha = parts?.length === 4 ? parseAlpha(parts[3]) : 1;

    if (!validRGB || alpha === null) {
        updateColorValues();
        return;
    }

    const [r, g, b] = parts.slice(0, 3).map(Number);

    setOpacityPercent(alpha * 100);
    setColor(r, g, b);
});

// Parse HSV or HSL text: hue, %, %, optional alpha
function parseHueColor(text, allowedNames) {
    const parts = parseColorArguments(text, allowedNames);

    if (parts === null) return null;

    if (parts.length !== 3 && parts.length !== 4) {
        return null;
    }

    const numeric = /^\d+(?:\.\d+)?$/;
    const percent = /^\d+(?:\.\d+)?%$/;

    if (!numeric.test(parts[0]) ||
        !percent.test(parts[1]) ||
        !percent.test(parts[2])) {
        return null;
    }

    const h = Number(parts[0]);
    const s = Number(parts[1].slice(0, -1));
    const level = Number(parts[2].slice(0, -1));

    const alpha = parts?.length === 4 ? parseAlpha(parts[3]) : 1;

    if (h > 360 || s > 100 || level > 100 || alpha === null) {
        return null;
    }

    return { h: h % 360, s: s / 100, level: level / 100, alpha };
}

// HSV: h, s%, v%, optional alpha
hsvValue.addEventListener("change", () => {
    const parsed = parseHueColor(hsvValue.value, ["hsv"]);

    if (!parsed) {
        updateColorValues();
        return;
    }

    hsv = {
        h: parsed.h,
        s: parsed.s,
        v: parsed.level
    };

    setOpacityPercent(parsed.alpha * 100);
    applyHsvColor();
});

// HSL: h, s%, l%, optional alpha
hslValue.addEventListener("change", () => {
    const parsed = parseHueColor(hslValue.value, ["hsl", "hsla"]);

    if (!parsed) {
        updateColorValues();
        return;
    }

    const rgb = hslToRgb(parsed.h, parsed.s, parsed.level);

    // Preserve an explicitly entered hue for gray colors.
    hsv.h = parsed.h;

    setOpacityPercent(parsed.alpha * 100);
    setColor(...rgb);
});
// =====================================

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
        !document.querySelector(".results").contains(event.target)
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

// ======= HSL AND SHARED COLOR FORMATTING =======
// Convert RGB to HSL.
function rgbToHsl(r, g, b) {
    const hue = rgbToHsv(r, g, b).h;

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return { h: hue, s, l };
}

// Convert HSL to RGB using the existing HSV engine.
function hslToRgb(h, s, l) {
    const v = l + s * Math.min(l, 1 - l);
    const HsvS = v === 0 ? 0 : 2 * (v - l) / v;

    return hsvToRgb(h % 360, HsvS, v);
}

// Round numerical displays without unnecessary zeros.
function round2(value) {
    return Number(value.toFixed(2));
}

// Synchronize all four formats with currentColor and alpha.
function updateColorValues() {
    const [r, g, b] = currentColor;
    const hex = "#" + currentColor
        .map(n => n.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    
    const alphaByte = Math.round(swatchAlpha * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    
    const hasAlpha = swatchAlpha < 1;
    const alphaText = Number(swatchAlpha.toFixed(4));
    const alphaSuffix = hasAlpha ? `, ${alphaText}` : "";

    // HEX uses a rounded 8-bit alpha channel.
    hexValue.value = hasAlpha ? hex + alphaByte : hex;

    // Format RGB as a valid CSS color function.
    const rgbBody = `${r}, ${g}, ${b}`;

    rgbValue.value = hasAlpha
        ? `rgba(${rgbBody}, ${alphaText})`
        : `rgb(${rgbBody})`;

    const hsvColor = rgbToHsv(r, g, b);
    const hslColor = rgbToHsl(r, g, b);

    // Preserve the remembered hue for neutral colors.
    const hue = hsvColor.s === 0 ? hsv.h : hsvColor.h;

    const hsvBody = `${round2(hue)}, ` +
        `${round2(hsvColor.s * 100)}%, ` +
        `${round2(hsvColor.v * 100)}%`;
    
    const hslBody = `${round2(hue)}, ` +
        `${round2(hslColor.s * 100)}%, ` +
        `${round2(hslColor.l * 100)}%`;

    // HSV is an editor format, not a native CSS color function.
    hsvValue.value = `hsv(${hsvBody}${alphaSuffix})`;

    // HSL / HSLA are valid CSS functions.
    hslValue.value = hasAlpha
        ? `hsla(${hslBody}, ${alphaText})`
        : `hsl(${hslBody})`;
}
// ===============================================

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
setupCopyButton(copyHsvButton, hsvValue, "Copy HSV");
setupCopyButton(copyHslButton, hslValue, "Copy HSL");

// Initialize the editor without requiring an image.
setColor(0, 0, 0);

// ======= GRADIENT BUILDER: SAVE COLORS =======
const addGradientColorButton = document.getElementById("addGradientColorButton");
const gradientBuilder = document.getElementById("gradientBuilder");
const gradientPreview = document.getElementById("gradientPreview");
const gradientStopList = document.getElementById("gradientStopList");

const gradientStops = [];
let nextGradientStopId = 1;

addGradientColorButton.addEventListener("click", () => {
    const stop = {
        id: nextGradientStopId,
        rgb: [...currentColor],
        alpha: swatchAlpha,
        position: null
    };

    nextGradientStopId += 1;
    gradientStops.push(stop);

    const hex = "#" + stop.rgb
        .map(channel => channel.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    const row = document.createElement("li");
    row.className = "gradient-stop"

    const chip = document.createElement("span");
    chip.className = "gradient-stop-chip";
    chip.style.backgroundColor = hex;

    const label = document.createElement("code");
    label.textContent = hex;

    row.append(chip, label);
    gradientStopList.append(row);

    if (gradientStops.length === 1) {
        const [r, g, b] = stop.rgb;
        gradientPreview.style.backgroundColor =
        `rgba(${r}, ${g}, ${b}, ${stop.alpha})`;
    }

    gradientBuilder.hidden = false;
});
// =============================================