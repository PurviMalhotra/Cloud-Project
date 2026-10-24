import { useAuth } from "../context/AuthContext";
import { useEffect, useRef, useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";
import "./Tetris.css";

const COLS = 10;
const ROWS = 20;

const PIECES = [
  { type: "I", color: "#61d8ff", shape: [[1, 1, 1, 1]] },
  {
    type: "J",
    color: "#6f8dff",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  {
    type: "L",
    color: "#ffb25c",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
  {
    type: "O",
    color: "#ffe66d",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    type: "S",
    color: "#7ef5a8",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    type: "T",
    color: "#ca93ff",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    type: "Z",
    color: "#ff8699",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
];

function cloneShape(shape) {
  return shape.map((row) => [...row]);
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    type: piece.type,
    color: piece.color,
    shape: cloneShape(piece.shape),
    row: -1,
    col: Math.floor((COLS - piece.shape[0].length) / 2),
  };
}

function canPlace(board, piece, row, col, shape = piece.shape) {
  for (let y = 0; y < shape.length; y += 1) {
    for (let x = 0; x < shape[y].length; x += 1) {
      if (!shape[y][x]) continue;

      const nextX = col + x;
      const nextY = row + y;

      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
        return false;
      }

      if (nextY >= 0 && board[nextY][nextX]) {
        return false;
      }
    }
  }

  return true;
}

function rotateClockwise(shape) {
  return shape[0].map((_, index) =>
    shape.map((row) => row[index]).reverse(),
  );
}

function clearCompletedLines(board) {
  let cleared = 0;

  const filtered = board.filter((row) => {
    const full = row.every(Boolean);
    if (full) cleared += 1;
    return !full;
  });

  while (filtered.length < ROWS) {
    filtered.unshift(Array(COLS).fill(null));
  }

  return { board: filtered, cleared };
}

function lockPiece(game) {
  const mergedBoard = game.board.map((row) => [...row]);

  game.piece.shape.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      const boardY = game.piece.row + y;
      const boardX = game.piece.col + x;
      if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        mergedBoard[boardY][boardX] = game.piece.color;
      }
    });
  });

  const { board: nextBoard, cleared } = clearCompletedLines(mergedBoard);
  const totalLines = game.lines + cleared;
  const nextLevel = 1 + Math.floor(totalLines / 10);
  const lineScore = [0, 100, 300, 500, 800][cleared] || 0;

  const activePiece = {
    ...game.nextPiece,
    row: -1,
    col: Math.floor((COLS - game.nextPiece.shape[0].length) / 2),
  };

  const canSpawn = canPlace(nextBoard, activePiece, activePiece.row, activePiece.col);

  return {
    ...game,
    board: nextBoard,
    piece: activePiece,
    nextPiece: randomPiece(),
    score: game.score + lineScore * game.level,
    lines: totalLines,
    level: nextLevel,
    status: canSpawn ? "playing" : "gameover",
  };
}

function createInitialGame() {
  return {
    board: createEmptyBoard(),
    piece: randomPiece(),
    nextPiece: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    status: "playing",
  };
}

function renderBoard(board, piece) {
  const rendered = board.map((row) => [...row]);

  piece.shape.forEach((shapeRow, y) => {
    shapeRow.forEach((filled, x) => {
      if (!filled) return;
      const boardY = piece.row + y;
      const boardX = piece.col + x;
      if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        rendered[boardY][boardX] = piece.color;
      }
    });
  });

  return rendered;
}

