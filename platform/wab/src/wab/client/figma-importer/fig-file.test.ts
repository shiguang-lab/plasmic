import { fig, guid, node, schema } from "@/wab/__testonly__/fig-file";
import { denormalizeFigmaData } from "@/wab/client/figma";
import { FigFile } from "@/wab/client/figma-importer/fig-file";
import { zipSync } from "fflate";

vi.mock("@/wab/client/components/coding/FullCodeEditor.tsx", () => ({
  FullCodeEditor: () => null,
  CodePreview: () => null,
}));

const pages = [
  node(1, 0, "CANVAS", { name: "Desktop" }),
  node(2, 0, "CANVAS", { name: "Mobile" }),
  node(3, 0, "CANVAS", { name: "Library", internalOnly: true }),
  node(4, 0, "CANVAS", { visible: false }),
];

it.each([false, true])(
  "reads raw and ZIP files with deflate (ZIP: %s), preserving page order and excluding internal pages",
  (zip) => {
    const file = new FigFile();
    expect(file.read(fig(pages, { zip }))).toEqual([
      { id: "0:1", name: "Desktop" },
      { id: "0:2", name: "Mobile" },
    ]);
  },
);

it("decodes Zstandard chunks and converts only the selected page with editable text and Auto Layout", () => {
  const file = new FigFile();
  file.read(
    fig(
      [
        ...pages,
        node(5, 1, "FRAME", {
          name: "Stack",
          size: { x: 320, y: 100 },
          stackMode: "HORIZONTAL",
          stackSpacing: 12,
        }),
        node(6, 5, "TEXT", {
          name: "Title",
          size: { x: 100, y: 20 },
          fontSize: 18,
          textData: { characters: "你好 Figma" },
        }),
        node(7, 2, "RECTANGLE", { name: "OtherPage", size: { x: 20, y: 20 } }),
      ],
      { zstd: true },
    ),
  );
  const { nodes } = denormalizeFigmaData(file.convert("0:1"));
  expect(nodes).toHaveLength(1);
  expect(nodes[0]).toMatchObject({
    name: "Stack",
    layoutMode: "HORIZONTAL",
    itemSpacing: 12,
    width: 320,
    children: [{ name: "Title", characters: "你好 Figma", fontSize: 18 }],
  });
  expect("children" in nodes[0] && nodes[0].children?.[0].parent).toBe(
    nodes[0],
  );
});

it("embeds only images referenced by the selected page, so reloading does not need local files", () => {
  const file = new FigFile();
  file.read(
    fig(
      [
        ...pages,
        node(5, 1, "RECTANGLE", {
          fillPaints: [
            { type: "IMAGE", image: { hash: new Uint8Array([0xaa]) } },
          ],
        }),
        node(6, 2, "RECTANGLE", {
          fillPaints: [
            { type: "IMAGE", image: { hash: new Uint8Array([0xbb]) } },
          ],
        }),
      ],
      {
        zip: true,
        images: {
          "images/aa": new Uint8Array([1, 2, 3]),
          "images/bb": new Uint8Array([4, 5, 6]),
        },
      },
    ),
  );
  const data = file.convert("0:1");
  expect(Object.keys(data.i)).toEqual(["aa"]);
  expect(data.i.aa).toContain("base64,AQID");
  expect(denormalizeFigmaData(data).nodes[0]).toMatchObject({
    fills: [{ type: "IMAGE", imageHash: "aa" }],
  });
});

it("expands component instances into editable children from the internal component definitions", () => {
  const file = new FigFile();
  file.read(
    fig([
      ...pages,
      node(5, 3, "SYMBOL", { name: "Card", size: { x: 100, y: 100 } }),
      node(6, 5, "TEXT", { textData: { characters: "Card title" } }),
      node(7, 1, "INSTANCE", {
        name: "ProductCard",
        symbolData: { symbolID: guid(5) },
      }),
    ]),
  );
  expect(denormalizeFigmaData(file.convert("0:1")).nodes[0]).toMatchObject({
    type: "FRAME",
    name: "ProductCard",
    width: 100,
    children: [{ type: "TEXT", characters: "Card title" }],
  });
});

it("converts binary vector commands to an SVG asset", () => {
  const path = new Uint8Array(19),
    view = new DataView(path.buffer);
  path[0] = 1;
  view.setFloat32(1, 0, true);
  view.setFloat32(5, 0, true);
  path[9] = 2;
  view.setFloat32(10, 10, true);
  view.setFloat32(14, 10, true);
  path[18] = 0;
  const file = new FigFile();
  file.read(
    fig(
      [
        ...pages,
        node(5, 1, "VECTOR", {
          size: { x: 10, y: 10 },
          fillGeometry: [{ commandsBlob: 0 }],
          fillPaints: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
        }),
      ],
      { blobs: [{ bytes: path }] },
    ),
  );
  expect(denormalizeFigmaData(file.convert("0:1")).nodes[0].svgData).toContain(
    'd="M 0 0 L 10 10 Z"',
  );
});

it("rejects truncated files and missing image data before creating any Studio nodes", () => {
  const file = new FigFile();
  expect(() => file.read(new Uint8Array([1, 2, 3]))).toThrow();
  const valid = fig(pages);
  expect(() => file.read(valid.subarray(0, valid.length - 1))).toThrow();
  expect(() => file.read(zipSync({ "not-canvas.fig": valid }))).toThrow();
  file.read(
    fig([
      ...pages,
      node(5, 1, "RECTANGLE", {
        fillPaints: [
          { type: "IMAGE", image: { hash: new Uint8Array([0xaa]) } },
        ],
      }),
    ]),
  );
  expect(() => file.convert("0:1")).toThrow("Figma image is missing");
  expect(() => file.convert("unknown")).toThrow("Unknown Figma page");
});

it("rejects a cyclic component reference", () => {
  const file = new FigFile();
  file.read(
    fig([
      ...pages,
      node(5, 1, "INSTANCE", { symbolData: { symbolID: guid(5) } }),
    ]),
  );
  expect(() => file.convert("0:1")).toThrow("Cyclic Figma component");
});

it("applies the selected variable mode, follows aliases, and preserves baked values for missing references", () => {
  const file = new FigFile();
  const value = (id: number) => ({ value: { alias: { guid: guid(id) } } });
  file.read(
    fig([
      ...pages,
      node(10, 3, "VARIABLE_SET", {
        variableSetModes: [
          { id: guid(20), name: "Light" },
          { id: guid(21), name: "Dark" },
        ],
      }),
      node(11, 3, "VARIABLE", {
        variableSetID: { guid: guid(10) },
        variableDataValues: {
          entries: [
            {
              modeID: guid(20),
              variableData: {
                value: { colorValue: { r: 1, g: 1, b: 1, a: 1 } },
              },
            },
            {
              modeID: guid(21),
              variableData: {
                value: { colorValue: { r: 0, g: 0, b: 0, a: 1 } },
              },
            },
          ],
        },
      }),
      node(12, 3, "VARIABLE", {
        variableDataValues: {
          entries: [{ modeID: guid(20), variableData: value(11) }],
        },
      }),
      node(5, 1, "FRAME", {
        variableModeBySetMap: {
          entries: [
            { variableSetID: { guid: guid(10) }, variableModeID: guid(21) },
          ],
        },
      }),
      node(6, 5, "RECTANGLE", {
        fillPaints: [
          {
            type: "SOLID",
            color: { r: 1, g: 0, b: 0, a: 1 },
            colorVar: value(12),
          },
        ],
      }),
      node(7, 1, "TEXT", {
        fontSize: 18,
        parameterConsumptionMap: {
          entries: [{ variableField: "FONT_SIZE", variableData: value(99) }],
        },
      }),
    ]),
  );
  expect(denormalizeFigmaData(file.convert("0:1")).nodes).toMatchObject([
    { children: [{ fills: [{ color: { r: 0, g: 0, b: 0 } }] }] },
    { fontSize: 18 },
  ]);
});

it("uses component text property overrides and keeps separate SVG assets for differently overridden instances", () => {
  const path = new Uint8Array(9);
  path[0] = 1;
  const file = new FigFile();
  const instance = (id: number, text: string, r: number) =>
    node(id, 1, "INSTANCE", {
      symbolData: {
        symbolID: guid(5),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(7)] },
            fillPaints: [{ type: "SOLID", color: { r, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
      componentPropAssignments: [
        { defID: guid(30), value: { textValue: { characters: text } } },
      ],
    });
  file.read(
    fig(
      [
        ...pages,
        node(5, 3, "SYMBOL", {
          componentPropDefs: [
            {
              id: guid(30),
              initialValue: { textValue: { characters: "Default" } },
            },
          ],
        }),
        node(6, 5, "TEXT", {
          componentPropRefs: [
            { defID: guid(30), componentPropNodeField: "TEXT_DATA" },
          ],
        }),
        node(7, 5, "VECTOR", {
          size: { x: 10, y: -0.000002 },
          fillGeometry: [{ commandsBlob: 0 }],
        }),
        instance(8, "First title", 1),
        instance(9, "Second title", 0),
      ],
      { blobs: [{ bytes: path }] },
    ),
  );
  const { nodes } = denormalizeFigmaData(file.convert("0:1"));
  expect(nodes).toMatchObject([
    {
      children: [
        { characters: "First title" },
        { svgData: expect.stringContaining("rgba(255,0,0,1)"), height: 0 },
      ],
    },
    {
      children: [
        { characters: "Second title" },
        { svgData: expect.stringContaining("rgba(0,0,0,1)") },
      ],
    },
  ]);
});

it("retains group children and inherited fill styles", () => {
  const file = new FigFile();
  file.read(
    fig([
      ...pages,
      node(10, 3, "RECTANGLE", {
        fillPaints: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
      }),
      node(5, 1, "GROUP"),
      node(6, 5, "RECTANGLE", { styleIdForFill: { guid: guid(10) } }),
    ]),
  );
  expect(denormalizeFigmaData(file.convert("0:1")).nodes[0]).toMatchObject({
    children: [{ fills: [{ color: { r: 1 } }] }],
  });
});

it("rejects executable names in an embedded schema before compiling it", () => {
  const malicious = structuredClone(schema);
  malicious.definitions[0].name = "GUID;globalThis.figImportInjected=true;//";
  expect(() => new FigFile().read(fig(pages, { schema: malicious }))).toThrow(
    "Invalid Figma schema definition",
  );
  expect(globalThis).not.toHaveProperty("figImportInjected");
});

it("skips unpainted vectors without blocking the remaining page", () => {
  const file = new FigFile();
  file.read(fig([...pages, node(5, 1, "VECTOR"), node(6, 1, "RECTANGLE")]));
  expect(denormalizeFigmaData(file.convert("0:1")).nodes).toMatchObject([
    { type: "RECTANGLE" },
  ]);
});
