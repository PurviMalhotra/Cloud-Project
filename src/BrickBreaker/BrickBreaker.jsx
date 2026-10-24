import { useEffect, useRef, useState } from "react";
import Navbar from "../Components/Navbar";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";
import "./BrickBreaker.css";
import { useAuth } from "../context/AuthContext";

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 480;
const PADDLE_Y = CANVAS_HEIGHT - 34;
const MAX_LEVEL = 6;

function createBricks(level) {
  const rows = 4 + Math.min(3, level);
  const cols = 10;
  const padding = 8;
  const topOffset = 64;
  const brickWidth = (CANVAS_WIDTH - padding * (cols + 1)) / cols;
  const brickHeight = 18;

  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => {
      const hp = level >= 3 && rowIndex % 2 === 0 ? 2 : 1;
      return {
        x: padding + colIndex * (brickWidth + padding),
        y: topOffset + rowIndex * (brickHeight + padding),
        w: brickWidth,
        h: brickHeight,
        hp,
      };
    }),
  ).flat();
}

function createGameState(level = 1, score = 0, lives = 3) {
  const initialSpeed = 4 + level * 0.45;
  const paddleW = Math.max(78, 132 - (level - 1) * 10);

  return {
    level,
    score,
    lives,
    status: "playing",
    paddle: {
      x: CANVAS_WIDTH / 2 - paddleW / 2,
      y: PADDLE_Y,
      w: paddleW,
      h: 12,
      speed: 8,
    },
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 60,
      r: 8,
      vx: initialSpeed,
      vy: -initialSpeed,
    },
    bricks: createBricks(level),
  };
}

function drawScene(ctx, state) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#0e152b");
  gradient.addColorStop(1, "#090f1f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "rgba(130, 164, 255, 0.08)";
  for (let i = 0; i < CANVAS_WIDTH; i += 12) {
    ctx.fillRect(i, 0, 1, CANVAS_HEIGHT);
  }

  state.bricks.forEach((brick) => {
    if (brick.hp <= 0) return;

    const color = brick.hp === 2 ? "#69a9ff" : "#74ff9b";
    ctx.fillStyle = color;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    ctx.strokeStyle = "rgba(8, 12, 24, 0.6)";
    ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
  });

  ctx.fillStyle = "#9fc6ff";
  ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h);

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#f9fcff";
  ctx.shadowColor = "rgba(161, 194, 255, 0.85)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
}

