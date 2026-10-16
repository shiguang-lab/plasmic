const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

test(
  "Apple Development signatures preserve Team ID across code and reject ad-hoc or mismatched apps",
  { skip: process.platform !== "darwin" },
  async (t) => {
    const { localSigningCertificate, verifyLocalSignature } =
      await import("../scripts/local-signing.mjs");
    const certificate = localSigningCertificate();
    if (!certificate) {
      t.skip(
        "Import an Apple Development identity to exercise native local signatures",
      );
      return;
    }
    const identity = certificate.fingerprint.replaceAll(":", "");
    const previousIdentity = process.env.CSC_NAME;
    try {
      process.env.CSC_NAME = identity;
      assert.equal(localSigningCertificate()?.fingerprint, certificate.fingerprint);
      process.env.CSC_NAME = "0".repeat(40);
      assert.equal(localSigningCertificate(), undefined);
    } finally {
      if (previousIdentity === undefined) delete process.env.CSC_NAME;
      else process.env.CSC_NAME = previousIdentity;
    }
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "plasmic-signature-test-"),
    );
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const requirements = [],
      hashes = [];
    for (const name of ["true", "false"]) {
      const target = path.join(directory, name);
      await fs.copyFile(`/usr/bin/${name}`, target);
      await fs.chmod(target, 0o755);
      execFileSync(
        "/usr/bin/codesign",
        [
          "--force",
          "--sign",
          identity,
          "--identifier",
          "cn.publib.plasmic.desktop",
          target,
        ],
        { stdio: "pipe" },
      );
      verifyLocalSignature(target, certificate);
      requirements.push(
        spawnSync("/usr/bin/codesign", ["-d", "-r-", target], {
          encoding: "utf8",
        }).stdout,
      );
      const details = spawnSync(
        "/usr/bin/codesign",
        ["-dv", "--verbose=4", target],
        { encoding: "utf8" },
      );
      const hash = details.stderr.match(/^CDHash=(\w+)$/m)?.[1];
      assert.ok(hash);
      hashes.push(hash);
    }
    assert.notEqual(hashes[0], hashes[1]);
    assert.equal(requirements[0], requirements[1]);

    const target = path.join(directory, "true");
    execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", target], {
      stdio: "pipe",
    });
    assert.throws(() => verifyLocalSignature(target, certificate));
    execFileSync(
      "/usr/bin/codesign",
      [
        "--force",
        "--sign",
        identity,
        "--identifier",
        "another.application",
        target,
      ],
      { stdio: "pipe" },
    );
    assert.throws(() => verifyLocalSignature(target, certificate));
  },
);
