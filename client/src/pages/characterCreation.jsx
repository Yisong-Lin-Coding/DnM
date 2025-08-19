import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
import React, { useContext } from "react";
import '../Pages.css'
function StartScreen() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/login'); // Use route path, not file path
  };

  return (
    <div class="bg-black grid grid-rows-[12.5vh_87.5vh] min-h-screen">
      <div class="bg-black text-center p-5 rounded-lg shadow-lg text-white flex flex-row items-center justify-center space-x-8">
        
        <div>
          <h1 class="text-xl">Character Creation</h1>
          <p>
            Character Name
          </p>
        </div>     

        <p class="flex flex-row items-center justify-center space-x-4">
            <Link to="/character-creation/customize">1. Customization</Link>
            <Link to="/character-creation/class">2. Class</Link>
            <Link to="/character-creation/background">3. Background</Link>
            <Link to="/character-creation/species">4. Species</Link>
            <Link to="/character-creation/equipment">5. Equipment</Link>
            <Link to="/character-creation/summary">6. Summary</Link>
        </p>

        </div>
      <div class="bg-fantasy text-center p-5 rounded-lg shadow-lg text-white overflow-y-auto grid grid-cols-[1fr_2fr_1fr] gap-4">

        <div class="bg-blue-500">
          TESt 1
        </div>
          
        <div>

          <div class="h-[9000px]">
            MAIN DIV
          </div>

          <button class="absolute top-1/2 left-5 -translate-y-1/2 bg-yellow-500 p-3 rounded-full shadow-lg">
            {"<--"}
          </button>

          <button class="absolute top-1/2 right-5 -translate-y-1/2 bg-green-500 p-3 rounded-full shadow-lg">
            {"-->"}
          </button>

        </div>

        <div class="bg-red-500">
          TEST 3
        </div>

      </div>
    </div>
  );
}

export default StartScreen;