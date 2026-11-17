import {
  Section,
  getOrderedSections,
  isCodeComponentMissingPositionClass,
} from "@/wab/client/components/sidebar-tabs/Sections";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { TplTagType, mkTplComponent, mkTplTag } from "@/wab/shared/core/tpls";
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

it.each([
  ["container", () => mkTplTag("div")],
  ["text", () => mkTplTag("p", [], { type: TplTagType.Text })],
  ["image", () => mkTplTag("img", [], { type: TplTagType.Image })],
  [
    "component instance",
    () =>
      mkTplComponent(
        mkComponent({
          name: "Card",
          type: ComponentType.Plain,
          tplTree: mkTplTag("div"),
        }),
        mkBaseVariant(),
      ),
  ],
])(
  "places Position, Layout, and Appearance below Box Geometry for %s nodes",
  (_label, createTpl) => {
    const vc = {
      studioCtx: {
        codeComponentsRegistry: new Map(),
      },
    } as unknown as ViewCtx;
    const ordered = [...getOrderedSections(createTpl(), vc)];
    const boxIndex = ordered.indexOf(Section.BoxGeometry);
    const positionIndex = ordered.indexOf(Section.PositioningPanel);
    const layoutIndex = ordered.indexOf(Section.LayoutPanel);
    const appearanceIndex = ordered.indexOf(Section.AppearancePanel);

    expect(boxIndex).toBeGreaterThanOrEqual(0);
    expect(positionIndex).toBe(boxIndex + 1);
    expect(layoutIndex).toBe(positionIndex + 1);
    expect(appearanceIndex).toBe(layoutIndex + 1);
    expect(ordered.indexOf(Section.Typography)).toBe(appearanceIndex + 1);
    expect(ordered.slice(appearanceIndex + 2, appearanceIndex + 6)).toEqual([
      Section.InteractionStylesPanel,
      Section.Background,
      Section.Border,
      Section.Outline,
    ]);
  },
);

it("includes BoxGeometry in ordered sections for styleSections: false code components", () => {
  const unstyleableComp = mkCodeComponent(
    "AppShell",
    { name: "AppShell", importPath: "test", props: {}, styleSections: false },
    {},
  );
  const tpl = mkTplComponent(unstyleableComp, mkBaseVariant());
  const vc = {
    studioCtx: {
      codeComponentsRegistry: {
        getRegisteredCodeComponentsMap: () =>
          new Map([["AppShell", { meta: { styleSections: false } }]]),
      },
    },
  } as unknown as ViewCtx;
  const ordered = [...getOrderedSections(tpl, vc)];
  expect(ordered).toContain(Section.BoxGeometry);
});
