import { computedNodeNamer } from "@/wab/shared/cached-selectors";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { isKnownTplTag, isKnownTplSlot, isKnownTplComponent } from "@/wab/shared/model/classes";
import { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { assert, switchType } from "@/wab/shared/common";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Component, ObjInst, TplNode, isKnownComponent, isKnownTplNode } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";

interface Declaration {
  readonly fields: readonly string[];
  readonly follow: readonly string[];
}

// Declared render inputs, not intercepted model reads. Tree children own separate
// capsules; component contracts are shared by every instance in this artboard.
const renderFields: Record<string, Declaration> = {
  Animation: { fields: ["sequence", "duration", "timingFunction", "iterationCount", "direction", "delay", "fillMode", "playState"], follow: ["sequence"] },
  AnimationSequence: { fields: ["name", "uuid", "keyframes"], follow: ["keyframes"] },
  AnyType: { fields: ["name"], follow: [] },
  Arg: { fields: ["param", "expr"], follow: ["param", "expr"] },
  ArgType: { fields: ["name", "argName", "displayName", "type"], follow: ["type"] },
  BoolType: { fields: ["name"], follow: [] },
  Choice: { fields: ["name", "options"], follow: [] },
  ClassNamePropType: { fields: ["name", "selectors", "defaultStyles"], follow: ["selectors"] },
  CodeComponentHelper: { fields: ["importPath", "importName", "defaultExport"], follow: [] },
  CodeComponentMeta: { fields: ["importPath", "defaultExport", "displayName", "importName", "classNameProp", "refProp", "defaultStyles", "defaultDisplay", "isHostLess", "isContext", "isAttachment", "providesData", "hasRef", "isRepeatable", "subtreePrefetchingConfig", "helpers", "defaultSlotContents", "variants"], follow: ["defaultStyles", "helpers", "variants"] },
  CodeComponentVariantMeta: { fields: ["cssSelector", "displayName"], follow: [] },
  CollectionExpr: { fields: ["exprs"], follow: ["exprs"] },
  ColorPropType: { fields: ["name", "noDeref"], follow: [] },
  ColumnsConfig: { fields: ["breakUpRows", "colsSizes"], follow: [] },
  ColumnsSetting: { fields: ["screenBreakpoint"], follow: [] },
  Component: { fields: ["uuid", "name", "params", "states", "tplTree", "variants", "variantGroups", "pageMeta", "codeComponentMeta", "type", "superComp", "subComps", "plumeInfo", "metadata", "dataQueries", "serverQueries", "alwaysAutoName", "trapsFocus"], follow: ["params", "states", "variants", "variantGroups", "pageMeta", "codeComponentMeta", "plumeInfo", "dataQueries", "serverQueries"] },
  ComponentDataQuery: { fields: ["uuid", "name", "op"], follow: ["op"] },
  ComponentInstance: { fields: ["name", "component"], follow: [] },
  ComponentServerQuery: { fields: ["uuid", "name", "op"], follow: ["op"] },
  ComponentVariantGroup: { fields: ["type", "param", "linkedState", "uuid", "variants", "multi"], follow: ["param", "variants"] },
  CompositeExpr: { fields: ["hostLiteral", "substitutions"], follow: ["substitutions"] },
  CustomCode: { fields: ["code", "fallback"], follow: ["fallback"] },
  CustomFunction: { fields: ["importPath", "importName", "defaultExport", "namespace", "displayName", "params", "isQuery", "isMutation"], follow: ["params"] },
  CustomFunctionExpr: { fields: ["func", "args"], follow: ["func", "args"] },
  DataSourceOpExpr: { fields: ["parent", "sourceId", "opId", "opName", "templates", "cacheKey", "queryInvalidation", "roleId"], follow: ["parent", "templates", "cacheKey", "queryInvalidation"] },
  DataSourceTemplate: { fields: ["fieldType", "value", "bindings"], follow: ["value", "bindings"] },
  DateRangeStrings: { fields: ["name"], follow: [] },
  DateString: { fields: ["name"], follow: [] },
  DefaultStylesClassNamePropType: { fields: ["name", "includeTagStyles"], follow: [] },
  DefaultStylesPropType: { fields: ["name"], follow: [] },
  EventHandler: { fields: ["interactions"], follow: ["interactions"] },
  ExprText: { fields: ["expr", "html"], follow: ["expr"] },
  FunctionArg: { fields: ["uuid", "argType", "expr"], follow: ["argType", "expr"] },
  FunctionExpr: { fields: ["argNames", "bodyExpr"], follow: ["bodyExpr"] },
  FunctionType: { fields: ["name", "params"], follow: ["params"] },
  GenericEventHandler: { fields: ["handlerType", "interactions"], follow: ["handlerType", "interactions"] },
  GlobalVariantGroupParam: { fields: ["type", "variable", "uuid", "enumValues", "origin", "exportType", "defaultExpr", "previewExpr", "propEffect", "displayName", "isRepeated", "isMainContentSlot", "required", "mergeWithParent", "isLocalizable"], follow: ["type", "variable", "defaultExpr", "previewExpr"] },
  HrefType: { fields: ["name"], follow: [] },
  ImageAsset: { fields: ["uuid", "name", "type", "dataUri", "width", "height", "aspectRatio"], follow: [] },
  ImageAssetRef: { fields: ["asset"], follow: ["asset"] },
  Img: { fields: ["name"], follow: [] },
  Interaction: { fields: ["interactionName", "actionName", "args", "condExpr", "conditionalMode", "uuid"], follow: ["args", "condExpr"] },
  KeyFrame: { fields: ["percentage", "rs"], follow: ["rs"] },
  LabeledSelector: { fields: ["selector", "label", "defaultStyles"], follow: [] },
  MapExpr: { fields: ["mapExpr"], follow: ["mapExpr"] },
  Mixin: { fields: ["name", "rs", "preview", "uuid", "forTheme", "variantedRs"], follow: ["rs", "variantedRs"] },
  MultiChoice: { fields: ["name", "options"], follow: [] },
  NamedState: { fields: ["variableType", "name", "param", "accessType", "onChangeParam", "tplNode", "implicitState"], follow: ["param", "onChangeParam"] },
  NameArg: { fields: ["name", "expr"], follow: ["expr"] },
  NodeMarker: { fields: ["tpl", "position", "length"], follow: [] },
  Num: { fields: ["name"], follow: [] },
  ObjectPath: { fields: ["path", "fallback"], follow: ["fallback"] },
  PageHref: { fields: ["page", "params", "query", "fragment", "encode"], follow: ["page", "params", "query", "fragment"] },
  PageMeta: { fields: ["path", "params", "query", "title", "canonical", "roleId", "openGraphImage"], follow: ["title", "canonical", "openGraphImage"] },
  PlumeInfo: { fields: ["type"], follow: [] },
  PlumeInstance: { fields: ["name", "plumeType"], follow: [] },
  PropParam: { fields: ["type", "advanced", "variable", "uuid", "enumValues", "origin", "exportType", "defaultExpr", "previewExpr", "propEffect", "displayName", "isRepeated", "isMainContentSlot", "required", "mergeWithParent", "isLocalizable"], follow: ["type", "variable", "defaultExpr", "previewExpr"] },
  QueryData: { fields: ["name"], follow: [] },
  QueryInvalidationExpr: { fields: ["invalidationQueries", "invalidationKeys"], follow: ["invalidationQueries", "invalidationKeys"] },
  QueryRef: { fields: ["ref"], follow: ["ref"] },
  RawText: { fields: ["markers", "text"], follow: ["markers"] },
  RenderExpr: { fields: ["tpl"], follow: [] },
  RenderFuncType: { fields: ["name", "params", "allowed", "allowRootWrapper"], follow: ["params", "allowed"] },
  RenderableType: { fields: ["name", "params", "allowRootWrapper"], follow: ["params"] },
  Rep: { fields: ["element", "index", "collection"], follow: ["element", "index", "collection"] },
  RuleSet: { fields: ["values", "mixins", "animations"], follow: ["mixins", "animations"] },
  SelectorRuleSet: { fields: ["rs", "selector"], follow: ["rs"] },
  SlotParam: { fields: ["type", "tplSlot", "variable", "uuid", "enumValues", "origin", "exportType", "defaultExpr", "previewExpr", "propEffect", "displayName", "isRepeated", "isMainContentSlot", "required", "mergeWithParent", "isLocalizable"], follow: ["type", "variable", "defaultExpr", "previewExpr"] },
  State: { fields: ["param", "accessType", "variableType", "onChangeParam", "tplNode", "implicitState"], follow: ["param", "onChangeParam"] },
  StateChangeHandlerParam: { fields: ["type", "state", "variable", "uuid", "enumValues", "origin", "exportType", "defaultExpr", "previewExpr", "propEffect", "displayName", "isRepeated", "isMainContentSlot", "required", "mergeWithParent", "isLocalizable"], follow: ["type", "variable", "defaultExpr", "previewExpr"] },
  StateParam: { fields: ["type", "state", "variable", "uuid", "enumValues", "origin", "exportType", "defaultExpr", "previewExpr", "propEffect", "displayName", "isRepeated", "isMainContentSlot", "required", "mergeWithParent", "isLocalizable"], follow: ["type", "variable", "defaultExpr", "previewExpr"] },
  StrongFunctionArg: { fields: ["argType", "uuid", "expr"], follow: ["argType", "expr"] },
  StyleExpr: { fields: ["uuid", "styles"], follow: ["styles"] },
  StyleMarker: { fields: ["rs", "position", "length"], follow: ["rs"] },
  StyleScopeClassNamePropType: { fields: ["name", "scopeName"], follow: [] },
  StyleToken: { fields: ["type", "name", "uuid", "value", "variantedValues", "isRegistered", "regKey"], follow: ["variantedValues"] },
  StyleTokenRef: { fields: ["token"], follow: ["token"] },
  TargetType: { fields: ["name"], follow: [] },
  TemplatedString: { fields: ["text"], follow: ["text"] },
  Text: { fields: ["name"], follow: [] },
  TplComponent: { fields: ["parent", "name", "component", "uuid", "vsettings"], follow: ["component", "vsettings"] },
  TplRef: { fields: ["tpl"], follow: [] },
  TplSlot: { fields: ["parent", "param", "defaultContents", "uuid", "vsettings"], follow: ["param", "vsettings"] },
  TplTag: { fields: ["parent", "tag", "name", "children", "type", "codeGenType", "columnsSetting", "uuid", "vsettings"], follow: ["columnsSetting", "vsettings"] },
  Var: { fields: ["name", "uuid"], follow: [] },
  VarRef: { fields: ["variable"], follow: ["variable"] },
  Variant: { fields: ["uuid", "name", "selectors", "codeComponentName", "codeComponentVariantKeys", "mediaQuery", "forTpl"], follow: [] },
  VariantSetting: { fields: ["variants", "args", "attrs", "rs", "dataCond", "dataRep", "text", "columnsConfig"], follow: ["variants", "args", "attrs", "rs", "dataCond", "dataRep", "text", "columnsConfig"] },
  VariantGroupState: { fields: ["variableType", "variantGroup", "param", "accessType", "onChangeParam", "tplNode", "implicitState"], follow: ["param", "onChangeParam"] },
  VariantedRuleSet: { fields: ["variants", "rs"], follow: ["rs"] },
  VariantedValue: { fields: ["variants", "value"], follow: [] },
  VariantsRef: { fields: ["variants"], follow: ["variants"] },
  VirtualRenderExpr: { fields: ["tpl"], follow: [] },
};

