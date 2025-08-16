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

app.use(express.json());
app.use(require("./api/login"));

const dataBase = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }})

  async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await dataBase.connect();
    // Send a ping to confirm a successful connection
    await dataBase.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await dataBase.close();
  }
  }

  run().catch(console.dir);


io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  APIHandler(socket);

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  })

});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



