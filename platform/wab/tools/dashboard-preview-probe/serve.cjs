const { createProbeServer } = require("./server.cjs");
createProbeServer().listen(3217, "127.0.0.1", () => console.log("Cover probe: http://127.0.0.1:3217"));
