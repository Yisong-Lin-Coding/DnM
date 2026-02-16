import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import IndexCardFolder from "../../pageComponents/indexCard";
import { useContext, useEffect, useRef, useState } from "react";
import { SocketContext } from "../../socket.io/context";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Eye } from "lucide-react"; // Added icons
import CharacterCard from "../../pageComponents/characterCard";

function normalizeStats(stats, fallbackStats = {}) {
    if (stats && typeof stats === "object" && Object.keys(stats).length > 0) {
        return stats;
    }

    if (fallbackStats && typeof fallbackStats === "object") {
        const normalized = {};
        Object.entries(fallbackStats).forEach(([key, value]) => {
            const num = Number(value) || 0;
            normalized[key.toUpperCase()] = { score: num, modifier: Math.floor((num - 10) / 2) };
        });
        return normalized;
    }

    return {};
}

function normalizeCharacterForCard(rawCharacter, fallbackCharacter = {}) {
    const c = rawCharacter || {};
    const f = fallbackCharacter || {};

    const hp = c.hp || c.HP || c._baseHP || { max: 0, current: 0, temp: 0 };
    const mp = c.mp || c.MP || c._baseMP || { max: 0, current: 0, temp: 0 };
    const sta = c.sta || c.STA || c._baseSTA || { max: 0, current: 0, temp: 0 };
    const stats = normalizeStats(c.stats, c._baseStats || f.stats);

    return {
        ...f,
        ...c,
        id: String(c.id || c._id || f.id || f._id || ""),
        name: c.name || f.name || "Unnamed Character",
        level: c.level || f.level || 1,
        hp,
        mp,
        sta,
        stats,
    };
}


export default function CharacterMenu() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const playerID = localStorage.getItem("player_ID");
    const [builtCharacters, setBuiltCharacters] = useState({}); // { [id]: builtCharacter }
    const logPrefix = "[CharacterMenu]";
    const loadInFlightRef = useRef(false);
    const lastLoadKeyRef = useRef("");

    const handleDeleteCharacter = (characterID) => {
        
        if (!socket) return;

        if (!window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) {
            return;
        }
        socket.emit("character_delete", { characterID }, (response) => {
            if (response && response.success) {
                // This triggers the rerender instantly
                setCharacters((prevCharacters) => 
                    prevCharacters.filter(char => String(char.id) !== String(characterID))
                );
                
                // Don't forget to hide the menu!
                closeContextMenu();
            } else {
                alert(response?.message || 'Failed to delete');
            }
        });
    }

    const buildCharacter = async (characterID) => {
    // 1. Basic validation
    if (!socket || !playerID) return null;

    // 2. Wrap the socket emit in a Promise
    const startedAt = performance.now();
    console.log(`${logPrefix} build start`, { characterID });

    return new Promise((resolve) => {
        socket.emit("character_builder", { characterID }, (response) => {
            const durationMs = Math.round(performance.now() - startedAt);
            if (response && response.success) {
                // Success: Resolve the promise with the data
                console.log(`${logPrefix} build success`, { characterID, durationMs });
                resolve(response.character);
            } else {
                // Failure: Log and Reject
                const errorMsg = response?.message || 'Failed to build character';
                console.error(`${logPrefix} build failed`, { characterID, durationMs, errorMsg });
                resolve(null); // Or use reject(errorMsg) if you want to use try/catch
            }
        });
    });
};
    

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
        setContextMenu((prev) => ({ ...prev, show: false, character: null }));
    };

    const handleViewCharacter = (characterID) => {
        if (!characterID) return;
        closeContextMenu();
        const sessionID = sessionStorage.getItem("session_ID") || "default";
        navigate(`/ISK/${sessionID}/character/view/${characterID}`);
    };

    const handleEditCharacter = (characterID) => {
        if (!characterID) return;
        closeContextMenu();
        const sessionID = sessionStorage.getItem("session_ID") || "default";
        navigate(`/ISK/${sessionID}/character/edit/${characterID}`);
    };