export default function BrickBreaker() {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const keysRef = useRef({ left: false, right: false });
  const pointerXRef = useRef(null);
  const stateRef = useRef(createGameState());
  const previousTimeRef = useRef(0);
  const { user, reportScore } = useAuth();

  const [booting, setBooting] = useState(true);
  const [ui, setUi] = useState({
    score: 0,
    lives: 3,
    level: 1,
    status: "playing",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setBooting(false);
    }, 650);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    const updateUi = () => {
      const { score, lives, level, status } = stateRef.current;
      setUi({ score, lives, level, status });
    };

    const resetBall = () => {
      const state = stateRef.current;
      const speed = 4 + state.level * 0.45;
      state.ball = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 60,
        r: 8,
        vx: Math.random() > 0.5 ? speed : -speed,
        vy: -speed,
      };
      state.paddle.x = CANVAS_WIDTH / 2 - state.paddle.w / 2;
      pointerXRef.current = null;
    };

    const levelUp = () => {
      const state = stateRef.current;
      if (state.level >= MAX_LEVEL) {
        state.status = "won";
        updateUi();
        return;
      }

      state.level += 1;
      state.bricks = createBricks(state.level);
      state.paddle.w = Math.max(78, 132 - (state.level - 1) * 10);
      resetBall();
      updateUi();
    };

    const loseLife = () => {
      const state = stateRef.current;
      state.lives -= 1;

      if (state.lives <= 0) {
        state.status = "gameover";
        state.lives = 0;
        updateUi();
        return;
      }

      resetBall();
      updateUi();
    };

    const frame = (time) => {
      const state = stateRef.current;
      const dt = Math.min(2, (time - previousTimeRef.current) / 16.67 || 1);
      previousTimeRef.current = time;

      if (state.status === "playing") {
        const direction =
          Number(keysRef.current.right) - Number(keysRef.current.left);

        if (pointerXRef.current !== null) {
          const target = pointerXRef.current - state.paddle.w / 2;
          const diff = target - state.paddle.x;
          state.paddle.x += diff * 0.18 * dt;
        } else {
          state.paddle.x += direction * state.paddle.speed * dt;
        }

        state.paddle.x = Math.max(
          0,
          Math.min(CANVAS_WIDTH - state.paddle.w, state.paddle.x),
        );

        const previousY = state.ball.y;

        state.ball.x += state.ball.vx * dt;
        state.ball.y += state.ball.vy * dt;

        if (state.ball.x - state.ball.r <= 0) {
          state.ball.x = state.ball.r;
          state.ball.vx = Math.abs(state.ball.vx);
        }

        if (state.ball.x + state.ball.r >= CANVAS_WIDTH) {
          state.ball.x = CANVAS_WIDTH - state.ball.r;
          state.ball.vx = -Math.abs(state.ball.vx);
        }

        if (state.ball.y - state.ball.r <= 0) {
          state.ball.y = state.ball.r;
          state.ball.vy = Math.abs(state.ball.vy);
        }

        if (
          state.ball.vy > 0 &&
          state.ball.y + state.ball.r >= state.paddle.y &&
          state.ball.y + state.ball.r <= state.paddle.y + state.paddle.h + 10 &&
          state.ball.x >= state.paddle.x &&
          state.ball.x <= state.paddle.x + state.paddle.w
        ) {
          const hitOffset =
            (state.ball.x - (state.paddle.x + state.paddle.w / 2)) /
            (state.paddle.w / 2);
          const speed = Math.min(
            10.5,
            Math.hypot(state.ball.vx, state.ball.vy) + 0.18,
          );
          state.ball.vx = speed * hitOffset;
          state.ball.vy = -Math.sqrt(
            Math.max(6, speed * speed - state.ball.vx * state.ball.vx),
          );
          state.ball.y = state.paddle.y - state.ball.r - 1;
        }

        let activeBricks = 0;
        let scored = false;

        for (let index = 0; index < state.bricks.length; index += 1) {
          const brick = state.bricks[index];
          if (brick.hp <= 0) continue;

          activeBricks += 1;

          const intersects =
            state.ball.x + state.ball.r >= brick.x &&
            state.ball.x - state.ball.r <= brick.x + brick.w &&
            state.ball.y + state.ball.r >= brick.y &&
            state.ball.y - state.ball.r <= brick.y + brick.h;

          if (!intersects) continue;

          const cameFromTop = previousY + state.ball.r <= brick.y;
          const cameFromBottom = previousY - state.ball.r >= brick.y + brick.h;

          if (cameFromTop || cameFromBottom) {
            state.ball.vy *= -1;
          } else {
            state.ball.vx *= -1;
          }

          brick.hp -= 1;
          if (brick.hp <= 0) {
            state.score += 10 * state.level;
            if (user) {
              reportScore("brickbreaker", 10 * state.level).catch(() => {
                console.error;
              });
            }
            scored = true;
            activeBricks -= 1;
          }

          break;
        }

        if (scored) {
          updateUi();
        }

        if (activeBricks === 0) {
          levelUp();
        }

        if (state.ball.y - state.ball.r > CANVAS_HEIGHT) {
          loseLife();
        }
      }

      drawScene(ctx, state);

      if (state.status !== "playing") {
        ctx.fillStyle = "rgba(5, 10, 20, 0.62)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#f3f8ff";
        ctx.textAlign = "center";
        ctx.font = "700 28px Rajdhani";
        ctx.fillText(
          state.status === "won" ? "You Cleared All Levels" : "Game Over",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 - 4,
        );
        ctx.font = "500 16px JetBrains Mono";
        ctx.fillText(
          "Press Restart to play again",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 28,
        );
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keysRef.current.left = true;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keysRef.current.right = true;
      }
    };

    const onKeyUp = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keysRef.current.left = false;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keysRef.current.right = false;
      }
    };

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      pointerXRef.current = x;
    };

    const onPointerLeave = () => {
      pointerXRef.current = null;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [booting, user, reportScore]);

  const restart = () => {
    stateRef.current = createGameState();
    previousTimeRef.current = 0;
    setUi({ score: 0, lives: 3, level: 1, status: "playing" });
  };

  if (booting) {
    return (
      <div className="brick-page">
        <Navbar />
        <GameBoot
          title="Brick Breaker"
          subtitle="Loading paddle physics and brick grid..."
        />
      </div>
    );
  }

  return (
    <div className="brick-page">
      <Navbar />

      <div className="brick-container">
        <div className="brick-header">
          <h1>Brick Breaker</h1>
          <div className="brick-stats">
            <span>Score: {ui.score}</span>
            <span>Lives: {ui.lives}</span>
            <span>Level: {ui.level}</span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="brick-canvas"
        />

        <div className="brick-actions">
          <button onClick={restart}>Restart</button>
          <p>Use Left/Right arrows or move your pointer</p>
        </div>
      </div>
    </div>
  );
}
