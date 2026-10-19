const { createProbeServer } = require("./server.cjs");
createProbeServer({ production: true }).listen(3218, "127.0.0.1", () => console.log("Production preview harness: http://127.0.0.1:3218"));
