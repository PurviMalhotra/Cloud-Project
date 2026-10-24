import { useEffect, useMemo, useState } from "react";
import eatSoundFile from "../assets/eat.mp3";
import gameOverSoundFile from "../assets/gameover.mp3";
import Navbar from "../Components/Navbar.jsx";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";
import { useAuth } from "../context/AuthContext.jsx";

const GRID_SIZE = 20;

const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
];

export default function Snake() {
  const [booting, setBooting] = useState(true);
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState({ x: 0, y: -1 });
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true); // 🔊 default ON

  const [highScore, setHighScore] = useState(
    Number(localStorage.getItem("snakeHighScore")) || 0,
  );

  const eatSound = useMemo(() => new Audio(eatSoundFile), []);
  const gameOverSound = useMemo(() => new Audio(gameOverSoundFile), []);

  const { user, reportScore } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  // Movement loop
  useEffect(() => {
    if (booting || gameOver || paused) return;

    const interval = setInterval(
      () => {
        setSnake((prevSnake) => {
          const newHead = {
            x: prevSnake[0].x + direction.x,
            y: prevSnake[0].y + direction.y,
          };

          // Wall collision
          if (
            newHead.x < 0 ||
            newHead.y < 0 ||
            newHead.x >= GRID_SIZE ||
            newHead.y >= GRID_SIZE
          ) {
            setGameOver(true);
            if (soundOn) gameOverSound.play();
            return prevSnake;
          }

          // Self collision
          if (
            prevSnake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)
          ) {
            setGameOver(true);
            if (soundOn) gameOverSound.play();
            return prevSnake;
          }

          const newSnake = [newHead, ...prevSnake];

          // Eat food
          if (newHead.x === food.x && newHead.y === food.y) {
            if (soundOn) eatSound.play();

            if (user) {
              reportScore("snake", 10).catch(() => {
                console.error;
              });
            }
            setFood({
              x: Math.floor(Math.random() * GRID_SIZE),
              y: Math.floor(Math.random() * GRID_SIZE),
            });
          } else {
            newSnake.pop();
          }

          const nextScore = newSnake.length - 1;
          setHighScore((previous) => {
            if (nextScore > previous) {
              localStorage.setItem("snakeHighScore", nextScore);
              return nextScore;
            }
            return previous;
          });

          return newSnake;
        });
      },
      Math.max(60, 150 - snake.length * 3),
    );

    return () => clearInterval(interval);
  }, [
    booting,
    direction,
    food,
    gameOver,
    paused,
    snake.length,
    soundOn,
    eatSound,
    gameOverSound,
    user,
    reportScore,
  ]);

  // Controls
  useEffect(() => {
    if (booting) return undefined;

    const handleKey = (e) => {
      setDirection((prev) => {
        if (e.key === "ArrowUp" && prev.y !== 1) return { x: 0, y: -1 };
        if (e.key === "ArrowDown" && prev.y !== -1) return { x: 0, y: 1 };
        if (e.key === "ArrowLeft" && prev.x !== 1) return { x: -1, y: 0 };
        if (e.key === "ArrowRight" && prev.x !== -1) return { x: 1, y: 0 };
        return prev;
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [booting]);

  // Food animation
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.4); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (booting) {
    return (
      <div
        style={{
          textAlign: "center",
          background: "radial-gradient(circle at center, #0f172a, #020617)",
          minHeight: "100vh",
          color: "white",
        }}
      >
        <Navbar />
        <GameBoot
          title="Snake"
          subtitle="Loading grid, food spawns, and speed logic..."
        />
      </div>
    );
  }

  return (
    <div
      style={{
        textAlign: "center",
        background: "radial-gradient(circle at center, #0f172a, #020617)",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <Navbar />

      <h1 style={{ color: "#4ade80", fontSize: "40px" }}>🐍 Snake Game</h1>

      <h2>Score: {snake.length - 1}</h2>
      <h3 style={{ opacity: 0.7 }}>High Score: {highScore}</h3>

      {/* 🔊 SOUND TOGGLE */}
      <button
        onClick={() => setSoundOn(!soundOn)}
        style={{ margin: "5px", padding: "6px 12px", cursor: "pointer" }}
      >
        {soundOn ? "🔊 Sound ON" : "🔇 Sound OFF"}
      </button>

      {/* ⏸ PAUSE */}
      <button
        onClick={() => setPaused(!paused)}
        style={{ margin: "5px", padding: "6px 12px", cursor: "pointer" }}
      >
        {paused ? "Resume ▶️" : "Pause ⏸"}
      </button>

      {gameOver && (
        <div>
          <h2 style={{ color: "#ef4444" }}>Game Over 💀</h2>
          <button
            onClick={() => {
              setSnake(INITIAL_SNAKE);
              setDirection({ x: 0, y: -1 });
              setGameOver(false);
              setPaused(false);
            }}
            style={{
              padding: "10px 20px",
              margin: "10px",
              fontSize: "16px",
              cursor: "pointer",
              borderRadius: "6px",
              border: "none",
              background: "#4ade80",
              color: "black",
              fontWeight: "bold",
            }}
          >
            Restart
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 22px)`,
          justifyContent: "center",
          marginTop: "20px",
          padding: "10px",
          background: "#020617",
          borderRadius: "10px",
          boxShadow: "0 0 20px rgba(74, 222, 128, 0.2)",
        }}
      >
        {[...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
          const x = i % GRID_SIZE;
          const y = Math.floor(i / GRID_SIZE);

          const isSnake = snake.some((seg) => seg.x === x && seg.y === y);
          const isFood = food.x === x && food.y === y;

          return (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                backgroundColor: isSnake
                  ? "#4ade80"
                  : isFood
                    ? "#fb7185"
                    : "#020617",
                border: "1px solid #1e293b",
                borderRadius: isSnake ? "4px" : "0px",
                boxShadow: isSnake
                  ? "0 0 6px #4ade80"
                  : isFood
                    ? "0 0 10px #fb7185"
                    : "none",
                animation: isFood ? "pulse 1s infinite" : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
