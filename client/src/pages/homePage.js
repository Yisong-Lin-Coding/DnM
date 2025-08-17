import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import { SocketContext } from '../socket.io/context';
import React, { useState, useContext } from "react";

function HomePage() {
  const socket = useContext(SocketContext);

  useEffect(() => {
    

  }, []);



  const navigate = useNavigate();
  const ChacterSelect = () => {
    
    navigate('/character-selection'); 
} 

const ChacterCreation = () => {
    
    navigate('/character-creation'); 
}

socket.on("connect", () => {
    console.log("Connected to the server");})

  let adminPermission = false

const permissionCheck = () => {
    socket.emit("permissionCheck", { message: "Admin action triggered" }, (response) => {
        console.log("Admin response:", response);
        if (response.success == true) {
        console.log("Admin action successful");
        adminPermission = true;
    } else {
        console.error("Admin action failed:", response.error);
        alert("Admin action failed: " + response.error);
    }
    });
    
}


  return (
    
    <div className="App">
      <div></div>
      <h1></h1>
       
      <div>
      {permissionCheck() == true && (
        <button>Admin Panel</button>
      )}
      <button onClick={ ChacterCreation }>Join new lobby</button>
      <button onClick={ ChacterSelect } >Chacter Selection</button>
      <button>Exit</button>
      </div>
    </div>
  );
}

export default HomePage;