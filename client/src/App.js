import logo from './logo.svg';
import './App.css';
import { HashRouter  as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';

import Login from './pages/login';
import StartScreen from './pages/startScreen';
import CharacterCreation from './pages/characterCreation';
import CharacterSelection from './pages/characterSelection';
import Game from './pages/game';
import HomePage from './pages/homePage';
import SignUp from './pages/signUp';
import Lobby from './pages/lobby';
import LobbyCreation from './pages/lobbyCreation';
import LoreRule from './pages/loreRule';

import { SocketContext, socket } from './socket.io/context';
import React, { useEffect } from 'react';



function App() {

  useEffect(() => {

  socket.on("connect", () => {
    console.log("Connected with ID:", socket.id);
    console.log("try 2");
  });

  socket.on("welcome", (data) => {
    console.log("Server says:", data.message);
  });

 socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);
  });
  return () => {
    socket.off("connect");
  };
}, []);

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <Routes>
          <Route path="/" element={<StartScreen />} />
          <Route path="/login" element={<Login />} />
          <Route path="/character-creation" element={<CharacterCreation />} />
          <Route path="/character-selection" element={<CharacterSelection />} />
          <Route path="/game" element={<Game socket={socket} />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/lobby-creation" element={<LobbyCreation />} />
          <Route path="/lore-rule" element={<LoreRule />} />
          

        </Routes>
      </Router>
    </SocketContext.Provider>
  );
}

export default App;
