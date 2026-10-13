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
test("exports binary images and resolves canonical picture and background references", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-code-image-"));
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  try {
    const target = path.join(root, "export");
    const result = await writeCodeBundle(target, {
      components: [
        {
          ...component,
          skeletonModule:
            'import image from "./old-name.null"; // plasmic-import: image/picture\nimport "./Page.css"; export default image;',
          cssRules: "div{background:var(--image-image)}",
        },
      ],
      imageAssets: [
        { id: "image", fileName: "image.jpg", blob: bytes.toString("base64") },
      ],
    });
    assert.ok(result.files.includes("image.jpg"));
    assert.deepEqual(await fs.readFile(path.join(target, "image.jpg")), bytes);
    assert.match(
      await fs.readFile(path.join(target, "Page.tsx"), "utf8"),
      /from "\.\/image.jpg"/,
    );
    assert.match(
      await fs.readFile(path.join(target, "Page.css"), "utf8"),
      /url\("\.\/image.jpg"\)/,
    );
    await require("esbuild").build({
      entryPoints: [path.join(target, "Page.tsx")],
      bundle: true,
      outfile: path.join(root, "build.js"),
      loader: { ".jpg": "file" },
    });
    await assert.rejects(
      writeCodeBundle(path.join(root, "unsafe"), {
        components: [component],
        imageAssets: [
          { id: "bad", fileName: "../bad.jpg", blob: bytes.toString("base64") },
        ],
      }),
      /invalid filename/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
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

test("exports default styles with the generated import and builds the untouched bundle", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-code-style-"));
  try {
    for (const css of ["body{margin:0}", ""]) {
      const target = path.join(root, css ? "styled" : "empty-style");
      await writeCodeBundle(target, {
        components: [
          {
            ...component,
            skeletonModule:
              'import "./plasmic__default_style.css"; export const page = "Page";',
          },
        ],
        defaultStyles: {
          defaultStyleCssFileName: "plasmic__default_style.css",
          defaultStyleCssRules: css,
        },
      });
      assert.equal(
        await fs.readFile(
          path.join(target, "plasmic__default_style.css"),
          "utf8",
        ),
        css,
      );
      await require("esbuild").build({
        entryPoints: [path.join(target, "Page.tsx")],
        bundle: true,
        write: false,
        outfile: path.join(target, "built.js"),
      });
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("exports imported and transitive project CSS inside the output directory and builds without manual fixes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-code-deps-"));
  const reference = (id) =>
    `@import "../${id}/plasmic.css"; /* plasmic-import: ${id}/projectcss */`;
  const bundle = {
    components: [
      {
        ...component,
        skeletonModule: 'import "./plasmic.css"; export const page = "Page";',
      },
    ],
    projectConfig: {
      projectId: "page",
      cssFileName: "plasmic.css",
      cssRules: reference("library"),
    },
  };
  const dependencies = [
    {
      projectConfig: {
        projectId: "library",
        cssFileName: "plasmic.css",
        cssRules: reference("shared") + "div{color:var(--accent)}",
      },
    },
    {
      projectConfig: {
        projectId: "shared",
        cssFileName: "plasmic.css",
        cssRules: ":root{--accent:red}",
      },
    },
  ];
  try {
    assert.deepEqual(
      require("../src/code-export.cjs").getCssDependencyIds(bundle),
      ["library"],
    );
    await assert.rejects(
      writeCodeBundle(path.join(root, "incomplete"), bundle),
      /omitted dependency CSS/,
    );
    const target = path.join(root, "export");
    const result = await writeCodeBundle(target, bundle, dependencies);
    assert.ok(result.files.includes("dependencies/library/plasmic.css"));
    assert.ok(result.files.includes("dependencies/shared/plasmic.css"));
    const built = await require("esbuild").build({
      entryPoints: [path.join(target, "Page.tsx")],
      bundle: true,
      write: false,
      outfile: path.join(target, "built.js"),
    });
    assert.ok(
      built.outputFiles.some(
        (file) =>
          file.path.endsWith(".css") && /--accent:\s*red/.test(file.text),
      ),
    );
    await assert.rejects(fs.stat(path.join(root, "library")), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
