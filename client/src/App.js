import logo from './logo.svg';
import './App.css';
import io from "socket.io-client"
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';

import Login from './pages/login';
import StartScreen from './pages/startScreen';
import CharacterCreation from './pages/characterCreation';
import CharacterSelection from './pages/characterSelection';
import Game from './pages/game';
import HomePage from './pages/homePage';
import SignUp from './pages/signUp';

// Correct socket connection string
const socket = io.connect("http://localhost:3001");

// Component for main menu


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/login" element={<Login />} />
        <Route path="/character-creation" element={<CharacterCreation />} />
        <Route path="/character-selection" element={<CharacterSelection />} />
        <Route path="/game" element={<Game socket={socket} />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/signup" element={<SignUp />} />

      </Routes>
    </Router>
  );
}

export default App;
