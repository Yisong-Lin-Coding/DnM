import { useNavigate } from 'react-router-dom';
import '../Pages.css';
import { SocketContext } from '../socket.io/context';
import { useContext, useEffect } from "react";
import getImage from '../handlers/getImage';
import Body from '../pageComponents/bodySkeleton';

const getSessionID = () => sessionStorage.getItem("session_ID");

function HomePage() {
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  const navigateTo = (path) => {
    const sessionID = getSessionID();
    if (!sessionID) {
      navigate("/login");
      return;
    }
    navigate(`/ISK/${sessionID}${path}`);
  };

  const goToLore = () => {
    navigateTo("/lore");
  };

  const goToCampaign = () => {
    navigateTo("/lobby");
  };

  const goToCharacters = () => {
    navigateTo("/character");
  };

  const handleExit = () => {
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

  useEffect(() => {
    const playerID = localStorage.getItem("player_ID");
    if (!playerID) return;

    socket.emit("login_adminPermissionCheck", { playerID }, (response) => {
      if (response?.success) {
        sessionStorage.setItem("adminPermission", "true");
      } else {
        sessionStorage.setItem("adminPermission", "false");
      }
    });
  }, [socket]);

  return (
    <Body className="relative overflow-hidden bg-website-default-900 text-website-default-100">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none"
        style={{ backgroundImage: `url(${getImage("homepage_background")})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-website-default-900/70 via-website-default-900/90 to-website-default-900 pointer-events-none" />

      <Body.Header className="relative z-10" title="Home" />
      <Body.Left className="relative z-10" />

      <Body.Center className="relative z-10 min-h-screen px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-3xl border border-website-default-700 bg-website-default-900/80 p-8 shadow-2xl backdrop-blur-md">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-website-neutral-400">
                Adventure Console
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-website-neutral-50 md:text-4xl">
                Choose your next chapter
              </h2>
              <p className="mt-2 text-sm text-website-neutral-300">
                Jump into lore references, manage campaigns, or shape your party roster.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={goToLore}
                className="flex h-full flex-col items-start gap-2 rounded-xl border border-website-default-600 bg-website-default-800/80 p-5 text-left transition-colors hover:bg-website-default-700"
              >
                <span className="text-sm font-semibold text-website-neutral-50">Lore</span>
                <span className="text-xs text-website-neutral-300">
                  Worldbuilding references, races, spells, and items.
                </span>
              </button>
              <button
                type="button"
                onClick={goToCampaign}
                className="flex h-full flex-col items-start gap-2 rounded-xl border border-website-highlights-500/60 bg-website-highlights-500/10 p-5 text-left transition-colors hover:bg-website-highlights-500/20"
              >
                <span className="text-sm font-semibold text-website-neutral-50">Campaigns</span>
                <span className="text-xs text-website-neutral-200">
                  Create, join, or manage the table&apos;s ongoing stories.
                </span>
              </button>
              <button
                type="button"
                onClick={goToCharacters}
                className="flex h-full flex-col items-start gap-2 rounded-xl border border-website-default-600 bg-website-default-800/80 p-5 text-left transition-colors hover:bg-website-default-700"
              >
                <span className="text-sm font-semibold text-website-neutral-50">Characters</span>
                <span className="text-xs text-website-neutral-300">
                  Review sheets, track progress, and customize builds.
                </span>
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="flex h-full flex-col items-start gap-2 rounded-xl border border-website-specials-500/60 bg-website-specials-500/10 p-5 text-left transition-colors hover:bg-website-specials-500/20"
              >
                <span className="text-sm font-semibold text-website-neutral-50">Exit</span>
                <span className="text-xs text-website-neutral-200">
                  Sign out and return to the login screen.
                </span>
              </button>
            </div>
          </div>
        </div>
      </Body.Center>

      <Body.Right className="relative z-10" />
      <Body.Footer className="relative z-10" />
    </Body>
  );
}

export default HomePage;
