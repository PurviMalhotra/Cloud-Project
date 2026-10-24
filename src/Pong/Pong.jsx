import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../Components/Navbar";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";
import "./Pong.css";

const WIDTH = 820;
const HEIGHT = 460;
const WIN_SCORE = 7;

function createState() {
  return {
    status: "playing",
    winner: "",
    playerScore: 0,
    aiScore: 0,
    player: {
      x: 24,
      y: HEIGHT / 2 - 44,
      w: 12,
      h: 88,
      speed: 7.4,
    },
    ai: {
      x: WIDTH - 36,
      y: HEIGHT / 2 - 44,
      w: 12,
      h: 88,
      speed: 5.8,
    },
    ball: {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      r: 8,
      vx: 4.2,
      vy: 2.5,
    },
  };
}

function resetBall(state, toPlayer) {
  const baseSpeed = 4.2;
  state.ball.x = WIDTH / 2;
  state.ball.y = HEIGHT / 2;
  state.ball.vx = (toPlayer ? -1 : 1) * baseSpeed;
  state.ball.vy = (Math.random() * 2 - 1) * 2.8;
}

function draw(ctx, state) {
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#0d152a");
  bg.addColorStop(1, "#081122");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(157, 186, 255, 0.26)";
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#95b7ff";
  ctx.fillRect(state.player.x, state.player.y, state.player.w, state.player.h);

  ctx.fillStyle = "#7dffb2";
  ctx.fillRect(state.ai.x, state.ai.y, state.ai.w, state.ai.h);

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fcff";
  ctx.shadowColor = "rgba(170, 205, 255, 0.9)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
}

export default function Pong() {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const keysRef = useRef({ up: false, down: false });
  const stateRef = useRef(createState());
  const previousTimeRef = useRef(0);

  const { user, reportScore } = useAuth();

  const [booting, setBooting] = useState(true);
  const [ui, setUi] = useState({
    playerScore: 0,
    aiScore: 0,
    status: "playing",
    winner: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    const updateUi = () => {
      const { playerScore, aiScore, status, winner } = stateRef.current;
      setUi({ playerScore, aiScore, status, winner });
    };

    const endIfNeeded = () => {
      const state = stateRef.current;
      if (state.playerScore >= WIN_SCORE) {
        state.status = "finished";
        state.winner = "Player";
      } else if (state.aiScore >= WIN_SCORE) {
        state.status = "finished";
        state.winner = "AI";
      }
      updateUi();
    };

    const frame = (time) => {
      const state = stateRef.current;
      const dt = Math.min(2, (time - previousTimeRef.current) / 16.67 || 1);
      previousTimeRef.current = time;

      if (state.status === "playing") {
        const direction =
          Number(keysRef.current.down) - Number(keysRef.current.up);
        state.player.y += direction * state.player.speed * dt;

        state.player.y = Math.max(
          0,
          Math.min(HEIGHT - state.player.h, state.player.y),
        );

        const aiTarget = state.ball.y - state.ai.h / 2;
        const aiDelta = aiTarget - state.ai.y;
        const aiStep =
          Math.sign(aiDelta) * Math.min(Math.abs(aiDelta), state.ai.speed * dt);
        state.ai.y += aiStep;
        state.ai.y = Math.max(0, Math.min(HEIGHT - state.ai.h, state.ai.y));

        state.ball.x += state.ball.vx * dt;
        state.ball.y += state.ball.vy * dt;

        if (
          state.ball.y - state.ball.r <= 0 ||
          state.ball.y + state.ball.r >= HEIGHT
        ) {
          state.ball.vy *= -1;
          state.ball.y = Math.max(
            state.ball.r,
            Math.min(HEIGHT - state.ball.r, state.ball.y),
          );
        }

        const paddles = [state.player, state.ai];
        paddles.forEach((paddle, index) => {
          const hit =
            state.ball.x - state.ball.r <= paddle.x + paddle.w &&
            state.ball.x + state.ball.r >= paddle.x &&
            state.ball.y + state.ball.r >= paddle.y &&
            state.ball.y - state.ball.r <= paddle.y + paddle.h;

          if (!hit) return;

          const headingToPaddle =
            index === 0 ? state.ball.vx < 0 : state.ball.vx > 0;
          if (!headingToPaddle) return;

          const relative =
            (state.ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
          const speed = Math.min(
            11.5,
            Math.hypot(state.ball.vx, state.ball.vy) * 1.06,
          );

          state.ball.vx = (index === 0 ? 1 : -1) * Math.max(4.3, speed * 0.9);
          state.ball.vy = speed * relative;

          if (index === 0) {
            state.ball.x = paddle.x + paddle.w + state.ball.r + 1;
            if (user) {
              reportScore("pong", 10).catch(() => {
                console.error;
              });
            }
          } else {
            state.ball.x = paddle.x - state.ball.r - 1;
          }
        });

        if (state.ball.x < -20) {
          state.aiScore += 1;

          resetBall(state, true);
          endIfNeeded();
        }

        if (state.ball.x > WIDTH + 20) {
          state.playerScore += 1;
          if (user) {
            reportScore("pong", 50).catch(() => {
              console.error;
            });
          }
          resetBall(state, false);
          endIfNeeded();
        }
      }

      draw(ctx, state);

      if (state.status === "finished") {
        ctx.fillStyle = "rgba(5, 12, 20, 0.6)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#edf5ff";
        ctx.textAlign = "center";
        ctx.font = "700 30px Rajdhani";
        ctx.fillText(`${state.winner} Wins`, WIDTH / 2, HEIGHT / 2 - 4);
        ctx.font = "500 16px JetBrains Mono";
        ctx.fillText(
          "Press Restart for a new match",
          WIDTH / 2,
          HEIGHT / 2 + 28,
        );
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w") keysRef.current.up = true;
      if (event.key === "ArrowDown" || key === "s") keysRef.current.down = true;
    };

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w") keysRef.current.up = false;
      if (event.key === "ArrowDown" || key === "s")
        keysRef.current.down = false;
    };

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const pointerY = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      stateRef.current.player.y = pointerY - stateRef.current.player.h / 2;
      stateRef.current.player.y = Math.max(
        0,
        Math.min(HEIGHT - stateRef.current.player.h, stateRef.current.player.y),
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
    };
  }, [booting, user, reportScore]);

  const restart = () => {
    stateRef.current = createState();
    previousTimeRef.current = 0;
    setUi({ playerScore: 0, aiScore: 0, status: "playing", winner: "" });
  };

  if (booting) {
    return (
      <div className="pong-page">
        <Navbar />
        <GameBoot
          title="Pong"
          subtitle="Loading AI opponent and ball physics..."
        />
      </div>
    );
  }

  return (
    <div className="pong-page">
      <Navbar />

      <div className="pong-container">
        <header className="pong-header">
          <h1>Pong</h1>
          <div className="pong-score">
            <span>Player: {ui.playerScore}</span>
            <span>AI: {ui.aiScore}</span>
          </div>
        </header>

        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="pong-canvas"
        />

        <div className="pong-actions">
          <button onClick={restart}>Restart</button>
          <p>Use W/S or Arrow Up/Down. First to {WIN_SCORE} wins.</p>
        </div>
      </div>
    </div>
  );
}
