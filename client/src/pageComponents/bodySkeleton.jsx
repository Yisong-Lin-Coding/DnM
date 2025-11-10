import Header from "./header"

export default function Body({children, className=""}){


    return(
        <div className={`grid grid-cols-[1fr_3fr_1fr] grid-rows-[auto_1fr_auto] grid-col w-screen h-screen ${className}`}>
            {children}
        </div>
    )
}

Body.Header = function BodyHeader({children, className=""}){

    return(
        <Header className={`col-span-3 row-start-1 ${className}`}>
      {children}
    </Header>
    )
}

Body.Left = function BodyLeft({children, className=""}){

    return(
        <div className={`col-start-1 row-start-2${className}`}>{children}</div>
    )
}

Body.Right = function BodyRight({children, className=""}){
    
    return(
        <div className={`col-start-3 row-start-2 ${className}`}>{children}</div>
    )
}

Body.Center = function BodyCenter({children, className=""}){

    return(
        <div className={`col-start-2 row-start-2 ${className}`}>{children}</div>
    )
}

Body.Footer = function BodyFooter({children, className=""}){

    return(
        <div className={`col-span-3 row-start-3 ${className}`}>{children}</div>
    )
}