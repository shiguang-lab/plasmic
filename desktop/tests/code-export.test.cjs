const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { writeCodeBundle } = require("../src/code-export.cjs");
const component = {
  id: "page",
  componentName: "Page",
  skeletonModuleFileName: "Page.tsx",
  skeletonModule: "export default function Page(){return <div>Page</div>}",
  cssFileName: "Page.css",
  cssRules: "div{color:red}",
};
test("writes actual editable modules and retains codegen metadata without overwriting", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-code-"));
  try {
    const target = path.join(root, "export");
    const result = await writeCodeBundle(target, {
      components: [component],
      projectConfig: { cssFileName: "project.css", cssRules: "body{margin:0}" },
    });
    assert.equal(result.editable, true);
    assert.match(
      await fs.readFile(path.join(target, "Page.tsx"), "utf8"),
      /function Page/,
    );
    assert.equal(
      JSON.parse(
        await fs.readFile(path.join(target, "plasmic-codegen.json"), "utf8"),
      ).components[0].id,
      "page",
    );
    await assert.rejects(
      writeCodeBundle(target, { components: [component] }),
      /EEXIST/,
    );
    await assert.rejects(
      writeCodeBundle(path.join(root, "unsafe"), {
        components: [
          { ...component, skeletonModuleFileName: "../outside.tsx" },
        ],
      }),
      /invalid filename/,
    );
    await assert.rejects(fs.stat(path.join(root, "unsafe")), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
