import { useEffect, useMemo, useState } from "react";
import "./Minesweeper.css";
import Navbar from "../Components/Navbar";
import { useAuth } from "../context/AuthContext";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";

const SIZE = 8;
const MINES = 10;
const SAFE_CELLS = SIZE * SIZE - MINES;

function generateBoard() {
  const board = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({
      mine: false,
      revealed: false,
      count: 0,
    })),
  );

  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed += 1;
    }
  }

  const dirs = [-1, 0, 1];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c].mine) continue;

      let count = 0;
      dirs.forEach((dr) =>
        dirs.forEach((dc) => {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nc >= 0 &&
            nr < SIZE &&
            nc < SIZE &&
            board[nr][nc].mine
          ) {
            count += 1;
          }
        }),
      );

      board[r][c].count = count;
    }
  }

  return board;
}

function revealFlood(board, startR, startC) {
  const queue = [[startR, startC]];
  let revealedSafeCells = 0;

  while (queue.length) {
    const [r, c] = queue.shift();
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;

    const cell = board[r][c];
    if (cell.revealed) continue;

    cell.revealed = true;

    if (cell.mine) continue;

    revealedSafeCells += 1;

    if (cell.count === 0) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr !== 0 || dc !== 0) {
            queue.push([r + dr, c + dc]);
          }
        }
      }
    }
  }

  return revealedSafeCells;
}

export default function Minesweeper() {
  const { user, reportScore } = useAuth();

  const [booting, setBooting] = useState(true);
  const [board, setBoard] = useState(generateBoard);
  const [status, setStatus] = useState("playing");
  const [score, setScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  const revealedSafeCells = useMemo(
    () => board.flat().filter((cell) => cell.revealed && !cell.mine).length,
    [board],
  );

  const reveal = (r, c) => {
    if (status !== "playing") return;
    if (board[r][c].revealed) return;

    const nextBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    const selected = nextBoard[r][c];

    if (selected.mine) {
      nextBoard.forEach((row) => {
        row.forEach((cell) => {
          if (cell.mine) cell.revealed = true;
        });
      });

      setBoard(nextBoard);
      setStatus("lost");
      return;
    }

    const newlyRevealed = revealFlood(nextBoard, r, c);
    const points = newlyRevealed * 5;

    if (points > 0) {
      setScore((previous) => previous + points);

      if (user) {
        reportScore("minesweeper", points).catch(() => {
          console.error;
        });
      }
    }

    const nextRevealed = nextBoard
      .flat()
      .filter((cell) => cell.revealed && !cell.mine).length;

    setBoard(nextBoard);

    if (nextRevealed >= SAFE_CELLS) {
      setStatus("won");
    }
  };

  const reset = () => {
    setBoard(generateBoard());
    setStatus("playing");
    setScore(0);
  };

  const statusLabel =
    status === "won"
      ? "You cleared the board"
      : status === "lost"
        ? "Mine hit"
        : "In progress";

  if (booting) {
    return (
      <div className="ms-page">
        <Navbar />
        <GameBoot
          title="Minesweeper"
          subtitle="Loading mines and clue map..."
        />
      </div>
    );
  }

  return (
    <div className="ms-page">
      <Navbar />

      <div className="ms-container">
        <header className="ms-header">
          <h1>Minesweeper</h1>
          <div className="ms-stats">
            <span>Score: {score}</span>
            <span>
              Safe: {revealedSafeCells}/{SAFE_CELLS}
            </span>
            <span>Mines: {MINES}</span>
          </div>
          <p className={`ms-status ms-status-${status}`}>{statusLabel}</p>
        </header>

        <div
          className="ms-grid"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(32px, 42px))` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => reveal(r, c)}
                className={`ms-cell ${cell.revealed ? "revealed" : ""} ${
                  cell.revealed && cell.mine ? "mine" : ""
                }`}
                disabled={status !== "playing" || cell.revealed}
              >
                {cell.revealed && (cell.mine ? "X" : cell.count || "")}
              </button>
            )),
          )}
        </div>

        <button className="ms-reset-btn" onClick={reset}>
          Restart
        </button>
      </div>
    </div>
  );
}
