import logo from './logo.svg';
import './App.css';
import io from "socket.io-client"
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import Login from './pages/login';
import StartScreen from './pages/startScreen';

// Correct socket connection string
const socket = io.connect("http://localhost:3001");

// Component for main menu


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
