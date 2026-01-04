import Skeleton from "../../pageComponents/skeleton"
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import { SocketContext } from "../../socket.io/context";
import { useContext, useEffect } from "react";

import { useParams } from "react-router-dom";



export default function CharacterViewer(){

    const socket = useContext(SocketContext);
    const {characterID} = useParams()


        useEffect(() => {
        if (!characterID) return; // optional safety check

        socket.emit(
            'database_query',
            {
            collection: 'character',
            operation: 'findById',
            filter: { _id:characterID },
            },
            (response) => {
            if (response.success) {
                console.log(response);
            } else {
                console.error('Failed to fetch character:', response.error);
            }
            }
        );
        }, [socket, characterID]);



    return(

            <Body className="bg-website-default-900 text-center shadow-lg text-website-default-100  justify-center space-x-8">
            <Header className="col-span-3" title={"heje"} />





                        <Body.Footer>
                            </Body.Footer>
            
        </Body>

    )
}