import React, { useState } from "react";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    function handleLogin() {
        console.log("Username:", username);
        console.log("Password:", password);

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