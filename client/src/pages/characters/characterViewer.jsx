import Skeleton from "../../pageComponents/skeleton";
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header"; // Body.Header likely uses this
import { SocketContext } from "../../socket.io/context";
import { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Equipment from "./characterViewerPages/equipment";
import InventoryBox from "./characterViewerPages/inventory";
import EffectsTab from "./characterViewerPages/effects";
import ProfileCard from "./characterViewerPages/level";
import StoryBox from "./characterViewerPages/storyBox";
import AppearanceCard from "./characterViewerPages/appearance";
import AttributesCard from "./characterViewerPages/attributes";
import VitalsCard from "./characterViewerPages/vitals";

export default function CharacterViewer() {
  const socket = useContext(SocketContext);
  const { characterID } = useParams();
  const [character, setCharacter] = useState(null);
  const [raceData, setRaceData] = useState(null);
  const [classData, setClassData] = useState(null);

useEffect(() => {
    if (!characterID) return;

    // 1. Fetch the Character
    socket.emit("database_query", {
      collection: "characters",
      operation: "findById",
      filter: { _id: characterID },
    }, (response) => {
      if (response.success) {
        const char = response.data;
        setCharacter(char);

        // 2. Fetch the Race name using the ID from the character
        socket.emit("database_query", {
          collection: "races",
          operation: "findById",
          filter: { _id: char.race },
        }, (res) => { if (res.success) setRaceData(res.data); });

        // 3. Fetch the Class name using the ID from the character
        socket.emit("database_query", {
          collection: "classes",
          operation: "findById",
          filter: { _id: char.class },
        }, (res) => { if (res.success) setClassData(res.data); });
      }
    });
  }, [socket, characterID]);

  if (!character) return <div className="text-white p-10">Loading...</div>;

  const ProgressBar = ({ label, current, max, color }) => (
    <div className="w-full mb-4 px-2">
      <div className="flex justify-between text-[10px] mb-1 uppercase tracking-widest font-bold">
        <span>{label}</span>
        <span>{current} / {max}</span>
      </div>
      <div className="w-full bg-black/40 rounded-full h-2 border border-white/10">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${color}`} 
          style={{ width: `${Math.min((current / max) * 100, 100)}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <Body className="bg-website-default-900">
      {/* 1. Use the static Header sub-component provided by your Body skeleton */}
      <Body.Header title={character.name || "Character"} />

      {/* 2. Wrap main content in Center to use the '5fr' column */}
      <Body.Center className="p-6 text-left">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-6">
          
          {/* LEFT COLUMN: Vitals & XP */}
          <div className="space-y-4">

            <div>
                <ProfileCard
                    character = {character}
                    raceName = {raceData?.name}
                    className = {classData?.name}
                />
            </div>

            <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
                <VitalsCard
                    character = {character}
                />

              
            </div>

            <div>
                <EffectsTab 
                effects={character?.effects}
                
                />
              </div>

            
          </div>

          {/* MIDDLE COLUMN: Attributes */}
          <div className="space-y-4">
          <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
            <AttributesCard
                stats ={character.stats}
            />
            
          </div>

          <div className="col-span-3">
            {/* Passing character?.inv?.equipment ensures we don't pass undefined to the component */}
            <Equipment 
                equipment={character?.inv?.equipment} 
                gp={character?.inv?.gp} 
            />
            </div>

          </div>

          {/* RIGHT COLUMN: Details */}
          <div className="space-y-4">
            <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
             <AppearanceCard
                character ={character}
             />
            </div>
            <div>

                <InventoryBox
                    inventory={character?.inv}
                    characterWeight={character?.weight}
                />
            </div>
             <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
             <StoryBox 
                character = {character}
             />
              
            </div>
          </div>

        </div>
      </Body.Center>

      <Body.Footer>
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">
          Character ID: {character._id}
        </div>
      </Body.Footer>
    </Body>
  );
}