
import { Link } from "react-router-dom"
import { useNavigate } from 'react-router-dom';


export default function Footer(){





    return(
        <div className="bg-black font-serif text-center text-white p-4 flex flex-col justify-between items-center">
          <div className="flex flex-row space-x-4 p-4">
            <div>
                <Link 
                to="/"
                >Home</Link>
            </div>
            <div className=" w-px bg-white h-full" />
            <div>
                <a 
                  href="https://github.com/Yisong-Lin-Coding/DnM"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Help
                </a>
            </div>
            <div className=" w-px bg-white h-full" />
            <div>
               <a 
                  href="https://github.com/Yisong-Lin-Coding/DnM"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Github
                </a>
            </div>
            <div className=" w-px bg-white h-full" />
            <div>
                <a 
                  href="https://www.linkedin.com/in/yisong-lin-8605a3357/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Linkedin
                </a>
            </div>
          </div>

          <div className=" p-4 max-w-[65vw] text-sm">
            All game mechanics and content from the System Reference Document are Open Game Content under the Open Game License v1.0a. All other content is Product Identity of Yisong Lin and may not be used without permission.
          </div>

        </div>
    )


}