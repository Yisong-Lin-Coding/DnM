import { useNavigate } from 'react-router-dom';
import '../Pages.css'
import { SocketContext } from '../socket.io/context';
import { useContext, useEffect } from "react";
import getImage from '../handlers/getImage';

const getSessionID = () => sessionStorage.getItem("session_ID");

function HomePage() {
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  const navigateTo = (path) => {
    const sessionID = getSessionID();
    if (!sessionID) {
      navigate("/login");
      return;
    }
    navigate(`/ISK/${sessionID}${path}`);
  };

  const goToLore = () => {
    navigateTo("/lore");
  };

  const goToCampaign = () => {
    navigateTo("/lobby");
  };

  const goToCharacters = () => {
    navigateTo("/character");
  };

  const handleExit = () => {
    const playerID = localStorage.getItem("player_ID");
    if (playerID) {
      socket.emit("playerData_logOff", { playerID });
    }

    localStorage.removeItem("player_ID");
    localStorage.removeItem("player_username");
    sessionStorage.removeItem("session_ID");
    sessionStorage.removeItem("adminPermission");
    sessionStorage.removeItem("lastLocation");
    navigate("/login");
  };

  useEffect(() => {
    const playerID = localStorage.getItem("player_ID");
    if (!playerID) return;

    socket.emit("login_adminPermissionCheck", { playerID }, (response) => {
      if (response?.success) {
        sessionStorage.setItem("adminPermission", "true");
      } else {
        sessionStorage.setItem("adminPermission", "false");
      }
    });
  }, [socket]);

  return (
    <div className="relative min-h-screen w-full">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${getImage("homepage_background")})` }}
      >
        <div className="relative z-10 grid grid-rows-[25vh_75vh] grid-cols-[1fr_3fr_1fr] items-center justify-center w-full text-center text-white p-5 h-screen">
          <div className="col-start-2 row-start-2 self-start w-[40%] mx-auto h-[55%] flex flex-col justify-between items-center p-8 space-y-4 rounded-lg bg-black/60 text-lg">
            <button onClick={goToLore}>Lore</button>
            <button onClick={goToCampaign}>Campaign</button>
            <button onClick={goToCharacters}>Characters</button>
            <button onClick={handleExit}>Exit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
