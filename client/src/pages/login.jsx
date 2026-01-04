import React, { useState, useContext, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter, useParams } from 'react-router-dom';
import { SocketContext } from '../socket.io/context';
import getImage from "../handlers/getImage";


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
                    socket.emit("playerData_logOn", { playerID: localStorage.getItem("player_ID") });

                    const playerID = response.userID.toString()
                    const sessionID = sessionStorage.getItem("session_ID")
                    socket.emit("login_tokenSave",{ playerID , sessionID}, (response) =>{
                        console.log(response.message)
                    })

                    navigate(`/ISK/${sessionStorage.getItem(`session_ID`)}/home`);
                } 
                else {
                    console.log(`Login Failed: ${response.message}`)
                    alert (`login failed\nPlease Try Again`)
                }
            })
        

        
    }

useEffect(() => {
    function autoLogin() {
        const playerID = (localStorage.getItem("player_ID") || "");
        const sessionID = (sessionStorage.getItem("session_ID") || "")
        const lastLocation = (sessionStorage.getItem("lastLocation") || "")
        
        socket.emit("login_validityCheck", { playerID, sessionID }, (response) => {
            if (response.success) {
                if(lastLocation){
                    navigate(`/ISK/${sessionID}/${lastLocation}`)
                }else {
                    navigate(`/ISK/${sessionID}/home`);
                }
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

     <div className="relative min-h-screen w-full">
         <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getImage("loginpage_background")})` }}
              />

    <div className="absolute w-1/3 p-16 bg-black/85 h-screen">
        <div className="flex flex-col text-white h-full">
            <div className="text-2xl">
                Login
            </div>
            <div className="flex space-y-6 flex-col pt-8">
                <div className="flex space-y-1 flex-col">
                    <div>Username</div>
                    <div>
                        <input 
                            type="text"
                            placeholder="Username..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="bg-transparent border-b border-b-white text-white w-full focus:outline-none focus:ring-0"
                            />
                    </div>
                </div>
                <div className="flex space-y-1 flex-col">
                    <div>Password </div>
                    <div>
                        <input 
                            type="password" 
                            placeholder="Password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-transparent border-b border-b-white text-white w-full focus:outline-none focus:ring-0 "
                            />
                    </div>
                </div>
                <button 
                    onClick={handleLogin} 
                    className="relative bg-blue-500 text-white px-4 py-2 rounded-full w-full">
                        Log In
                </button>
                <div className="text-center">
                    <p>Don't have an account? <Link to="/signup">Sign up here</Link>.</p>
                </div>
            </div>
            
            <div className="mt-auto flex flex-row justify-center text-xs space-x-2">
                <div>
                    <Link to="/">Home</Link>
                </div>
                <div>|</div>
                <div>
                    <Link>About</Link>
                </div>
                <div>|</div>
                <div>
                    <Link>Github</Link>
                </div>
            </div>
        </div>
         
        
        
    </div>
    </div>
)
}


export default Login