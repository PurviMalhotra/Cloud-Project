import { useState, useEffect, useCallback } from "react";
import "./pacman.css";
import Navbar from "../Components/Navbar";
import { useAuth } from "../context/AuthContext";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";

// Game board: 0=empty, 1=wall, 2=pellet
const createInitialBoard = () => [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 1, 0, 1, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const createInitialPlayer = () => ({ row: 5, col: 6, direction: "right" });
const createInitialGhosts = () => [
  { id: "ghost-1", row: 1, col: 1, behavior: "chase", label: "Chaser" },
  { id: "ghost-2", row: 1, col: 11, behavior: "random", label: "Wanderer" },
];

const MOVES = [
  { dr: -1, dc: 0, direction: "up" },
  { dr: 1, dc: 0, direction: "down" },
  { dr: 0, dc: -1, direction: "left" },
  { dr: 0, dc: 1, direction: "right" },
];

const isSameCell = (a, b) => a.row === b.row && a.col === b.col;

const getValidMoves = (row, col, board) =>
  MOVES.map((move) => ({
    row: row + move.dr,
    col: col + move.dc,
    direction: move.direction,
  })).filter(
    (move) =>
      move.row >= 0 &&
      move.row < board.length &&
      move.col >= 0 &&
      move.col < board[0].length &&
      board[move.row][move.col] !== 1,
  );

const getNextGhostState = (ghost, player, board) => {
  const validMoves = getValidMoves(ghost.row, ghost.col, board);
  if (validMoves.length === 0) return ghost;

  if (ghost.behavior === "chase") {
    const bestMove = validMoves.reduce((best, move) => {
      const moveDistance =
        Math.abs(move.row - player.row) + Math.abs(move.col - player.col);
      const bestDistance =
        Math.abs(best.row - player.row) + Math.abs(best.col - player.col);
      return moveDistance < bestDistance ? move : best;
    });

    return { ...ghost, row: bestMove.row, col: bestMove.col };
  }

  const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
  return { ...ghost, row: randomMove.row, col: randomMove.col };
};

export default function Pacman() {
  const { user, reportScore } = useAuth();
  const [player, setPlayer] = useState(createInitialPlayer());
  const [ghosts, setGhosts] = useState(createInitialGhosts());
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [grid, setGrid] = useState(createInitialBoard());
  const [gameState, setGameState] = useState("playing");
  const [highScore, setHighScore] = useState(0);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  const resetPositions = useCallback(() => {
    setPlayer(createInitialPlayer());
    setGhosts(createInitialGhosts());
  }, []);

  const handleCollision = useCallback(() => {
    if (gameState !== "playing") return;

    if (lives <= 1) {
      setLives(0);
      setGameState("over");
      return;
    }

    setLives((prev) => prev - 1);
    resetPositions();
  }, [gameState, lives, resetPositions]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      if (booting || gameState !== "playing") return;

      let { row, col } = player;
      let newRow = row;
      let newCol = col;
      let direction = player.direction;

      if (e.key === "ArrowUp") {
        newRow--;
        direction = "up";
      } else if (e.key === "ArrowDown") {
        newRow++;
        direction = "down";
      } else if (e.key === "ArrowLeft") {
        newCol--;
        direction = "left";
      } else if (e.key === "ArrowRight") {
        newCol++;
        direction = "right";
      } else {
        return;
      }

      // Check bounds and walls
      if (
        newRow < 0 ||
        newRow >= grid.length ||
        newCol < 0 ||
        newCol >= grid[0].length
      )
        return;
      if (grid[newRow][newCol] === 1) return;

      const nextPlayer = { row: newRow, col: newCol, direction };

      // Collide with ghost
      if (ghosts.some((ghost) => isSameCell(ghost, nextPlayer))) {
        handleCollision();
        return;
      }

      // Eat pellets
      if (grid[newRow][newCol] === 2) {
        const points = 10;
        const nextScore = score + points;
        const newGrid = grid.map((r) => [...r]);
        newGrid[newRow][newCol] = 0;

        const remainingPellets = newGrid
          .flat()
          .filter((cell) => cell === 2).length;

        setGrid(newGrid);
        setScore(nextScore);

        if (user) {
          reportScore("pacman", points).catch(() => {
            console.error;
          });
        }

        if (remainingPellets === 0) {
          setGameState("won");
          setHighScore((prev) => Math.max(prev, nextScore));
        }
      }

      setPlayer(nextPlayer);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [booting, player, ghosts, grid, gameState, user, handleCollision, reportScore, score]);

  // Ghost movement loop
  useEffect(() => {
    if (booting || gameState !== "playing") return;

    const timer = setTimeout(() => {
      const movedGhosts = ghosts.map((ghost) =>
        getNextGhostState(ghost, player, grid),
      );

      if (movedGhosts.some((ghost) => isSameCell(ghost, player))) {
        handleCollision();
        return;
      }

      setGhosts(movedGhosts);
    }, 300);

    return () => clearTimeout(timer);
  }, [booting, ghosts, player, grid, gameState, handleCollision]);

  const resetGame = () => {
    setPlayer(createInitialPlayer());
    setGhosts(createInitialGhosts());
    setLives(3);
    setScore(0);
    setGrid(createInitialBoard());
    setGameState("playing");
  };

  if (booting) {
    return (
      <div className="pacman-page">
        <Navbar />
        <GameBoot
          title="Pac-Man"
          subtitle="Loading maze, pellets, and ghosts..."
        />
      </div>
    );
  }

  return (
    <div className="pacman-page">
      <Navbar />

      <div className="pacman-game-container">
        <div className="pacman-game-header">
          <div className="pacman-score-board">
            <div className="pacman-stat-pill">Score: {score}</div>
            <div className="pacman-stat-pill">Best: {highScore}</div>
            <div className="pacman-stat-pill">Lives: {lives}</div>
          </div>

          {gameState === "won" && (
            <div className="pacman-message won">
              You Win!
              <button onClick={resetGame}>New Game</button>
            </div>
          )}

          {gameState === "over" && (
            <div className="pacman-message">
              Game Over
              <button onClick={resetGame}>Try Again</button>
            </div>
          )}
        </div>

        <div className="pacman-board-shell">
          <div className="pacman-board-legend">
            {ghosts.map((ghost) => (
              <span key={ghost.id} className="pacman-legend-chip">
                <span className={`ghost-dot ghost-${ghost.behavior}`} />
                {ghost.label}
              </span>
            ))}
          </div>

          <div className="board">
            {grid.map((row, i) =>
              row.map((cell, j) => {
                let className = "cell";
                const ghostOnCell = ghosts.find(
                  (ghost) => ghost.row === i && ghost.col === j,
                );

                if (cell === 1) className += " wall";
                if (cell === 2) className += " pellet";

                if (player.row === i && player.col === j) {
                  className += ` pacman pacman-${player.direction}`;
                }

                return (
                  <div key={`${i}-${j}`} className={className}>
                    {ghostOnCell && !(player.row === i && player.col === j) ? (
                      <span className={`ghost ghost-${ghostOnCell.behavior}`} />
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className="pacman-controls">
          <p>Use arrow keys to move. Avoid the ghosts.</p>
        </div>
      </div>
    </div>
  );
}
