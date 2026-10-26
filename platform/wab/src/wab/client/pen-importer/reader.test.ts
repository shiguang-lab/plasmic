import { PenFiles } from "@/wab/client/pen-importer/files";
import { PenFileReader } from "@/wab/client/pen-importer/reader";
import { runPenScript } from "@/wab/client/pen-importer/scripts";
import type { PenLayer, PenNode } from "@/wab/client/pen-importer/types";
import { strToU8, zipSync } from "fflate";

const doc = (children: PenNode[], rest = {}) =>
  JSON.stringify({ version: "2.21", children, ...rest });
const frame = (children: PenNode[] = [], rest = {}): PenNode => ({
  type: "frame",
  id: "root",
  name: "测试画布",
  width: 800,
  height: 600,
  children,
  ...rest,
});
const entries = (files: Record<string, string>) =>
  Object.entries(files).map(([path, data]) => ({ path, bytes: strToU8(data) }));
const flatten = (layer: PenLayer): PenLayer[] => [
  layer,
  ...layer.children.flatMap(flatten),
];

it("reads JSONC and preserves layout, text and variable values without translating source content", async () => {
  const reader = new PenFileReader();
  reader.read(
    entries({
      "test.pen": `// design\n${doc([frame([{ type: "text", id: "label", name: "Heading", content: "中文内容", fill: "$color", fontSize: 20, width: 120, textGrowth: "fixed-width" }], { layout: "vertical", padding: [12, 20], gap: 8 })], { variables: { color: { type: "color", value: "#123456" } } })}`,
    }),
  );
  const design = await reader.convert("test.pen", "root");
  expect(design.root.styles).toMatchObject({
    "flex-direction": "column",
    "padding-left": "20px",
    "row-gap": "8px",
  });
  expect(design.root.children[0]).toMatchObject({
    text: "中文内容",
    styles: { color: "#123456", width: "120px", height: "wrap" },
  });
});

it("reads only referenced files from a selected folder", async () => {
  const contents = strToU8(doc([frame()]));
  const readDesign = vi.fn(async () => contents.buffer as ArrayBuffer);
  const readUnused = vi.fn(async () => { throw new Error("Unrelated files must not be read"); });
  const reader = new PenFileReader();
  reader.read([
    { path: "project/design.pen", file: { size: contents.length, arrayBuffer: readDesign } as unknown as File },
    { path: "project/unused.bin", file: { size: 1024 * 1024 * 1024, arrayBuffer: readUnused } as unknown as File },
    { path: "project/node_modules/package/design.pen", file: { size: 1024, arrayBuffer: readUnused } as unknown as File },
  ]);
  await reader.convert("project/design.pen", "root");
  expect(readDesign).toHaveBeenCalledOnce();
  expect(readUnused).not.toHaveBeenCalled();
});

it("expands library refs, applies instance descendant overrides and evaluates inherited themes", async () => {
  const reader = new PenFileReader();
  reader.read(
    entries({
      "bundle/design.pen": doc(
        [
          frame([
            {
              type: "ref",
              id: "instance",
              ref: "kit:card",
              descendants: { "kit:title": { content: "实例标题" } },
              theme: { mode: "dark" },
            },
          ]),
        ],
        { imports: { kit: "library.lib.pen" } },
      ),
      "bundle/library.lib.pen": doc(
        [
          frame(
            [
              {
                type: "text",
                id: "title",
                content: "默认标题",
                fill: "$color",
              },
            ],
            { id: "card", reusable: true },
          ),
        ],
        {
          themes: { mode: ["light", "dark"] },
          variables: {
            color: {
              type: "color",
              value: [
                { value: "#fff", theme: { mode: "light" } },
                { value: "#000", theme: { mode: "dark" } },
              ],
            },
          },
        },
      ),
    }),
  );
  const design = await reader.convert("bundle/design.pen", "root");
  expect(flatten(design.root).find((n) => n.text)).toMatchObject({
    text: "实例标题",
    styles: { color: "#000" },
  });
});

it("replaces children inside nested instances while retaining the dependency source of new images", async () => {
  const reader = new PenFileReader();
  reader.read(
    entries({
      "design.pen": doc(
        [
          frame([
            {
              type: "ref",
              id: "outer",
              ref: "kit:card",
              descendants: {
                "inner/title": {
                  type: "text",
                  id: "replacement",
                  content: "替换内容",
                },
              },
            },
          ]),
        ],
        { imports: { kit: "lib/library.lib.pen" } },
      ),
      "lib/library.lib.pen": doc([
        frame([{ type: "ref", id: "inner", ref: "button" }], { id: "card" }),
        frame([{ type: "text", id: "title", content: "原始" }], {
          id: "button",
        }),
      ]),
    }),
  );
  const design = await reader.convert("design.pen", "root");
  expect(
    flatten(design.root)
      .filter((n) => n.text !== undefined)
      .map((n) => n.text),
  ).toEqual(["替换内容"]);
});

