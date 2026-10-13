const canvas=document.getElementById("matrix-rain");
const ctx=canvas.getContext("2d");

// Set canvas drawing resolution.
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// Appearence and speed.
const fontSize = 12;
const speed = 1.5;

// Characters available for rain.
const characters = "アイウエオカキクケコサシスセソタチツテト012345789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Number of columns that fit.
const columns = Math.floor(canvas.width / fontSize);

// Array to store each column's Y position.
const drops = [];
const symbols = [];

// Give each column a random starting point.
for (let i = 0; i < columns; i++) {
  drops[i] = Math.random() * canvas.height;

  const index = Math.floor(
    Math.random() * characters.length
  );

  symbols[i] = characters[index];
}

// This function draws one frame.
function draw() {

  // Erase previous frame.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set character appearance.
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = "#00ff88";
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

    // Draw the character.
    ctx.fillText(character, x, y);

    // Move this column downward.
    drops[i] += speed;

    // Occasional character change.
    if (Math.random() < 0.08) {
      const index = Math.floor(
        Math.random() * characters.length
      );

      symbols[i] = characters[index];
    }

    // Restart when it reaches the bottom.
    if (drops[i] > canvas.height + fontSize) {
      drops[i] = -Math.random() * canvas.height;
    }
  }

  // Ask the browser to draw next frame.
  requestAnimationFrame(draw);
}

// Start the animation!
draw();
