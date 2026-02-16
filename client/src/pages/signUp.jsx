import { Link, useNavigate } from 'react-router-dom';
import { useState, useContext, useCallback } from "react";
import { SocketContext } from '../socket.io/context';
import getImage from '../handlers/getImage';

const GITHUB_URL = "https://github.com/Yisong-Lin-Coding/DnM";
const LINKEDIN_URL = "https://www.linkedin.com/in/yisong-lin-8605a3357/";

  const SignupScreen = () =>{

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const socket = useContext(SocketContext);
    const navigate = useNavigate();

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

    const Signup = () => {
      const cleanUsername = username.trim();
      if (!cleanUsername || !password) {
        alert("Please provide both username and password.");
        return;
      }

      waitForSessionID().then((resolvedSessionID) => {
        if (!resolvedSessionID) {
          alert("Unable to establish a session. Please refresh and try again.");
          return;
        }

        socket.emit("signup", { username: cleanUsername, password, sessionID: resolvedSessionID }, (response) => {
          if (!response?.success) {
            console.error("Signup failed:", response?.error);
            alert("Signup failed: " + (response?.error || "Unknown error"));
            return;
          }

          const playerID = String(response.userID || response.userId || "").trim();
          if (!playerID) {
            alert("Signup failed: missing user ID.");
            return;
          }

          localStorage.setItem("player_ID", playerID);
          localStorage.setItem("player_username", cleanUsername);

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


  

  return (
    <div className="relative min-h-screen w-full">
         <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getImage("loginpage_background")})` }}
              />

    <div className="absolute w-1/3 p-16 bg-black/85 h-screen top-0 right-0">
        <div className="flex flex-col text-white h-full">
            <div className="text-2xl">
                Sign Up
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
                    onClick={Signup} 
                    className="relative bg-blue-500 text-white px-4 py-2 rounded-full w-full">
                        Sign Up
                </button>
                <div className='text-center'>
                  <p>Already have an account? <Link to="/login">Login here</Link>.</p>
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
  );
}



export default SignupScreen;
