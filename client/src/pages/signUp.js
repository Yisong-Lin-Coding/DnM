import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import React, { useState, useContext } from "react";
import { SocketContext } from '../socket.io/context';


  const SignupScreen = () =>{

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    
    const socket = useContext(SocketContext);
    const navigate = useNavigate();

     
    const Signup = () => {
    
    socket.emit("signup", { username, password }, (response) => {
      if (response.success == true) {
        console.log("Signup successful, user ID:", response.userId);
        navigate("/home");
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