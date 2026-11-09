import { CodeComponentsRegistry, registeredFunctionId } from "@/wab/shared/code-components/code-components";
import type { CustomFunctionRegistration } from "@plasmicapp/host";

it("publishes host registration changes only after clearing all registry caches", () => {
  const first = () => "first", second = () => "second";
  const registration: CustomFunctionRegistration = {function: first, meta: {name: "lookup", importPath: "./lookup"}};
  const id = registeredFunctionId(registration), previous = window.__PlasmicFunctionsRegistry;
  window.__PlasmicFunctionsRegistry = [registration];
  const registry = new CodeComponentsRegistry(window, {});
  const seen: unknown[] = [];
  const stop = registry.revisionStore.subscribe(() => {seen.push(registry.getRegisteredFunctionsMap().get(id)?.function);});
  try {
    expect(registry.getRegisteredFunctionsMap().get(id)?.function).toBe(first);
    window.__PlasmicFunctionsRegistry = [{function: second, meta: {name: "lookup", importPath: "./lookup"}}];
    expect(seen).toEqual([]);
    registry.clear(); expect(seen).toEqual([second]);
    stop(); registry.clear(); expect(seen).toEqual([second]);
  } finally {stop(); window.__PlasmicFunctionsRegistry = previous;}
});
