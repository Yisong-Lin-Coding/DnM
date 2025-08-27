
import { Link } from "react-router-dom"

export default function Footer(){

    return(
        <div className="bg-black font-serif text-center text-white p-4 flex flex-col justify-between items-center">
          <div className="flex flex-row space-x-4 p-4">
            <div>
                <Link>Home</Link>
            </div>
            <div className=" w-px bg-white h-full" />
            <div>
                <Link>Help</Link>
            </div>
            <div className=" w-px bg-white h-full" />
            <div>
                <Link>Github</Link>
            </div>
            <div className=" w-px bg-white h-full" />
            <div>
                <Link>Linkedin</Link>
            </div>
          </div>

          <div className=" p-4 max-w-[65vw] text-sm">
            All game mechanics and content from the System Reference Document are Open Game Content under the Open Game License v1.0a. All other content is Product Identity of Yisong Lin and may not be used without permission.
          </div>

        </div>
    )


}