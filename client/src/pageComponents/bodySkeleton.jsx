

export function Body({children}){


    return(
        <div className="grid grid-cols-[1fr_3fr_1fr] grid-col w-screen h-screen ">
            {children}
        </div>
    )
}

Body.Header = function BodyHeader({children}){

    return(
        <div>
            
        </div>
    )
}

Body.Left = function BodyLeft({children}){

    return(
        <div>

        </div>
    )
}

Body.Right = function BodyRight({children}){
    
    return(
        <div>

        </div>
    )
}

Body.Center = function BodyCenter({children}){

    return(
        <div>

        </div>
    )
}

Body.Footer = function BodyFooter({children}){

    return(
        <div>

        </div>
    )
}