const fs = require("node:fs");
const path = require("node:path");

// Renderer diagnostics include the original stack and HTTP request. Keep two
// bounded private files so failures remain available after the app closes.
function attachErrorLog(contents, profile, maxBytes = 5 * 1024 * 1024) {
  const directory = path.join(profile, "logs");
  const file = path.join(directory, "errors.log");
  const listener = (details) => {
    if (!details.message?.startsWith("Studio operation failed ")) return;
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const record = JSON.stringify({ time: new Date().toISOString(), source: details.sourceId,
        detail: JSON.parse(details.message.slice("Studio operation failed ".length)) }) + "\n";
      if (fs.existsSync(file) && fs.statSync(file).size + Buffer.byteLength(record) > maxBytes) {
        fs.renameSync(file, file + ".1");
      }
      fs.appendFileSync(file, record, { mode: 0o600 });
    } catch (error) {
      console.error("Cannot write Desktop error log:", error);
    }
  };
  contents.on("console-message", listener);
  return () => contents.removeListener("console-message", listener);
}
module.exports = { attachErrorLog };
