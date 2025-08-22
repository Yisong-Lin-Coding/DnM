import { useNavigate } from 'react-router-dom';

function StartScreen() {
  const navigate = useNavigate();
  const handleStart = () => {
    navigate (`/login`);
  };

  return (
    <div className="bg-black text-center rounded-lg p-5 shadow-lg text-white grid grid-rows-[25vh_75vh] grid-cols-[1fr_3fr_1fr] items-center justify-center w-full min-h-full overflow-hidden">
      <h1 className='col-span-3'>Welcome to the D&D Game</h1>

      <div className=' flex flex-col items-center justify-between bg-blue-500 space-y-4 p-5 rounded-lg col-start-2 self-start w-1/2 mx-auto h-1/2 '>
        <button onClick={handleStart}>Start</button>
        <button>Settings</button>
        <button>Exit</button>

      </div>
    </div>
  );
}

export default StartScreen;