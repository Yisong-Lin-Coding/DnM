import { Outlet, Link, useParams } from 'react-router-dom';

function LobbyLayout() {
  const { sessionID } = useParams();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Game Lobby</h1>
          <div className="flex gap-4">
            <Link 
              to={`/ISK/${sessionID}/lobby`}
              className="hover:text-blue-400"
            >
              Menu
            </Link>
            <Link 
              to={`/ISK/${sessionID}/lobby/join`}
              className="hover:text-blue-400"
            >
              Join
            </Link>
            <Link 
              to={`/ISK/${sessionID}/lobby/create`}
              className="hover:text-blue-400"
            >
              Create
            </Link>
            <Link 
              to={`/ISK/${sessionID}/home`}
              className="hover:text-blue-400"
            >
              Home
            </Link>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

export default LobbyLayout;