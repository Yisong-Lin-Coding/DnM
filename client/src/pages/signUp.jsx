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
    <div className="relative min-h-screen w-full overflow-hidden bg-website-default-900 text-website-neutral-50">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${getImage("loginpage_background")})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-website-default-900/80 via-website-default-900/60 to-website-default-900" />

      <div className="relative min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-website-default-700 bg-website-default-900/85 p-8 shadow-2xl backdrop-blur-md">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-website-neutral-400">
              Create your legend
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-website-neutral-50">Sign Up</h1>
            <p className="mt-2 text-sm text-website-neutral-300">
              Set up your account to start building campaigns and characters.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-website-neutral-400 mb-2">
                Username
              </label>
              <input
                type="text"
                placeholder="Username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm text-website-neutral-100 focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-website-neutral-400 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm text-website-neutral-100 focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
              />
            </div>
            <button
              type="button"
              onClick={Signup}
              className="w-full rounded-lg bg-website-specials-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-website-specials-600"
            >
              Sign Up
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-website-neutral-300">
            <p>
              Already have an account?{" "}
              <Link to="/login" className="text-website-specials-400 hover:text-website-specials-300">
                Login here
              </Link>
              .
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 text-xs text-website-neutral-400">
            <Link to="/" className="hover:text-website-specials-400">
              Home
            </Link>
            <span className="text-website-default-700">|</span>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-website-specials-400"
            >
              About
            </a>
            <span className="text-website-default-700">|</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-website-specials-400"
            >
              Github
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}



export default SignupScreen;
