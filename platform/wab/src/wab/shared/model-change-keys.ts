import type { RecordedChanges } from "@/wab/shared/core/observable-model";
import {
  ObjInst,
  TplNode,
  isKnownArena,
  isKnownComponent,
  isKnownSite,
  isKnownStyleToken,
  isKnownTplNode,
  isKnownVariant,
} from "@/wab/shared/model/classes";
import { modelKeys, type ModelKey } from "@/wab/shared/model-revisions";

/**
 * Translate a recorded model change into the revision keys it dirties.
 *
 * This is the "dirty key derivation" table from the migration plan (§5.3):
 * anything that can change what a component renders must map to a key that
 * component subscribes to. `site` is the coarse fallback — cheap to over-
 * invalidate, catastrophic to under-invalidate.
 */
/**
 * Resolve the component that owns a tpl. Injected rather than imported so this
 * module stays free of the (very heavy) `core/tpls` dependency graph, which also
 * makes the table testable with a fake resolver.
 */
export type OwnerComponentLookup = (
  tpl: TplNode,
) => { uuid: string } | undefined;

export function modelKeysForInst(
  inst: ObjInst,
  getOwnerComponent: OwnerComponentLookup,
): ModelKey[] {
  if (isKnownSite(inst)) {
    return [modelKeys.site];
  }
  if (isKnownComponent(inst)) {
    return [modelKeys.component(inst.uuid), modelKeys.site];
  }
  if (isKnownTplNode(inst)) {
    const keys: ModelKey[] = [modelKeys.tpl(inst.uuid), modelKeys.site];
    const owner = getOwnerComponent(inst);
    if (owner) {
      keys.push(modelKeys.component(owner.uuid));
    }
    return keys;
  }
  if (isKnownVariant(inst)) {
    return [modelKeys.variant(inst.uuid), modelKeys.site];
  }
  if (isKnownStyleToken(inst)) {
    return [modelKeys.token(inst.uuid), modelKeys.site];
  }
  if (isKnownArena(inst)) {
    return [modelKeys.arena(String(inst.uid)), modelKeys.site];
  }
  // Rule sets, themes, mixins, layout settings, ...: anything unknown is
  // conservative but correct.
  return [modelKeys.site];
}

/**
 * Fields whose change can move or resize the element, so every ancestor's
 * geometry (overlay boxes, rulers, measure tool) may change too.
 */
const LAYOUT_FIELDS = new Set([
  "parent",
  "children",
  "vsettings",
  "styles",
  "variants",
  "attrs",
  "args",
  "tplTree",
  "columnSpan",
  "columnsSetting",
]);

function ancestorTplKeys(inst: TplNode): ModelKey[] {
  const keys: ModelKey[] = [];
  let parent = inst.parent;
  // Guard against a broken parent chain while a change is in flight.
  let depth = 0;
  while (parent && depth < 200) {
    keys.push(modelKeys.tpl(parent.uuid));
    parent = parent.parent;
    depth += 1;
  }
  return keys;
}

export function modelKeysForChanges(
  changes: RecordedChanges,
  getOwnerComponent: OwnerComponentLookup,
): ModelKey[] {
  const keys = new Set<ModelKey>();
  for (const change of changes.changes) {
    for (const key of modelKeysForInst(change.changeNode.inst, getOwnerComponent)) {
      keys.add(key);
    }
    // The recorder also gives the path from the root to the changed node. Kinds
    // without an owner lookup (State, Param, ComponentDataQuery, ...) would
    // otherwise fall back to `site`; walking the path lets us dirty their owning
    // component (and tpl ancestors) instead.
    // Geometry consumers depend on the container chain, not just the element.
    const inst = change.changeNode.inst;
    if (isKnownTplNode(inst) && LAYOUT_FIELDS.has(change.changeNode.field)) {
      for (const key of ancestorTplKeys(inst)) {
        keys.add(key);
      }
    }
    for (const node of change.path ?? []) {
      for (const key of modelKeysForInst(node.inst, getOwnerComponent)) {
        keys.add(key);
      }
    }
  }
  // Structural changes move nodes between parents, so subscribers of both the
  // old and the new owner need a notification even if no field "changed".
  for (const inst of [...changes.newInsts, ...changes.removedInsts]) {
    for (const key of modelKeysForInst(inst, getOwnerComponent)) {
      keys.add(key);
    }
  }
  return [...keys];
}
