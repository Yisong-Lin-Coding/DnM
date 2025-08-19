import { BrowserRouter as useContext, useNavigate } from 'react-router-dom';
import { SocketContext } from '../socket.io/context';


function StartScreen() {
  const socket = useContext(SocketContext);
  const navigate = useNavigate();
  const handleStart = () => {
    navigate ('/login'); // Use route path, not file path
  };

  return (
    <div className="bg-fantasy text-center p-5 rounded-lg shadow-lg text-white">
      <h1>Welcome to the D&D Game</h1>
      <div className='flex flex-col items-center space-y-4 mt-5'>
        <button onClick={handleStart}>Start</button>
        <button>Settings</button>
        <button>Exit</button>
      </div>
    </div>
  );
}

export default StartScreen;