type InputSnapshot = readonly unknown[];
export type CanvasModelInputStore = ModelFieldStore<InputSnapshot>;

function projectsTplNode(model: TplNode | Component) {
  return switchType(model).when(TplNode, () => true).when(Component, () => false).result();
}

interface Projection {
  current: InputSnapshot;
  dirty: boolean;
  readonly store: CanvasModelInputStore;
  readonly dependents: Set<Projection>;
  capture(): void;
  publish(): void;
  dispose(): void;
}

/** Per-artboard projections of the fields needed by rendered nodes/contracts. */
export class CanvasModelInputs {
  private readonly nodes = new WeakMap<TplNode, Projection>();
  private readonly components = new WeakMap<Component, Projection>();
  private readonly resources = new Set<Projection>();
  private readonly publications = new Set<Projection>();
  private disposed = false;

  constructor(private readonly models: ModelSnapshots) {}

  node(node: TplNode) {
    return this.resource(node, this.nodes).store;
  }

  component(component: Component) {
    return this.resource(component, this.components).store;
  }

  /** Capture every dirty input before publishing any derived render source. */
  prepareCommit() {
    if (!this.disposed) {
      this.resources.forEach((resource) => resource.capture());
    }
  }

  publishCommit() {
    if (this.disposed) {
      return;
    }
    const publish = [...this.publications];
    this.publications.clear();
    publish.forEach((resource) => resource.publish());
  }

