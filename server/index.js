const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const APIHandler = require("./handlers/apiHandler");
require("dotenv").config();

app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://yisong-lin-coding.github.io",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(require("./api/login"));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});



io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  APIHandler(socket);

});

server.listen(process.env.PORT || 3001, () => {
  console.log(`Server is running on port ${process.env.PORT || 3001}`);
});

io.on("disconnect", (socket) => {
  console.log("A user disconnected:", socket.id);
});



