import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter, useLocation } from 'react-router-dom';
import { useState } from "react";
import getImage from "../handlers/getImage"
import Header_Menu from './header_menu';
import Header_Mail from './header_mail';
import Header_PFP from './header_pfp'

export default function Header() {

    const [menuisPinned, setmenuIsPinned] = useState(false);
    const [profileIsPinned, setprofileIsPinned] = useState(false)
    const [mailIsPinned, setmailIsPinned] = useState(false)
    
      const locate = useLocation()
    

    return(
        <div class="bg-black w-full h-full text-white text-center flex justify-between p-0 item-stretch sticky top-0 border-white border-b">
            <div className="relative inline-block group">
                <div className="p-4 text-white cursor-pointer text-center" onClick={() => setmenuIsPinned(!menuisPinned)}>
                       <img src={getImage("header_menu")} alt="Menu header" className='h-6'/>
                </div>
                <div 
                    className={`absolute top-full left-0 p-4 bg-black shadow-lg transition-opacity duration-200 w-[140px] text-left flex flex-col space-y-8 border-r border-b border-white
                    ${menuisPinned ? "opacity-100 visible" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"}`}>
                    <Header_Menu />
                </div>
       
                    
                <div>
       
                </div>

                </div>


            <div className='absolute left-1/2 -translate-x-1/2 inline-block text-xl'>
                <div className='p-4'>
                    {locate.pathname.split("/").pop().replace(/^./,locate.pathname.split("/").pop().charAt(0).toUpperCase())}
                </div>
            </div>

            <div className='inline-block'>
                <div className='p-4 flex flex-row space-x-8 relative'>
                    <div className='group inline-block'>
                        <div className='text-center relative cursor-pointer' onClick={() => setmailIsPinned(!mailIsPinned)}>
                            <img src={getImage("header_email")} alt="Menu Email" className='h-6'/>
                            
                            <div className="h-4 w-4 bg-red-600 rounded-full absolute -bottom-1 -right-1 text-[10px] text-center">
                                99+
                            </div>
                        </div> 
                        <div 
                                className={`absolute top-full right-0 p-4 bg-black shadow-lg transition-opacity duration-200 w-[250px] text-left flex flex-col space-y-8 border-l border-b border-white
                                ${mailIsPinned ? "opacity-100 visible" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"}`}>
                                <Header_Mail />
                            </div>
                    </div>
                    <div className="group inline-block">
                        <div className="text-white cursor-pointer text-center" onClick={() => setprofileIsPinned(!profileIsPinned)}>
                            <img src={getImage("header_pfp")} alt="Menu PFP" className='h-6'/>
                        </div>
                        <div 
                            className={`absolute top-full right-0 p-4 bg-black shadow-lg transition-opacity duration-200 w-[250px] text-left flex flex-col space-y-8 border-l border-b border-white
                            ${profileIsPinned ? "opacity-100 visible" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"}`}>
                            <Header_PFP />
                        </div>
                        
                    </div>
                </div>
            </div>
        </div>
        
    )
}