import { BrowserRouter as Link, useNavigate } from 'react-router-dom';
import '../Pages.css'
import { SocketContext } from '../socket.io/context';
import {  useContext, useEffect } from "react";


function HomePage() {
  const socket = useContext(SocketContext);


  const navigate = useNavigate();
  const ChacterSelect = () => {
    
    navigate('/character-selection'); 
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
    
    <div className="App">
      <div></div>
      <h1></h1>
       
      <div>
      <button onClick={ ChacterCreation }>Join new lobby</button>
      <button onClick={ ChacterSelect } >Chacter Selection</button>
      <button onClick={ Home } >Exit</button>
      </div>
    </div>
  );
}

export default HomePage;