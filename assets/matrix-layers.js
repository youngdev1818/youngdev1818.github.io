const characters = "*':;!?,.@#$_&-+()%|/=[]<>{}\\\"ABCDEF0123456789";

function randomCharacter() {
  const index = Math.floor(
    Math.random() * characters.length
  );

  return characters[index];
}

function createRainLayer(canvasId, settings) {

  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  return {
    canvas: canvas,
    ctx: ctx,

    fontSize: settings.fontSize,
    trailLength: settings.trailLength,

    speedMin: settings.speedMin,
    speedMax: settings.speedMax,

    opacity: settings.opacity,

    drops: [],
    speeds: [],
    streamCharacters: [],
    timers: [],

    columns: 0
  }
}

const farLayer = createRainLayer("matrix-far", {
  fontSize: 8,
  trailLength: 9,
  speedMin: 1,
  speedMax: 3,
  opacity: 0.5
});

const midLayer = createRainLayer("matrix-mid", {
  fontSize: 10,
  trailLength: 11,
  speedMin: 2,
  speedMax: 6,
  opacity: 0.75
});

const frontLayer = createRainLayer("matrix-rain", {
  fontSize: 12,
  trailLength: 14,
  speedMin: 3,
  speedMax: 12,
  opacity: 1
});

function setupLayer(layer) {

  // Give this canvas its own drawing resolution
  layer.canvas.width = layer.canvas.clientWidth;
  layer.canvas.height = layer.canvas.clientHeight;

  // Calculate the number of character columns
  layer.columns = Math.floor(
    layer.canvas.width / layer.fontSize
  );

  // Start with fresh arrays for this layer.
  layer.drops = [];
  layer.speeds = [];
  layer.streamCharacters = [];
  layer.timers = [];

  // Prepare every column independently.
  for (let i = 0; i < layer.columns; i++) {

    // Start at a random vertical row.
    layer.drops[i] = Math.floor(
      Math.random() * (layer.canvas.height / layer.fontSize)
    );

    // Choose a speed from this layer's range.
    layer.speeds[i] = layer.speedMin + Math.random() *
    (layer.speedMax - layer.speedMin);

    // No elapsed time accumulated yet.
    layer.timers[i] = 0;

    // Create the character memory for this column.
    layer.streamCharacters[i] = [];

    for (let j = 0; j < layer.trailLength; j++) {
      layer.streamCharacters[i][j] = randomCharacter();
    }
  } 
}

function drawLayer(layer, deltaTime) {

  const ctx = layer.ctx;
  const canvas = layer.canvas;
  const fontSize = layer.fontSize;
  const trailLength = layer.trailLength;

  // Clear this layer without hiding the portal.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";

  for (let i = 0; i < layer.columns; i++) {

    // Accumulate elapsed time independently.
    layer.timers[i] += deltaTime;

    const stepTime = 1 / layer.speeds[i];

    // Advance only when a complete row is reached.
    while (layer.timers[i] >= stepTime) {

      layer.timers[i] -= stepTime;
      layer.drops[i]++;

      // Old leader becomes part of the trail.
      layer.streamCharacters[i].pop();
      layer.streamCharacters[i].unshift(randomCharacter());

      // Reset after the entire trail leaves.
      if ( layer.drops[i] > canvas.height / fontSize + trailLength) {
        layer.drops[i] = -Math.floor(
          Math.random() * canvas.height / fontSize
        );
      }
    }

    // Smooth movement between rows.
    const progress = layer.timers[i] / stepTime;
    const x = i * fontSize;

    //Draw oldest characters first.
    for (let j = trailLength - 1; j >= 0; j--) {

      const y = j === 0
      ? (layer.drops[i] + progress) * fontSize
      : (layer.drops[i] - j) * fontSize;

      if (y < 0 || y >= canvas.height) {
        continue;
      }

      // Random character mutations.
      const chance = j === 0 ? 0.09 : 0.005;

      if (Math.random() < chance) {
        layer.streamCharacters[i][j] =
          randomCharacter();
      }

      // Fade the older characters.
      ctx.globalAlpha = (1 - j / trailLength) * layer.opacity;

      if (j === 0) {

        // Bright leading character.
        ctx.fillStyle = "#caffee";
        ctx.shadowColor = "#00ffee";
        ctx.shadowBlur = 10 * layer.opacity;

        // Draw the stationary imprints FIRST.
        ctx.save();

        ctx.globalAlpha = (0.8 + progress * ((1 - 1 / trailLength) - 0.8))
          * layer.opacity;

        ctx.fillStyle = "#00eeff";
        ctx.shadowBlur = 0;

        ctx.fillText(
          layer.streamCharacters[i][0], x, layer.drops[i] * fontSize);

        ctx.restore();
        
      } else {

        // Ordinary trailing character.
        ctx.fillStyle = "#00bbff";
        ctx.shadowBlur = 0;
      }

      // Draw the character after teh imprint.
      ctx.fillText( layer.streamCharacters[i][j], x, y);
    }
  }

  // Restore drawing settings.
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

setupLayer(farLayer);
setupLayer(midLayer);
setupLayer(frontLayer);

let lastTime = 0;

function animate(time) {

  // Seconds elapsed since the previous frame.
  const deltaTime = Math.min((time - (lastTime || time)) / 1000, 0.05);

  lastTime = time;

  // One clock, three independent layers.
  drawLayer(farLayer, deltaTime);
  drawLayer(midLayer, deltaTime);
  drawLayer(frontLayer, deltaTime);

  requestAnimationFrame(animate);
}

// Start the animation.
requestAnimationFrame(animate);
