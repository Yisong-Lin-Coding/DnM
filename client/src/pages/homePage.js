import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
function StartScreen() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/login'); // Use route path, not file path
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

export default StartScreen;