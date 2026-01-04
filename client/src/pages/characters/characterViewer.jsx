import Skeleton from "../../pageComponents/skeleton"
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";

import { useParams } from "react-router-dom";



export default function CharacterViewer(){

    const {characterID} = useParams




    return(

            <Body className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100  justify-center space-x-8">
            <Header className="col-span-3" />
            




                        <Body.Footer className="col-span-3">
                            </Body.Footer>
            
        </Body>

    )
}