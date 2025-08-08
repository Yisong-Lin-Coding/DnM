import logo from './logo.svg';
import './App.css';
import io from "socket.io-client"
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import StartScreen from './pages/startMenu';

// Correct socket connection string
const socket = io.connect("http://localhost:3001");

// Component for main menu
function Home() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/start'); // Use route path, not file path
  };

  return (
    <div className="App">
      <h1>Welcome to the D&D Game</h1>
      <button onClick={handleStart}>Start</button>
      <button>Settings</button>
      <button>Exit</button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<StartScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
