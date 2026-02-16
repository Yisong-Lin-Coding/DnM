import { useNavigate } from 'react-router-dom';
import getImage from '../handlers/getImage';

const GITHUB_URL = "https://github.com/Yisong-Lin-Coding/DnM";

function StartScreen() {
  const navigate = useNavigate();
  const handleStart = () => {
    navigate(`/login`);
  };

  const handleSettings = () => {
    navigate(`/settings`);
  };

  const handleExit = () => {
    localStorage.removeItem("player_ID");
    localStorage.removeItem("player_username");
    sessionStorage.removeItem("session_ID");
    sessionStorage.removeItem("adminPermission");
    sessionStorage.removeItem("lastLocation");
    window.location.assign(GITHUB_URL);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${getImage("startpage_background")})` }}
      />

     <div className="absolute inset-0 bg-gradient-to-t from-black/40" />


      <div className="relative z-10 grid grid-rows-[25vh_75vh] grid-cols-[1fr_3fr_1fr] items-center justify-center w-full text-center text-white p-5 h-screen">

        <h1 className="col-span-3 text-3xl font-bold">Welcome to DNM</h1>


        <div className="col-start-2 self-start w-[40%] mx-auto h-[55%] flex flex-col justify-between items-center p-5 space-y-4 rounded-lg bg-black/55 text-lg"> 
          <button onClick={handleStart}>Start</button> 
          <button onClick={handleSettings}>Settings</button> 
          <button onClick={handleExit}>Exit</button>
        </div>
      </div>
    </div>
  );
}

export default StartScreen;
