import { useNavigate } from 'react-router-dom';
import getImage from '../handlers/getImage';

const GITHUB_URL = "https://github.com/Yisong-Lin-Coding/DnM";

function StartScreen() {
  const navigate = useNavigate();
  const handleStart = () => {
    navigate(`/login`);
  };

  const handleSettings = () => {
    navigate(`/settings`);
  };

  const handleExit = () => {
    localStorage.removeItem("player_ID");
    localStorage.removeItem("player_username");
    sessionStorage.removeItem("session_ID");
    sessionStorage.removeItem("adminPermission");
    sessionStorage.removeItem("lastLocation");
    window.location.assign(GITHUB_URL);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-website-default-900 text-website-neutral-50">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${getImage("startpage_background")})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-website-default-900/80 via-website-default-900/55 to-website-default-900" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-website-neutral-400">
            Welcome to the world of
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-website-neutral-50 md:text-5xl">
            Dungeons not Mastered
          </h1>
          <p className="mt-4 text-sm text-website-neutral-300 md:text-base">
            Where you never really know what you're doing.
          </p>
        </div>

        <div className="mt-10 w-full max-w-sm rounded-2xl border border-website-default-700 bg-website-default-900/80 p-6 shadow-2xl backdrop-blur-md">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleStart}
              className="rounded-lg bg-website-specials-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-website-specials-600"
            >
              Start
            </button>
            <button
              type="button"
              onClick={handleSettings}
              className="rounded-lg border border-website-default-600 bg-website-default-800 px-4 py-3 text-sm font-semibold text-website-default-100 transition-colors hover:bg-website-default-700"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={handleExit}
              className="rounded-lg border border-website-highlights-500/60 bg-website-highlights-500/10 px-4 py-3 text-sm font-semibold text-website-neutral-100 transition-colors hover:bg-website-highlights-500/20"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StartScreen;
