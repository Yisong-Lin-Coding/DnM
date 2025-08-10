import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import { SocketContext } from '../socket.io/context';
import React, { useState, useContext } from "react";

function HomePage() {
  

  const ChacterSelect = () => {
    const navigate = useNavigate();
    navigate('/character-selection'); 
} 
const socket = useContext(SocketContext);
socket.on("connect", () => {
    console.log("Connected to the server");})

  return (
    <div className="App">
      <h1></h1>
      <button>Add New Chacter</button>
      <button onClick={ ChacterSelect } >Chacter Selection</button>
      <button>Exit</button>
    </div>
  );
}

export default HomePage;