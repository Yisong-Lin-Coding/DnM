import { BrowserRouter as Link, useNavigate } from 'react-router-dom';
import '../Pages.css'
import { SocketContext } from '../socket.io/context';
import {  useContext, useEffect } from "react";
import getImage from '../handlers/getImage';
import Skeleton from '../pageComponents/skeleton';
import Header from '../pageComponents/header'

 const sessionID=() => sessionStorage.getItem("session_ID")


function HomePage() {
  const socket = useContext(SocketContext);


  const navigate = useNavigate();
  const CharacterMenu = () => {
    
    navigate(`/ISK/${sessionID()}/character-menu`); 
} 

const ChacterCreation = () => {
    
    navigate('/character-creation'); 
}

const Home = () =>{
  navigate(`/`)
}
  let adminPermission = sessionStorage.getItem("adminPermission")


    useEffect(()=>{

      const playerID = localStorage.getItem("player_ID")
      function adminPermissionCheck(){
        socket.emit(`login_adminPermissionCheck`, {playerID}, (response) =>{
          if(response.success){
            sessionStorage.setItem(`adminPermission`, true)
            console.log(`adminPermission set to true`)
          }
          else{
            sessionStorage.setItem(`adminPermission`, false)
            console.log(`adminPermission set to false`)
          }

        })

      }
      adminPermissionCheck()

    },[])


  return ( 
    <div className="relative min-h-screen w-full">
             <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${getImage("homepage_background")})` }}
                  >
       <div className="relative z-10 grid grid-rows-[25vh_75vh] grid-cols-[1fr_3fr_1fr] items-center justify-center w-full text-center text-white p-5 h-screen">




        <div className="col-start-2 row-start-2 self-start w-[40%] mx-auto h-[55%] flex flex-col justify-between items-center p-8 space-y-4 rounded-lg bg-black/60 text-lg"> 
          <button onClick={CharacterMenu}>Lore</button> 
          <button onClick={CharacterMenu}>Campaign</button> 
          <button onClick={CharacterMenu}>Characters</button>
          <button>Exit</button>
        </div>
      
      </div>
      </div>
      </div>

   
  );
}

export default HomePage;