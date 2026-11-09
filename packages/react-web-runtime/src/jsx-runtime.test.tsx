import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createPlasmicElementProxy, deriveRenderOpts } from "@plasmicapp/react-web";
import { jsxDEV } from "./jsx-dev-runtime";
import { Fragment, jsx, jsxs } from "./jsx-runtime";

function ManagedFixture(props: { children?: React.ReactNode }) {
  const { overrides } = deriveRenderOpts(props, {
    name: "root",
    descendantNames: ["root"],
    internalVariantPropNames: [],
    internalArgPropNames: [],
  });
  const rootProps: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown> = {
    "data-plasmic-name": "root",
    "data-plasmic-root": true,
    "data-plasmic-for-node": "root",
    "data-plasmic-override": overrides.root,
  };
  return createPlasmicElementProxy("div", rootProps, "Default content");
}

describe("Plasmic automatic JSX runtime", () => {
  for (const factory of [jsx, jsxs, jsxDEV]) {
    it(`${factory.name} distinguishes omitted children from explicit generated root overrides`, () => {
      expect(renderToStaticMarkup(factory(ManagedFixture, {}))).toBe("<div>Default content</div>");
      expect(renderToStaticMarkup(factory(ManagedFixture, null))).toBe("<div>Default content</div>");
      for (const children of [undefined, null, false, [], ""]) {
        expect(renderToStaticMarkup(factory(ManagedFixture, { children }))).toBe("<div></div>");
      }
      expect(renderToStaticMarkup(factory(ManagedFixture, { children: 0 }))).toBe("<div>0</div>");
      const children = [factory("span", { children: "first" }, "first"), factory("em", { children: "last" }, "last")];
      const element = factory(ManagedFixture, { children }, "managed-key") as React.ReactElement;
      expect(element.key).toBe("managed-key");
      expect(renderToStaticMarkup(element)).toBe("<div><span>first</span><em>last</em></div>");
    });

    it(`${factory.name} preserves falsy children and accepts empty props`, () => {
      for (const children of [0, "", false, null, undefined]) {
        const element = factory("div", { children });
        expect(React.isValidElement(element)).toBe(true);
        expect((element as React.ReactElement<{ children: React.ReactNode }>).props.children)
          .toBe(children);
      }
      expect(renderToStaticMarkup(factory("div", { children: 0 }))).toBe("<div>0</div>");
      expect(renderToStaticMarkup(factory("div", null))).toBe("<div></div>");
    });

    it(`${factory.name} preserves keys and does not mutate caller props`, () => {
      const props = Object.freeze({ key: "prop-key", children: "text" });
      expect((factory("div", props) as React.ReactElement).key).toBe("prop-key");
      for (const key of ["argument-key", 0, BigInt(19)]) {
        expect((factory("div", props, key) as React.ReactElement).key).toBe(String(key));
      }
      expect(props).toEqual({ key: "prop-key", children: "text" });
    });
  }

  it("keeps fragment children and named Plasmic node selection", () => {
    const children = [jsx("span", { children: 0 }, "zero"), jsx("span", { children: "last" }, "last")];
    expect(renderToStaticMarkup(jsxs(Fragment, { children }))).toBe("<span>0</span><span>last</span>");
    const named = jsx("span", { "data-plasmic-name": "Content", children: "selected" });
    const selected = jsx("section", {
      "data-plasmic-root": true,
      "data-plasmic-for-node": "Content",
      children: named,
    });
    expect(selected).toBe(named);
    expect(renderToStaticMarkup(selected)).toBe("<span>selected</span>");
  });
});
