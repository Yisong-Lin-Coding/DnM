import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

function JoinLobby() {
  const { sessionID } = useParams();
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    console.log('Joining game with code:', gameCode);
    // Navigate to game
    navigate(`/ISK/${sessionID}/game/${gameCode}`);
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Join Game</h2>
        
        <form onSubmit={handleJoin} className="bg-gray-800 p-6 rounded-lg">
          <label className="block mb-2 font-semibold">Game Code</label>
          <input
            type="text"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value)}
            className="w-full bg-gray-700 px-4 py-2 rounded mb-4"
            placeholder="Enter 6-digit code"
            required
          />
          <button 
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold"
          >
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinLobby;