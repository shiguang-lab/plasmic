const fs = require("node:fs");
const [run, ...args] = process.argv.slice(2);
fs.appendFileSync(
  run + "/official-calls.jsonl",
  JSON.stringify({ args }) + "\n",
);
if (args.includes("--version")) {
  console.log("0.1.381");
} else if (args.includes("--help")) {
  console.log(
    "plasmic info --projects <IDs...> --host <URL> --json\nplasmic sync --projects <IDs...> (writes managed code)",
  );
} else if (
  args[0] === "info" &&
  args.includes("--projects") &&
  args.includes("--host")
) {
  console.log(
    JSON.stringify([
      {
        id: "official-evaluation-project",
        name: "Official metadata fixture",
        lastPublishedVersion: "2.3.0",
        hostUrl: null,
      },
    ]),
  );
} else {
  console.error("Unsupported fixture invocation");
  process.exitCode = 1;
}
