import {Link} from 'react-router-dom';
import Mail_Card from './mail_card';

export default function Header_Menu(){


    return(
    <div className='space-y-8'>
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
                            Navigation
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
        </div>
    )
}