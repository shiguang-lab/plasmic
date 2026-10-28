import { isCodeComponentMissingPositionClass } from "@/wab/client/components/sidebar-tabs/Sections";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import type { ValComponent } from "@/wab/shared/core/val-nodes";

function fixture(elements: HTMLElement[], className = "studio-table studio-size") {
  const component = mkCodeComponent(
    "Table",
    { name: "Table", importPath: "test", props: {} },
    {},
  );
  const val = {
    tpl: mkTplComponent(component, mkBaseVariant()),
    className,
  } as ValComponent;
  const vc = {
    renderState: { sel2dom: () => elements },
    canvasCtx: {},
  } as unknown as ViewCtx;
  return { vc, val };
}

it.each(["style", "div"])(
  "recognizes forwarded classes after a %s sibling",
  (tag) => {
    const sibling = document.createElement(tag);
    const root = document.createElement("div");
    root.className = "ant-table-wrapper studio-table studio-size";
    const { vc, val } = fixture([sibling, root]);
    expect(isCodeComponentMissingPositionClass(vc, val)).toBeFalsy();
  },
);

it("recognizes generated class names separated by whitespace", () => {
  const root = document.createElement("div");
  root.className = "studio-table studio-size";
  const { vc, val } = fixture([root], "  studio-table\tstudio-size ");
  expect(isCodeComponentMissingPositionClass(vc, val)).toBeFalsy();
});

it("detects components that do not forward their generated classes", () => {
  const root = document.createElement("div");
  root.className = "ant-table-wrapper";
  const { vc, val } = fixture([root]);
  expect(isCodeComponentMissingPositionClass(vc, val)).toBe(true);
});

it("requires all generated classes on the same root", () => {
  const first = document.createElement("div");
  first.className = "studio-table";
  const second = document.createElement("div");
  second.className = "studio-size";
  const { vc, val } = fixture([first, second]);
  expect(isCodeComponentMissingPositionClass(vc, val)).toBe(true);
});

it("waits for a mounted root before declaring styling unsupported", () => {
  const { vc, val } = fixture([]);
  expect(isCodeComponentMissingPositionClass(vc, val)).toBeFalsy();
});
