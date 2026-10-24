import { useAuth } from "../context/AuthContext";
import { useEffect, useRef, useState } from "react";
import Navbar from "../Components/Navbar";
import GameBoot from "../Components/GameBoot";
import "../Components/GameBoot.css";
import "./TicTacToe.css";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function getWinner(board) {
  for (let index = 0; index < WIN_LINES.length; index += 1) {
    const [a, b, c] = WIN_LINES[index];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getAvailableMoves(board) {
  return board
    .map((value, index) => (value ? null : index))
    .filter((value) => value !== null);
}

function minimax(board, aiSymbol, humanSymbol, isAiTurn) {
  const winner = getWinner(board);

  if (winner === aiSymbol) return 10;
  if (winner === humanSymbol) return -10;

  const availableMoves = getAvailableMoves(board);
  if (!availableMoves.length) return 0;

  if (isAiTurn) {
    let best = -Infinity;
    for (let i = 0; i < availableMoves.length; i += 1) {
      const move = availableMoves[i];
      const copy = [...board];
      copy[move] = aiSymbol;
      best = Math.max(best, minimax(copy, aiSymbol, humanSymbol, false));
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < availableMoves.length; i += 1) {
    const move = availableMoves[i];
    const copy = [...board];
    copy[move] = humanSymbol;
    best = Math.min(best, minimax(copy, aiSymbol, humanSymbol, true));
  }
  return best;
}

function getBestAiMove(board, aiSymbol = "O", humanSymbol = "X") {
  const availableMoves = getAvailableMoves(board);
  let bestScore = -Infinity;
  let bestMove = availableMoves[0] ?? -1;

  for (let i = 0; i < availableMoves.length; i += 1) {
    const move = availableMoves[i];
    const copy = [...board];
    copy[move] = aiSymbol;
    const score = minimax(copy, aiSymbol, humanSymbol, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function createInitialState() {
  return {
    mode: "ai",
    board: Array(9).fill(null),
    turn: "X",
    winner: null,
    draw: false,
    score: {
      X: 0,
      O: 0,
      draws: 0,
    },
  };
}

function applyMove(game, index) {
  if (index < 0 || index > 8 || game.board[index] || game.winner || game.draw) {
    return game;
  }

  const board = [...game.board];
  board[index] = game.turn;

  const winner = getWinner(board);
  const draw = !winner && board.every(Boolean);

  if (winner) {
    return {
      ...game,
      board,
      winner,
      draw: false,
      score: {
        ...game.score,
        [winner]: game.score[winner] + 1,
      },
    };
  }

  if (draw) {
    return {
      ...game,
      board,
      draw: true,
      score: {
        ...game.score,
        draws: game.score.draws + 1,
      },
    };
  }

  return {
    ...game,
    board,
    turn: game.turn === "X" ? "O" : "X",
  };
}

export default function TicTacToe() {
  const [booting, setBooting] = useState(true);
  const [game, setGame] = useState(createInitialState);
  const { user, reportScore } = useAuth();
  const reported = useRef(false);
  useEffect(() => {
    const finished = game.mode === "ai" && game.winner === "X";
    if (!finished) { reported.current = false; return; }
    if (reported.current || !user) return;
    reported.current = true;
    reportScore('tictactoe', 50).catch(() => {});
  }, [game, user, reportScore]);


  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return undefined;
    if (game.mode !== "ai" || game.turn !== "O" || game.winner || game.draw) {
      return undefined;
    }

    const snapshot = game.board.join("");
    const timer = setTimeout(() => {
      setGame((previous) => {
        if (
          previous.mode !== "ai" ||
          previous.turn !== "O" ||
          previous.winner ||
          previous.draw ||
          previous.board.join("") !== snapshot
        ) {
          return previous;
        }

        const bestMove = getBestAiMove(previous.board, "O", "X");
        return applyMove(previous, bestMove);
      });
    }, 320);

    return () => clearTimeout(timer);
  }, [booting, game]);

  const changeMode = (mode) => {
    setGame((previous) => ({
      ...previous,
      mode,
      board: Array(9).fill(null),
      turn: "X",
      winner: null,
      draw: false,
    }));
  };

  const restartRound = () => {
    setGame((previous) => ({
      ...previous,
      board: Array(9).fill(null),
      turn: "X",
      winner: null,
      draw: false,
    }));
  };

  const resetMatch = () => {
    setGame((previous) => ({
      ...previous,
      board: Array(9).fill(null),
      turn: "X",
      winner: null,
      draw: false,
      score: {
        X: 0,
        O: 0,
        draws: 0,
      },
    }));
  };

  const statusText = game.winner
    ? `${game.winner} wins this round`
    : game.draw
      ? "Draw"
      : `Turn: ${game.turn}`;

  if (booting) {
    return (
      <div className="ttt-page">
        <Navbar />
        <GameBoot title="Tic Tac Toe" subtitle="Loading board, rules, and AI strategy..." />
      </div>
    );
  }

  return (
    <div className="ttt-page">
      <Navbar />

      <div className="ttt-container">
        <header className="ttt-header">
          <h1>Tic Tac Toe</h1>
          <div className="ttt-mode-switch">
            <button
              className={game.mode === "ai" ? "active" : ""}
              onClick={() => changeMode("ai")}
            >
              Player vs AI
            </button>
            <button
              className={game.mode === "pvp" ? "active" : ""}
              onClick={() => changeMode("pvp")}
            >
              Player vs Player
            </button>
          </div>
        </header>

        <div className="ttt-scorebar">
          <span>X: {game.score.X}</span>
          <span>O: {game.score.O}</span>
          <span>Draws: {game.score.draws}</span>
        </div>

        <p className="ttt-status">{statusText}</p>

        <div className="ttt-grid" role="grid" aria-label="Tic Tac Toe board">
          {game.board.map((cell, index) => (
            <button
              key={index}
              className="ttt-cell"
              onClick={() => setGame((previous) => applyMove(previous, index))}
              disabled={Boolean(cell) || Boolean(game.winner) || game.draw}
            >
              {cell || ""}
            </button>
          ))}
        </div>

        <div className="ttt-actions">
          <button onClick={restartRound}>Restart Round</button>
          <button onClick={resetMatch}>Reset Match</button>
        </div>
      </div>
    </div>
  );
}
