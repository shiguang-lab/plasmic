import { htmlForComponentAction } from "@/wab/client/components/sidebar-tabs/component-action-html";
import { createComponentTestSite } from "@/wab/client/web-importer/__testonly__/utils";
import { parseHtmlToWebImporterTree } from "@/wab/client/web-importer/html-parser";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { deserializePlasmicComponentAttrs } from "@/wab/shared/web-exporter/component-utils";

function fixture() {
  const site = createComponentTestSite();
  const library = createComponentTestSite();
  const other = createComponentTestSite();
  for (const [id, dependency] of [
    ["library", library],
    ["other", other],
  ] as const) {
    site.projectDependencies.push(
      new ProjectDependency({
        projectId: id,
        pkgId: id,
        version: "1.0.0",
        name: id,
        site: dependency,
        uuid: id,
      }),
    );
  }
  return { site, library, other, column: library.components[0] };
}

test("an imported component action inserts editable sibling slots from the correct library", async () => {
  const { site, library, column } = fixture();
  const html = htmlForComponentAction(
    '<plasmic-component data-plasmic-component="Card"><slot name="children"><plasmic-component data-plasmic-component="Button" data-props=\'{"label":"{{ cell }}"}\'></plasmic-component></slot></plasmic-component>',
    site,
    column,
  );
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of Array.from(
    document.querySelectorAll("plasmic-component"),
  )) {
    const name = element.getAttribute("data-plasmic-component")!;
    expect(element.getAttribute("data-plasmic-project")).toBe("library");
    expect(
      deserializePlasmicComponentAttrs(site, {
        "data-plasmic-component": name,
        "data-plasmic-project": "library" as ProjectId,
      }),
    ).toBe(library.components.find((component) => component.name === name));
  }
  const parsed = (await parseHtmlToWebImporterTree(html, site))._unsafeUnwrap();
  expect(parsed.errors).toEqual([]);
  expect(parsed.wiTree).toMatchObject({
    type: "fragment",
    children: [
      {
        type: "component",
        component: "Card",
        depProjectId: "library",
        slots: {
          children: [
            expect.objectContaining({
              component: "Button",
              depProjectId: "library",
              props: { label: "{{ cell }}" },
            }),
          ],
        },
      },
    ],
  });
});

test("explicit library references retain their identity and unknown components stay unresolved", () => {
  const { site, column } = fixture();
  const html = htmlForComponentAction(
    '<plasmic-component data-plasmic-component="Button" data-plasmic-project="other"></plasmic-component><plasmic-component data-plasmic-component="Unknown"></plasmic-component>',
    site,
    column,
  );
  const document = new DOMParser().parseFromString(html, "text/html");
  const elements = document.querySelectorAll("plasmic-component");
  expect(elements[0].getAttribute("data-plasmic-project")).toBe("other");
  expect(elements[1].getAttribute("data-plasmic-project")).toBeNull();
});

test("local component actions continue to resolve local components", () => {
  const { site } = fixture();
  const html =
    '<plasmic-component data-plasmic-component="Button"></plasmic-component>';
  expect(htmlForComponentAction(html, site, site.components[0])).toBe(html);
});
