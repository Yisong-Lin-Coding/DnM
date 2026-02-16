import React, { useState, useContext, useEffect, useCallback } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { SocketContext } from '../socket.io/context';
import getImage from "../handlers/getImage";

const GITHUB_URL = "https://github.com/Yisong-Lin-Coding/DnM";
const LINKEDIN_URL = "https://www.linkedin.com/in/yisong-lin-8605a3357/";

function Login() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const waitForSessionID = useCallback((timeoutMs = 5000, intervalMs = 50) => {
        return new Promise((resolve) => {
            const startedAt = Date.now();

            const poll = () => {
                const sessionID = sessionStorage.getItem("session_ID") || socket?.id || null;
                if (sessionID) {
                    resolve(sessionID);
                    return;
                }

                if (Date.now() - startedAt >= timeoutMs) {
                    resolve(null);
                    return;
                }

                setTimeout(poll, intervalMs);
            };

            poll();
        });
    }, [socket]);

    function handleLogin() {
        const cleanUsername = username.trim();
        if (!cleanUsername || !password) {
            alert("Please provide both username and password.");
            return;
        }

        socket.emit("login", { username: cleanUsername, password }, (response) => {
            if (!response?.success) {
                const errorMessage = response?.error || response?.message || "Login failed. Please try again.";
                console.log(`Login failed: ${errorMessage}`);
                alert(errorMessage);
                return;
            }

            const playerID = String(response.userID || response.userId || "").trim();
            if (!playerID) {
                alert("Login failed: missing user ID.");
                return;
            }

            localStorage.setItem("player_ID", playerID);
            localStorage.setItem("player_username", cleanUsername);

            waitForSessionID().then((resolvedSessionID) => {
                if (!resolvedSessionID) {
                    alert("Unable to establish a session. Please try again.");
                    return;
                }

                socket.emit("login_tokenSave", { playerID, sessionID: resolvedSessionID }, (tokenResponse) => {
                    if (!tokenResponse?.success) {
                        alert(tokenResponse?.error || "Unable to save login session.");
                        return;
                    }

                    socket.emit("playerData_logOn", { playerID });
                    navigate(`/ISK/${resolvedSessionID}/home`);
                });
            });
        });
    }

useEffect(() => {
    let cancelled = false;

    function autoLogin() {
        const playerID = (localStorage.getItem("player_ID") || "");
        
        const lastLocation = (sessionStorage.getItem("lastLocation") || "")
        if (!playerID) {
            return;
        }

        waitForSessionID().then((sessionID) => {
            if (cancelled || !sessionID) {
                return;
            }

            socket.emit("login_validityCheck", { playerID, sessionID }, (response) => {
                if (cancelled) return;

                if (response.success) {
                    if(lastLocation){
                        navigate(`/ISK/${sessionID}/${lastLocation}`)
                    }else {
                        navigate(`/ISK/${sessionID}/home`);
                    }
                } 
                else {
                    console.log(response?.error || response?.message || "Autologin failed");
                    localStorage.removeItem("player_ID");
                    localStorage.removeItem("player_username");
                    sessionStorage.removeItem("lastLocation");
                }
            });
        });
    }
    
    autoLogin();
    return () => {
        cancelled = true;
    };
}, [socket, navigate, waitForSessionID]);

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
                    <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">About</a>
                </div>
                <div>|</div>
                <div>
                    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Github</a>
                </div>
            </div>
        </div>
         
        
        
    </div>
    </div>
)
}


export default Login
