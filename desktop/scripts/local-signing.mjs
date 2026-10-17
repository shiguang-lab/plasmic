import { execFileSync, spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";

const LOCAL_SIGNING_IDENTITY = "Apple Development";

export function macSigningCertificate() {
  // Actions packages with ad-hoc signing and must not depend on runner identities.
  if (process.env.GITHUB_ACTIONS === "true") return undefined;
  const result = spawnSync(
    "/usr/bin/security",
    ["find-certificate", "-a", "-c", LOCAL_SIGNING_IDENTITY, "-p"],
    { encoding: "utf8" },
  );
  if (result.status === 44) return undefined;
  if (result.status !== 0)
    throw new Error(
      result.stderr || "Could not read the local signing certificate",
    );
  const certificates = (
    result.stdout.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    ) || []
  )
    .map((pem) => new X509Certificate(pem))
    .filter((certificate) =>
      certificate.subject
        .split("\n")
        .some((line) => line.startsWith(`CN=${LOCAL_SIGNING_IDENTITY}: `)),
    );
  const identities = spawnSync(
    "/usr/bin/security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  if (identities.status !== 0)
    throw new Error("Could not read valid code signing identities");
  const expectedIdentity = process.env.CSC_NAME?.replaceAll(":", "").toUpperCase();
  const usable = certificates.filter((certificate) => {
    const fingerprint = certificate.fingerprint.replaceAll(":", "");
    return (
      (!expectedIdentity || fingerprint === expectedIdentity) &&
      identities.stdout.includes(fingerprint)
    );
  });
  if (usable.length > 1)
    throw new Error(
      "Multiple usable Apple Development identities found; use a build keychain containing the intended identity",
    );
  return usable[0];
}

export function verifyMacSignature(app, certificate) {
  if (!certificate) {
    execFileSync("/usr/bin/codesign", [
      "--verify", "--deep", "--strict", "-R",
      '=identifier "cn.publib.plasmic.desktop"', app,
    ]);
    console.log("macOS application signature and bundle identifier verified");
    return;
  }
  const fingerprint = certificate.fingerprint.replaceAll(":", "");
  const teamId = certificate.subject.match(/^OU=([A-Z0-9]{10})$/m)?.[1];
  if (!teamId)
    throw new Error("Apple Development certificate is missing its Team ID");
  // Local builds retain the selected Apple Development certificate and Team ID.
  const developmentRequirement =
    "anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.1] exists and certificate leaf[field.1.2.840.113635.100.6.1.12] exists";
  execFileSync("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "-R",
    `=identifier "cn.publib.plasmic.desktop" and certificate leaf = H"${fingerprint}" and certificate leaf[subject.OU] = "${teamId}" and ${developmentRequirement}`,
    app,
  ]);
  const result = spawnSync(
    "/usr/bin/codesign",
    ["-d", "--verbose=4", "-r-", app],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0)
    throw new Error(
      result.stderr || "Could not read the application signing requirement",
    );
  const requirement = result.stdout
    .split("\n")
    .find((line) => /^#?\s*designated =>/.test(line));
  if (
    !requirement ||
    /\bcdhash\b/.test(requirement) ||
    !result.stderr.split("\n").includes(`TeamIdentifier=${teamId}`)
  ) {
    throw new Error(
      "The application must retain an Apple Development identity and its Team ID",
    );
  }
  console.log(
    `Local signing certificate: ${fingerprint}\nTeam ID: ${teamId}\n${requirement}`,
  );
}
