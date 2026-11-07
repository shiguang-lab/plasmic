import { depsForComponent, serializeComponent } from "@/wab/client/components/docs/serialize-docs-preview";
import { getExportedComponentName } from "@/wab/shared/codegen/react-p/serialize-utils";
import { ensure } from "@/wab/shared/common";
import { isSubComponent } from "@/wab/shared/core/components";
import type { Component, Site } from "@/wab/shared/model/classes";
import { PlumeDocsExample, getPlumeDocsPlugin } from "@/wab/shared/plume/plume-registry";

function mkDeps(site: Site, component: Component): Record<string, Component> {
  const deps: Record<string, Component> = {};
  for (const comp of depsForComponent(site, component)) {
    if (comp?.plumeInfo) {
      deps[ensure(comp.plumeInfo, "Example dependency must have Plume metadata").type] = comp;
    }
  }
  return deps;
}

function mkInstances(
  component: Component,
  deps: Record<string, Component>,
  example: PlumeDocsExample,
  useLoader: boolean,
): Record<string, string> {
  if (!example.instances) {
    return {};
  }

  const instances: Record<string, string> = {};
  for (const [key, instance] of Object.entries(example.instances)) {
    const comp = instance.plumeType
      ? ensure(
          deps[instance.plumeType],
          `Instance in example has unknown dep "${instance.plumeType}"`,
        )
      : component;

    let forceName: string | undefined;
    if (isSubComponent(comp) && instance.plumeType) {
      const superComp = ensure(comp.superComp, "Example subcomponent must have its owner");
      const superPlugin = getPlumeDocsPlugin(superComp);
      if (superPlugin?.subs?.[instance.plumeType]) {
        forceName = `${getExportedComponentName(superComp)}.${
          superPlugin.subs[instance.plumeType]
        }`;
      }
    }

    instances[key] = serializeComponent(
      comp,
      instance.props,
      useLoader,
      true,
      forceName,
    );
  }

  return instances;
}

export function makeCodePreviewSource(
  site: Site,
  component: Component,
  example: PlumeDocsExample,
  useLoader: boolean,
) {
  const deps = mkDeps(site, component);
  const instances = mkInstances(component, deps, example, useLoader);

  let initialCode = `
      export default function App() {
        ${example.code}
      }
    `;

  // eslint-disable-next-line no-useless-escape
  while (initialCode.match(/<Instance[^ \/]* ?\/>/)) {
    initialCode = initialCode.replace(
      // eslint-disable-next-line no-useless-escape
      /<Instance([^ \/]*) ?\/>/g,
      (_, key) => instances[key],
    );
  }

  return initialCode.trim();
}

