import React, { useState, useContext, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter, useParams } from 'react-router-dom';
import { SocketContext } from '../socket.io/context';


function Login() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const perm = useParams()
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    function handleLogin() {
        
            socket.emit("login", { username, password }, (response) => {
                if (response.success) {
                    console.log("Login successful, user ID:", response.userID);
                    localStorage.setItem("player_ID", response.userID.toString());
                    console.log(localStorage.getItem("player_ID"));

                    const playerID = response.userID.toString()
                    const sessionID = sessionStorage.getItem("session_ID")
                    socket.emit("login_tokenSave",{ playerID , sessionID}, (response) =>{
                        console.log(response.message)
                    })

                    navigate(`/ISK/${JSON.stringify(sessionStorage.getItem(`session_ID`))}/home`);
                } 
                else {
                    console.log(`Login Failed: ${response.message}`)
                    alert (`login failed\nPlease Try Again`)
                }
            })
        

        
    }

useEffect(() => {
    function autoLogin() {
        const playerID = (localStorage.getItem("player_ID") || "").toString();
        const sessionID = (sessionStorage.getItem("session_ID") || "").toString();
        
        socket.emit("login_validityCheck", { playerID, sessionID }, (response) => {
            if (response.success) {
                navigate(`/ISK/${sessionID}/home`);
            } 
            else {
                console.log(response.error || response.message);
                console.log("Error with autologin")
            }
        });
    }
    
    autoLogin();
}, []);

return( 

    <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Login</h1>
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
        <button onClick={()=>{
            handleLogin();
        }}>Log In</button>
        <p>Don't have an account? <Link to="/signup">Sign up here</Link>.</p>
        
    </div>
)
}


export default Login