export default function Tetris() {
  const [booting, setBooting] = useState(true);
  const [game, setGame] = useState(createInitialGame);
  const { user, reportScore } = useAuth();
  const reported = useRef(false);
  useEffect(() => {
    const finished = game.status === "gameover";
    if (!finished) { reported.current = false; return; }
    if (reported.current || !user || game.score <= 0) return;
    reported.current = true;
    reportScore('tetris', game.score).catch(() => {});
  }, [game, user, reportScore]);


  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting || game.status !== "playing") return undefined;

    const speed = Math.max(90, 720 - (game.level - 1) * 55);

    const interval = setInterval(() => {
      setGame((previous) => {
        if (previous.status !== "playing") return previous;

        if (
          canPlace(
            previous.board,
            previous.piece,
            previous.piece.row + 1,
            previous.piece.col,
          )
        ) {
          return {
            ...previous,
            piece: { ...previous.piece, row: previous.piece.row + 1 },
          };
        }

        return lockPiece(previous);
      });
    }, speed);

    return () => clearInterval(interval);
  }, [booting, game.level, game.status]);

  useEffect(() => {
    if (booting) return undefined;

    const onKeyDown = (event) => {
      setGame((previous) => {
        if (previous.status !== "playing") return previous;

        const key = event.key;

        if (key === "ArrowLeft") {
          if (
            canPlace(
              previous.board,
              previous.piece,
              previous.piece.row,
              previous.piece.col - 1,
            )
          ) {
            return {
              ...previous,
              piece: { ...previous.piece, col: previous.piece.col - 1 },
            };
          }
          return previous;
        }

        if (key === "ArrowRight") {
          if (
            canPlace(
              previous.board,
              previous.piece,
              previous.piece.row,
              previous.piece.col + 1,
            )
          ) {
            return {
              ...previous,
              piece: { ...previous.piece, col: previous.piece.col + 1 },
            };
          }
          return previous;
        }

        if (key === "ArrowDown") {
          if (
            canPlace(
              previous.board,
              previous.piece,
              previous.piece.row + 1,
              previous.piece.col,
            )
          ) {
            return {
              ...previous,
              score: previous.score + 1,
              piece: { ...previous.piece, row: previous.piece.row + 1 },
            };
          }

          return lockPiece(previous);
        }

        if (key === "ArrowUp") {
          const rotated = rotateClockwise(previous.piece.shape);
          const kicks = [0, -1, 1, -2, 2];

          for (let index = 0; index < kicks.length; index += 1) {
            const offset = kicks[index];
            if (
              canPlace(
                previous.board,
                previous.piece,
                previous.piece.row,
                previous.piece.col + offset,
                rotated,
              )
            ) {
              return {
                ...previous,
                piece: {
                  ...previous.piece,
                  shape: rotated,
                  col: previous.piece.col + offset,
                },
              };
            }
          }

          return previous;
        }

        if (key === " ") {
          let dropped = previous;
          while (
            canPlace(
              dropped.board,
              dropped.piece,
              dropped.piece.row + 1,
              dropped.piece.col,
            )
          ) {
            dropped = {
              ...dropped,
              score: dropped.score + 2,
              piece: { ...dropped.piece, row: dropped.piece.row + 1 },
            };
          }
          return lockPiece(dropped);
        }

        return previous;
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [booting]);

  const displayBoard = useMemo(() => renderBoard(game.board, game.piece), [game.board, game.piece]);

  const restart = () => {
    setGame(createInitialGame());
  };

  if (booting) {
    return (
      <div className="tetris-page">
        <Navbar />
        <GameBoot title="Tetris" subtitle="Loading tetromino matrix and line clear logic..." />
      </div>
    );
  }

  return (
    <div className="tetris-page">
      <Navbar />

      <div className="tetris-container">
        <div className="tetris-main">
          <header className="tetris-header">
            <h1>Tetris</h1>
            <div className="tetris-stats">
              <span>Score: {game.score}</span>
              <span>Lines: {game.lines}</span>
              <span>Level: {game.level}</span>
            </div>
          </header>

          <div className="tetris-board" role="grid" aria-label="Tetris board">
            {displayBoard.flat().map((cell, index) => (
              <div
                key={index}
                className="tetris-cell"
                style={{ background: cell || "#11182d" }}
              />
            ))}
          </div>

          <div className="tetris-actions">
            <button onClick={restart}>Restart</button>
            <p>Arrow keys to move, Up to rotate, Space to hard drop</p>
          </div>
        </div>

        <aside className="tetris-side">
          <div className="next-piece-card">
            <h2>Next</h2>
            <div className="next-piece-grid">
              {Array.from({ length: 16 }).map((_, index) => {
                const y = Math.floor(index / 4);
                const x = index % 4;
                const cell = game.nextPiece.shape[y]?.[x];
                return (
                  <div
                    key={index}
                    className="next-piece-cell"
                    style={{ background: cell ? game.nextPiece.color : "#11182d" }}
                  />
                );
              })}
            </div>
          </div>

          {game.status === "gameover" && (
            <div className="tetris-over">Game Over</div>
          )}
        </aside>
      </div>
    </div>
  );
}
