import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import React, { useState, useContext } from "react";
import { SocketContext } from '../socket.io/context';


  const SignupScreen = () =>{

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const socket = useContext(SocketContext);
    const navigate = useNavigate();

     
    const Signup = () => {
    
      console.log("Attempting to sign up with username:", username);
      console.log("Attempting to sign up with password:", password);
    socket.emit("signup", { username, password }, (response) => {
      if (response.success == true) {
        console.log("Signup successful, user ID:", response.userId);
        navigate(`/ISK/${JSON.stringify(sessionStorage.getItem("session_ID"))}/home`);
      } else {
        console.error("Signup failed:", response.error);
        alert("Signup failed: " + response.error);
      }
    });
  }

  return (
    <div className="App">
      <h1>Sign-Up</h1>
      <input
      placeholder="Username..."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
         />
      <input
        type="password"
        placeholder="Password..."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={Signup}>Sign-Up</button>
       <p>Already have an account? <Link to="/login">Login here</Link>.</p>
    </div>
  );
}



export default SignupScreen;