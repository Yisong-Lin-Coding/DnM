import React from "react";
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";


export default function CharacterMenu(){


    return(
        <>
        
        <Body className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100  justify-center space-x-8">
            <Header className="col-span-3" />
            <Body.Left className="row-span-1 col-start-1">
                    HELLO
                </Body.Left>
            <Body.Center className="row-span-1 col-start-2">
                </Body.Center>
            <Body.Right className="col-start-3">

                </Body.Right>
            <Body.Footer className="col-span-3">

                </Body.Footer>
        </Body>
        </>
    )
}