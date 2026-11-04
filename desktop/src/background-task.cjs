const { parentPort } = process;
let drafts;

parentPort.on("message", async ({ data: { task, input } }) => {
  try {
    let result;
    if (task === "trace") result = require("./raster-vector.cjs").tracePng(Buffer.from(input.png), input.colors);
    else if (task === "vector") result = require("./vector.cjs").makeVector(input);
    else if (task === "draft-store") {
      if (!drafts) {
        drafts = new (require("./draft-files.cjs").DraftFiles)(input.directory, { maxBytes: input.maxBytes });
        drafts.summaries = new Map(input.summaries);
      }
      if (!["write", "read", "list", "remove"].includes(input.method)) throw new Error("Unknown draft method");
      let value = await drafts[input.method](...input.args);
      parentPort.postMessage({ result: { value, summaries: [...drafts.summaries] } });
      return;
    } else throw new Error("Unknown background task");
    parentPort.postMessage({ result });
  } catch (error) {
    parentPort.postMessage({ error: { ...error, name: error.name, message: error.message, stack: error.stack } });
  }
});
