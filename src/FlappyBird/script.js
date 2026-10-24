export function initFlappy(submitScore) {
let animation;
const previousTheme = document.body.className;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const themeBtn = document.getElementById("themeBtn");
const musicBtn = document.getElementById("musicBtn");
const difficultySel = document.getElementById("difficulty");

const bgMusic = document.getElementById("bgMusic");
const crashSound = document.getElementById("crashSound");

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// 🎮 SETTINGS
const settings = {
  easy: { gravity: 0.35, jump: -7 },
  medium: { gravity: 0.45, jump: -8 },
  hard: { gravity: 0.6, jump: -9 },
};

// 💾 Load saved settings
let difficulty = localStorage.getItem("difficulty") || "easy";
difficultySel.value = difficulty;

let theme = localStorage.getItem("theme") || "day";
document.body.className = theme;

let gravity = settings[difficulty].gravity;
let jumpForce = settings[difficulty].jump;

// 🐦 Bird
let bird = {
  x: W * 0.25,
  y: H / 2,
  r: 18,
  v: 0,
  flap: 0,
};

let pipes = [];
let frame = 0;
let score = 0;
let best = localStorage.getItem("best") || 0;
bestEl.textContent = best;

// 🧠 GAME STATE
let state = "IDLE"; // IDLE | PLAYING | GAME_OVER
let musicOn = false;

// 🎮 Controls
const onKeyDown = (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (state === "IDLE") {
      state = "PLAYING";
      overlay.classList.add("hidden");
    }
    if (state === "PLAYING") {
      bird.v = jumpForce;
      bird.flap = 10;
    }
  }
};
window.addEventListener("keydown", onKeyDown);

// 🌗 Theme toggle
themeBtn.onclick = () => {
  theme = theme === "day" ? "night" : "day";
  document.body.className = theme;
  themeBtn.textContent = theme === "night" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
};

// 🎵 Music toggle
musicBtn.onclick = () => {
  musicOn = !musicOn;
  musicOn ? bgMusic.play() : bgMusic.pause();
  musicBtn.textContent = musicOn ? "🔈" : "🔊";
};

// 🎚 Difficulty
difficultySel.onchange = () => {
  difficulty = difficultySel.value;
  gravity = settings[difficulty].gravity;
  jumpForce = settings[difficulty].jump;
  localStorage.setItem("difficulty", difficulty);
};

// 🐦 Draw Bird
function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.v * 0.04);

  ctx.fillStyle = "#FFD93D";
  ctx.beginPath();
  ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#F4C430";
  ctx.beginPath();
  ctx.ellipse(-5, bird.flap > 0 ? -10 : 5, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(5, -5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "orange";
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(25, -5);
  ctx.lineTo(25, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// 🌤 Background
function drawBackground() {
  if (theme === "day") {
    ctx.fillStyle = "#7ecbff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFD93D";
    ctx.beginPath();
    ctx.arc(W - 120, 120, 40, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#050b2e";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f5f3ce";
    ctx.beginPath();
    ctx.arc(W - 120, 120, 35, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 🚧 Pipes
function addPipe() {
  let gap = 180;
  let top = Math.random() * (H - gap - 200) + 100;
  pipes.push({ x: W, top, passed: false });
}

function drawPipes() {
  pipes.forEach((p) => {
    if (state === "PLAYING") p.x -= 3;
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(p.x, 0, 70, p.top);
    ctx.fillRect(p.x, p.top + 180, 70, H);

    if (
      state === "PLAYING" &&
      bird.x + bird.r > p.x &&
      bird.x - bird.r < p.x + 70 &&
      (bird.y - bird.r < p.top || bird.y + bird.r > p.top + 180)
    )
      gameOver();

    if (state === "PLAYING" && !p.passed && p.x + 70 < bird.x) {
      p.passed = true;
      score += 10;
      scoreEl.textContent = score;
      submitScore(10);
    }
  });

  pipes = pipes.filter((p) => p.x > -80);
}

function gameOver() {
  if (state === "GAME_OVER") return;
  state = "GAME_OVER";
  crashSound.play();
  overlay.innerHTML = "<h1>Game Over</h1><p>Refresh to Restart</p>";
  overlay.classList.remove("hidden");

  if (score > best) {
    best = score;
    localStorage.setItem("best", best);
    bestEl.textContent = best;
  }
}

// 🔁 Loop
function loop() {
  drawBackground();

  if (state === "IDLE") {
    bird.y = H / 2 + Math.sin(frame * 0.05) * 10;
  }

  if (state === "PLAYING") {
    bird.v += gravity;
    bird.y += bird.v;
    bird.flap = Math.max(0, bird.flap - 1);

    if (frame % 100 === 0) addPipe();
  }

  drawPipes();
  drawBird();

  if (bird.y + bird.r > H || bird.y - bird.r < 0) gameOver();

  frame++;
  animation = requestAnimationFrame(loop);
}

loop();

return () => { cancelAnimationFrame(animation); window.removeEventListener("resize", resize); window.removeEventListener("keydown", onKeyDown); bgMusic.pause(); document.body.className = previousTheme; themeBtn.onclick = null; musicBtn.onclick = null; difficultySel.onchange = null; };
}
