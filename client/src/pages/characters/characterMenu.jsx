import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import IndexCardFolder from "../../pageComponents/indexCard";
import { useContext } from "react";
import { SocketContext } from "../../socket.io/context";
import { Plus } from "lucide-react"


export default function CharacterMenu(){

    let playerID = localStorage.getItem("player_ID")
    const socket = useContext(SocketContext);
    let characters = []

    socket.emit("playeData_getCharacter", { playerID }, (response) => {
            if (!response.success){
                console.log(`ERROR ${response.error}`)
                alert ('Data retrival failed')
                return
            }

            characters.push(...response.characters)
                                        
            })


    return(
        <>
        
        <Body className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100  justify-center space-x-8">
            <Header className="col-span-3" />
            <Body.Left className="row-span-1 col-start-1">
                    
                </Body.Left>
            <Body.Center className="row-span-1 col-start-2">

                <IndexCardFolder>

                    {characters && characters.map(character => (

                    <div key={character.id}>

                        {character.name}
                        
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