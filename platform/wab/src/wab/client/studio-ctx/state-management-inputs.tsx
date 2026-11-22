import { extractValueSavedFromDataPicker, getCodeExpressionWithFallback } from "@/wab/shared/core/exprs";
import { isBaseVariantName } from "@/wab/shared/Variants";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { ModelSnapshotInputs } from "@/wab/client/studio-ctx/model-snapshot-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq, assert, ensureInstance } from "@/wab/shared/common";
import { canDeleteState, isPageComponent } from "@/wab/shared/core/components";
import { getStateDisplayName, getStateVarName, isPrivateState, type StateVariableType } from "@/wab/shared/core/states";
import { shallow } from "zustand/shallow";
import { allComponents, isTplAttachedToSite } from "@/wab/shared/core/sites";
import { findExprsInNode, isEventHandlerKeyForParam, type EventHandlerKeyType } from "@/wab/shared/core/tpls";
import { CustomCode, ObjectPath, isKnownTplComponent, isKnownTplNode, isKnownTplSlot, isKnownNamedState, type Rep, type VariantSetting, type Expr, type Param, type Component, type EventHandler, type Interaction, type State, type TplComponent, type TplNode, type TplTag } from "@/wab/shared/model/classes";
import { groupBy } from "lodash";
import * as React from "react";

/** Committed read leases for the two sidebar lists. Models keep ownership;
 * these resources retain only finite fields and immutable command references. */
abstract class StateListInputs<Value> extends ModelSnapshotInputs<Value> {
  constructor(protected readonly view: ViewCtx, component: Component, empty: Value) {
    super(view.studioCtx, view.studioCtx.modelSnapshots, view.site, view.disposeSignal, empty);
    if (!this.isClosed()) { assert(allComponents(this.site, { includeDeps: "all" }).includes(component), "State sidebar component belongs to another model world"); }
  }
  protected expressionVersion(expression: Expr): string {
    return this.snapshotVersion(expression);
  }
}

export interface VariableRosterSnapshot {
  readonly regular: readonly ModelRef<State>[];
  readonly implicit: readonly ModelRef<TplTag | TplComponent>[];
  readonly emptyBody: boolean;
}
const noVariables: VariableRosterSnapshot = Object.freeze({ regular: Object.freeze([]), implicit: Object.freeze([]), emptyBody: true });
export class VariableRosterInputs extends StateListInputs<VariableRosterSnapshot> {
  constructor(view: ViewCtx, private readonly component: Component) { super(view, component, noVariables); }
  protected capture(previous: VariableRosterSnapshot): VariableRosterSnapshot {
    const states = this.read(this.component, "states").map((ref) => {
      const state = this.models.resolve(ref), tpl = this.read(state, "tplNode");
      return { ref, variableType: this.read(state, "variableType"), tpl, name: tpl ? this.read(this.models.resolve(tpl), "name") : undefined };
    });
    const nextRegular = states.filter((state) => state.variableType !== "variant" && !state.tpl).map((state) => state.ref);
    // Retain lodash's property-key grouping and Object.values order, including
    // distinct TplNodes sharing a name and integer-like node names.
    const nextImplicit = Object.values(groupBy(states.filter((state) => state.tpl), (state) => state.name)).map((group) => {
      const tpl = group[0].tpl; assert(tpl, "Implicit state should have a tpl"); return tpl;
    });
    const regular = arrayEq(previous.regular, nextRegular) ? previous.regular : Object.freeze(nextRegular);
    const implicit = arrayEq(previous.implicit, nextImplicit) ? previous.implicit : Object.freeze(nextImplicit);
    const emptyBody = !states.some((state) => state.variableType !== "variant");
    return regular === previous.regular && implicit === previous.implicit && emptyBody === previous.emptyBody ? previous : Object.freeze({ regular, implicit, emptyBody });
  }
}
export function useVariableRoster(view: ViewCtx, component: Component) {
  const source = React.useMemo(() => new VariableRosterInputs(view, component), [view, component]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, source };
}

