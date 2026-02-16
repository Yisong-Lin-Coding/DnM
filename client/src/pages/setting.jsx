import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Github, Linkedin, LogOut, Home, LogIn } from "lucide-react";
import { SocketContext } from "../socket.io/context";
import getImage from "../handlers/getImage";

const GITHUB_URL = "https://github.com/Yisong-Lin-Coding/DnM";
const LINKEDIN_URL = "https://www.linkedin.com/in/yisong-lin-8605a3357/";

export default function Setting() {
  const socket = useContext(SocketContext);
  const navigate = useNavigate();
  const sessionID = sessionStorage.getItem("session_ID");
  const homeRoute = sessionID ? `/ISK/${sessionID}/home` : "/";
  const loggedIn = Boolean(localStorage.getItem("player_ID"));

  const handleSignOut = () => {
    const playerID = localStorage.getItem("player_ID");
    if (playerID) {
      socket.emit("playerData_logOff", { playerID });
    }

    localStorage.removeItem("player_ID");
    localStorage.removeItem("player_username");
    sessionStorage.removeItem("session_ID");
    sessionStorage.removeItem("adminPermission");
    sessionStorage.removeItem("lastLocation");
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen w-full">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${getImage("loginpage_background")})` }}
      />

      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-website-default-700 bg-website-default-900/90 p-8 text-website-neutral-50 backdrop-blur-md shadow-xl">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-2 text-sm text-website-neutral-300">
            Account and navigation actions are now wired and ready to use.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to={homeRoute}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-website-default-700 bg-website-default-800 px-4 py-3 text-sm hover:bg-website-default-700"
            >
              <Home className="size-4" />
              Home
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-website-default-700 bg-website-default-800 px-4 py-3 text-sm hover:bg-website-default-700"
            >
              <LogIn className="size-4" />
              Login
            </Link>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-website-default-700 bg-website-default-800 px-4 py-3 text-sm hover:bg-website-default-700"
            >
              <Github className="size-4" />
              GitHub
            </a>

            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-website-default-700 bg-website-default-800 px-4 py-3 text-sm hover:bg-website-default-700"
            >
              <Linkedin className="size-4" />
              LinkedIn
            </a>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={!loggedIn}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-website-specials-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-website-specials-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