  /** Called after the model owner's committed fields have all been installed. */
  flush() {
    this.prepareCommit();
    this.publishCommit();
  }

  private markDirty(resource: Projection) {
    if (resource.dirty || this.disposed) {
      return;
    }
    resource.dirty = true;
    resource.dependents.forEach((dependent) => this.markDirty(dependent));
  }

  private resource<T extends TplNode | Component>(model: T, cache: WeakMap<T, Projection>): Projection {
    assert(!this.disposed, "Cannot read disposed canvas model inputs");
    const retained = cache.get(model);
    if (retained) {
      return retained;
    }
    const isNodeProjection = projectsTplNode(model);
    const state = createStore<InputSnapshot>(() => Object.freeze([]));
    const subscriptions = new Map<ModelFieldStore<unknown>, () => void>();
    let dependencies = new Set<Projection>();
    const projection: Projection = {
      current: state.getState(),
      dirty: true,
      dependents: new Set(),
      store: {
        getState: () => projection.current,
        getInitialState: () => initial,
        subscribe: state.subscribe,
      },
      capture: () => {
        if (!projection.dirty || this.disposed) {
          return;
        }
        projection.dirty = false;
        const fields = new Set<ModelFieldStore<unknown>>();
        const nextDependencies = new Set<Projection>();
        const sources: (() => unknown)[] = [];
        const visited = new Set<ObjInst>();
        const addField = (field: ModelFieldStore<unknown>) => {
          if (!fields.has(field)) {
            fields.add(field);
            sources.push(field.getState);
          }
        };
        const followValue = (value: unknown) => {
          if (instUtil.isObjInst(value)) {
            if (isKnownTplNode(value)) {
              return;
            }
            if (isKnownComponent(value)) {
              if (isNodeProjection) {
                const dependency = this.resource(value, this.components);
                if (!nextDependencies.has(dependency)) {
                  nextDependencies.add(dependency);
                  sources.push(() => {
                    dependency.capture();
                    return dependency.current;
                  });
                }
              } else {
                // A page href consumes its destination's route, not its tree.
                addField(this.models.declaredField(value, "pageMeta"));
                followValue(value.pageMeta);
              }
            } else {
              visit(value);
            }
          } else if (Array.isArray(value)) {
            value.forEach(followValue);
          } else if (value && typeof value === "object") {
            Object.values(value).forEach(followValue);
          }
        };
        const visit = (current: ObjInst) => {
          if (visited.has(current)) {
            return;
          }
          visited.add(current);
          const type = instUtil.getInstClassName(current);
          const declaration = renderFields[type];
          assert(declaration, () => `Missing canvas input declaration for ${type}`);
          for (const key of declaration.fields) {
            addField(this.models.declaredField(current, key));
          }
          if (isKnownComponent(current)) {
            // Plume wrappers choose their concrete child implementations by
            // subtype; the child's own mounted contract owns its other fields.
            current.subComps.forEach((child) => {
              addField(this.models.declaredField(child, "plumeInfo"));
              if (child.plumeInfo) { addField(this.models.declaredField(child.plumeInfo, "type")); }
            });
          }
          for (const key of declaration.follow) {
            followValue(Reflect.get(current, key));
          }
        };
        visit(model);
        const namingComponent: Component | TplNode = model;
        if (isKnownComponent<Component | TplNode>(namingComponent)) {
          // Contexts retain one namer for the owning component. Observe its
          // explicit naming/topology inputs, but publish only the derived namer
          // identity, so a CSS edit cannot invalidate every sibling contract.
          const watched = new Set<ObjInst>();
          const nameField = (value: ObjInst, ...keys: string[]) => keys.forEach((key) => fields.add(this.models.declaredField(value, key)));
          const nameValue = (value: unknown) => {
            if (Array.isArray(value)) { value.forEach(nameValue); }
            else if (value && instUtil.isObjInst(value)) { nameModel(value); }
            else if (value && typeof value === "object") { Object.values(value).forEach(nameValue); }
          };
          const nameModel = (value: ObjInst) => {
            if (watched.has(value) || isKnownTplNode(value)) { return; } watched.add(value);
            if (isKnownComponent(value)) {
              nameField(value, "name", "type", "codeComponentMeta");
              if (value.codeComponentMeta) { nameField(value.codeComponentMeta, "displayName"); }
              return;
            }
            const declaration = renderFields[instUtil.getInstClassName(value)];
            assert(declaration, () => `Missing canvas name declaration for ${instUtil.getInstClassName(value)}`);
            declaration.fields.forEach((key) => nameField(value, key));
            declaration.follow.forEach((key) => nameValue(Reflect.get(value, key)));
          };
          flattenTpls(namingComponent.tplTree).forEach((tpl) => {
            nameField(tpl, "parent");
            if (isKnownTplTag(tpl)) {
              nameField(tpl, "name", "tag", "type", "children", "codeGenType");
              if (tpl.tag === "input" || (tpl.type === "text" && isKnownTplComponent(tpl.parent))) {
                nameField(tpl, "vsettings"); tpl.vsettings.forEach(nameModel);
              }
            } else if (isKnownTplComponent(tpl)) {
              nameField(tpl, "name", "component", "vsettings"); nameModel(tpl.component);
              tpl.vsettings.forEach((setting) => {
                nameField(setting, "args"); setting.args.forEach((arg) => { nameField(arg, "expr"); nameValue(arg.expr); });
              });
            } else if (isKnownTplSlot(tpl)) {
              nameField(tpl, "param", "defaultContents"); nameField(tpl.param, "variable"); nameField(tpl.param.variable, "name");
            }
          });
          sources.push(() => computedNodeNamer(namingComponent));
        }
        for (const [field, stop] of subscriptions) {
          if (!fields.has(field)) {
            stop();
            subscriptions.delete(field);
          }
        }
        for (const field of fields) {
          if (!subscriptions.has(field)) {
            subscriptions.set(field, this.models.subscribePreparedField(field, () => this.markDirty(projection)));
          }
        }
        dependencies.forEach((dependency) => {
          if (!nextDependencies.has(dependency)) {
            dependency.dependents.delete(projection);
          }
        });
        nextDependencies.forEach((dependency) => dependency.dependents.add(projection));
        dependencies = nextDependencies;
        const next = sources.map((read) => read());
        const before = projection.current;
        if (next.length !== before.length || next.some((value, index) => !Object.is(value, before[index]))) {
          projection.current = Object.freeze(next);
          this.publications.add(projection);
        }
      },
      publish: () => state.setState(() => projection.current, true),
      dispose: () => {
        subscriptions.forEach((stop) => stop());
        subscriptions.clear();
        dependencies.forEach((dependency) => dependency.dependents.delete(projection));
        dependencies.clear();
        projection.dependents.clear();
      },
    };
    cache.set(model, projection);
    this.resources.add(projection);
    projection.capture();
    const initial = projection.current;
    // Initial construction is synchronous and has no subscribers yet.
    state.setState(() => projection.current, true);
    this.publications.delete(projection);
    return projection;
  }

  dispose() {
    this.disposed = true;
    this.resources.forEach((resource) => resource.dispose());
    this.resources.clear();
    this.publications.clear();
  }
}
