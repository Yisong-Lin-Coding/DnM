

export default function BodySkeleton({children}){


    return(
        <div className="grid grid-cols-[1fr_3fr_1fr] grid-col w-screen h-screen ">
            {children}
        </div>
    )
}