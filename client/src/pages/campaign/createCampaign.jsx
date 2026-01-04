import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

function CreateLobby() {
  const { sessionID } = useParams();
  const navigate = useNavigate();
  const [gameName, setGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);

  const handleCreate = (e) => {
    e.preventDefault();
    const newGameId = 'game_' + Math.random().toString(36).substr(2, 9);
    console.log('Creating game:', { name: gameName, maxPlayers, id: newGameId });
    navigate(`/ISK/${sessionID}/game/${newGameId}`);
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Create New Game</h2>
        
        <form onSubmit={handleCreate} className="bg-gray-800 p-6 rounded-lg space-y-4">
          <div>
            <label className="block mb-2 font-semibold">Game Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full bg-gray-700 px-4 py-2 rounded"
              placeholder="Enter game name"
              required
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold">Max Players</label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full bg-gray-700 px-4 py-2 rounded"
            >
              <option value={2}>2 Players</option>
              <option value={4}>4 Players</option>
              <option value={6}>6 Players</option>
              <option value={8}>8 Players</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold"
          >
            Create Game
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateLobby;