import { ensure } from "@/wab/shared/common";
import {
  parseSync,
  types as t,
  transformFromAstSync,
  traverse,
} from "@babel/core";
import { outlinePreviewRenderBoundaries } from "../preview-render-boundaries.mjs";
import { reactCompilerCandidates } from "../react-compiler-coverage.mjs";

function outline(source: string) {
  const ast = ensure(
    parseSync(source, {
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ["jsx"] },
    }),
    "Parsed preview fixture",
  );
  outlinePreviewRenderBoundaries(ast, reactCompilerCandidates(ast));
  return ast;
}
function evaluate(body: string) {
  const source = `function create() { ${body} }`;
  const ast = outline(source);
  const code = ensure(
    transformFromAstSync(ast, source, {
      babelrc: false,
      configFile: false,
      presets: [["@babel/preset-react", { runtime: "classic" }]],
    })?.code,
    "Outlined preview fixture",
  );
  const React = {
    Fragment: Symbol(),
    createElement: (type: any, props: any, ...children: any[]) =>
      typeof type === "function"
        ? type({ ...props, children })
        : children.flat(),
  };
  return new Function("React", "window", `${code}; return create();`)(React, {
    __plasmicLive: { renderBoundary: (render: () => unknown) => render },
  });
}

it("keeps deferred lexical reads, writes and each repeated item's scope", () => {
  const result = evaluate(`
    let count = 1;
    const renders = [1, 2].map(item => window.__plasmicLive.renderBoundary(() => <span>{item}:{count++}</span>));
    count = 3;
    return { renders, read: () => count };
  `);
  expect(result.renders[0]()).toEqual([1, ":", 3]);
  expect(result.renders[1]()).toEqual([2, ":", 4]);
  expect(result.read()).toBe(5);
});

it("retains local JSX component bindings and bare call receivers", () => {
  const render = evaluate(`
    const Label = props => <span>{props.children}</span>;
    const receiver = function() { "use strict"; return this; };
    return window.__plasmicLive.renderBoundary(() => <Label>{receiver() === undefined ? "correct" : "wrong"}</Label>);
  `);
  expect(render()).toEqual(["correct"]);
});

it("creates independently audited components without changing slot child types", () => {
  const ast = outline(
    `function Page() { return <main>{window.__plasmicLive.renderBoundary(() => <Tabs><Tab key="one" /></Tabs>)}</main>; }`,
  );
  expect(
    reactCompilerCandidates(ast).map((candidate) => candidate.name),
  ).toEqual(["Page", "PlasmicPreviewNode1"]);
  const slotChildren: string[] = [];
  traverse(ast, {
    JSXElement(path) {
      if (t.isJSXIdentifier(path.node.openingElement.name, { name: "Tabs" })) {
        for (const child of path.node.children) {
          if (
            t.isJSXElement(child) &&
            t.isJSXIdentifier(child.openingElement.name)
          ) {
            slotChildren.push(child.openingElement.name.name);
          }
        }
      }
    },
  });
  expect(slotChildren).toEqual(["Tab"]);
});

it.each([
  "window.__plasmicLive.renderBoundary(() => <span>{this.value}</span>)",
  "window.__plasmicLive.renderBoundary(() => <span>{eval('value')}</span>)",
  "window.__plasmicLive.renderBoundary(() => { const [v] = useState(0); return <span>{v}</span>; })",
  "other.__plasmicLive.renderBoundary(() => <span/>)",
])(
  "leaves scope-sensitive callbacks and foreign runtime calls intact: %s",
  (expression) => {
    const ast = outline(`function Page(){return <main>{${expression}}</main>}`);
    expect(
      ast.program.body.filter(
        (node) =>
          t.isFunctionDeclaration(node) &&
          node.id?.name.startsWith("PlasmicPreviewNode"),
      ),
    ).toHaveLength(0);
  },
);

it("does not shadow a render owner's local component name", () => {
  const render = evaluate(`const PlasmicPreviewNode1 = () => <span>local</span>; return window.__plasmicLive.renderBoundary(() => <PlasmicPreviewNode1/>);`);
  expect(render()).toEqual(["local"]);
});
