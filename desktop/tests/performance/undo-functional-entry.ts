// Diagnostic build entry only; never include in a release entry.
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { getBaseVariant, mkVariantSetting } from "@/wab/shared/Variants";
import { ComponentType } from "@/wab/shared/core/components";
import { customCode } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { SlotSelection } from "@/wab/shared/core/slots";
import * as T from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";

(window as any).__undoFunctional = async () => {
  const s = (window as any).studioCtx,
    cases: any[] = ((window as any).__undoCases = []);
  (window as any).__undoStage = "setup";
  const assert = (ok: any, label: string) => {
    if (!ok) throw Error(label);
  };
  const ready = async () => {
    await s.awaitEval();
    await s.awaitStudioReady();
  };
  const rollover = async (stage: string) => {
    if (!(window as any).__undoBoundTest) return;
    for (let i = 0; i < 120; i++) {
      await s.changeUnsafe(() => {
        root.tplTree.name = `Boundary${stage}${i}`;
      });
    }
    await ready();
    cases.push({
      case: `rollover-${stage}`,
      records: s.undoLog._log.length,
      passed: true,
    });
  };
  let inner: any,
    outer: any,
    root: any,
    repeated: any,
    inside: any,
    param: any,
    arena: any,
    variant: any;
  await s.changeUnsafe(() => {
    inner = s
      .tplMgr()
      .addComponent({ type: ComponentType.Plain, name: "UndoInner" });
    const bi = getBaseVariant(inner);
    param = mkParam({
      name: "children",
      paramType: "slot",
      type: typeFactory.renderable(),
    });
    inner.params.push(param);
    inner.tplTree = T.mkTplTag(
      "div",
      [
        T.mkTplInlinedText("Default content", [bi], "span", {
          baseVariant: bi,
          name: "DefaultText",
          styles: { color: "rgb(7, 13, 29)" },
        }),
        T.mkSlot(param as any, [
          T.mkTplInlinedText("Slot default", [bi], "span", {
            baseVariant: bi,
            name: "SlotDefault",
          }),
        ]),
      ],
      {
        baseVariant: bi,
        name: "InnerRoot",
        styles: { width: "200px", height: "80px" },
      },
    );
    T.trackComponentRoot(inner);
    T.trackComponentSite(inner, s.site);
    const group = s
      .tplMgr()
      .createVariantGroup({ component: inner, name: "Tone" });
    variant = s.tplMgr().createVariant(inner, group, "Accent");
    outer = s
      .tplMgr()
      .addComponent({ type: ComponentType.Plain, name: "UndoOuter" });
    const bo = getBaseVariant(outer);
    inside = T.mkTplComponentX({
      component: inner,
      baseVariant: bo,
      children: T.mkTplInlinedText("Slot argument", [bo], "span", {
        baseVariant: bo,
        name: "SlotArg",
      }),
    });
    outer.tplTree = T.mkTplTag("div", [inside], {
      baseVariant: bo,
      name: "OuterRoot",
    });
    root = s
      .tplMgr()
      .addComponent({ type: ComponentType.Plain, name: "UndoHost" });
    const bh = getBaseVariant(root);
    repeated = T.mkTplComponent(outer, bh, []);
    repeated.vsettings[0].dataRep = T.mkRep("row", customCode("[1,2]"));
    root.tplTree = T.mkTplTag("div", [repeated], {
      baseVariant: bh,
      name: "HostRoot",
    });
    for (const component of [inner, outer, root]) {
      for (const tpl of T.flattenTpls(component.tplTree)) {
        if (
          T.isTplVariantable(tpl) &&
          !tpl.vsettings.some((vs: any) =>
            vs.variants.includes(getBaseVariant(component)),
          )
        )
          tpl.vsettings.unshift(
            mkVariantSetting({ variants: [getBaseVariant(component)] }),
          );
      }
      T.trackComponentRoot(component);
      T.trackComponentSite(component, s.site);
    }
    arena = s.tplMgr().addArena("UndoCases");
    s.tplMgr().addNewMixedArenaFrame(arena, "Cases", root, {
      width: 640,
      height: 480,
      insertPt: s.viewportCtx.visibleScalerBox().topLeft(),
    });
    s.tplMgr().addNewMixedArenaFrame(arena, "OtherCases", root, {
      width: 640,
      height: 480,
      insertPt: s.viewportCtx.visibleScalerBox().topLeft(),
    });
  });
  assertSiteInvariants(s.site);
  s.changeSelection(() => s.switchToArena(arena));
  await ready();
  let vc = s.tryGetViewCtxForFrame(arena.children[0]);
  (window as any).__undoStage = "repeat";
  const outerKeys = vc.renderState.tpl2fullKeys(repeated).sort();
  assert(outerKeys.length === 2, "Repeat instances missing");
  const outerKey = outerKeys[1];
  s.changeSelection(() =>
    vc.setStudioFocusBySelectable(vc.renderState.fullKey2val(outerKey)),
  );
  const clone = vc.focusedCloneKey();
  await rollover("repeat");
  await s.changeUnsafe(() => {
    repeated.name = "RepeatChanged";
  });
  await ready();
  await s.undo();
  await ready();
  assert(
    vc.focusedSelectable()?.fullKey === outerKey &&
      vc.focusedCloneKey() === clone,
    "Repeat undo chose wrong instance",
  );
  await s.redo();
  await ready();
  assert(repeated.name === "RepeatChanged", "Repeat redo failed");
  cases.push({
    case: "repeated-instance",
    passed: true,
    instances: outerKeys.length,
  });
  (window as any).__undoStage = "enter-outer";
  await s.changeUnsafe(() =>
    vc.enterComponentCtxForVal(vc.renderState.fullKey2val(outerKey), "menu"),
  );
  await ready();
  (window as any).__undoStage = "slot";
  const innerKey = vc.renderState
    .tpl2fullKeys(inside)
    .find(
      (k: string) =>
        vc.renderState.fullKey2val(k)?.valOwner?.fullKey === outerKey,
    );
  assert(innerKey, "Nested instance missing");
  s.changeSelection(() =>
    vc.setStudioFocusBySelectable(
      new SlotSelection({
        val: vc.renderState.fullKey2val(innerKey),
        slotParam: param,
      }),
    ),
  );
  await rollover("slot");
  await s.changeUnsafe(() => {
    inside.name = "SlotChanged";
  });
  await ready();
  await s.undo();
  await ready();
  let selection = vc.focusedSelectable();
  assert(
    selection instanceof SlotSelection &&
      selection.slotParam === param &&
      selection.val?.fullKey === innerKey,
    "Slot identity failed",
  );
  await s.redo();
  await ready();
  assert(inside.name === "SlotChanged", "Slot redo failed");
  cases.push({ case: "slot-owner-param", passed: true });
  (window as any).__undoStage = "enter-inner";
  await s.changeUnsafe(() =>
    vc.enterComponentCtxForVal(vc.renderState.fullKey2val(innerKey), "menu"),
  );
  await ready();
  s.changeSelection(() => {
    vc.currentComponentStackFrame().setTargetVariants([variant]);
    vc.currentComponentStackFrame().setPinnedVariants(
      new Map([[variant, true]]),
    );
    vc.setShowDefaultSlotContents(true);
  });
  await ready();
  await s.changeUnsafe(() => {
    inner.tplTree.name = "NestedOne";
  });
  await ready();
  await rollover("nested");
  await s.changeUnsafe(() => {
    inner.tplTree.name = "NestedTwo";
  });
  await ready();
  await s.undo();
  await ready();
  assert(
    vc.currentComponentCtx()?.valComponent().fullKey === innerKey,
    "Nested context undo failed",
  );
  assert(
    vc.currentComponentStackFrame().getTargetVariants().includes(variant),
    "Target variant lost",
  );
  assert(
    vc.currentComponentStackFrame().getPinnedVariants().get(variant) === true,
    "Pin lost",
  );
  assert(vc.showDefaultSlotContents(), "Default Slot policy lost");
  await s.redo();
  await ready();
  cases.push({ case: "nested-context-variants-default-slot", passed: true });
  (window as any).__undoStage = "cold";
  const old = vc;
  (window as any).__undoColdProof = {
    before: {
      context: vc.currentComponentCtx()?.component().name,
      key: vc.currentComponentCtx()?.valComponent().fullKey,
      stack: vc.componentStackFrames().map((f: any) => f.component.name),
      defaultSlot: vc.showDefaultSlotContents(),
    },
  };
  for (const a of (window as any).__undoArenas) {
    s.changeSelection(() => s.switchToArena(a));
    await ready();
  }
  (window as any).__undoColdProof.disposed = old.isDisposed;
  assert(old.isDisposed, "Cold test did not dispose case frame");
  const cold = performance.now();
  await s.undo();
  await ready();
  vc = s.tryGetViewCtxForFrame(arena.children[0]);
  assert(vc && vc !== old, "Frame was not recreated");
  assert(
    vc.currentComponentCtx()?.valComponent().fullKey === innerKey,
    "Cold nested context lost",
  );
  assert(
    vc.currentComponentStackFrame().getTargetVariants().includes(variant),
    "Cold variant lost",
  );
  assert(vc.showDefaultSlotContents(), "Cold default Slot policy lost");
  assert(
    vc.currentComponentStackFrame().getPinnedVariants().get(variant) === true,
    "Cold pin lost",
  );
  (window as any).__undoColdProof.after = {
    context: vc.currentComponentCtx()?.component().name,
    key: vc.currentComponentCtx()?.valComponent().fullKey,
    stack: vc.componentStackFrames().map((f: any) => f.component.name),
    defaultSlot: vc.showDefaultSlotContents(),
  };
  cases.push({
    case: "cold-nested-context",
    passed: true,
    ms: performance.now() - cold,
    stackDepth: vc.componentStackFrames().length,
  });
  // Exercise the UI deletion path, then the public MCP tool on the same selection.
  (window as any).__undoStage = "delete";
  const node = inner.tplTree.children[0];
  s.changeSelection(() => vc.setStudioFocusByTpl(node));
  await vc.getViewOps().tryDelete({
    tpl: node,
    forceDelete: true,
    skipCommentsConfirmation: true,
  });
  await s.awaitEval();
  await ready();
  assertSiteInvariants(s.site);
  await s.undo();
  await ready();
  assertSiteInvariants(s.site);
  assert(inner.tplTree.children.includes(node), "Deleted model not restored");
  assert(vc.focusedTpl() === node, "Deleted selection not restored");
  await Promise.all(
    arena.children.map(async (f: any) => {
      const v = await s.awaitViewCtxForFrame(f);
      await v.awaitSync();
    }),
  );
  const documents = arena.children.map((f: any) =>
    s.tryGetViewCtxForFrame(f)?.canvasCtx.doc(),
  );
  const proof = {
    views: arena.children.map((f: any) => {
      const v = s.tryGetViewCtxForFrame(f);
      return {
        active: v?.isRenderActive(),
        visible: v?.isVisible(),
        paused: v?.syncQueue.paused,
      };
    }),
    vsettings: node.vsettings.map((v: any) => ({
      variants: v.variants.map((v: any) => v.name),
      values: { ...v.rs.values },
    })),
    rules: s.styleMgr.componentToVsRules.get(inner)?.map((r: any) => ({
      vs: r.vs.uid,
      hasColor: r.rules.join(" ").includes("7, 13, 29"),
    })),
    docs: documents.map((d: any) => ({
      present: !!d,
      styles:
        d &&
        [...d.querySelectorAll("style")].map((e: any) => ({
          id: e.id,
          bytes: e.textContent.length,
          hasColor: e.textContent.includes("7, 13, 29"),
        })),
    })),
  };
  cases.push({ case: "two-frame-style-proof", proof });
  assert(
    documents.length === 2 &&
      documents.every((d: any) =>
        d
          ?.getElementById("plasmic-comp-" + inner.uuid)
          ?.textContent.includes("7, 13, 29"),
      ),
    "Two-frame styles not restored after sync",
  );
  await s.redo();
  await ready();
  assert(!inner.tplTree.children.includes(node), "Delete redo failed");
  await s.undo();
  await ready();
  cases.push({ case: "delete-undo-redo-selection", passed: true });
  (window as any).__undoStage = "mcp-delete";
  await COPILOT_TOOLS.deleteElement.execute(s, {
    componentUuid: inner.uuid,
    elementUuid: node.uuid,
  });
  await s.awaitEval();
  await ready();
  assert(!inner.tplTree.children.includes(node), "MCP delete failed");
  await s.undo();
  await ready();
  assert(inner.tplTree.children.includes(node), "MCP delete undo failed");
  assert(vc.focusedTpl() === node, "MCP delete undo selection failed");
  await s.redo();
  await ready();
  assert(!inner.tplTree.children.includes(node), "MCP delete redo failed");
  await s.undo();
  await ready();
  assertSiteInvariants(s.site);
  cases.push({ case: "mcp-delete-undo-redo", passed: true });
  s.changeSelection(() => vc.setCurrentComponentCtx(null));
  s.changeSelection(() =>
    s.setStudioFocusOnFrame({ frame: arena.children[1], autoZoom: true }),
  );
  await ready();
  const v2 = s.tryGetViewCtxForFrame(arena.children[1]);
  cases.push({
    case: "second-frame-after-activation",
    active: v2.isRenderActive(),
    hasColor: v2.canvasCtx
      .doc()
      .getElementById("plasmic-comp-" + inner.uuid)
      ?.textContent.includes("7, 13, 29"),
  });
  assert(
    v2.isRenderActive() &&
      v2.canvasCtx
        .doc()
        .getElementById("plasmic-comp-" + inner.uuid)
        ?.textContent.includes("7, 13, 29"),
    "Activated second frame style not restored",
  );
  const frames = (window as any).__undoArenas
    .slice(0, 2)
    .map((a: any) => a.children[0]);
  s.changeSelection(() => s.switchToArena((window as any).__undoArenas[0]));
  await ready();
  s.changeSelection(() => s.setStudioFocusOnFrames([frames[0]]));
  await s.changeUnsafe(() => {
    frames[0].left += 25;
  });
  await ready();
  const after = frames[0].left;
  await s.undo();
  await ready();
  assert(frames[0].left === after - 25, "Frame position not restored");
  assert(s.focusedFrames()[0] === frames[0], "Frame selection lost");
  await s.redo();
  await ready();
  assert(frames[0].left === after, "Frame redo failed");
  cases.push({ case: "frame-position-selection", passed: true });
  return {
    cases,
    errors: (window as any).__perf.errors,
    records: s.undoLog._log.length,
  };
};
