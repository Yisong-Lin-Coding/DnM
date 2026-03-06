import './App.css';
import { HashRouter  as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './handlers/protectedRoutes';
import { GameProvider } from './data/gameContext';

import Login from './pages/login';
import StartScreen from './pages/startScreen';
import HomePage from './pages/homePage';
import SignUp from './pages/signUp';
import Test from './pages/test'
import Test2 from './pages/test2'
import Setting from './pages/setting';
import LoreMenu from './pages/lore/loreMenu';
import GameComponent from './pages/game/game'
import LobbyLayout from './pages/campaign/lobbyLayout';
import LobbyMenu from './pages/campaign/campaignMenu';
import JoinLobby from './pages/campaign/joinCampaign';
import CreateLobby from './pages/campaign/createCampaign';

import CharacterMenu from './pages/characters/characterMenu';
import CharacterCreation from './pages/characters/characterCreation'
import CharacterViewer from './pages/characters/characterViewer';

import { SocketContext, createSocket, getSocketUrls } from './socket.io/context';
import { useEffect, useMemo, useRef, useState } from 'react';



function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const socketUrls = useMemo(() => getSocketUrls(), []);
  const [socket, setSocket] = useState(() => createSocket(socketUrls[0]));
  const socketRef = useRef(socket);
  const urlIndexRef = useRef(0);

  function GameWrapper() {
  return (
    <GameProvider>
      <GameComponent />
    </GameProvider>
  );
}


  useEffect(() => {
    let disposed = false;

    const disposeSocket = (activeSocket) => {
      if (!activeSocket) return;
      activeSocket.off("connect");
      activeSocket.off("disconnect");
      activeSocket.off("welcome");
      activeSocket.off("connect_error");
      activeSocket.disconnect();
    };

    const attachSocketListeners = (activeSocket, activeUrl) => {
      if (!activeSocket) return;

      console.log(`Attempting to connect to socket at ${activeUrl}...`);

      activeSocket.on("connect", () => {
        console.log("Connected with ID:", activeSocket.id);
        const existingSessionID = sessionStorage.getItem("session_ID");
        const stableSessionID = existingSessionID || activeSocket.id.toString();
        if (!existingSessionID) {
          sessionStorage.setItem("session_ID", stableSessionID);
        }

        const playerID = localStorage.getItem("player_ID");
        if (playerID) {
          activeSocket.emit("login_tokenSave", { playerID, sessionID: stableSessionID }, () => {});
          activeSocket.emit("playerData_logOn", { playerID });
        }
        setIsConnected(true);
        setConnectionError(null);
      });

      activeSocket.on("disconnect", (reason) => {
        console.log("Disconnected:", reason);
        setIsConnected(false);
      });

      activeSocket.on("welcome", (data) => {
        console.log("Server says:", data.message);
      });

      activeSocket.on("connect_error", (err) => {
        if (disposed) return;
        const currentIndex = urlIndexRef.current;
        const nextIndex = currentIndex + 1;
        if (nextIndex < socketUrls.length) {
          const nextUrl = socketUrls[nextIndex];
          console.warn(`Socket error on ${activeUrl}:`, err.message);
          setConnectionError(`Failed to connect to ${activeUrl}. Trying ${nextUrl}...`);

          disposeSocket(activeSocket);
          const nextSocket = createSocket(nextUrl);
          urlIndexRef.current = nextIndex;
          socketRef.current = nextSocket;
          setSocket(nextSocket);
          attachSocketListeners(nextSocket, nextUrl);
          nextSocket.connect();
          return;
        }

        console.error("Socket connection error:", err.message);
        setConnectionError(err.message);
        setIsConnected(false);
      });
    };

    const initialUrl = socketUrls[0];
    const initialSocket = socketRef.current || createSocket(initialUrl);
    socketRef.current = initialSocket;
    setSocket(initialSocket);
    attachSocketListeners(initialSocket, initialUrl);

    if (!initialSocket.connected) {
      initialSocket.connect();
    }

    return () => {
      disposed = true;
      const activeSocket = socketRef.current;
      if (activeSocket?.connected && localStorage.getItem("player_ID")) {
        activeSocket.emit("playerData_logOff", { playerID: localStorage.getItem("player_ID") });
      }
      disposeSocket(activeSocket);
    };
  }, [socketUrls]);

  return (
    <SocketContext.Provider value={socket}>
      {/* Optional: Show connection status */}
      {connectionError && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'orange',
          color: 'white',
          padding: '10px',
          textAlign: 'center',
          zIndex: 9999
        }}>
          Connection Error: {connectionError}. Retrying...
        </div>
      )}
      
      <Router>
        <Routes>
          <Route path="/" element={<StartScreen />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/settings" element={<Setting />} />
          <Route path="/test" element={<Test />} />
          <Route path="/test2" element={<Test2 />} />
          <Route path="/ISK/:sessionID" element={<ProtectedRoute />}> 
            <Route path="home" element={<HomePage />} />
            <Route path="settings" element={<Setting />} />
            <Route path="lore" element={<LoreMenu />} />
            <Route path="lore/:topic" element={<LoreMenu />} />

            <Route path="character">
              <Route index element={<CharacterMenu />}/>
              <Route path="creation" element={<CharacterCreation />} />
              <Route path="view/:characterID" element={<CharacterViewer />} />
              <Route path="edit/:characterID" element={<CharacterCreation />} />
            </Route>

            <Route path="lobby" element ={<LobbyLayout />}>
              <Route index element ={<LobbyMenu />} />
              <Route path="menu" element ={<LobbyMenu />} />
              <Route path="join" element ={<JoinLobby />} />
              <Route path="create" element ={<CreateLobby />} />
              
            </Route>
            <Route path="game/:gameID" element ={<GameWrapper  />} />

          </Route>
        </Routes>
      </Router>
    </SocketContext.Provider>
  );
}


export default App;
