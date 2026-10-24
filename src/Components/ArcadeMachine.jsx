import { useState } from "react";
import "./ArcadeMachine.css";
import { useNavigate } from "react-router-dom";

const DEFAULT_GAMES = [
  { title: "GALAGA", genre: "SHOOTER" },
  { title: "DONKEY KONG", genre: "PLATFORM" },
  { title: "PAC-MAN", genre: "MAZE" },
  { title: "STREET FIGHTER", genre: "FIGHTER" },
  { title: "SPACE INVADERS", genre: "SHOOTER" },
  { title: "FROGGER", genre: "ACTION" },
  { title: "DIG DUG", genre: "ACTION" },
  { title: "CENTIPEDE", genre: "SHOOTER" },
  { title: "ASTEROIDS", genre: "SHOOTER" },
  { title: "TRON", genre: "ACTION" },
];

export default function ArcadeMachine({ games = DEFAULT_GAMES }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [credits, setCredits] = useState(3);
  const [screenText, setScreenText] = useState("INSERT COIN");
  const [screenLabel, setScreenLabel] = useState("// SELECT GAME //");
  const [screenScore, setScreenScore] = useState(null);
  const [hint, setHint] = useState("TAP TO SPIN");
  const [spinning, setSpinning] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [path, setPath] = useState("");
  const navigate = useNavigate();

  const getRandomGame = () => games[Math.floor(Math.random() * games.length)];
  const getRandomScore = () => Math.floor(Math.random() * 500) + 10;

  const spinMachine = () => {
    if (isSpinning) return;

    if (credits <= 0) {
      setScreenText("NO CREDITS!");
      setSpinning(true);
      setTimeout(() => {
        setScreenText("INSERT COIN");
        setSpinning(false);
      }, 1200);
      return;
    }

    const newCredits = credits - 1;
    setCredits(newCredits);
    setIsSpinning(true);
    setGlowing(true);
    setSpinning(true);
    setScreenScore(null);
    setHint(null);
    setScreenLabel("// SPINNING... //");

    let counter = 0;
    const interval = setInterval(() => {
      const g = getRandomGame();
      setScreenText(g.title);
      counter++;

      if (counter > 18) {
        clearInterval(interval);
        const final = getRandomGame();
        const score = getRandomScore();

        setScreenText(final.title);
        setScreenLabel("// RESULT //");
        setScreenScore(`GOAL: ${score.toLocaleString()} PTS`);
        setHint(newCredits > 0 ? "TAP TO SPIN" : "NO CREDITS");
        setSpinning(false);
        setGlowing(false);
        setIsSpinning(false);
        setPath(final.path);
      }
    }, 90);
  };

  const goToGame = () => {
    if (path != "") {
      navigate(path);
    }
  };

  const resetMachine = () => {
    if (isSpinning) return;
    setCredits(3);
    setScreenText("INSERT COIN");
    setScreenLabel("// SELECT GAME //");
    setScreenScore(null);
    setHint("TAP TO SPIN");
    setSpinning(false);
    setGlowing(false);
  };

  return (
    <div className="cabinet">
      {/* MARQUEE */}
      <div className="marquee">
        <div className="marquee-title">ARCADE</div>
        <div className="marquee-sub">★ ULTRA ★</div>
      </div>

      {/* BODY */}
      <div className="cabinet-body">
        {/* Screen bezel */}
        <div className="screen-bezel">
          <div
            className={`arcade-screen ${glowing ? "glow" : ""}`}
            onClick={spinMachine}
          >
            <div className="screen-content">
              <div className="screen-label">{screenLabel}</div>
              <div className={`screen-text ${spinning ? "spinning" : ""}`}>
                {screenText}
              </div>
              {screenScore && <div className="screen-score">{screenScore}</div>}
              {hint && <div className="screen-hint">{hint}</div>}
            </div>
          </div>
        </div>

        {/* Coin slot */}
        <div className="coin-slot-area">
          <div>
            <div className="coin-slot" />
            <div style={{ height: 14 }} />
          </div>
          <div className="credit-display">CREDITS: {credits}</div>
        </div>
      </div>

      {/* CONTROLS PANEL */}
      <div className="controls-panel">
        <div className="joystick-row">
          <div className="joystick-base">
            <div className="joystick-stick" />
          </div>

          <div className="player-label">
            <div className="player-label-text">PLAYER 1</div>
            <div className="player-divider" />
          </div>

          <div className="buttons-cluster">
            {["red", "yellow", "blue", "purple", "green", "orange"].map(
              (color) => (
                <div key={color} className={`btn-arcade btn-${color}`} />
              ),
            )}
          </div>
        </div>

        <div className="start-row">
          <button className="btn-start" onClick={goToGame}>
            TAKE ME
          </button>
          <button className="btn-start spin-btn" onClick={spinMachine}>
            ★ SPIN ★
          </button>
          <button className="btn-start" onClick={resetMachine}>
            RESET
          </button>
        </div>
      </div>

      {/* BASE */}
      <div className="cabinet-base">
        <SpeakerGrill />
        <div className="base-logo">
          PIXEL
          <br />
          LABS
        </div>
        <SpeakerGrill />
      </div>
    </div>
  );
}

function SpeakerGrill() {
  return (
    <div className="speaker-grill">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="speaker-dot" />
      ))}
    </div>
  );
}
