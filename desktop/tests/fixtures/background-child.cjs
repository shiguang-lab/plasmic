const { EventEmitter } = require("node:events");
process.parentPort = new EventEmitter();
process.parentPort.postMessage = message => process.send(message);
process.on("message", data => process.parentPort.emit("message", { data }));
process.on("disconnect", () => process.exit());
require(process.argv[2]);
