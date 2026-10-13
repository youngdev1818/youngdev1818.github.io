
const canvas = document.getElementById("matrix-rain");
const ctx = canvas.getContext("2d");

// Appearance settings
const fontSize = 12;
const trailLength = 14;
const characters =
  "*':;!?,.@#$_&-+()%|/=[]<>{}ABCDEF0123456789";

// Mutation probabilities
const leaderMutation = 0.05;
const trailMutation = 0.005;

// Stream information
let drops = [];
let speeds = [];
let streamCharacters = [];
let timers = [];
let columns = 0;
let lastTime = 0;

// Choose a random character
function randomCharacter() {
  const index = Math.floor(
    Math.random() * characters.length
  );

  return characters[index];
}

// Prepare the canvas and streams
function setup() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  columns = Math.floor(canvas.width / fontSize);

  drops = [];
  speeds = [];
  streamCharacters = [];
  timers = [];

  for (let i = 0; i < columns; i++) {

    // Start at different vertical positions
    drops[i] = Math.floor(
      Math.random() * canvas.height / fontSize
    );

    // Different speeds: steps per second
    speeds[i] = 3 + Math.random() * 9;

    timers[i] = 0;
    streamCharacters[i] = [];

    for (let j = 0; j < trailLength; j++) {
      streamCharacters[i][j] = randomCharacter();
    }
  }
}

// Draw one animation frame
function draw(time) {

  const deltaTime = Math.min(
    (time - (lastTime || time)) / 1000,
    0.05
  );

  lastTime = time;

  ctx.clearRect(
    0, 0, canvas.width, canvas.height
  );

  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";

  for (let i = 0; i < columns; i++) {

    // Accumulate elapsed time
    timers[i] += deltaTime;

    // Time needed for one character step
    const stepTime = 1 / speeds[i];

    // Advance by complete character cells
    while (timers[i] >= stepTime) {
      timers[i] -= stepTime;
      drops[i]++;

      // Previous leader becomes trail character
      streamCharacters[i].pop();
      streamCharacters[i].unshift(randomCharacter());

      // Wait until the entire trail exits
      if (
        drops[i] >
        canvas.height / fontSize + trailLength
      ) {
        drops[i] = -Math.floor(
          Math.random() * canvas.height / fontSize
        );
      }
    }

    // Progress toward the next character row.
    const progress = timers[i] / stepTime;

    // Draw this stream
    const x = i * fontSize;

    for (let j = trailLength - 1; j >= 0; j--) {

      const y = j === 0 ? (drops[i] + progress) * fontSize : (drops[i] - j) * fontSize;

      if (y < 0 || y >= canvas.height) {
        continue;
      }

      // Occasionally mutate a character
      const chance =
        j === 0 ? leaderMutation : trailMutation;

      if (Math.random() < chance) {
        streamCharacters[i][j] = randomCharacter();
      }

      // Fade older characters
      ctx.globalAlpha = 1 - j / trailLength;

      if (j === 0) {
        ctx.fillStyle = "#caffed";
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = "#00ddff";
        ctx.shadowBlur = 0;
      }

      // Ghost write the lead character imprint.
      if (j === 0) {
        ctx.save();
        ctx.globalAlpha = 0.3 + progress * ((1 - 1 / trailLength) - 0.3);
        ctx.fillStyle = "#0066ff";
        ctx.shadowBlur = 0;
        
        ctx.fillText(streamCharacters[i][0], x, drops[i] * fontSize);

        // Restore previous settings.
        ctx.restore();
      }

      ctx.fillText(streamCharacters[i][j], x, y);
    }
  }

  // Restore normal drawing settings
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  requestAnimationFrame(draw);
}

// Start the animation
setup();
requestAnimationFrame(draw);
