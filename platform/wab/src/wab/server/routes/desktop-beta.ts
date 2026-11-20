import { shiguangIdentityMiddleware } from "@/wab/server/auth/shiguang";
import { getPublicUrl } from "@/wab/shared/urls";
import type { Application, Request, Response } from "express";
import { readFile, readdir } from "fs/promises";
import path from "path";
import semver from "semver";

const number = "(?:0|[1-9][0-9]*)";
const betaVersion = `${number}[.]${number}[.]${number}-beta[.]${number}`;
const versionPattern = new RegExp(`^${betaVersion}$`);
const targets = new Map([
  ["darwin/arm64", ["latest-mac.yml", "mac-arm64[.](?:zip|dmg)"]],
  ["darwin/x64", ["latest-mac.yml", "mac-x64[.](?:zip|dmg)"]],
  ["win32/x64", ["latest.yml", "win-x64[.]exe"]],
  ["linux/x64", ["latest-linux.yml", "linux-x86_64[.]AppImage"]],
]);

function eligible(req: Request) {
  const ids = (process.env.DESKTOP_BETA_USER_IDS || "")
    .split(",")
    .map((id) => id.trim());
  return !!req.shiguangIdentity && !!req.user?.id && ids.includes(req.user.id);
}

const directory = () =>
  process.env.DESKTOP_BETA_DIRECTORY || "/plasmic/desktop-beta";

// The public installer index is authoritative for the current Desktop version,
// even if another product has since advanced the repository's latest tag.
export function addDesktopUpdateDiscovery(app: Application) {
  // Only discovery treats invalid credentials as anonymous. Downloads use the
  // normal authenticated API middleware and recheck eligibility for every file.
  app.get(
    "/api/v1/desktop-updates/latest",
    (req, res, next) =>
      shiguangIdentityMiddleware(req, res, (error) => {
        if (error) {
          req.user = undefined;
          req.shiguangIdentity = undefined;
        }
        next();
      }),
    getDesktopUpdate,
  );
}

async function getDesktopUpdate(req: Request, res: Response) {
  res.set("Cache-Control", "private, no-store");
  const response = await fetch(
    `${getPublicUrl()}/desktop-updates/latest.json`,
    {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error(`Desktop release index returned HTTP ${response.status}`);
  const release = await response.json();
  if (eligible(req)) {
    try {
      const root = directory();
      const entries = await readdir(root, { withFileTypes: true });
      const newest = entries
        .filter(
          (entry) =>
            entry.isDirectory() &&
            versionPattern.test(entry.name) &&
            semver.valid(entry.name),
        )
        .map((entry) => entry.name)
        .sort(semver.rcompare)[0];
      if (newest && semver.gt(newest, release.version)) {
        const beta = JSON.parse(
          await readFile(path.join(root, newest, "latest.json"), "utf8"),
        );
        if (beta.version === newest) {
          res.json(beta);
          return;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn("Cannot read Desktop beta index", error);
    }
  }
  res.json(release);
}

export function getDesktopBeta(req: Request, res: Response) {
  res.set("Cache-Control", "private, no-store");
  const { platform, arch, version, file } = req.params;
  const target = targets.get(`${platform}/${arch}`);
  if (!eligible(req) || !target || !versionPattern.test(version)) {
    res.sendStatus(404);
    return;
  }
  const asset = new RegExp(
    `^Plasmic-(${betaVersion})-${target[1]}(?:[.]blockmap)?$`,
  );
  if (file !== target[0] && asset.exec(file)?.[1] !== version) {
    res.sendStatus(404);
    return;
  }
  res.sendFile(file, {
    root: path.join(directory(), version, platform, arch),
    cacheControl: false,
  });
}
