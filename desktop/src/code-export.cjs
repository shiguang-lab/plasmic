const fs = require("node:fs/promises");
const path = require("node:path");

async function writeCodeBundle(outputPath, bundle) {
  if (!path.isAbsolute(outputPath))
    throw new Error("outputPath must be an absolute new directory");
  const files = new Map();
  const add = (name, content) => {
    if (!name || !content) return;
    if (
      typeof name !== "string" ||
      typeof content !== "string" ||
      name !== path.basename(name) ||
      name === "." ||
      name === ".."
    )
      throw new Error("Codegen returned an invalid filename");
    if (files.has(name) && files.get(name) !== content)
      throw new Error("Codegen returned conflicting files: " + name);
    files.set(name, content);
  };
  if (!Array.isArray(bundle.components) || !bundle.components.length)
    throw new Error("NAS returned no generated components");
  for (const component of bundle.components) {
    add(component.renderModuleFileName, component.renderModule);
    add(component.skeletonModuleFileName, component.skeletonModule);
    add(component.cssFileName, component.cssRules);
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
      if (part) add(part.fileName, part.module);
    }
    for (const part of project.reactWebExportedFiles || [])
      add(part.fileName, part.content);
  }
  for (const part of bundle.globalVariants || [])
    add(part.contextFileName, part.contextModule);
  for (const part of bundle.iconAssets || []) add(part.fileName, part.module);
  if (![...files.keys()].some((file) => file.endsWith(".tsx")))
    throw new Error("NAS returned no editable React modules");
  files.set("plasmic-codegen.json", JSON.stringify(bundle, null, 2));
  await fs.mkdir(outputPath); // never overwrite an existing directory or partial export
  try {
    for (const [name, content] of files)
      await fs.writeFile(path.join(outputPath, name), content, { flag: "wx" });
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
module.exports = { writeCodeBundle };
