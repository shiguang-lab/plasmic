const fs = require("node:fs");
const { replaceDomains } = require("./migrate-domains.cjs");

// Stage private deployment files without switching a running installation.
if (!process.argv[2]) {
  console.error("Usage: node deploy/prepare-domain-files.cjs <env-or-config-file> [...]");
  process.exitCode = 1;
} else {
  for (const file of process.argv.slice(2)) {
    const original = fs.readFileSync(file, "utf8");
    const next = replaceDomains(original);
    if (next === original) {
      console.log(`${file}: already uses the new domains`);
      continue;
    }
    const target = `${file}.plasmic-domain-next`;
    fs.writeFileSync(target, next, { mode: fs.statSync(file).mode & 0o777 });
    fs.chmodSync(target, fs.statSync(file).mode & 0o777);
    console.log(`Prepared ${target}; original unchanged`);
  }
}
