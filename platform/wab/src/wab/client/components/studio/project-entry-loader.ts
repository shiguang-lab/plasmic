export function loadProjectEntry() {
  performance.mark("studio-project-entry-import-start");
  return import("./view-initializer").then((module) => {
    performance.mark("studio-project-entry-import-ready");
    return module;
  });
}
