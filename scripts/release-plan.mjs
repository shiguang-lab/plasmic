import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions } from "../packages/plasmic-cli/src/protocol.mjs";
import { isNewReleaseSeries } from "./release-version.mjs";

const version = "(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)";
const patterns = Object.fromEntries(
  Object.entries({
    studio: "",
    desktop: "desktop-v",
    cli: "cli-v",
    resources: "resources-v",
  }).map(([key, prefix]) => [key, new RegExp(`^${prefix}${version}$`)]),
);
export function productForTag(tag) {
  const product = Object.keys(patterns).find((key) => patterns[key].test(tag));
  if (!product) {
    throw new Error(`Unsupported release tag: ${tag}`);
  }
  return product;
}
export function affectedProducts(files) {
  const result = {
    studio: false,
    desktop: false,
    cli: false,
    resources: false,
    frontend: false,
  };
  for (const file of files) {
    if (
      /^ai\/plasmic\/(references|scripts)\/.*\.(md|py|json)$/.test(file) &&
      !path.basename(file).startsWith("test_")
    ) {
      result.resources = true;
    }
    if (
      file === "scripts/build-plasmic-resources.mjs" ||
      file === "scripts/release-resources.mjs" ||
      file === "scripts/validate-plasmic-references.mjs" ||
      file === "scripts/validate-plasmic-component-coverage.mjs" ||
      file === "packages/plasmic-cli/src/protocol.mjs"
    ) {
      result.resources = true;
    }
    if (
      /^packages\/plasmic-cli\/(src\/|skill\/|package\.json$)/.test(file) ||
      file === "scripts/build-plasmic-resources.mjs"
    ) {
      result.cli = true;
      result.resources = true;
    }
    if (
      /\.(test|spec)\.[^/]+$/.test(file) ||
      /(^|\/)(tests|__tests__|release-notes)\//.test(file) ||
      /\.(md|mdx)$/.test(file)
    ) {
      continue;
    }
    if (
      /^desktop\//.test(file) &&
      !/^desktop\/scripts\/(publish|setup-nas|nas-|.*resources)/.test(file)
    ) {
      result.desktop = true;
    }
    const shared =
      /^(packages\/(?!plasmic-cli\/)|plasmicpkgs\/|patches\/)/.test(file) ||
      /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|build\.mjs|\.npmrc|\.dockerignore)$/.test(
        file,
      );
    const platform = /^platform\//.test(file);
    if (shared || platform || /^deploy\//.test(file)) {
      result.studio = true;
    }
    const backend =
      /^platform\/(wab\/(src\/wab\/(server|migrations)\/|.*server.*config)|preview\/)/.test(
        file,
      );
    if (
      shared ||
      (platform && !backend) ||
      file === "deploy/Dockerfile" ||
      file === "scripts/bundle-studio-fonts.mjs"
    ) {
      result.frontend = true;
    }
  }
  result.studio ||= result.frontend;
  result.desktop ||= result.frontend;
  return result;
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
export function releasePlan(tag, ref = "HEAD", rebuild = false) {
  const product = productForTag(tag);
  const tags = git("tag", "--merged", ref, "--sort=-version:refname")
    .split("\n")
    .filter((t) => t !== tag);
  // 0.0.83 is the last combined release. Later Studio tags must never advance
  // the baseline for resources that have not received their first independent tag.
  const baseline =
    tags.find((t) => patterns[product].test(t)) ||
    (["cli", "resources"].includes(product)
      ? tags.find(
          (t) => patterns.studio.test(t) && compareVersions(t, "0.0.83") <= 0,
        )
      : undefined);
  const files = (
    baseline
      ? git("diff", "--name-only", baseline, ref)
      : git("ls-tree", "-r", "--name-only", ref)
  ).split("\n");
  const affected = affectedProducts(files);
  const milestone = Boolean(
    baseline &&
    isNewReleaseSeries(
      tag.replace(/^(desktop-v|cli-v|resources-v)/, ""),
      baseline.replace(/^(desktop-v|cli-v|resources-v)/, ""),
    ),
  );
  const publish =
    milestone ||
    (product === "desktop"
      ? affectedProducts(files.filter((file) => file.startsWith("desktop/")))
          .desktop
      : affected[product]);
  let desktopTag = "";
  if (product === "studio" && publish && (affected.frontend || milestone)) {
    const pkg = JSON.parse(git("show", `${ref}:desktop/package.json`));
    const config = JSON.parse(
      git("show", `${ref}:desktop/desktop.config.json`),
    );
    desktopTag = `desktop-v${pkg.version}`;
    if (
      !patterns.desktop.test(desktopTag) ||
      config.webImage !== `ghcr.io/shiguang-lab/plasmic-web:${tag}`
    ) {
      throw new Error(
        "Frontend release requires a new Desktop version, release notes, and webImage pinned to this Studio tag",
      );
    }
    const lock = JSON.parse(git("show", `${ref}:desktop/package-lock.json`));
    if (
      lock.version !== pkg.version ||
      lock.packages?.[""]?.version !== pkg.version
    ) {
      throw new Error("Desktop lockfile version does not match package.json");
    }
    if (!git("show", `${ref}:desktop/release-notes/${pkg.version}.md`)) {
      throw new Error("Desktop English release notes are empty");
    }
    const notes = JSON.parse(
      git("show", `${ref}:desktop/release-notes/${pkg.version}.json`),
    );
    for (const language of ["en", "zh-CN", "zh-TW", "ja", "ko"]) {
      if (typeof notes[language] !== "string" || !notes[language].trim()) {
        throw new Error(`Missing Desktop release notes: ${language}`);
      }
    }
    if (
      !rebuild && tags.includes(desktopTag) &&
      git("rev-parse", `${desktopTag}^{commit}`) !==
        git("rev-parse", `${ref}^{commit}`)
    ) {
      throw new Error(
        `${desktopTag} already belongs to another commit; bump Desktop version`,
      );
    }
  }
  return {
    product,
    baseline: baseline || null,
    publish,
    desktop: Boolean(desktopTag),
    desktopTag,
    affected,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const plan = releasePlan(process.argv[2] || process.env.GITHUB_REF_NAME, "HEAD", process.env.RELEASE_REBUILD === "true");
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(plan)) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `${key}=${typeof value === "object" ? JSON.stringify(value) : value}\n`,
      );
    }
  }
}