useEffect(() => {
    if (!socket || !playerID) {
        setLoading(false);
        return;
    }

    const loadKey = `${socket.id || "no-socket"}:${playerID}`;
    if (loadInFlightRef.current) {
        console.log(`${logPrefix} skip load (already in progress)`, { loadKey });
        return;
    }
    if (lastLoadKeyRef.current === loadKey) {
        console.log(`${logPrefix} skip load (same key already loaded)`, { loadKey });
        return;
    }
    loadInFlightRef.current = true;
    lastLoadKeyRef.current = loadKey;

    // 1. Define an async function inside the effect
    const loadAndBuildCharacters = async () => {
        const menuLoadStartedAt = performance.now();
        setLoading(true); // Start loading

        try {
            // A. Get the list of character IDs
            const listStartedAt = performance.now();
            console.log(`${logPrefix} list fetch start`, { playerID });
            const listResponse = await new Promise((resolve) => {
                socket.emit("playerData_getCharacter", { playerID }, resolve);
            });
            console.log(`${logPrefix} list fetch done`, {
                playerID,
                durationMs: Math.round(performance.now() - listStartedAt),
                success: !!listResponse?.success,
                count: listResponse?.characters?.length || 0,
            });

            if (!listResponse || !listResponse.success) {
                throw new Error(listResponse?.message || 'Failed to fetch characters');
            }

            const charList = listResponse.characters || [];
            setCharacters(charList);

            // B. Build the mapping object: { [id]: characterData }
            const builtMap = {};
            
            // Use Promise.all to fetch all characters in parallel for speed
            const buildAllStartedAt = performance.now();
            await Promise.all(
                charList.map(async (char) => {
                    const builtChar = await buildCharacter(char.id); // Using your new async function
                    builtMap[char.id] = normalizeCharacterForCard(builtChar, char);
                })
            );
            console.log(`${logPrefix} build all done`, {
                count: charList.length,
                durationMs: Math.round(performance.now() - buildAllStartedAt),
            });

            // C. Update state once all are built
            setBuiltCharacters(builtMap);
            setError(null);
        } catch (err) {
            console.error(`${logPrefix} load failed`, { message: err.message });
            setError(err.message);
            lastLoadKeyRef.current = "";
        } finally {
            console.log(`${logPrefix} load complete`, {
                playerID,
                totalDurationMs: Math.round(performance.now() - menuLoadStartedAt),
            });
            setLoading(false); // Stop loading regardless of success/failure
            loadInFlightRef.current = false;
        }
    };

    // 2. Call the function
    loadAndBuildCharacters();

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
                            {contextMenu.character?.name}
                        </div>
                        
                        {/* Divider */}
                        <div className="h-px bg-website-default-700/50 my-1 mx-2" />

                        {/* Action: View (High contrast text-website-default-100) */}
                        <button 
                            onClick={() => handleViewCharacter(contextMenu.character?.id)}
                            className="w-full flex items-center px-4 py-2.5 text-website-default-100 hover:bg-website-default-700 transition-all duration-150 group"
                        >
                            <Eye className="size-4 mr-3 text-website-default-400 group-hover:text-website-default-100" />
                            <span className="text-sm font-medium">View Character</span>
                        </button>

                        {/* Action: Edit */}
                        <button 
                            onClick={() => handleEditCharacter(contextMenu.character?.id)}
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
                        
                        {!loading && !error && characters.map(character => {
                            const normalizedCharacter = normalizeCharacterForCard(
                                builtCharacters[character.id],
                                character
                            );

                            return (
                            <div 
                                key={character.id} 
                                onContextMenu={(e) => handleContextMenu(e, normalizedCharacter)}
                                className="relative"
                            >
                                <CharacterCard 
                                    character={normalizedCharacter}
                                    to={`/ISK/${sessionStorage.getItem('session_ID') || 'default'}/character/view/${normalizedCharacter.id}`}
                                />
                            </div>
                        )})}

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
