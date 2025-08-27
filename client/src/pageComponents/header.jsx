import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter, useLocation } from 'react-router-dom';
import { useState } from "react";

export default function Header() {

    const [menuisPinned, setmenuIsPinned] = useState(false);
    const [profileIsPinned, setprofileIsPinned] = useState(false)
    
      const locate = useLocation()
    

    return(
        <div class="bg-black w-full h-full text-white text-center flex justify-between p-0 item-stretch">
            <div className="relative inline-block group">
                <div className="p-4 text-white cursor-pointer" onClick={() => setmenuIsPinned(!menuisPinned)}>
                       Menu
                </div>
                <div 
                    className={`absolute top-full left-0 p-4 bg-black shadow-lg transition-opacity duration-200 w-[140px] text-left flex flex-col space-y-8
                    ${menuisPinned ? "opacity-100 visible" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"}`}>
                    <div>
                        Lookup
                        <div class="h-px bg-gray-300 mb-4 mt-2"></div>
                            <div class="flex flex-col space-y-4">
                                <div >
                                    <Link>Classes</Link>
                                </div>
                                <div>
                                    <Link>Backgrounds</Link>
                                </div>
                                <div>
                                    <Link>Races</Link>
                                </div>
                                <div>
                                    <Link>Spells</Link>
                                </div>
                                <div>
                                    <Link>Items</Link>
                                </div>
                                <div>
                                    <Link>Lore</Link>
                                </div>
                                <div>
                                    <Link>Enemies</Link>
                                </div>
                            </div>
                    </div>
       
                    <div>
                            Nav
                            <div class="h-px bg-gray-300 mb-4 mt-2"></div>
                            <div class="flex flex-col space-y-4">
                                <div>
                                    <Link>Home</Link>
                                </div>
                                <div>
                                    <Link>Lobby</Link>
                                </div>
                                <div>
                                    <Link>Sign Out</Link>
                                </div>
                            </div>
                    </div>
                <div>
       
                </div>

                </div>
            </div> 

            <div className='absolute left-1/2 -translate-x-1/2 inline-block'>
                <div className='p-4'>
                    {locate.pathname.split("/").pop().replace(/^./,locate.pathname.split("/").pop().charAt(0).toUpperCase())}
                </div>
            </div>

            <div className='relative inline-block'>
                <div className='p-4 flex flex-row space-x-8'>
                    <div>
                        Mail
                    </div>
                    <div className="relative inline-block group">
                        PFP
                    </div>
                    <div>
                        Setting
                    </div>
                </div>
            </div>
        </div>
    )
}