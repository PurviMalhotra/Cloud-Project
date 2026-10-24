import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./Pages/Dashboard";
import Minesweeper from "./Minesweeper/Minesweeper";
import Profile from "./Pages/Profile";
import Pacman from "./pacman/pacman";
import Login from "./Pages/Login";
import FlappyBird from "./FlappyBird/FlappyBird";
import Friends from "./Pages/Friends";
import Snake from "./Snake/Snake";
import TicTacToe from "./TicTacToe/tictactoe";
import Shooter from "./Shooter/shooter";
import LoadingScreen from "./Components/LoadingScreen";
import BrickBreaker from "./BrickBreaker/BrickBreaker";
import Pong from "./Pong/Pong";
import Tetris from "./Tetris/Tetris";

function App() {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 1600);

    return () => clearTimeout(timer);
  }, []);

  if (showLoader) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/:username" element={<Profile />} />
      <Route path="/minesweeper" element={<Minesweeper />} />
      <Route path="/pacman" element={<Pacman />} />
      <Route path="/login" element={<Login />} />
      <Route path="/flappybird" element={<FlappyBird />} />
      <Route path="/snake" element={<Snake />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/brick-breaker" element={<BrickBreaker />} />
      <Route path="/pong" element={<Pong />} />
      <Route path="/tetris" element={<Tetris />} />
      <Route path="/tictactoe" element={<TicTacToe />} />
      <Route path="/shooter" element={<Shooter />} />
    </Routes>
  );
}

export default App;
