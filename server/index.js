const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require('mongodb');
const APIHandler = require("./handlers/apiHandler");
require("dotenv").config();

app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001; // 3001 is only for local dev

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`TESTING 80`);
});

app.get("/", (req, res) => {
  res.send("Backend is running!");
  console.log("Backend is running!");
});


app.use(express.json());
app.use(require("./api/login"));

const dataBase = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }})

  async function runDB() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await dataBase.connect();
    // Send a ping to confirm a successful connection
    await dataBase.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
  }




io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.emit("welcome", { message: "Welcome to the server!" });
  APIHandler(socket);

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  })

});







  runDB()




