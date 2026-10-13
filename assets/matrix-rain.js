const canvas=document.getElementById("matrix-rain");
const ctx=canvas.getContext("2d");

// Set canvas drawing resolution.
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// Appearence and speed.
const fontSize = 14;
const trailLength = 14;

// Characters available for rain.
const characters = "アイウエオカキクケコサシスセソタチツテト012345789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Number of columns that fit.
const columns = Math.floor(canvas.width / fontSize);

// Array to store each column's Y position.
const drops = [];
const symbols = [];
const speeds = [];

// Give each column a random starting point.
for (let i = 0; i < columns; i++) {
  drops[i] = Math.random() * canvas.height;

  const index = Math.floor(
    Math.random() * characters.length
  );

  symbols[i] = characters[index];

  // Random speed for each column.
  speeds[i] = 0.5 + Math.random() * 2;
}

// This function draws one frame.
function draw() {

  // Erase previous frame.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set character appearance.
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = "#00ffbb";
  ctx.shadowColor = "#00ffcc";
  ctx.shadowBlur = 5;

  // Draw every column.
  for (let i = 0; i < columns; i++) {

    // Choose random character.
    const character = symbols[i];

    // Calculate its horizontal position.
    const x = i * fontSize;

    // Get this column's vertical position.
    const y = drops[i];

    // Draw the trailing characters.
    for (let j = trailLength - 1; j >= 0; j--) {

      // Each character sits above the leader
      const trailY = y - j * fontSize;

      // Skip characters outside the canvas
      if (trailY < 0 || trailY > canvas.height + fontSize) {
        continue;
      }

      // Older characters become dimmer
      const brightness = 1 - j / trailLength;

      ctx.globalAlpha = brightness;

      if (j === 0) {
        ctx.fillStyle = "#caffed";
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = "00ffbb";
        ctx.shadowBlur = 0;
      }

      // Pick a character for this trail possition
      const trailIndex = (i * 7 + j * 3) % characters.length;

      const trailCharacter = j === 0 ? character : characters[trailIndex];

      ctx.fillText(trailCharacter, x, trailY)
    }

    // Restore opacity for the next column
    ctx.globalAlpha = 1

    // Move this column downward.
    drops[i] += speeds[i];

    // Occasional character change.
    if (Math.random() < 0.02) {
      const index = Math.floor(
        Math.random() * characters.length
      );

      symbols[i] = characters[index];
    }

    // Restart when it reaches the bottom.
    if (drops[i] > canvas.height + trailLength * fontSize) {
      drops[i] = -Math.random() * canvas.height;
    }
  }

  // Ask the browser to draw next frame.
  requestAnimationFrame(draw);
}

// Start the animation!
draw();
