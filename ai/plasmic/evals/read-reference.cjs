const fs = require("node:fs"),
  path = require("node:path");
const [run, ...files] = process.argv.slice(2);
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  fs.appendFileSync(
    run + "/reference-reads.jsonl",
    JSON.stringify({
      path: path.resolve(file),
      bytes: Buffer.byteLength(content),
    }) + "\n",
  );
  console.log(`\n${file}\n${content}`);
}
