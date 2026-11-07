import type { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { getTplSlots, isPlainTextTplSlot } from "@/wab/shared/SlotUtils";
import { isStandaloneVariantGroup, tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { wabTypeToPropType } from "@/wab/shared/code-components/code-components";
import { makeNodeNamer } from "@/wab/shared/codegen/react-p";
import { getExportedComponentName, makePlasmicComponentName } from "@/wab/shared/codegen/react-p/serialize-utils";
import { toClassName, toVarName } from "@/wab/shared/codegen/util";
import { serializeVariantGroupMembersType } from "@/wab/shared/codegen/variants";
import { ensure } from "@/wab/shared/common";
import { flattenTplsWithoutThrowawayNodes, getRichTextContent, getTplType, isTplComponent, isTplTag, isTplTagOrComponent, type TplNamable, type TplType } from "@/wab/shared/core/tpls";
import { type Component, type Param, type TplSlot, type Variant, type VariantGroup, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { wabToTsType } from "@/wab/shared/model/model-util";
import { getPlumeDocsPlugin, type PlumeDocsExample } from "@/wab/shared/plume/plume-registry";
import { cloneDeep } from "lodash";

export interface DocsVariantOption {
  readonly ref: ModelRef<Variant>;
  readonly uuid: string;
  readonly name: string;
  readonly varName: string;
}
export interface DocsVariantGroup {
  readonly ref: ModelRef<VariantGroup>;
  readonly param: ModelRef<Param>;
  readonly name: string;
  readonly type: string;
  readonly isToggle: boolean;
  readonly multi: boolean;
  readonly options: readonly DocsVariantOption[];
}
export interface DocsSlot {
  readonly ref: ModelRef<TplSlot>;
  readonly param: ModelRef<Param>;
  readonly name: string;
  readonly isText: boolean;
}
export interface DocsLinkedProp {
  readonly param: ModelRef<Param>;
  readonly name: string;
  readonly varName: string;
  readonly type: string;
  readonly propType: ReturnType<typeof wabTypeToPropType>;
}
export interface DocsElement {
  readonly ref: ModelRef<TplNamable>;
  readonly uuid: string;
  readonly name: string;
  readonly isRoot: boolean;
  readonly isComponent: boolean;
  readonly elementType: string | null;
  readonly iconType: TplType;
}
export interface DocsContractProp {
  readonly name: string;
  readonly info: string;
  readonly type: string;
}
export interface DocsComponentModel {
  readonly ref: ModelRef<Component>;
  readonly uuid: string;
  readonly name: string;
  readonly exportedName: string;
  readonly plasmicName: string;
  readonly isPlume: boolean;
  readonly variantGroups: readonly DocsVariantGroup[];
  readonly slots: readonly DocsSlot[];
  readonly linkedProps: readonly DocsLinkedProp[];
  readonly elements: readonly DocsElement[];
  readonly docsInfo: string | undefined;
  readonly examples: readonly PlumeDocsExample[];
  readonly baseProps: readonly DocsContractProp[];
  readonly customProps: readonly DocsContractProp[];
  readonly footer: string | undefined;
}

function freezeData<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((item) => freezeData(item));
    Object.freeze(value);
  }
  return value;
}

export function variantGroupType(group: VariantGroup) {
  const members = serializeVariantGroupMembersType(group);
  return isStandaloneVariantGroup(group) ? `boolean | ${members}` : group.multi ? `Array<${members}> | Record<${members}, boolean>` : members;
}

/** Called for one demanded component after a complete model transaction.
 * Existing naming, type, slot and Plume helpers remain the only algorithms. */
export function projectDocsComponent(docs: DocsPortalCtx, component: Component): DocsComponentModel {
  const snapshots = docs.studioCtx.modelSnapshots;
  const plugin = getPlumeDocsPlugin(component);
  const codePropNames = new Set(plugin?.codeProps?.map((prop) => prop.name));
  const groups = component.variantGroups.filter((group) => group.variants.length);
  const slots = getTplSlots(component);
  const linkedProps = component.params.filter((param) => !slots.some((slot) => slot.param === param) && !component.variantGroups.some((group) => group.param === param));
  const nodeNamer = makeNodeNamer(component);
  const variantGroups = groups.map((group): DocsVariantGroup => Object.freeze({
    ref: snapshots.ref(group), param: snapshots.ref(group.param), name: toVarName(group.param.variable.name), type: variantGroupType(group), isToggle: isStandaloneVariantGroup(group), multi: group.multi,
    options: Object.freeze(group.variants.map((variant) => Object.freeze({ ref: snapshots.ref(variant), uuid: variant.uuid, name: variant.name, varName: toVarName(variant.name) }))),
  }));
  const slotModels = slots.map((slot): DocsSlot => Object.freeze({ ref: snapshots.ref(slot), param: snapshots.ref(slot.param), name: toVarName(slot.param.variable.name), isText: isPlainTextTplSlot(slot) }));
  const linkedModels = linkedProps.map((param): DocsLinkedProp => Object.freeze({ param: snapshots.ref(param), name: param.variable.name, varName: toVarName(param.variable.name), type: wabToTsType(param.type, true), propType: freezeData(cloneDeep(wabTypeToPropType(param.type))) }));
  const elements = flattenTplsWithoutThrowawayNodes(component).filter(isTplTagOrComponent).flatMap((node): DocsElement[] => {
    const name = nodeNamer(node);
    return name ? [Object.freeze({ ref: snapshots.ref(node), uuid: node.uuid, name, isRoot: node === component.tplTree, isComponent: isTplComponent(node), elementType: isTplTag(node) ? node.tag : isTplComponent(node) ? toClassName(node.component.name) : null, iconType: getTplType(node) })] : [];
  });
  const allProps = new Set<string>(component.params.map((param) => toVarName(param.variable.name)));
  const baseProps = (plugin?.codeProps ?? []).filter((prop) => allProps.has(prop.name)).map((prop) => Object.freeze({ name: prop.name, info: prop.info, type: typeof prop.type === "string" ? prop.type : prop.type(docs.studioCtx.site) }));
  const customProps = [
    ...variantGroups.filter((group) => !codePropNames.has(group.name)).map((group) => Object.freeze({ name: group.name, info: "Variant group.", type: group.type })),
    ...slotModels.filter((slot) => !codePropNames.has(slot.name)).map((slot) => Object.freeze({ name: slot.name, info: "Slot.", type: "ReactNode" })),
    ...linkedModels.filter((prop) => !codePropNames.has(prop.varName)).map((prop) => Object.freeze({ name: prop.varName, info: "Prop.", type: prop.type })),
  ];
  return Object.freeze({
    ref: snapshots.ref(component), uuid: component.uuid, name: component.name, exportedName: getExportedComponentName(component), plasmicName: makePlasmicComponentName(component), isPlume: !!component.plumeInfo,
    variantGroups: Object.freeze(variantGroups), slots: Object.freeze(slotModels), linkedProps: Object.freeze(linkedModels), elements: Object.freeze(elements), docsInfo: plugin?.docsInfo, examples: Object.freeze((plugin?.examples ?? []).map((example) => freezeData(cloneDeep(example)))), baseProps: Object.freeze(baseProps), customProps: Object.freeze(customProps), footer: plugin?.footer,
  });
}


/** Slot text is demanded only by the mounted text control, which owns the same
 * ViewCtx precondition as the existing slot editor. */
export function projectDocsSlotText(docs: DocsPortalCtx, slot: TplSlot) {
  if (!isPlainTextTplSlot(slot)) { return undefined; }
  const text = ensure(tryGetBaseVariantSetting(ensureKnownTplTag(slot.defaultContents[0])), "Slot default text setting missing").text;
  const viewCtx = ensure(docs.studioCtx.focusedOrFirstViewCtx(), "Missing viewCtx in docs portal");
  return text ? getRichTextContent(text, viewCtx) : "";
}
