import { createSiteForHostlessProject, updateHostlessPackage } from "@/wab/server/code-components/code-components";
import { Bundler } from "@/wab/shared/bundler";
import { attachRenderableTplSlots } from "@/wab/shared/code-components/code-components";
import { assert, ensure } from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";
import { isRenderableType, typeFactory } from "@/wab/shared/model/model-util";
import { expect, it } from "vitest";

it("imports Material UI props, slots, states and defaults into a serializable Studio library", async () => {
  const site = await createSiteForHostlessProject(
    new HostLessPackageInfo({
      name: "material-ui",
      npmPkg: ["@shiguang-lab/plasmic-material-ui"],
      cssImport: [],
      deps: [],
      registerCalls: [],
      minimumReactVersion: "19.3.1",
    }),
  );
  expect(
    site.components.filter((c) => !c.codeComponentMeta?.isContext),
  ).toHaveLength(105);
  expect(
    site.components.find((c) => c.name === "plasmic-material-ui-theme-provider")
      ?.codeComponentMeta?.isContext,
  ).toBe(true);
  for (const suffix of [
    "text-field",
    "slider",
    "switch",
    "tabs",
    "dialog",
    "swipeable-drawer",
  ]) {
    const component = site.components.find(
      (c) => c.name === `plasmic-material-ui-${suffix}`,
    );
    expect(component?.codeComponentMeta).toMatchObject({
      isHostLess: true,
      importPath: "@shiguang-lab/plasmic-material-ui/components",
    });
    expect(component?.states.length).toBeGreaterThan(0);
  }
  const field = site.components.find(
    (c) => c.name === "plasmic-material-ui-text-field",
  );
  expect(field?.params.map((p) => p.variable.name)).toEqual(
    expect.arrayContaining([
      "label",
      "value",
      "onChange",
      "slotProps",
      "sx",
      "variant",
    ]),
  );
  const drawer = site.components.find(
    (c) => c.name === "plasmic-material-ui-drawer",
  );
  expect(drawer?.params.map((p) => p.variable.name)).toEqual(
    expect.arrayContaining([
      "open",
      "onOpenChange",
      "onClose",
      "anchor",
      "children",
    ]),
  );
  const bundle = new Bundler().bundle(site, "material-ui-test", "1");
  const restored = new Bundler().unbundle(
    bundle,
    "material-ui-test",
  ) as typeof site;
  expect(restored.components.map((c) => c.name)).toEqual(
    site.components.map((c) => c.name),
  );
  expect(
    restored.components
      .find((c) => c.name === field?.name)
      ?.params.map((p) => p.variable.name),
  ).toEqual(field?.params.map((p) => p.variable.name));
  for (const [suffix, prop] of [
    ["box", "children"],
    ["container", "children"],
    ["step-label", "children"],
    ["icon-button", "children"],
    ["tooltip", "children"],
    ["card-media", "children"],
    ["alert", "action"],
    ["card-header", "action"],
    ["tab", "icon"],
  ]) {
    const param = restored.components
      .find((c) => c.name === `plasmic-material-ui-${suffix}`)
      ?.params.find((p) => p.variable.name === prop);
    expect(param, `${suffix}.${prop}`).toBeDefined();
    expect(param && isRenderableType(param.type), `${suffix}.${prop}`).toBe(
      true,
    );
  }
  for (const suffix of [
    "checkbox",
    "radio",
    "switch",
    "mobile-stepper",
    "pagination-item",
    "snackbar-content",
    "table-pagination",
    "tab",
    "chip",
    "bottom-navigation-action",
  ]) {
    expect(
      restored.components
        .find((c) => c.name === `plasmic-material-ui-${suffix}`)
        ?.params.some((p) => p.variable.name === "children"),
      suffix,
    ).toBe(false);
  }
  for (const [suffix, prop, typeName] of [
    ["grid", "container", "bool"],
    ["card", "raised", "bool"],
    ["stepper", "activeStep", "num"],
    ["mobile-stepper", "steps", "num"],
    ["avatar-group", "max", "num"],
    ["rating", "precision", "num"],
    ["grid", "size", "any"],
    ["select", "value", "any"],
    ["button", "component", "any"],
  ]) {
    const param = restored.components
      .find((c) => c.name === `plasmic-material-ui-${suffix}`)
      ?.params.find((p) => p.variable.name === prop);
    expect(param?.type.name, `${suffix}.${prop}`).toBe(typeName);
  }
}, 60000);

it.each([false, true])("requires explicit breaking publication to remove obsolete Material UI slots: %s", async (breaking) => {
  const site = await createSiteForHostlessProject(new HostLessPackageInfo({
    name: "material-ui", npmPkg: ["@shiguang-lab/plasmic-material-ui"],
    cssImport: [], deps: [], registerCalls: [], minimumReactVersion: "19.3.1",
  }));
  const checkbox = ensure(site.components.find(c => c.name === "plasmic-material-ui-checkbox"), "Missing Checkbox");
  assert(isCodeComponent(checkbox));
  const id = checkbox.uuid;
  checkbox.params.push(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() }));
  attachRenderableTplSlots(checkbox);
  const result = updateHostlessPackage(site, "material-ui", createSite(), { breaking });
  if (!breaking) {
    await expect(result).rejects.toThrow("Deleted slot children of component plasmic-material-ui-checkbox");
  } else {
    await expect(result).resolves.toEqual({ "plasmic-material-ui-checkbox": ["children"] });
    expect(site.components.find(c => c.uuid === id)).toBe(checkbox);
    expect(checkbox.params.some(p => p.variable.name === "children")).toBe(false);
    expect(checkbox.params.some(p => p.variable.name === "checked")).toBe(true);
  }
}, 60000);
