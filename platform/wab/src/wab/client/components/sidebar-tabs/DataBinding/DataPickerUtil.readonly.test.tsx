import { prepareEnvForDataPicker } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerUtil";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam, mkParamsForState, mkVar } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { addComponentState, ensureCorrectImplicitStates, mkNamedState } from "@/wab/shared/core/states";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { Rep, ensureKnownTplTag, ensureKnownTplComponent } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { mkMetaName } from "@plasmicapp/host";
import type { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import { mock } from "vitest-mock-extended";

it("annotates frozen picker containers without changing the input env or opaque runtime/query handles", () => {
  const site = createSite();
  const meta: CodeComponentMeta<any> = {name: "Conditional", importPath: "conditional", props: {}, states: {value: {type: "readonly", variableType: "text", onChangeProp: "onValueChange", hidden: () => true}}};
  const child = mkCodeComponent(meta.name, meta, {}); child._meta = meta;
  const {valueParam, onChangeParam} = mkParamsForState({name: "value", accessType: "readonly", variableType: "text", onChangeProp: "onValueChange"});
  addComponentState(site, child, mkNamedState({name: "value", accessType: "readonly", param: valueParam, onChangeParam, variableType: "text"}));
  const component = mkComponent({name: "Repeating", type: ComponentType.Plain, tplTree: (base) => {
    const node = mkTplComponent(child, base); node.name = "Rows";
    return mkTplTagX("div", {
      baseVariant: base,
      dataRep: new Rep({collection: codeLit([]), element: mkVar("item"), index: null}),
    }, node);
  }});
  site.components.push(child, component);
  const root = ensureKnownTplTag(component.tplTree);
  ensureCorrectImplicitStates(site, component, root);
  const instance = ensureKnownTplComponent(ensure(root.children[0], "Repeated code instance"));
  ensureCorrectImplicitStates(site, component, instance);
  component.params.push(mkParam({name: "missingProp", paramType: "prop", type: typeFactory.text()}));
  const view = mock<ViewCtx>();
  view.getComponentEvalContext.mockReturnValue({componentPropValues: {}, ccContextData: undefined, invalidArgs: []});
  const callback = () => undefined;
  class RuntimeHandle {readonly id = "runtime";}
  class QueryHandle {get data() {return {result: 4};}}
  const runtime = new RuntimeHandle(), query = new QueryHandle();
  const rows = Object.freeze([Object.freeze({value: "one"}), Object.freeze({value: "two"})]);
  const env = Object.freeze({$props: Object.freeze({callback}), $state: Object.freeze({rows, runtime, query}), $q: Object.freeze({load: query}), $ctx: Object.freeze({runtime})});
  const prepared = prepareEnvForDataPicker(view, env, component, undefined, {keepStatefulQueries: true});
  expect(Object.hasOwn(prepared.$props, "missingProp")).toBe(true);
  expect(Object.hasOwn(env.$props, "missingProp")).toBe(false);
  expect(prepared.$props.callback).toBe(callback);
  expect(prepared.$state.rows).not.toBe(rows);
  for (const row of prepared.$state.rows) {expect(row[mkMetaName("value")]).toMatchObject({hidden: true});}
  expect(Object.hasOwn(rows[0], mkMetaName("value"))).toBe(false);
  expect(prepared.$state.runtime).toBe(runtime);
  expect(prepared.$state.query).toBe(query);
  expect(prepared.$q).toBe(env.$q);
  expect(prepared.$q.load).toBe(query);
  expect(prepared.$ctx).toBe(env.$ctx);
  const unwrapped = prepareEnvForDataPicker(view, env, component);
  expect(unwrapped.$q.load).toEqual({data: {result: 4}, error: undefined});
  expect(env.$q.load).toBe(query);
});
