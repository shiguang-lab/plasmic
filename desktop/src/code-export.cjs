const fs = require("node:fs/promises");
const path = require("node:path");

const projectCssImport =
  /@import\s+(["'])([^"']+)\1;\s*\/\*\s*plasmic-import:\s*([A-Za-z0-9_-]+)\/projectcss\s*\*\//g;

function getCssDependencyIds(bundle) {
  const css = [
    bundle.projectConfig?.cssRules,
    ...(bundle.components || []).map((component) => component.cssRules),
  ];
  return [
    ...new Set(
      css.flatMap((text) =>
        [...(text || "").matchAll(projectCssImport)].map((match) => match[3]),
      ),
    ),
  ];
}

async function writeCodeBundle(outputPath, bundle, dependencies = []) {
  if (!path.isAbsolute(outputPath)) {
    throw new Error("outputPath must be an absolute new directory");
  }
  const files = new Map();
  const cssFiles = new Map();
  const imageFiles = new Map(
    [bundle, ...dependencies].flatMap((current) =>
      (current.imageAssets || []).map((asset) => [asset.id, asset.fileName]),
    ),
  );
  const rootProject = bundle.projectConfig;
  if (rootProject) {
    cssFiles.set(rootProject.projectId, rootProject.cssFileName);
  }
  for (const dependency of dependencies) {
    const project = dependency.projectConfig;
    if (!project || !/^[A-Za-z0-9_-]+$/.test(project.projectId)) {
      throw new Error("Codegen returned an invalid dependency project");
    }
    cssFiles.set(
      project.projectId,
      `dependencies/${project.projectId}/${project.cssFileName}`,
    );
  }
  const add = (name, content, prefix = "") => {
    if (!name || content == null) {
      return;
    }
    if (
      typeof name !== "string" ||
      (typeof content !== "string" && !Buffer.isBuffer(content)) ||
      name !== path.basename(name) ||
      name === "." ||
      name === ".."
    ) {
      throw new Error("Codegen returned an invalid filename");
    }
    const fileName = prefix + name;
    const imagePath = (id) => {
      const target = imageFiles.get(id);
      if (!target) {
        throw new Error("Codegen omitted image: " + id);
      }
      let relative = path.posix.relative(path.posix.dirname(fileName), target);
      if (!relative.startsWith(".")) {
        relative = "./" + relative;
      }
      return relative;
    };
    if (typeof content === "string") {
      content = content.replace(
        /import\s+(["'])([^"']+)\1;?\s*\/\/\s*plasmic-import:\s*([A-Za-z0-9_-]+)\/projectcss/g,
        (_match, _quote, _url, id) => {
          const target = cssFiles.get(id);
          if (!target) {
            throw new Error("Codegen omitted dependency CSS: " + id);
          }
          return `import "./${target}"; // plasmic-import: ${id}/projectcss`;
        },
      );
      content = content.replace(
        /from\s+(["'])([^"']+)\1;\s*\/\/\s*plasmic-import:\s*([A-Za-z0-9_-]+)\/picture/g,
        (_match, _quote, _url, id) =>
          `from "${imagePath(id)}"; // plasmic-import: ${id}/picture`,
      );
      content = content.replace(
        /var\(--image-([^)]+)\)/g,
        (_match, id) => `url("${imagePath(id)}")`,
      );
    }
    if (name.endsWith(".css")) {
      content = content.replace(
        projectCssImport,
        (match, _quote, _url, projectId) => {
          const target = cssFiles.get(projectId);
          if (!target) {
            throw new Error("Codegen omitted dependency CSS: " + projectId);
          }
          let relative = path.posix.relative(
            path.posix.dirname(fileName),
            target,
          );
          if (!relative.startsWith(".")) {
            relative = "./" + relative;
          }
          return `@import "${relative}"; /* plasmic-import: ${projectId}/projectcss */`;
        },
      );
    }
    if (
      files.has(fileName) &&
      !Buffer.from(files.get(fileName)).equals(Buffer.from(content))
    ) {
      throw new Error("Codegen returned conflicting files: " + fileName);
    }
    files.set(fileName, content);
  };
  if (!Array.isArray(bundle.components) || !bundle.components.length) {
    throw new Error("NAS returned no generated components");
  }
  for (const component of bundle.components) {
    add(component.renderModuleFileName, component.renderModule);
    add(component.skeletonModuleFileName, component.skeletonModule);
    add(component.cssFileName, component.cssRules);
  }
  if (bundle.defaultStyles) {
    add(
      bundle.defaultStyles.defaultStyleCssFileName,
      bundle.defaultStyles.defaultStyleCssRules,
    );
  }
  const project = bundle.projectConfig;
  if (project) {
    add(project.cssFileName, project.cssRules);
    for (const key of [
      "projectModuleBundle",
      "styleTokensProviderBundle",
      "dataTokensBundle",
    ]) {
      const part = project[key];
      if (part) {
        add(part.fileName, part.module);
      }
    }
    for (const part of project.reactWebExportedFiles || []) {
      add(part.fileName, part.content);
    }
    if (project.globalContextBundle) {
      add(
        "PlasmicGlobalContextsProvider.tsx",
        project.globalContextBundle.contextModule,
      );
    }
    if (project.splitsProviderBundle) {
      add("PlasmicSplitsProvider.tsx", project.splitsProviderBundle.module);
    }
  }
  for (const part of bundle.globalVariants || []) {
    add(part.contextFileName, part.contextModule);
  }
  for (const part of bundle.iconAssets || []) {
    add(part.fileName, part.module);
  }
  for (const current of [bundle, ...dependencies]) {
    for (const asset of current.imageAssets || []) {
      if (typeof asset.blob !== "string" || /^https?:\/\//.test(asset.blob)) {
        throw new Error(
          "Image contents were not downloaded: " + asset.fileName,
        );
      }
      add(asset.fileName, Buffer.from(asset.blob, "base64"));
    }
  }
  for (const dependency of dependencies) {
    const dependencyProject = dependency.projectConfig;
    add(
      dependencyProject.cssFileName,
      dependencyProject.cssRules,
      `dependencies/${dependencyProject.projectId}/`,
    );
  }
  if (![...files.keys()].some((file) => file.endsWith(".tsx"))) {
    throw new Error("NAS returned no editable React modules");
  }
  files.set("plasmic-codegen.json", JSON.stringify(bundle, null, 2));
  await fs.mkdir(outputPath); // never overwrite an existing directory or partial export
  try {
    for (const [name, content] of files) {
      await fs.mkdir(path.dirname(path.join(outputPath, name)), {
        recursive: true,
      });
      await fs.writeFile(path.join(outputPath, name), content, { flag: "wx" });
    }
  } catch (error) {
    await fs.rm(outputPath, { recursive: true, force: true });
    throw error;
  }
  return {
    path: outputPath,
    files: [...files.keys()],
    components: bundle.components.map((component) => ({
      uuid: component.id,
      name: component.componentName,
    })),
    editable: true,
    framework: "react",
  };
}
module.exports = { writeCodeBundle, getCssDependencyIds };
