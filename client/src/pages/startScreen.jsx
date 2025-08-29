import { useNavigate } from 'react-router-dom';
import getImage from '../handlers/getImage';

function StartScreen() {
  const navigate = useNavigate();
  const handleStart = () => {
    navigate(`/login`);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${getImage("startpage_background")})` }}
      />


      <div className="absolute inset-0 bg-gradient-to-t from-black/60" />


      <div className="relative z-10 grid grid-rows-[25vh_75vh] grid-cols-[1fr_3fr_1fr] items-center justify-center w-full text-center text-white p-5 h-screen">

        <h1 className="col-span-3 text-3xl font-bold">Welcome to DNM</h1>


        <div className="col-start-2 self-start w-[40%] mx-auto h-[55%] flex flex-col justify-between items-center p-5 space-y-4 rounded-lg bg-black/55 text-lg"> 
          <button onClick={handleStart}>Start</button> 
          <button>Settings</button> 
          <button>Exit</button>
        </div>
      </div>
    </div>
  );
}

export default StartScreen;
