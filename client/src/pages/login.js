import React, { useState, useContext } from "react";
import { SocketContext } from '../socket.io/context';

function Login() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    function handleLogin() {
        socket.emit("login", { username, password }, (response) => {
            if (response.success) {
                console.log("Login successful, user ID:", response.userId);
                navigate("/home");
            } else {
                console.error("Login failed:", response.error);
                alert("Login failed: " + response.error);
            }
        })

    }
return( 

    <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Login</h1>
        <input 
        placeholder="Username..."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        />
        <input 
        type="password" 
        placeholder="Password..."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Log In</button>
    </div>
)
}


export default Login