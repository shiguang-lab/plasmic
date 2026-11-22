import { setupComponentWithInstance } from "@/wab/client/operations/__testonly__/utils";
import { createInteraction } from "@/wab/client/operations/create-interaction";
import {
  ensureBaseVariantSetting,
  ensureVariantSetting,
  getBaseVariant,
} from "@/wab/shared/Variants";
import { toVarName } from "@/wab/shared/codegen/util";
import { assert } from "@/wab/shared/common";
import { asCode, customCode } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import * as expressionParser from "@/wab/shared/eval/expression-parser";
import {
  TplTag,
  isKnownEventHandler,
  isKnownFunctionExpr,
  isKnownPageHref,
} from "@/wab/shared/model/classes";
import { ComponentType } from "@/wab/shared/core/components";
import { ensure } from "@/wab/shared/common";
import { typeFactory } from "@/wab/shared/model/model-util";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { err } from "neverthrow";
import { runInNewContext } from "node:vm";
import { initBuiltinActions, interactionActionSchema } from "@/wab/shared/core/states";
import { ACTIONS_META } from "@/wab/client/state-management/interactions-meta";
import { PAGE_TRANSITION_PRESETS } from "@plasmic-shared/preview";

describe("createInteraction", () => {
  it.each(["react", "nextjs"] as const)("creates a parameterless Go back action for %s", async (platform) => {
    const { page, root } = setup();
    initBuiltinActions({ projectId: "back", platform, projectFlags: DEVFLAGS, inStudio: false });
    expect(ACTIONS_META.goBack.parameters).toEqual({});
    const result = createInteraction({ component: page, tpl: root, eventName: "onClick", name: "Back", action: { actionName: "goBack" } });
    assert(result.isOk(), "Go back must be supported by native interactions");
    expect(result.value.args).toEqual([]);
    const back = vi.fn();
    const run = runInNewContext(`(${asCode(getHandler(root, "onClick"), { component: page, projectFlags: DEVFLAGS, inStudio: false }).code})`, {
      window: { history: { back } }, __nextRouter: { back },
    });
    await run();
    expect(back).toHaveBeenCalledExactlyOnceWith();
    expect(interactionActionSchema().safeParse({ actionName: "goBack", destination: "/list" }).success).toBe(false);
  });
  it("offers only fixed concrete transition presets in the action contract", () => {
    const meta = ACTIONS_META.navigation.parameters.transition;
    expect(meta).toMatchObject({ type: "choice", disableDynamicValue: true, defaultValueHint: "Push from right" });
    expect((meta as { options: { value: string }[] }).options.map((option) => option.value)).toEqual(PAGE_TRANSITION_PRESETS);
    expect(interactionActionSchema().safeParse({ actionName: "navigation", destination: "/detail", transition: "default" }).success).toBe(false);
  });

  it.each([undefined, ...PAGE_TRANSITION_PRESETS])("persists and generates a navigation with transition %s", async (transition) => {
    const { page, root } = setup();
    initBuiltinActions({ projectId: "transitions", platform: "nextjs", projectFlags: DEVFLAGS, inStudio: false });
    const result = createInteraction({ component: page, tpl: root, eventName: "onClick", name: "Details", action: {
      actionName: "navigation", destination: "/detail", transition,
    } });
    expect(result.isOk()).toBe(true);
    const handler = getHandler(root, "onClick");
    expect(handler.interactions[0].args.some((arg) => arg.name === "transition")).toBe(transition !== undefined);
    const code = asCode(handler, { component: page, inStudio: false, projectFlags: DEVFLAGS }).code;
    const push = vi.fn();
    await runInNewContext(`(${code})`, { __nextRouter: { push } })();
    expect(push).toHaveBeenCalledExactlyOnceWith("/detail", undefined, { plasmicTransition: transition });
  });

  function setup() {
    const fixture = setupComponentWithInstance();
    const root = fixture.page.tplTree as TplTag;
    ensureVariantSetting(root, [getBaseVariant(fixture.page)]);
    return { ...fixture, root };
  }

  function getHandler(tpl: TplTag, attr: string) {
    const expr = ensureBaseVariantSetting(tpl).attrs[attr];
    assert(isKnownEventHandler(expr), "expected an EventHandler");
    return expr;
  }

  it("runs only the matching conditional step and skips its arguments otherwise", async () => {
    const { page, root } = setup();
    initBuiltinActions({ projectId: "conditional-test", platform: "react", projectFlags: DEVFLAGS, inStudio: false });
    for (const [name, condition, action] of [
      ["View", '{{ event.key === "view" }}', { actionName: "navigation", destination: "{{ destination() }}" }],
      ["Copy", '{{ event.key === "copy" }}', { actionName: "customFunction", code: 'record("copy")' }],
      ["Disabled", false, { actionName: "customFunction", code: 'record("disabled")' }],
    ] as const) {
      const result = createInteraction({ component: page, tpl: root, eventName: "onClick", name, condition, action });
      assert(result.isOk(), "expected conditional interaction");
    }
    const destination = vi.fn(() => "/details");
    const assign = vi.fn();
    const record = vi.fn();
    const handlerCode = asCode(getHandler(root, "onClick"), { component: page, inStudio: false, projectFlags: DEVFLAGS }).code;
    const run = runInNewContext(`(${handlerCode})`, { location: {assign}, destination, record });
    await run({key:"copy"});
    expect(record).toHaveBeenCalledExactlyOnceWith("copy");
    expect(destination).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    await run({key:"view"});
    expect(destination).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledExactlyOnceWith("/details");
    expect(record).toHaveBeenCalledOnce();
  });

  it.each(["plain text", "{{ event. }}"])("rejects invalid condition %s without creating a handler", (condition) => {
    const { page, root } = setup();
    const result = createInteraction({ component: page, tpl: root, eventName:"onClick", name:"Invalid", condition, action:{actionName:"customFunction",code:"1"} });
    expect(result.isErr()).toBe(true);
    expect(ensureBaseVariantSetting(root).attrs.onClick).toBeUndefined();
  });

  it("stores validated-event navigation as a native navigation action", () => {
    const { page, root } = setup();
    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Continue",
      action: {
        actionName: "navigation",
        destination: "{{ '/next?name=' + encodeURIComponent(values.name) }}",
      },
    });
    expect(result.isOk()).toBe(true);
    const step = getHandler(root, "onClick").interactions[0];
    expect(step.actionName).toBe("navigation");
    const destination = step.args.find((arg) => arg.name === "destination");
    assert(destination, "expected navigation destination");
    expect(asCode(destination.expr, {
      component: page,
      inStudio: true,
      projectFlags: DEVFLAGS,
    }).code).toContain("encodeURIComponent(values.name)");
  });

  it("creates a run-code interaction on a tag event", () => {
    const { page, root } = setup();

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Log click",
      action: { actionName: "customFunction", code: 'console.log("hi")' },
    });

    assert(result.isOk(), "expected success result");
    const handler = getHandler(root, "onClick");
    expect(handler.interactions).toHaveLength(1);
    expect(result.value).toBe(handler.interactions[0]);
    expect(result.value).toMatchObject({
      actionName: "customFunction",
      interactionName: "Log click",
      conditionalMode: "always",
    });
    expect(result.value.parent).toBe(handler);
    const arg = result.value.args.find((a) => a.name === "customFunction");
    assert(arg && isKnownFunctionExpr(arg.expr), "expected a FunctionExpr arg");
    expect(arg.expr.argNames).toEqual([]);
    expect(arg.expr.bodyExpr).toMatchObject({
      code: '(console.log("hi"))',
    });
  });

  it("appends to an existing handler with a deduped name", () => {
    const { page, root } = setup();

    const first = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Log",
      action: { actionName: "customFunction", code: "console.log(1)" },
    });
    const second = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Log",
      action: { actionName: "customFunction", code: "console.log(2)" },
    });

    assert(first.isOk(), "expected success result");
    assert(second.isOk(), "expected success result");
    const handler = getHandler(root, "onClick");
    expect(handler.interactions.map((it) => it.interactionName)).toEqual([
      "Log",
      "Log 2",
    ]);
  });

  it("dedupes names that collide after $steps normalization", () => {
    const { page, root } = setup();

    const first = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "saveStep",
      action: { actionName: "customFunction", code: "1" },
    });
    const second = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Save step",
      action: { actionName: "customFunction", code: "2" },
    });

    assert(first.isOk(), "expected success result");
    assert(second.isOk(), "expected success result");
    expect(second.value.interactionName).toEqual("Save step 2");
    const varNames = getHandler(root, "onClick").interactions.map((it) =>
      toVarName(it.interactionName),
    );
    expect(new Set(varNames).size).toEqual(varNames.length);
  });

  it("supports multi-statement code", () => {
    const { page, root } = setup();

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Save draft",
      action: {
        actionName: "customFunction",
        code: "const draft = $state.text;\nawait $props.onSave(draft);",
      },
    });

    assert(result.isOk(), "expected success result");
    expect(result.value.interactionName).toEqual("Save draft");
  });

  it("creates on a component instance's function-typed prop", () => {
    const { page, button, instance } = setup();
    button.params.push(
      mkParam({ name: "onSave", type: typeFactory.func(), paramType: "prop" }),
    );

    const result = createInteraction({
      component: page,
      tpl: instance,
      eventName: "onSave",
      name: "Reset count",
      action: { actionName: "customFunction", code: "$state.count = 0" },
    });

    assert(result.isOk(), "expected success result");
    const arg = ensureBaseVariantSetting(instance).args.find(
      (a) => a.param.variable.name === "onSave",
    );
    assert(arg && isKnownEventHandler(arg.expr), "expected handler arg");
    expect(arg.expr.interactions).toHaveLength(1);
  });

  it("rejects an unknown event", () => {
    const { page, root } = setup();

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onTeleport",
      name: "Nope",
      action: { actionName: "customFunction", code: "1" },
    });

    assert(result.isErr(), "expected error result");
    expect(result.error.message).toMatch(
      /^Event "onTeleport" is not available on this element\. Available events: /,
    );
  });

  it("rejects empty code", () => {
    const { page, root } = setup();

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Blank",
      action: { actionName: "customFunction", code: "  " },
    });

    expect(result).toEqual(
      err({ message: "Interaction code cannot be empty." }),
    );
  });

  it("rejects invalid JavaScript", () => {
    const { page, root } = setup();

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Broken",
      action: { actionName: "customFunction", code: "const = ;" },
    });

    expect(result).toEqual(
      err({ message: "Interaction code is not valid JavaScript" }),
    );
  });

  it("rejects reassigning the $state binding", () => {
    const { page, root } = setup();

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Replace state",
      action: { actionName: "customFunction", code: "$state = nextState" },
    });

    expect(result).toEqual(
      err({
        message:
          "$state cannot be reassigned. Update one of its properties instead, for example: $state.count = value.",
      }),
    );
  });

  it("accepts valid function-body syntax", () => {
    const { page, root } = setup();

    expect(
      createInteraction({
        component: page,
        tpl: root,
        eventName: "onClick",
        name: "Acquire resource",
        action: {
          actionName: "customFunction",
          code: "using resource = acquire()",
        },
      }).isOk(),
    ).toBe(true);
  });

  it("returns a validation error when static analysis cannot parse valid syntax", () => {
    const { page, root } = setup();
    vi.spyOn(
      expressionParser,
      "tryCodeWritesToGlobalVariable",
    ).mockReturnValueOnce(undefined);

    expect(
      createInteraction({
        component: page,
        tpl: root,
        eventName: "onClick",
        name: "Run valid code",
        action: {
          actionName: "customFunction",
          code: "return importModuleSource()",
        },
      }),
    ).toEqual(
      err({ message: "Interaction code uses unsupported JavaScript syntax" }),
    );
  });

  it("rejects a slot occupied by a custom expression", () => {
    const { page, root } = setup();
    ensureBaseVariantSetting(root).attrs["onClick"] =
      customCode("$props.onClick");

    const result = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Log",
      action: { actionName: "customFunction", code: "1" },
    });

    expect(result).toEqual(
      err({
        message:
          'The "onClick" handler of this element is a custom expression, not an interaction list; edit it in Studio instead.',
      }),
    );
  });

  it("creates a structured PageHref destination when matching a local page route and falls back otherwise", () => {
    const { tplMgr, page, root } = setup();
    const detail = tplMgr.addComponent({ name: "MobileDetail", type: ComponentType.Page });
    ensure(detail.pageMeta, "detail pageMeta").path = "/m/work-orders/detail/[id]/[mode]";

    const matched = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "OpenDetail",
      action: {
        actionName: "navigation",
        destination: '/m/work-orders/detail/{{ "BPM-1" }}/{{ $state.tab }}',
      },
    });
    assert(matched.isOk(), "expected navigation to resolve local page");
    const destArg = matched.value.args.find((a) => a.name === "destination");
    assert(destArg && isKnownPageHref(destArg.expr), "expected PageHref destination");
    expect(destArg.expr.page).toBe(detail);
    expect(asCode(destArg.expr, { component: page, inStudio: false, projectFlags: DEVFLAGS }).code)
      .toContain("/m/work-orders/detail/");

    const unmatched = createInteraction({
      component: page,
      tpl: root,
      eventName: "onClick",
      name: "Fallback",
      action: {
        actionName: "navigation",
        destination: "/unregistered/{{ $state.id }}",
      },
    });
    assert(unmatched.isOk(), "expected unmatched local path to fall back cleanly");
    const fallbackArg = unmatched.value.args.find((a) => a.name === "destination");
    assert(fallbackArg, "expected fallback arg");
    expect(isKnownPageHref(fallbackArg.expr)).toBe(false);
  });
});