export interface HandlerListSnapshot {
  readonly interactions: readonly ModelRef<Interaction>[];
  readonly formSubmissionWarning: boolean;
}
const noHandler: HandlerListSnapshot = Object.freeze({ interactions: Object.freeze([]), formSubmissionWarning: false });
export class HandlerListInputs extends StateListInputs<HandlerListSnapshot> {
  constructor(view: ViewCtx, component: Component, private readonly tpl: TplTag | TplComponent, private readonly handler: EventHandler | null | undefined, private readonly eventKey: EventHandlerKeyType) {
    super(view, component, noHandler);
    if (!this.isClosed()) {
      assert(isTplAttachedToSite(this.site, tpl), "Handler sidebar node belongs to another model world");
      assert(!handler || findExprsInNode(tpl).some(({ expr }) => expr === handler), "Handler sidebar requires the original expression from its node");
      if (isEventHandlerKeyForParam(eventKey)) {
        assert(isKnownTplComponent(tpl) && tpl.component.params.includes(eventKey.param), "Handler parameter belongs to another component contract");
      }
    }
  }
  protected capture(previous: HandlerListSnapshot): HandlerListSnapshot {
    const nextInteractions = this.handler ? this.read(this.handler, "interactions") : noHandler.interactions;
    const interactions = arrayEq(previous.interactions, nextInteractions) ? previous.interactions : nextInteractions;
    let formSubmissionWarning = false;
    if (isEventHandlerKeyForParam(this.eventKey) && isKnownTplComponent(this.tpl)) {
      const variable = this.models.resolve(this.read(this.eventKey.param, "variable"));
      if (this.read(variable, "name") === "onClick") {
        const component = this.models.resolve(this.read(this.tpl, "component"));
        if (this.read(component, "name").toLowerCase().includes("button")) {
          let node: TplNode = this.tpl;
          while (true) {
            if (isKnownTplComponent(node)) {
              const ancestorComponent = this.models.resolve(this.read(node, "component"));
              if (this.read(ancestorComponent, "name") === "plasmic-antd5-form") { formSubmissionWarning = true; break; }
            }
            const parent = this.read(node, "parent");
            if (!parent) { break; }
            const ancestor = this.models.resolve(parent);
            assert(isKnownTplNode(ancestor), "Template parent must be a template node");
            node = ancestor;
          }
        }
      }
    }
    return interactions === previous.interactions && formSubmissionWarning === previous.formSubmissionWarning ? previous : Object.freeze({ interactions, formSubmissionWarning });
  }
}
export function useHandlerList(view: ViewCtx, component: Component, tpl: TplTag | TplComponent, handler: EventHandler | null | undefined, eventKey: EventHandlerKeyType) {
  const source = React.useMemo(() => new HandlerListInputs(view, component, tpl, handler, eventKey), [view, component, tpl, handler, eventKey]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, source };
}


export interface VariableRowSnapshot {
  readonly name: string;
  readonly variableName: string;
  readonly parameterName: string;
  readonly parameter: ModelRef<Param> | undefined;
  readonly variableType: StateVariableType;
  readonly accessType: State["accessType"];
  readonly initialExpression: ModelRef<Expr> | null | undefined;
  readonly isExternal: boolean;
  readonly implicit: boolean;
  readonly implicitAccessType: State["accessType"] | undefined;
  readonly canDelete: boolean;
  readonly isPage: boolean;
  readonly hasTpl: boolean;
  readonly invalidRoot: boolean;
}
const noVariableRow: VariableRowSnapshot = Object.freeze({ name: "", variableName: "", parameterName: "", parameter: undefined,
  variableType: "text", accessType: "private", initialExpression: undefined, isExternal: false, implicit: false, implicitAccessType: undefined, canDelete: false, isPage: false, hasTpl: false, invalidRoot: false });

