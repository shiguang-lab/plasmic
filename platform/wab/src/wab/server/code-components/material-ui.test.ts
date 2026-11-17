import { createSiteForHostlessProject } from "@/wab/server/code-components/code-components";
import { Bundler } from "@/wab/shared/bundler";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";
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
  ).toHaveLength(104);
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
}, 60000);
