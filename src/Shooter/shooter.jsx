import { useEffect, useRef, useState } from "react";
import "./shooter.css";
import Navbar from "../Components/Navbar";
import GameBoot from "../Components/GameBoot";
import { useAuth } from "../context/AuthContext";

export default function Shooter() {
  const gameWidth = 600;
  const gameHeight = 400;

  const [gameState, setGameState] = useState("idle");
  const [playerX, setPlayerX] = useState(280);
  const [sprites, setSprites] = useState({ bullets: [], enemies: [] });
  const [booting, setBooting] = useState(true);

  const keys = useRef({ left: false, right: false, shoot: false });
  const playerXRef = useRef(280);
  const lastShotRef = useRef(0);
  const bulletsRef = useRef([]);
  const enemiesRef = useRef([]);

  const { user, reportScore } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return undefined;

    const down = (e) => {
      if (e.key === "ArrowLeft") keys.current.left = true;
      if (e.key === "ArrowRight") keys.current.right = true;
      if (e.key === " " || e.key === "Space") {
        e.preventDefault();
        keys.current.shoot = true;
      }
    };
    const up = (e) => {
      if (e.key === "ArrowLeft") keys.current.left = false;
      if (e.key === "ArrowRight") keys.current.right = false;
      if (e.key === " " || e.key === "Space") {
        e.preventDefault();
        keys.current.shoot = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [booting]);

  useEffect(() => {
    if (gameState !== "playing") return;

    const interval = setInterval(() => {
      // Move player
      setPlayerX((prev) => {
        let x = prev;
        if (keys.current.left) x -= 5;
        if (keys.current.right) x += 5;
        const clamped = Math.max(0, Math.min(x, gameWidth - 40));
        playerXRef.current = clamped;
        return clamped;
      });

      // Shoot
      const now = Date.now();
      if (keys.current.shoot && now - lastShotRef.current > 250) {
        lastShotRef.current = now;
        bulletsRef.current.push({
          x: playerXRef.current + 18,
          y: gameHeight - 40,
        });
      }

      // Move bullets
      bulletsRef.current = bulletsRef.current
        .map((b) => ({ ...b, y: b.y - 6 }))
        .filter((b) => b.y > 0);

      // Spawn enemies
      if (Math.random() < 0.02) {
        enemiesRef.current.push({ x: Math.random() * (gameWidth - 30), y: 0 });
      }

      // Move enemies
      enemiesRef.current = enemiesRef.current.map((e) => ({
        ...e,
        y: e.y + 1,
      }));

      // Collision detection
      const remainingEnemies = [];
      for (let e of enemiesRef.current) {
        let hit = false;
        bulletsRef.current = bulletsRef.current.filter((b) => {
          if (
            !hit &&
            b.x < e.x + 30 &&
            b.x + 4 > e.x &&
            b.y < e.y + 30 &&
            b.y + 10 > e.y
          ) {
            hit = true;
            return false;
          }
          return true;
        });
        if (!hit) remainingEnemies.push(e);

        if (hit) {
          if (user) {
            reportScore("shooter", 10).catch(() => {
              console.error;
            });
          }
        }
      }
      enemiesRef.current = remainingEnemies;

      // Game over
      if (enemiesRef.current.some((e) => e.y > gameHeight - 40)) {
        setGameState("gameover");
        return;
      }

      setSprites({ bullets: [...bulletsRef.current], enemies: [...enemiesRef.current] });
    }, 16);

    return () => clearInterval(interval);
  }, [gameState, user, reportScore]);

  const startGame = () => {
    setPlayerX(280);
    playerXRef.current = 280;
    bulletsRef.current = [];
    enemiesRef.current = [];
    setSprites({ bullets: [], enemies: [] });
    setGameState("playing");
  };

  if (booting) {
    return (
      <div className="page">
        <Navbar />
        <GameBoot
          title="Shooter"
          subtitle="Loading Enemies, Bullets, and Shooting Pad..."
        />
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <div className="game">
        <div
          className="player"
          style={{ left: playerX, top: gameHeight - 30 }}
        />

        {sprites.bullets.map((b, i) => (
          <div key={i} className="bullet" style={{ left: b.x, top: b.y }} />
        ))}

        {sprites.enemies.map((e, i) => (
          <div key={i} className="enemy" style={{ left: e.x, top: e.y }} />
        ))}

        {gameState === "idle" && (
          <div className="button-div">
            <button className="start-button" onClick={startGame}>
              Start
            </button>
          </div>
        )}

        {gameState === "gameover" && (
          <div className="button-div">
            <h2>Game Over</h2>
            <button className="start-button" onClick={startGame}>
              Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
