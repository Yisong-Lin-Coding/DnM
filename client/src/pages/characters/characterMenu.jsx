import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import IndexCardFolder from "../../pageComponents/indexCard";
import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../../socket.io/context";
import { Plus, Edit2, Trash2, Eye } from "lucide-react"; // Added icons
import CharacterCard from "../../pageComponents/characterCard";

export default function CharacterMenu() {
    const socket = useContext(SocketContext);
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const playerID = localStorage.getItem("player_ID");


    const handleDeleteCharacter = (characterID) => {
        
        if (!socket) return;

        if (!window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) {
            return;
        }
        socket.emit("character_delete", { characterID }, (response) => {
            if (response && response.success) {
                // This triggers the rerender instantly
                setCharacters((prevCharacters) => 
                    prevCharacters.filter(char => char.id !== characterID)
                );
                
                // Don't forget to hide the menu!
                closeContextMenu();
            } else {
                alert(response?.message || 'Failed to delete');
            }
        });
    }

    // --- CONTEXT MENU STATE ---
    const [contextMenu, setContextMenu] = useState({
        show: false,
        x: 0,
        y: 0,
        character: null,
    });

    // Handle Right Click
    const handleContextMenu = (e, character) => {
        e.preventDefault(); // Stop the browser menu
        setContextMenu({
            show: true,
            x: e.pageX,
            y: e.pageY,
            character: character,
        });
    };

    // Close menu when clicking elsewhere
    const closeContextMenu = () => {
        setContextMenu({ ...contextMenu, show: false });
    };

    useEffect(() => {
        window.addEventListener("click", closeContextMenu);
        return () => window.removeEventListener("click", closeContextMenu);
    }, []);

    // --- FETCH LOGIC (Existing) ---
    useEffect(() => {
        if (!socket || !playerID) {
            setLoading(false);
            return;
        }

        socket.emit("playerData_getCharacter", { playerID }, (response) => {
            if (!response || !response.success) {
                setError(response?.message || 'Failed to fetch characters');
                setLoading(false);
                return;
            }
            setCharacters(response.characters || []);
            setLoading(false);
        });
    }, [socket, playerID]);

    return (
        <>
            {/* --- CUSTOM CONTEXT MENU UI --- */}
            {contextMenu.show && (
                    <div
                        className="absolute z-[100] w-56 bg-website-default-800/95 backdrop-blur-md border border-website-default-700 rounded-lg shadow-2xl py-2 text-left"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        {/* Title Section: Muted text for the character name */}
                        <div className="px-4 py-1.5 text-[10px] tracking-widest text-website-default-400 uppercase font-black">
                            Character Actions
                        </div>
                        <div className="px-4 pb-2 text-xs font-semibold text-website-default-300 truncate">
                            {contextMenu.character.name}
                        </div>
                        
                        {/* Divider */}
                        <div className="h-px bg-website-default-700/50 my-1 mx-2" />

                        {/* Action: View (High contrast text-website-default-100) */}
                        <button 
                            onClick={() => console.log("View", contextMenu.character.id)}
                            className="w-full flex items-center px-4 py-2.5 text-website-default-100 hover:bg-website-default-700 transition-all duration-150 group"
                        >
                            <Eye className="size-4 mr-3 text-website-default-400 group-hover:text-website-default-100" />
                            <span className="text-sm font-medium">View Character</span>
                        </button>

                        {/* Action: Edit */}
                        <button 
                            onClick={() => console.log("Edit", contextMenu.character.id)}
                            className="w-full flex items-center px-4 py-2.5 text-website-default-100 hover:bg-website-default-700 transition-all duration-150 group"
                        >
                            <Edit2 className="size-4 mr-3 text-website-default-400 group-hover:text-website-default-100" />
                            <span className="text-sm font-medium">Edit Profile</span>
                        </button>

                        {/* Divider for destructive actions */}
                        <div className="h-px bg-website-default-700/50 my-1 mx-2" />

                        {/* Action: Delete (Red with hover adjustment) */}
                        <button 
                            onClick={() => handleDeleteCharacter(contextMenu.character.id)}
                            className="w-full flex items-center px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150 group"
                        >
                            <Trash2 className="size-4 mr-3 text-red-400/60 group-hover:text-red-300" />
                            <span className="text-sm font-medium">Delete Character</span>
                        </button>
                    </div>
                )}

            <Body className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100 justify-center space-x-8">
                <Header className="col-span-3" />
                <Body.Left className="row-span-1 col-start-1" />
                
                <Body.Center className="row-span-1 col-start-2 min-h-screen">
                    <IndexCardFolder>
                        {loading && <div>Loading characters...</div>}
                        {error && <div className="text-red-400">Error: {error}</div>}
                        
                        {!loading && !error && characters.map(character => (
                            <div 
                                key={character.id} 
                                onContextMenu={(e) => handleContextMenu(e, character)}
                                className="relative"
                            >
                                <CharacterCard 
                                    character={character}
                                    to={`/ISK/${sessionStorage.getItem('session_ID') || 'default'}/character/view/${character.id}`}
                                />
                            </div>
                        ))}

                        <IndexCardFolder.File to={`/ISK/${sessionStorage.getItem('session_ID') || 'default'}/character/creation`}>
                            <IndexCardFolder.File.Bottom>
                                <Plus className="size-8 aspect-[1/1]" />
                                <IndexCardFolder.File.Detail>
                                    <p>Add New Character...</p>
                                </IndexCardFolder.File.Detail>
                            </IndexCardFolder.File.Bottom>
                        </IndexCardFolder.File>
                    </IndexCardFolder>
                </Body.Center>

                <Body.Right className="col-start-3" />
                <Body.Footer className="col-span-3" />
            </Body>
        </>
    );
}