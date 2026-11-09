import type { ModelChange, RecordedChanges } from "@/wab/shared/core/observable-model";
import {
  Component,
  TplTag,
  Variant,
  type ObjInst,
} from "@/wab/shared/model/classes";
import {
  modelKeysForChanges,
  modelKeysForInst,
  type OwnerComponentLookup,
} from "@/wab/shared/model-change-keys";
import { modelKeys } from "@/wab/shared/model-revisions";

/**
 * The dirty-key table is the main correctness risk of the migration: a missing
 * key means a component silently stops updating. These tests pin the mapping for
 * every model kind that appears in `RecordedChanges`.
 */

function fieldChange(inst: ObjInst, field = "name"): ModelChange {
  return {
    type: "update",
    observableKind: "object",
    name: field,
    object: inst,
    oldValue: undefined,
    newValue: undefined,
    changeNode: { inst, field },
  } as unknown as ModelChange;
}

function changesFor(insts: ObjInst[]): RecordedChanges {
  return {
    changes: insts.map((inst) => fieldChange(inst)),
    newInsts: [],
    removedInsts: [],
  };
}

/** Stand-in for `tryGetTplOwnerComponent`, which needs the real tpls tracker. */
function ownerLookup(...components: { uuid: string; tplTree: ObjInst }[]): OwnerComponentLookup {
  const byRoot = new Map<ObjInst, { uuid: string }>(
    components.map((component) => [component.tplTree, component]),
  );
  return (tpl) => byRoot.get(tpl);
}

/**
 * Build model instances directly from `model/classes` instead of the `core`
 * factories: those pull the codegen graph, which needs the whole dependency
 * tree installed and has nothing to do with this table.
 */
function makeTpl(uuid: string, tag = "div"): TplTag {
  return new TplTag({
    tag,
    name: null,
    children: [],
    type: "other",
    codeGenType: null,
    columnsSetting: null,
    uuid,
    parent: null,
    locked: null,
    vsettings: [],
  });
}

function makeVariant(uuid: string): Variant {
  return new Variant({
    uuid,
    name: "base",
    selectors: [],
    codeComponentName: null,
    codeComponentVariantKeys: [],
    parent: null,
    mediaQuery: null,
    description: null,
    forTpl: null,
  });
}

let nextComponent = 0;

function rootComponent() {
  nextComponent += 1;
  const tplTree = makeTpl(`tpl-${nextComponent}`);
  const variant = makeVariant(`variant-${nextComponent}`);
  const component = new Component({
    uuid: `component-${nextComponent}`,
    name: "Root",
    params: [],
    states: [],
    tplTree,
    editableByContentEditor: false,
    hiddenFromContentEditor: false,
    variants: [variant],
    variantGroups: [],
    pageMeta: null,
    codeComponentMeta: null,
    type: "plain",
    subComps: [],
    superComp: null,
    plumeInfo: null,
    templateInfo: null,
    metadata: {},
    dataQueries: [],
    serverQueries: [],
    figmaMappings: [],
    alwaysAutoName: false,
    trapsFocus: false,
    updatedAt: null,
  });
  return component;
}

it("dirties the tpl, its owner component and the site", () => {
  const component = rootComponent();
  const tpl = component.tplTree;

  const keys = modelKeysForChanges(changesFor([tpl]), ownerLookup(component));

  expect(keys).toEqual(
    expect.arrayContaining([
      modelKeys.tpl(tpl.uuid),
      modelKeys.component(component.uuid),
      modelKeys.site,
    ]),
  );
});

it("keeps the tpl key when the owner component is unknown", () => {
  const detached = makeTpl("tpl-detached");

  const keys = modelKeysForInst(detached, () => undefined);

  expect(keys).toContain(modelKeys.tpl(detached.uuid));
  expect(keys).toContain(modelKeys.site);
  expect(keys.some((key) => key.startsWith("component:"))).toBe(false);
});

it("dirties the component and the site for a component change", () => {
  const component = rootComponent();

  expect(modelKeysForInst(component, () => undefined)).toEqual(
    expect.arrayContaining([modelKeys.component(component.uuid), modelKeys.site]),
  );
});

it("dirties the variant and the site for a variant change", () => {
  const component = rootComponent();
  const variant = component.variants[0];

  expect(modelKeysForInst(variant, () => undefined)).toEqual(
    expect.arrayContaining([modelKeys.variant(variant.uuid), modelKeys.site]),
  );
});

it("falls back to the site key for unknown instances", () => {
  const unknown = { uuid: "u1", uid: 1 } as unknown as ObjInst;

  expect(modelKeysForInst(unknown, () => undefined)).toEqual([modelKeys.site]);
});

it("counts structural additions and removals, not only field updates", () => {
  const component = rootComponent();
  const tpl = component.tplTree;

  const added = modelKeysForChanges(
    { changes: [], newInsts: [tpl], removedInsts: [] },
    ownerLookup(component),
  );
  const removed = modelKeysForChanges(
    { changes: [], newInsts: [], removedInsts: [tpl] },
    ownerLookup(component),
  );

  expect(added).toContain(modelKeys.tpl(tpl.uuid));
  expect(removed).toContain(modelKeys.tpl(tpl.uuid));
  expect(removed).toContain(modelKeys.component(component.uuid));
});

it("deduplicates keys across several changes", () => {
  const component = rootComponent();
  const tpl = component.tplTree;

  const keys = modelKeysForChanges(
    changesFor([tpl, component, tpl, component]),
    ownerLookup(component),
  );

  const duplicates = keys.filter(
    (key) => key === modelKeys.component(component.uuid),
  );
  expect(duplicates).toHaveLength(1);
});


it("derives component and tpl keys from the recorded change path", () => {
  const component = rootComponent();
  const tpl = component.tplTree;
  // A kind without an owner lookup (e.g. State) falls back to `site`; the path
  // must still dirty the component and its tpl ancestors.
  const unknownInst = { uuid: "state-1", uid: 1 } as unknown as ObjInst;
  const change = {
    ...fieldChange(unknownInst),
    path: [
      { inst: component, field: "states" },
      { inst: tpl, field: "name" },
      { inst: unknownInst, field: "initialValue" },
    ],
  };

  const keys = modelKeysForChanges(
    { changes: [change], newInsts: [], removedInsts: [] },
    ownerLookup(component),
  );

  expect(keys).toContain(modelKeys.component(component.uuid));
  expect(keys).toContain(modelKeys.tpl(tpl.uuid));
  expect(keys).toContain(modelKeys.site);
});


function nestedTpls() {
  const component = rootComponent();
  const parentTpl = component.tplTree as TplTag;
  const child = makeTpl("tpl-child");
  child.parent = parentTpl;
  parentTpl.children.push(child);
  return { component, parentTpl, child };
}

it("dirties ancestor tpls when a layout field changes", () => {
  const { component, parentTpl, child } = nestedTpls();

  const keys = modelKeysForChanges(
    { changes: [fieldChange(child, "parent")], newInsts: [], removedInsts: [] },
    ownerLookup(component),
  );

  expect(keys).toContain(modelKeys.tpl(child.uuid));
  expect(keys).toContain(modelKeys.tpl(parentTpl.uuid));
});

it("does not dirty ancestors for non-layout fields", () => {
  const { component, parentTpl, child } = nestedTpls();

  const keys = modelKeysForChanges(
    { changes: [fieldChange(child, "name")], newInsts: [], removedInsts: [] },
    ownerLookup(component),
  );

  expect(keys).toContain(modelKeys.tpl(child.uuid));
  expect(keys).not.toContain(modelKeys.tpl(parentTpl.uuid));
});
