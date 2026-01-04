import { Link, useParams } from 'react-router-dom';

function LobbyMenu() {
  const { sessionID } = useParams();

  const activeGames = [
    { id: 'game1', name: 'Epic Quest', players: 3, maxPlayers: 4 },
    { id: 'game2', name: 'Dragon Hunt', players: 2, maxPlayers: 6 },
    { id: 'game3', name: 'Mystery Dungeon', players: 4, maxPlayers: 4 },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Active Games</h2>
        
        <div className="grid gap-4 mb-8">
          {activeGames.map(game => (
            <div key={game.id} className="bg-gray-800 p-6 rounded-lg flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">{game.name}</h3>
                <p className="text-gray-400">
                  Players: {game.players}/{game.maxPlayers}
                </p>
              </div>
              <Link 
                to={`/ISK/${sessionID}/game/${game.id}`}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
              >
                Join Game
              </Link>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <Link 
            to={`/ISK/${sessionID}/lobby/join`}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg"
          >
            Join by Code
          </Link>
          <Link 
            to={`/ISK/${sessionID}/lobby/create`}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg"
          >
            Create New Game
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LobbyMenu;
