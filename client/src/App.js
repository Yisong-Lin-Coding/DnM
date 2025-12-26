import logo from './logo.svg';
import './App.css';
import { HashRouter  as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './handlers/protectedRoutes';

import Login from './pages/login';
import StartScreen from './pages/startScreen';
import HomePage from './pages/homePage';
import SignUp from './pages/signUp';
import Test from './pages/test'
import Test2 from './pages/test2'

import CharacterMenu from './pages/characters/characterMenu';
import CharacterCreation from './pages/characters/characterCreation'

import { SocketContext, socket } from './socket.io/context';
import { useEffect } from 'react';



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

    if(localStorage.getItem("player_ID")){
      socket.emit("playerData_logOff", { playerID: localStorage.getItem("player_ID") });
    }

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
        <Route path="/test" element={<Test />} />
        <Route path="/test2" element={<Test2 />} />
        <Route path="/ISK/:sessionID" element={<ProtectedRoute />}> 
          <Route path="home" element={<HomePage />} />
          <Route path="character-menu" element={<CharacterMenu />} />
          <Route path="character-creation" element ={<CharacterCreation />} />
        </Route>
      </Routes>
    </Router>
    </SocketContext.Provider>
  );
}

export default App;
