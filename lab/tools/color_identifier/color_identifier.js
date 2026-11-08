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
const SAMPLE_SIZE = LOUPE_SIZE / ZOOM;

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
    const halfSample = SAMPLE_SIZE / 2;

    let sx = Math.round(x - halfSample);
    let sy = Math.round(y - halfSample);

    sx = Math.max(0, Math.min(canvas.width - SAMPLE_SIZE, sx));
    sy = Math.max(0, Math.min(canvas.height - SAMPLE_SIZE, sy));

    loupeCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.imageSmoothingEnabled = false;
    loupeCtx.drawImage(
        canvas,
        sx, sy, SAMPLE_SIZE, SAMPLE_SIZE,
        0, 0, LOUPE_SIZE, LOUPE_SIZE
    );

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    let loupeLeft = offsetX + 20;
    let loupeTop = offsetY - LOUPE_SIZE - 20;

    if (loupeLeft + LOUPE_SIZE > rect.width) {
        loupeLeft = offsetX - LOUPE_SIZE - 20;
    }

    if (loupeLeft < 0) {
        loupeLeft = 10;
    }

    if (loupeTop < 0) {
        loupeTop = offsetY + 20;
    }

    if (loupeTop + LOUPE_SIZE > rect.height) {
        loupeTop = rect.height - LOUPE_SIZE - 10;
    }

    loupe.style.left = `${loupeLeft}px`;
    loupe.style.top = `${loupeTop}px`;
    loupe.hidden = false;
}

function sampleAtEvent(event) {
    const { x, y, rect } = getCanvasCoordinates(event);

    UpdateColorReadout(x, y);
    updateLoupe(x, y, event, rect);
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
