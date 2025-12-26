import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import IndexCardFolder from "../../pageComponents/indexCard";
import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../../socket.io/context";
import { Plus } from "lucide-react"


export default function CharacterMenu(){

    const socket = useContext(SocketContext);
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const playerID = localStorage.getItem("player_ID");

    useEffect(() => {
        if (!socket || !playerID) {
            console.log('CharacterMenu: missing socket or playerID', { socketReady: !!socket, playerID });
            setLoading(false);
            return;
        }

        console.log('CharacterMenu: fetching characters', { socketConnected: socket.connected, playerID });

        const onConnect = () => console.log('CharacterMenu socket connected', socket.id);
        socket.on('connect', onConnect);

        setLoading(true);
        setError(null);

        socket.emit("playerData_getCharacter", { playerID }, (response) => {
            console.log('playerData_getCharacter response', response);
            if (!response || !response.success) {
                console.error('Character fetch failed', response && response.message);
                setError(response?.message || 'Failed to fetch characters');
                setCharacters([]);
                setLoading(false);
                return;
            }
            setCharacters(response.characters || []);
            setLoading(false);
        });

        return () => socket.off('connect', onConnect);
    }, [socket, playerID]);


    return(
        <>
        
        <Body className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100  justify-center space-x-8">
            <Header className="col-span-3" />
            <Body.Left className="row-span-1 col-start-1">
                    
                </Body.Left>
            <Body.Center className="row-span-1 col-start-2">

                <IndexCardFolder>

                    {loading && <div>Loading characters...</div>}
                    {error && <div className="text-red-400">Error: {error}</div>}
                    {!loading && !error && characters && characters.map(character => (

                    <div key={character.id}>

                        hello there {character.name}
                        
                        
                    </div>
                    ))}

                    <IndexCardFolder.File className=" " to={`/ISK/${sessionStorage.getItem(`session_ID`)}/character-creation`}>
                        <IndexCardFolder.File.Bottom>
                            <Plus className="size-8 aspect-[1/1]" />
                            <IndexCardFolder.File.Detail>
                                <p>Add New Character...</p>
                            </IndexCardFolder.File.Detail>
                        </IndexCardFolder.File.Bottom>
                    </IndexCardFolder.File>
                    
                    
                </IndexCardFolder>

                </Body.Center>
            <Body.Right className="col-start-3">

                </Body.Right>
            <Body.Footer className="col-span-3">

                </Body.Footer>
        </Body>
        </>
    )
}