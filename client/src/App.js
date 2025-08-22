import logo from './logo.svg';
import './App.css';
import { HashRouter  as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './handlers/protectedRoutes';

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
import Test from './pages/test'

import { SocketContext, socket } from './socket.io/context';
import { useEffect } from 'react';

import OneCCCustomize from './pages/chacterCreatorSubfolder/1_CC_Custoumize';



function App() {

  useEffect(() => {

  socket.on("connect", () => {
    console.log("Connected with ID:", socket.id);
    sessionStorage.setItem("session_ID", socket.id.toString());
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
          <Route path="/signup" element={<SignUp />} />
          <Route path ="/test" element={<Test />}    />
          <Route path ="/ISK/:sessionID" element={<ProtectedRoute />}> 

            <Route path="home" element={<HomePage />} />
            <Route path="lore-rule" element={<LoreRule />} />
            <Route path="character-selection" element={<CharacterSelection />} />
            <Route path="character-creation" element={<CharacterCreation />} />


            <Route path="character-creation/customize" element={<OneCCCustomize />} />
            <Route path="game" element={<Game socket={socket} />} />
            <Route path="lobby" element={<Lobby />} />
            <Route path="lobby-creation" element={<LobbyCreation />} />
          </Route>
          
          

        </Routes>
      </Router>
    </SocketContext.Provider>
  );
}

export default App;
