import { useNavigate } from "react-router-dom";

export default function IndexCardFolder({ children, className = "" }){
    
    return(
        <div className={`
         grid-cols-1 grid p-8 gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))] grid-center
          ${className}`}>
                {children}
        </div>
    )
}

IndexCardFolder.File = function IndexCardFile({ children, className = "", to, href, onClick }){
    const navigate = useNavigate();
    const isClickable = to || href || onClick;

    const handleClick = (e) => {
        // Don't trigger if clicking on a button or link inside
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
            return;
        }

        if (onClick) {
            onClick();
        } else if (to) {
            navigate(to);
        } else if (href) {
            window.location.href = href;
        }
    };

    return(
        <div 
            className={`
                aspect-[4/7] span-cols-1  
                grid grid-rows-[auto_auto_1fr]
                border-2 bg-website-default-500 border-website-specials-300 
                ${isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} 
                ${className}`}
                onClick={isClickable ? handleClick : undefined}
            > 
            {children}
        </div>
    )
}

IndexCardFolder.File.Top = function FileTop({ children, className = "" }){


    return(
        <div 
            className={`
                row-start-1

                ${className}`}
                >
            {children}
        </div>
        )
}

IndexCardFolder.File.Middle = function FileMiddle({ children, className = "" }){


    return(
        <div 
            className={`
                row-start-2

                ${className}`}
                >
            {children}

            <div className="
                h-px bg-website-default-500 mb-4 mt-2
            " />
        </div>
        )
}

IndexCardFolder.File.Bottom = function FileBottom({ children, className = "" }){


    return(
        <div 
            className={`
                row-start-3 
                flex flex-col items-center justify-center
                
                ${className}`}
                >
            {children}
        </div>
        )
}

IndexCardFolder.File.Image = function FileImage({ children, className = "" }){


    return(
        <div 
            className={`
                

                ${className}`}
                >
            {children}
        </div>
        )
}



IndexCardFolder.File.Title = function FileTitle({ children, className = "" }){


    return(
        <div 
            className={`
                

                ${className}`}
                >
            {children}
        </div>
        )
}

IndexCardFolder.File.Description = function FileDescription({ children, className = "" }){

    return(
        <div 
            className={`
                text-website-default-300 text-xs

                ${className}`}
                >
            {children}
        </div>
        )

}
IndexCardFolder.File.Actions = function FileAction({ children, className = "" }){


    return(
        <div 
            className={`
                

                ${className}`}
                >
            {children}
        </div>
        )
}

IndexCardFolder.File.Detail = function FileDetail({ children, className = "" }){
 

    return(
        <div 
            className={`
                

                ${className}`}
                >
            {children}
        </div>
        )
}