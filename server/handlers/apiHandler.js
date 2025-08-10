const fs = require("fs");
const path = require("path");

function APIHandler(socket) {
  const eventsDir = path.join(__dirname, "../events");

  fs.readdirSync(eventsDir).forEach((file) => {
    if (file.endsWith(".js")) {
      const eventHandler = require(path.join(eventsDir, file));
      if (typeof eventHandler === "function") {
        eventHandler(socket); // pass socket to the event handler
      }
    }
  });
}

module.exports = APIHandler;