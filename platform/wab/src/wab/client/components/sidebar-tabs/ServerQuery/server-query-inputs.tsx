import { clone } from "@/wab/shared/core/exprs";
import { smartHumanize } from "@/wab/shared/strs";
import { captureVariantModelWorld, useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { ModelSnapshotInputs } from "@/wab/client/studio-ctx/model-snapshot-inputs";
import { arrayEq, assert } from "@/wab/shared/common";
import { allCustomFunctions } from "@/wab/shared/cached-selectors";
import { getComponentDisplayName, isPageComponent } from "@/wab/shared/core/components";
import { isKnownTplNode, type Site, type TplNode, type Component, type ComponentServerQuery, type ComponentDataQuery, type QueryInvalidationExpr, isKnownComponentDataQuery, isKnownComponentServerQuery, isKnownCustomFunctionExpr, type CustomFunction, type Interaction, type ObjInst } from "@/wab/shared/model/classes";
import type { ServerQueryOp } from "@/wab/shared/codegen/react-p/server-queries/utils";
import type { EventHandlerKeyType } from "@/wab/shared/core/tpls";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import * as React from "react";

abstract class QueryModelInputs<Value> extends ModelSnapshotInputs<Value> {
  constructor(protected readonly studio: StudioCtx, empty: Value, view?: ViewCtx, world = captureVariantModelWorld(studio)) {
    super(studio, world.models, world.site, view?.disposeSignal ?? world.lifetime, empty);
  }
  protected ownedVersion(model: ObjInst): string {
    return this.snapshotVersion(model);
  }
}

export interface QuerySnapshot {
  readonly name: string;
  readonly op: ModelRef<ServerQueryOp> | null | undefined;
  readonly version: string;
}
const noQuery: QuerySnapshot = Object.freeze({name: "", op: undefined, version: ""});
export class ServerQueryInputs extends QueryModelInputs<QuerySnapshot> {
  constructor(studio: StudioCtx, private readonly query: ComponentServerQuery | undefined, view?: ViewCtx) {super(studio, noQuery, view);}
  protected capture(previous: QuerySnapshot) {
    if (!this.query) {return noQuery;}
    const name = this.read(this.query, "name"), op = this.read(this.query, "op");
    const version = op ? this.ownedVersion(this.models.resolve(op)) : "";
    return name === previous.name && op === previous.op && version === previous.version ? previous : Object.freeze({name, op, version});
  }
}
export function useServerQueryInputs(studio: StudioCtx, query: ComponentServerQuery | undefined, view?: ViewCtx) {
  const source = React.useMemo(() => new ServerQueryInputs(studio, query, view), [studio, query, view]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return {snapshot, source};
}

interface QueryChoice { readonly query: ModelRef<ComponentServerQuery>; readonly name: string; }
interface ComponentQueryChoices {readonly component: ModelRef<Component>; readonly label: string; readonly queries: readonly QueryChoice[];}
export interface QueryListSnapshot {
  readonly queries: readonly ModelRef<ComponentServerQuery>[];
  readonly other: readonly ComponentQueryChoices[];
  readonly isPage: boolean;
  readonly version: string;
}
const noQueries: QueryListSnapshot = Object.freeze({queries: Object.freeze([]), other: Object.freeze([]), isPage: false, version: ""});
export class ServerQueryListInputs extends QueryModelInputs<QueryListSnapshot> {
  constructor(studio: StudioCtx, private readonly component: Component, view: ViewCtx) {super(studio, noQueries, view);}
  protected capture(previous: QueryListSnapshot) {
    const rows = this.read(this.component, "serverQueries");
    const queries = arrayEq(previous.queries, rows) ? previous.queries : rows;
    this.read(this.component, "type");
    const isPage = isPageComponent(this.component);
    const other: ComponentQueryChoices[] = [];
    for (const ref of this.read(this.site, "components")) {
      const component = this.models.resolve(ref);
      if (component === this.component) {continue;}
      const choices = this.read(component, "serverQueries").flatMap((queryRef) => {
        const query = this.models.resolve(queryRef);
        return this.read(query, "op") ? [Object.freeze({query: queryRef, name: this.read(query, "name")})] : [];
      });
      if (!choices.length) {continue;}
      this.read(component, "name"); this.read(component, "type");
      const meta = this.read(component, "codeComponentMeta");
      if (meta) {this.read(this.models.resolve(meta), "displayName");}
      other.push(Object.freeze({component: ref, label: getComponentDisplayName(component), queries: Object.freeze(choices)}));
    }
    const version = JSON.stringify(other);
    return queries === previous.queries && isPage === previous.isPage && version === previous.version ? previous : Object.freeze({queries, isPage, other: Object.freeze(other), version});
  }
}
export function useServerQueryList(studio: StudioCtx, component: Component, view: ViewCtx) {
  const source = React.useMemo(() => new ServerQueryListInputs(studio, component, view), [studio, component, view]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return {snapshot, source};
}

interface FunctionCatalogSnapshot { readonly functions: readonly ModelRef<CustomFunction>[]; readonly version: string; }
const noFunctions: FunctionCatalogSnapshot = Object.freeze({functions: Object.freeze([]), version: ""});
export class ServerFunctionCatalogInputs extends QueryModelInputs<FunctionCatalogSnapshot> {
  constructor(studio: StudioCtx, world = captureVariantModelWorld(studio)) {super(studio, noFunctions, undefined, world);}
  protected capture(previous: FunctionCatalogSnapshot) {
    const owners: Site[] = [this.site];
    const dependencies = [...this.read(this.site, "projectDependencies")];
    const queued = new Set(dependencies.map((ref) => this.read(this.models.resolve(ref), "projectId")));
    const dependencyVersions: unknown[] = [];
    for (let index = 0; index < dependencies.length; index++) {
      const dependency = this.models.resolve(dependencies[index]), id = this.read(dependency, "projectId");
      const ownerRef = this.read(dependency, "site"), owner = this.models.resolve(ownerRef);
      dependencyVersions.push([dependencies[index], id, ownerRef]); owners.push(owner);
      for (const child of this.read(owner, "projectDependencies")) {
        const childId = this.read(this.models.resolve(child), "projectId");
        if (!queued.has(childId)) {queued.add(childId); dependencies.push(child);}
      }
    }
    for (const owner of owners) {this.read(owner, "customFunctions");}
    const functions = allCustomFunctions(this.site).map(({customFunction}) => this.models.ref(customFunction));
    const version = JSON.stringify([dependencyVersions, functions.map((ref) => this.ownedVersion(this.models.resolve(ref)))]);
    return arrayEq(previous.functions, functions) && version === previous.version ? previous : Object.freeze({functions: Object.freeze(functions), version});
  }
}
export function useServerFunctionCatalog(studio: StudioCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new ServerFunctionCatalogInputs(studio, world), [studio, world]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return {snapshot, source};
}

class FunctionMetadataInputs extends QueryModelInputs<string> {
  constructor(studio: StudioCtx, private readonly func: CustomFunction | undefined) {super(studio, "");}
  protected capture() {return this.func ? this.ownedVersion(this.func) : "";}
}
export function useServerFunctionMetadata(studio: StudioCtx, func: CustomFunction | undefined) {
  const source = React.useMemo(() => new FunctionMetadataInputs(studio, func), [studio, func]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
const noFunctionRegistration = createStore(() => undefined);
export function useServerFunctionRegistration(view: ViewCtx | undefined, func: CustomFunction | undefined) {
  return useStore(view && func ? view.canvasCtx.registrations.function(customFunctionId(func)) : noFunctionRegistration);
}

export interface QueryDataTokenName {readonly uid: number; readonly name: string;}
const noTokenNames: readonly QueryDataTokenName[] = Object.freeze([]);
export class QueryDataTokenNames extends QueryModelInputs<readonly QueryDataTokenName[]> {
  constructor(studio: StudioCtx, world = captureVariantModelWorld(studio)) {super(studio, noTokenNames, undefined, world);}
  protected capture(previous: readonly QueryDataTokenName[]) {
    const next = this.read(this.site, "dataTokens").map((ref) => {
      const token = this.models.resolve(ref), name = this.read(token, "name");
      return previous.find((item) => item.uid === token.uid && item.name === name) ?? Object.freeze({uid: token.uid, name});
    });
    return arrayEq(previous, next) ? previous : Object.freeze(next);
  }
}
export function useQueryDataTokenNames(studio: StudioCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new QueryDataTokenNames(studio, world), [studio, world]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

class PickerComponentInputs extends QueryModelInputs<string> {
  constructor(studio: StudioCtx, private readonly component: Component | null | undefined) {super(studio, "");}
  protected capture() {
    if (!this.component) {return "";}
    const component = this.component;
    const values: unknown[] = [this.read(component, "name"), this.read(component, "type")];
    const meta = this.read(component, "codeComponentMeta");
    if (meta) {values.push(this.read(this.models.resolve(meta), "displayName"));}
    for (const ref of this.read(component, "params")) {values.push(this.ownedVersion(this.models.resolve(ref)));}
    for (const ref of this.read(component, "states")) {
      const state = this.models.resolve(ref); values.push(this.ownedVersion(state));
      const inherited = this.read(state, "implicitState");
      if (inherited) {values.push(this.ownedVersion(this.models.resolve(inherited)));}
      let nodeRef: ModelRef<TplNode> | null | undefined = this.read(state, "tplNode");
      while (nodeRef) {
        const node = this.models.resolve(nodeRef);
        assert(isKnownTplNode(node), "State context must refer to a template node");
        if ("name" in node) {values.push(this.readDeclared(node, "name"));}
        for (const setting of this.read(node, "vsettings")) {values.push(this.read(this.models.resolve(setting), "dataRep"));}
        nodeRef = this.read(node, "parent");
      }
    }
    return JSON.stringify(values);
  }
}
export function useQueryPickerComponentInputs(studio: StudioCtx, component: Component | null | undefined) {
  const source = React.useMemo(() => new PickerComponentInputs(studio, component), [studio, component]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

class QueryInteractionInputs extends QueryModelInputs<string> {
  constructor(studio: StudioCtx, private readonly interaction: Interaction | undefined, private readonly key: EventHandlerKeyType | undefined, view?: ViewCtx) {super(studio, "", view);}
  protected capture() {
    const values: unknown[] = [];
    if (this.interaction) {
      const parent = this.read(this.interaction, "parent");
      if (parent) {
        for (const ref of this.read(this.models.resolve(parent), "interactions")) {
          const interaction = this.models.resolve(ref);
          values.push(ref, this.read(interaction, "interactionName"));
          if (interaction === this.interaction) {break;}
        }
      }
    }
    if (this.key && "param" in this.key) {
      const type = this.read(this.key.param, "type"); values.push(this.ownedVersion(this.models.resolve(type)));
    } else if (this.key && "funcType" in this.key) {values.push(this.ownedVersion(this.key.funcType));}
    return JSON.stringify(values);
  }
}
export function useQueryInteractionInputs(studio: StudioCtx, interaction: Interaction | undefined, key: EventHandlerKeyType | undefined, view?: ViewCtx) {
  const source = React.useMemo(() => new QueryInteractionInputs(studio, interaction, key, view), [studio, interaction, key, view]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}


/** Query refresh options read directory metadata, not query bodies or designs. */
export interface QueryInvalidationSnapshot {
  readonly options: readonly {readonly value: string; readonly name: string; readonly count?: number; readonly ref: ComponentDataQuery | ComponentServerQuery}[];
  readonly selectedValues: readonly string[] | undefined;
  readonly value: QueryInvalidationExpr | undefined;
  readonly isCurrent: () => boolean;
}
export class QueryInvalidationInputs extends QueryModelInputs<QueryInvalidationSnapshot | null> {
  constructor(studio: StudioCtx, private readonly value?: QueryInvalidationExpr, world = captureVariantModelWorld(studio)) { super(studio, null, undefined, world); }
  private isCurrent = () => !this.isClosed();
  protected capture(): QueryInvalidationSnapshot {
    const data: ComponentDataQuery[] = [], server: ComponentServerQuery[] = [];
    for (const ref of this.read(this.site, "components")) {
      const component = this.models.resolve(ref);
      data.push(...this.read(component, "dataQueries").map(queryRef => this.models.resolve(queryRef)));
      server.push(...this.read(component, "serverQueries").map(queryRef => this.models.resolve(queryRef)));
    }
    const options: {value: string; name: string; count?: number; ref: ComponentDataQuery | ComponentServerQuery}[] = [];
    const groups = new Map<string, {value: string; name: string; count: number; ref: ComponentServerQuery}>();
    const identify = (query: ComponentDataQuery | ComponentServerQuery | TplNode) => {
      const id = this.read(query, "uuid");
      if (isKnownComponentServerQuery(query)) {
        const op = this.read(query, "op");
        if (op) {
          const expression = this.models.resolve(op);
          if (isKnownCustomFunctionExpr(expression)) {
            const func = this.models.resolve(this.read(expression, "func"));
            this.read(func, "namespace"); this.read(func, "importName"); this.read(func, "displayName");
            return {id: customFunctionId(func), name: func.displayName ?? smartHumanize(func.importName), grouped: true, enabled: true};
          }
        }
        return {id, name: this.read(query, "name"), grouped: false, enabled: !!op};
      }
      return {id, name: isKnownComponentDataQuery(query) ? this.read(query, "name") : "", grouped: false, enabled: true};
    };
    for (const query of [...data, ...server]) {
      const entry = identify(query);
      if (!entry.enabled) {continue;}
      if (entry.grouped && isKnownComponentServerQuery(query)) {
        const group = groups.get(entry.id);
        if (group) {group.count++;}
        else {groups.set(entry.id, {value: entry.id, name: entry.name, count: 1, ref: query});}
      } else {options.push({value: entry.id, name: entry.name, ref: query});}
    }
    options.push(...groups.values());
    if (this.value) {this.ownedVersion(this.value);}
    return Object.freeze({
      options: Object.freeze(options.map(option => Object.freeze(option))),
      selectedValues: this.value ? Object.freeze(this.value.invalidationQueries.map(ref => typeof ref === "string" ? ref : identify(ref.ref).id)) : undefined,
      value: this.value ? clone(this.value) : undefined,
      isCurrent: this.isCurrent,
    });
  }
}

export function useQueryInvalidationInputs(studio: StudioCtx, value?: QueryInvalidationExpr) {
  // An existing expression keeps its original world. An empty editor is a live catalog.
  const current = useCurrentModelWorld(studio);
  const [binding, setBinding] = React.useState(() => ({studio, value, world: captureVariantModelWorld(studio)}));
  if (binding.value !== value || binding.studio !== studio) { setBinding({studio, value, world: captureVariantModelWorld(studio)}); }
  const world = value ? binding.world : current;
  const source = React.useMemo(() => new QueryInvalidationInputs(studio, value, world), [studio, value, world]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
