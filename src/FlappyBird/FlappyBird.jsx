import { useEffect, useState, useRef } from "react";
import Navbar from "../Components/Navbar";
import "./style.css";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";

import { initFlappy } from "./script";
import bgMusic from "./audio/bg-music.mp3";
import crashSound from "./audio/crash.mp3";
import { useAuth } from "../context/AuthContext";

export default function FlappyBird() {
  const { user, reportScore } = useAuth();
  const player = useRef(user);
  useEffect(() => { player.current = user; }, [user]);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return;
    return initFlappy(score => {
      if (player.current) reportScore('flappybird', score).catch(() => {});
    });
  }, [booting, reportScore]);

  if (booting) {
    return (
      <div className="flappy-bird-page">
        <Navbar />
        <GameBoot
          title="Flappy Bird"
          subtitle="Loading pipes, gravity, and timing controls..."
        />
      </div>
    );
  }

  return (
    <div className="flappy-bird-page">
      <Navbar />

      <div className="top-ui">
        <button id="themeBtn">🌙</button>
        <button id="musicBtn">🔊</button>

        <audio id="bgMusic" loop src={bgMusic}></audio>
        <audio id="crashSound" src={crashSound}></audio>

        <select id="difficulty">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <div className="scoreboard">
          Score: <span id="score">0</span> | Best: <span id="best">0</span>
        </div>
      </div>

      <canvas id="game"></canvas>

      <div className="overlay" id="overlay">
        <h1>Flappy Bird</h1>
        <p>Press SPACE to start</p>
      </div>
    </div>
  );
}
