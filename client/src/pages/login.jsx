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
                    console.log("Login successful, user ID:", response.userId);
                    localStorage.setItem("player_ID", JSON.stringify(response.userId));
                    console.log(localStorage.getItem("player_ID"));
                    navigate(`/ISK/${JSON.stringify(sessionStorage.getItem(`session_ID`))}/home`);
                } 
                else {
                    console.log(`Login Failed: ${response.message}`)
                    alert (`login failed\nPlease Try Again`)
                }
            })
        

        
    }

    useEffect(()=>{

        function autoLogin() {
        const playerID = JSON.stringify(localStorage.getItem("player_ID"))
        const sessionID = JSON.stringify(sessionStorage.getItem("session_ID"))
        socket.emit("validityCheck_login", { playerID, sessionID}, (response) =>{
            if(response.success = true){
                navigate(`/ISK/${sessionID}/home`)
            }
            else{
                console.log(response.message)
                return
            }


        })
    }
    
    autoLogin()


    })

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