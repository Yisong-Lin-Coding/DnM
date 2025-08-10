const fs = require("fs");
const path = require("path");
const APIs = require("../handlers/apiGrabber")();

function APIHandler(socket) {
  
    for (const [apiName, apiPath] of Object.entries(APIs)) {
        const apiModule = require(apiPath);
        if (typeof apiModule === "function") {
            apiModule(socket);
        } else {
            console.warn(`API module ${apiName} is not a function.`);
        }
    }

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });

}

module.exports = APIHandler;