it("runs nested component scripts using selected files and emits ordinary editable layers", async () => {
  const reader = new PenFileReader();
  reader.read(
    entries({
      "bundle/design.pen": doc([
        frame([
          {
            type: "script",
            id: "script",
            width: 200,
            height: 40,
            scriptUri: "scripts/parent.js",
            inputs: { label: "确定" },
          },
        ]),
      ]),
      "bundle/scripts/parent.js": `return [{ type: "script", width: pencil.width, height: pencil.height, scriptUri: "/original/bundle/scripts/child.js", inputs: { label: pencil.input.label } }];`,
      "bundle/scripts/child.js": `return [{ type: "text", content: pencil.input.label, width: pencil.width, height: pencil.height }];`,
    }),
  );
  const design = await reader.convert("bundle/design.pen", "root");
  expect(flatten(design.root).find((n) => n.text)).toMatchObject({
    text: "确定",
  });
});

it("uses script input defaults and clamps numeric inputs in an isolated deterministic engine", async () => {
  const code = `/**\n * @input columns: number(min=1,max=4) = 3\n * @input color: color = #1677FF\n */\nreturn [{type:'text',content:JSON.stringify({n:pencil.input.columns,c:pencil.input.color,r:Math.random(),env:[typeof fetch,typeof process,typeof document,typeof require]})}];`;
  const a = await runPenScript(code, {
    type: "script",
    inputs: { columns: 100 },
  });
  const b = await runPenScript(code, {
    type: "script",
    inputs: { columns: 100 },
  });
  expect(a).toEqual(b);
  expect(JSON.parse(a[0].content)).toMatchObject({
    n: 4,
    c: "#1677FF",
    env: ["undefined", "undefined", "undefined", "undefined"],
  });
});

it("interrupts infinite scripts and rejects oversized output", async () => {
  await expect(
    runPenScript("while (true) {}", { type: "script" }),
  ).rejects.toThrow(/interrupted/i);
  await expect(
    runPenScript("return Array.from({length:1001},()=>({type:'text'}))", {
      type: "script",
    }),
  ).rejects.toThrow(/excessive/);
});

it("preserves stored script inputs even when control annotations describe a simpler type", async () => {
  const pagination = '{"pageSize":20}';
  const result = await runPenScript(
    '/**\n * @input pagination: boolean = true\n */\nreturn [{type:"text",content:pencil.input.pagination}];',
    { type: "script", inputs: { pagination } },
  );
  expect(result[0].content).toBe(pagination);
});

it("loads ZIP resources and preserves vector/icon/image assets", async () => {
  const reader = new PenFileReader();
  const zip = zipSync(
    Object.fromEntries(
      entries({
        "project/design.pen": doc([
          frame([
            {
              type: "icon",
              id: "icon",
              library: "lucide",
              icon: "chevron-down",
              width: 16,
              height: 16,
              fill: "#123456",
            },
            {
              type: "path",
              id: "path",
              geometry: "M0 0L10 10",
              width: 10,
              height: 10,
              stroke: "#000",
            },
            {
              type: "rectangle",
              id: "image",
              width: 20,
              height: 20,
              fill: { type: "image", url: "images/test.png" },
            },
          ]),
        ]),
        "project/images/test.png": "test image bytes",
      }).map((e) => [e.path, e.bytes]),
    ),
  );
  reader.read([{ path: "design.zip", bytes: zip }]);
  const design = await reader.convert("project/design.pen", "root");
  expect(design.assets).toHaveLength(3);
  expect(design.assets[0].svg).toContain('stroke="#123456"');
  expect(design.assets[1].svg).toContain('d="M0 0L10 10"');
  expect(design.root.children[2].styles.background).toContain(
    "__PEN_ASSET_2__",
  );
});

it.each([
  [
    frame([{ type: "ref", id: "bad", ref: "missing" }]),
    /Missing Pen component/,
  ],
  [
    frame([{ type: "script", id: "bad", scriptUri: "missing.js" }]),
    /Missing Pen resource/,
  ],
  [frame([{ type: "browser", id: "bad" }]), /Unsupported Pen layer/],
])(
  "fails explicitly without returning a partial design for invalid dependencies",
  async (root, error) => {
    const reader = new PenFileReader();
    reader.read(entries({ "test.pen": doc([root as PenNode]) }));
    await expect(reader.convert("test.pen", "root")).rejects.toThrow(
      error as RegExp,
    );
  },
);

it("rejects reference and variable cycles", async () => {
  const reader = new PenFileReader();
  reader.read(
    entries({
      "test.pen": doc([frame([{ type: "ref", id: "loop", ref: "root" }])]),
    }),
  );
  await expect(reader.convert("test.pen", "root")).rejects.toThrow(
    /Cyclic Pen component/,
  );
  reader.read(
    entries({
      "test.pen": doc([frame([], { fill: "$a" })], {
        variables: {
          a: { type: "color", value: "$b" },
          b: { type: "color", value: "$a" },
        },
      }),
    }),
  );
  await expect(reader.convert("test.pen", "root")).rejects.toThrow(
    /Cyclic Pen variable/,
  );
});

it("rejects resource traversal, ambiguous absolute paths and duplicate files", () => {
  const files = new PenFiles(
    entries({ "a/design.pen": "{}", "a/icon.js": "", "icon.js": "" }),
  );
  expect(() => files.resolve("a/design.pen", "../../secret")).toThrow(
    /escapes/,
  );
  expect(() => files.resolve("a/design.pen", "/original/a/icon.js")).toThrow(
    /ambiguous/,
  );
  expect(
    () =>
      new PenFiles([
        ...entries({ "a.pen": "{}" }),
        ...entries({ "a.pen": "{}" }),
      ]),
  ).toThrow(/Duplicate/);
});
