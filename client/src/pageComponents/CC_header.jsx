
import { Link } from 'react-router-dom'

export default function CC_Header(){


    return(
       <div class="bg-black text-center p-4 shadow-lg text-white flex flex-row items-center justify-center space-x-8">
        
        <div>
          <h1 class="text-xl">Character Creation</h1>
          <p>
            Character Name
          </p>
        </div>     

        <p class="flex flex-row items-center justify-center space-x-4">
            <Link to="/character-creation/customize">1. Customization</Link>
            <Link to="/character-creation/class">2. Class</Link>
            <Link to="/character-creation/background">3. Background</Link>
            <Link to="/character-creation/species">4. Species</Link>
            <Link to="/character-creation/equipment">5. Equipment</Link>
            <Link to="/character-creation/summary">6. Summary</Link>
        </p>

        </div>
    )


}