export class VariableRowInputs extends StateListInputs<VariableRowSnapshot> {
  constructor(view: ViewCtx, private readonly component: Component, private readonly state: State) {
    super(view, component, noVariableRow);
  }
  protected capture(previous: VariableRowSnapshot): VariableRowSnapshot {
    const state = this.state;
    const parameter = this.read(state, "param"), param = this.models.resolve(parameter);
    const variable = this.models.resolve(this.read(param, "variable"));
    const parameterName = this.read(variable, "name");
    this.read(state, "variableType"); this.read(state, "accessType");
    const implicit = this.read(state, "implicitState");
    let implicitAccessType: State["accessType"] | undefined;
    if (implicit) {
      const inherited = this.models.resolve(implicit);
      implicitAccessType = this.read(inherited, "accessType");
      if (isKnownNamedState(inherited)) {this.read(inherited, "name");}
      else {
        const inheritedParam = this.models.resolve(this.read(inherited, "param"));
        this.read(this.models.resolve(this.read(inheritedParam, "variable")), "name");
      }
    } else if (isKnownNamedState(state)) {this.read(state, "name");}
    const tplRef = this.read(state, "tplNode");
    if (tplRef) {
      const namedNode = this.models.resolve(tplRef);
      this.read(namedNode, "name");
      let node: TplNode = namedNode;
      while (true) {
        if (!isKnownTplSlot(node)) {
          for (const ref of this.read(node, "vsettings")) {
            const setting = this.models.resolve(ref);
            this.read(setting, "dataRep");
            for (const variant of this.read(setting, "variants")) {this.read(this.models.resolve(variant), "name");}
          }
        }
        const parent = this.read(node, "parent");
        if (!parent) {break;}
        const ancestor = this.models.resolve(parent);
        assert(isKnownTplNode(ancestor), "Template parent must be a template node");
        node = ancestor;
      }
    }
    this.read(this.component, "type");
    const root = this.models.resolve(this.read(this.component, "tplTree"));
    const plume = this.read(this.component, "plumeInfo");
    if (plume) {this.read(this.models.resolve(plume), "type");}
    const next: VariableRowSnapshot = {
      name: getStateDisplayName(state, "short"), variableName: getStateVarName(state), parameterName, parameter,
      variableType: state.variableType as StateVariableType, accessType: this.read(state, "accessType"), initialExpression: this.read(param, "defaultExpr"), isExternal: !isPrivateState(state),
      implicit: !!implicit, implicitAccessType, canDelete: canDeleteState(this.component, state),
      isPage: isPageComponent(this.component), hasTpl: !!tplRef, invalidRoot: isKnownTplSlot(root),
    };
    return shallow(previous, next) ? previous : Object.freeze(next);
  }
}
export function useVariableRowInputs(view: ViewCtx, component: Component, state: State) {
  const source = React.useMemo(() => new VariableRowInputs(view, component, state), [view, component, state]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}


export interface RepeatingElementSnapshot {
  readonly base: ModelRef<VariantSetting> | undefined;
  readonly repetition: ModelRef<Rep> | null | undefined;
  readonly elementName: string;
  readonly indexName: string | undefined;
  readonly collectionValue: string | (string | number)[];
  readonly collectionCode: string | undefined;
}
const noRepetition: RepeatingElementSnapshot = Object.freeze({ base: undefined, repetition: undefined, elementName: "", indexName: undefined, collectionValue: "", collectionCode: undefined });
export class RepeatingElementInputs extends StateListInputs<RepeatingElementSnapshot> {
  constructor(view: ViewCtx, private readonly component: Component, private readonly tpl: TplNode) {super(view, component, noRepetition);}
  protected capture(previous: RepeatingElementSnapshot): RepeatingElementSnapshot {
    const base = this.read(this.tpl, "vsettings").find((ref) => {
      const variants = this.read(this.models.resolve(ref), "variants");
      return variants.length === 1 && isBaseVariantName(this.read(this.models.resolve(variants[0]), "name"));
    });
    assert(base, "All TplNodes must have a base variant setting");
    let node = this.tpl;
    while (true) { const parent = this.read(node, "parent"); if (!parent) {break;} node = this.models.resolve(parent); }
    const repetition = this.read(this.models.resolve(base), "dataRep");
    let elementName = "", indexName: string | undefined;
    let collectionValue: string | (string | number)[] = "";
    let collectionCode: string | undefined;
    if (repetition) {
      const rep = this.models.resolve(repetition);
      const element = this.models.resolve(this.read(rep, "element"));
      elementName = this.read(element, "name");
      const index = this.read(rep, "index");
      indexName = index ? this.read(this.models.resolve(index), "name") : undefined;
      const collection = this.read(rep, "collection");
      const expression = this.models.resolve(collection);
      this.expressionVersion(expression);
      collectionCode = getCodeExpressionWithFallback(ensureInstance(expression, CustomCode, ObjectPath), { projectFlags: this.view.projectFlags(), component: this.component, inStudio: true });
      const value = extractValueSavedFromDataPicker(expression, { projectFlags: this.view.projectFlags(), component: this.component, inStudio: true }) ?? "";
      if (Array.isArray(value)) {
        const nextValue = [...value]; Object.freeze(nextValue);
        collectionValue = Array.isArray(previous.collectionValue) && arrayEq(previous.collectionValue, value) ? previous.collectionValue : nextValue;
      } else { collectionValue = value; }
    }
    const next = {base, repetition, elementName, indexName, collectionValue, collectionCode};
    return shallow(previous, next) ? previous : Object.freeze(next);
  }
}
export function useRepeatingElementInputs(view: ViewCtx, component: Component, tpl: TplNode) {
  const source = React.useMemo(() => new RepeatingElementInputs(view, component, tpl), [view, component, tpl]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return {snapshot, source};
}


export interface ImplicitVariablesSnapshot {
  readonly name: string;
  readonly states: readonly ModelRef<State>[];
  readonly headingVersion: string;
}
const noImplicitVariables: ImplicitVariablesSnapshot = Object.freeze({name: "", states: Object.freeze([]), headingVersion: ""});
export class ImplicitVariablesInputs extends StateListInputs<ImplicitVariablesSnapshot> {
  constructor(view: ViewCtx, private readonly component: Component, private readonly tpl: TplTag | TplComponent) {super(view, component, noImplicitVariables);}
  protected capture(previous: ImplicitVariablesSnapshot): ImplicitVariablesSnapshot {
    const name = this.read(this.tpl, "name") ?? "";
    const candidates = this.read(this.component, "states").filter((ref) => {
      const node = this.read(this.models.resolve(ref), "tplNode");
      return node?.uid === this.tpl.uid;
    });
    const states = arrayEq(previous.states, candidates) ? previous.states : Object.freeze(candidates);
    const heading: unknown[] = [this.read(this.component, "tplTree")];
    const plume = this.read(this.component, "plumeInfo");
    heading.push(plume);
    if (plume) {heading.push(this.read(this.models.resolve(plume), "type"));}
    if (isKnownTplComponent(this.tpl)) {
      const referenced = this.read(this.tpl, "component"), component = this.models.resolve(referenced);
      heading.push(referenced, this.read(component, "name"), this.read(component, "type"), this.read(component, "plumeInfo"), this.read(component, "codeComponentMeta"));
      const referencedPlume = this.read(component, "plumeInfo");
      if (referencedPlume) {heading.push(this.read(this.models.resolve(referencedPlume), "type"));}
    } else {
      heading.push(this.read(this.tpl, "tag"), this.read(this.tpl, "type"));
      for (const ref of this.read(this.tpl, "vsettings")) {
        const setting = this.models.resolve(ref);
        heading.push(this.read(setting, "variants"), this.read(setting, "attrs"));
        for (const variant of this.read(setting, "variants")) {
          const model = this.models.resolve(variant);
          heading.push(this.read(model, "name"), this.read(model, "selectors"), this.read(model, "parent"), this.read(model, "mediaQuery"));
        }
        if (setting.attrs.type) {heading.push(this.expressionVersion(setting.attrs.type));}
      }
    }
    const headingVersion = JSON.stringify(heading);
    return name === previous.name && states === previous.states && headingVersion === previous.headingVersion ? previous : Object.freeze({name, states, headingVersion});
  }
}
export function useImplicitVariablesInputs(view: ViewCtx, component: Component, tpl: TplTag | TplComponent) {
  const source = React.useMemo(() => new ImplicitVariablesInputs(view, component, tpl), [view, component, tpl]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return {snapshot, source};
}
