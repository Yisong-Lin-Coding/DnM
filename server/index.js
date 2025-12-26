const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const APIHandler = require("./handlers/apiHandler");
const { loadItems } = require("./handlers/itemLoader");
require("dotenv").config();

app.use(cors());
app.use(express.json());
app.use(require("./api/login"));

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running!");
  console.log("Backend GET / called");
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,
})
.then(async () => {
  console.log("MongoDB connected!");

  // Load game data from database
  await loadItems();

  // Start server and Socket.IO after DB is ready
  const PORT = process.env.PORT || 3001;
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.emit("welcome", { message: "Welcome to the server!" });
    APIHandler(socket);

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Node version:", process.version);
  });

})
.catch(err => {
  console.error("Error connecting to MongoDB:", err);
});
