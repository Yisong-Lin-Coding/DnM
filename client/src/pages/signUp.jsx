import { Link, useNavigate } from 'react-router-dom';
import { useState, useContext } from "react";
import { SocketContext } from '../socket.io/context';
import getImage from '../handlers/getImage';


  const SignupScreen = () =>{

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const socket = useContext(SocketContext);
    const navigate = useNavigate();

     
    const Signup = () => {
    
      console.log("Attempting to sign up with username:", username);
      console.log("Attempting to sign up with password:", password);

    socket.emit("signup", { username, password }, (response) => {
      if (response.success == true) {
        console.log("Signup successful, user ID:", response.userId);
        navigate(`/ISK/${sessionStorage.getItem("session_ID")}/home`);
      } else {
        console.error("Signup failed:", response.error);
        alert("Signup failed: " + response.error);
      }
    });
  }


  

  return (
    <div className="relative min-h-screen w-full">
         <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getImage("loginpage_background")})` }}
              />

    <div className="absolute w-1/3 p-16 bg-black/85 h-screen top-0 right-0">
        <div className="flex flex-col text-white h-full">
            <div className="text-2xl">
                Sign Up
            </div>
            <div className="flex space-y-6 flex-col pt-8">
                <div className="flex space-y-1 flex-col">
                    <div>Username</div>
                    <div>
                        <input 
                            type="text"
                            placeholder="Username..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="bg-transparent border-b border-b-white text-white w-full focus:outline-none focus:ring-0"
                            />
                    </div>
                </div>
                <div className="flex space-y-1 flex-col">
                    <div>Password </div>
                    <div>
                        <input 
                            type="password" 
                            placeholder="Password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-transparent border-b border-b-white text-white w-full focus:outline-none focus:ring-0 "
                            />
                    </div>
                </div>
                <button 
                    onClick={Signup} 
                    className="relative bg-blue-500 text-white px-4 py-2 rounded-full w-full">
                        Sign Up
                </button>
                <div className='text-center'>
                  <p>Already have an account? <Link to="/login">Login here</Link>.</p>
                </div>
            </div>
            
            <div className="mt-auto flex flex-row justify-center text-xs space-x-2">
                <div>
                    <Link to="/">Home</Link>
                </div>
                <div>|</div>
                <div>
                    <Link>About</Link>
                </div>
                <div>|</div>
                <div>
                    <Link>Github</Link>
                </div>
            </div>
        </div>
         
        
        
    </div>
    </div>
  );
}



export default SignupScreen;