import { $$$ } from "@/wab/shared/TplQuery";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createTplMgr, createVariantTplMgr } from "@/wab/shared/__testonly__/site-tests-utils";
import { ensure } from "@/wab/shared/common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { addSlotParam, ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { mkSlot, mkTplComponentX, mkTplTagX, TplTagType } from "@/wab/shared/core/tpls";
import { RSH, RuleSetHelpers, ThemeLayoutRuleSetHelpers, VariantedRuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { instUtil } from "@/wab/shared/model/InstUtil";
import {
  Arg,
  RenderExpr,
  TplNode,
  ThemeLayoutSettings,
  VariantedRuleSet,
  VariantsRef,
  ensureKnownTplTag,
  Component,
  Mixin,
  RuleSet,
  Site,
  ThemeStyle,
  TplTag,
  Variant,
} from "@/wab/shared/model/classes";
import {
  getBaseVariant,
  mkVariantSetting,
  tryGetVariantSetting,
  type VariantCombo,
} from "@/wab/shared/Variants";
import {
  resolveDefinedIndicator,
  SingleRsStyleProjection,
  TplStyleProjection,
  type SingleRsStyleSource,
  type StyleCell,
  type TplStyleSource,
  ViewStyleInputs,
  SingleRsStyleInputs,
} from "@/wab/client/studio-ctx/style-inputs";

interface Fixture {
  site: Site;
  component: Component;
  root: TplTag;
  variant: Variant;
  base: Variant;
  vtm: ReturnType<typeof createVariantTplMgr>;
  tplMgr: ReturnType<typeof createTplMgr>;
  recorder: ChangeRecorder;
  snapshots: ModelSnapshots;
}

function fixture(): Fixture {
  const site = createSite();
  const tplMgr = createTplMgr(site);
  const component = tplMgr.addComponent({
    type: ComponentType.Plain,
    name: "Style Test",
  });
  const root = ensureKnownTplTag(component.tplTree);
  const variantGroup = tplMgr.createVariantGroup({
    component,
    name: "Mode",
  });
  const variant = tplMgr.createVariant(component, variantGroup, "Dark");
  const vtm = createVariantTplMgr(site, tplMgr, component);
  const base = getBaseVariant(component);
  vtm.ensureBaseVariantSetting(root);
  return {
    site,
    tplMgr,
    component,
    root,
    variant,
    base,
    vtm,
    recorder: new ChangeRecorder({ inst: site, _instUtil: instUtil }),
    snapshots: new ModelSnapshots(),
  };
}

function sourceFor(
  f: Fixture,
  active: VariantCombo,
  target: VariantCombo,
  indicator: VariantCombo,
  tpl: TplNode = f.root,
): TplStyleSource {
  return {
    kind: "tpl",
    tpl,
    site: f.site,
    component: f.component,
    contextKey: "fixture",
    readContext: () => ({ activeVariantCombo: active, targetVariantCombo: target,
      targetIndicatorCombo: indicator, effectiveVariantSetting: f.vtm.effectiveVariantSetting(tpl, [...active]) }),
  };
}

function syncAndPublish(
  f: Fixture,
  projection: TplStyleProjection | SingleRsStyleProjection,
  command: () => void,
) {
  const changes = f.recorder.withRecording(command);
  f.snapshots.sync(changes.changes, () => projection.prepare());
  projection.publish();
}

function cellOf(
  projection: TplStyleProjection | SingleRsStyleProjection,
  key: string,
): StyleCell {
  return ensure(
    projection.store.getState().find((cell) => cell.key === key),
    `expected a ${key} cell`,
  );
}

function indicatorOf(
  projection: TplStyleProjection | SingleRsStyleProjection,
  key: string,
) {
  const cell = cellOf(projection, key);
  return ensure(
    cell.indicator,
    cell.indicatorUnsupported ?? `expected a ${key} indicator`,
  );
}

describe("native selected-style projection", () => {
  it("reads the target css field, its defined indicator, and target presence", () => {
    const f = fixture();
    try {
      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity"],
      );
      syncAndPublish(f, projection, () => {
        RSH(ensure(tryGetVariantSetting(f.root, [f.base])).rs, f.root).set(
          "opacity",
          "0.4",
        );
      });
      const cell = cellOf(projection, "opacity");
      expect(cell.value).toBe("0.4");
      expect(cell.raw).toBe("0.4");
      expect(cell.has).toBe(true);
      expect(cell.targetHas).toBe(true);
      const indicator = ensure(
        cell.indicator,
        cell.indicatorUnsupported ?? "expected an opacity indicator",
      );
      expect(indicator.source).toBe("set");
      const live = resolveDefinedIndicator(f.snapshots, indicator);
      expect(live.source).toBe("set");
      if (live.source === "set") {
        expect(live.stack).toHaveLength(1);
      }
      projection.dispose();
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

  it("preserves theme, mixin, case-variant writes, and unrelated keys", () => {
    const f = fixture();
    try {
      // Theme tag style (div) with an opacity value.
      const theme = ensure(f.site.activeTheme, "default theme expected");
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      f.recorder.withRecording(() => {
        theme.styles.push(
          new ThemeStyle({
            selector: "div",
            style: new Mixin({
              name: "Theme div",
              rs: mkRuleSet({ values: { opacity: "0.3" } }),
              preview: undefined,
              uuid: "theme-div",
              forTheme: true,
              variantedRs: [],
            }),
          }),
        );
        const mixin = new Mixin({
          name: "Blend",
          rs: mkRuleSet({ values: { "mix-blend-mode": "multiply" } }),
          preview: undefined,
          uuid: "mixin-blend",
          forTheme: false,
          variantedRs: [],
        });
        f.site.mixins.push(mixin);
        baseVs.rs.mixins.push(mixin);
        RSH(baseVs.rs, f.root).set("color", "red");
      });

      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity", "mixBlendMode", "color"],
      );

      // css.normProp: the camelCase request maps to the kebab key.
      expect(projection.store.getState().map((cell) => cell.key)).toEqual([
        "opacity",
        "mix-blend-mode",
        "color",
      ]);
      expect(cellOf(projection, "opacity").value).toBe("0.3");
      expect(cellOf(projection, "mix-blend-mode").value).toBe("multiply");
      expect(indicatorOf(projection, "mix-blend-mode").source).toBe("mixin");
      expect(cellOf(projection, "color").value).toBe("red");

      const publish = vi.fn();
      projection.store.subscribe(publish);

      // Unrelated CSS key on the same persisted ruleset.
      syncAndPublish(f, projection, () => {
        RSH(baseVs.rs, f.root).set("border-color", "blue");
      });
      expect(publish).not.toHaveBeenCalled();

      // Same-value write is a model no-op.
      syncAndPublish(f, projection, () => {
        RSH(baseVs.rs, f.root).set("color", "red");
      });
      expect(publish).not.toHaveBeenCalled();

      projection.dispose();
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

  it("preserves same-component inherited typography while changing parent rules", () => {
    const f = fixture();
    try {
      const parent = mkTplTagX("div");
      const child = mkTplTagX("span", { type: TplTagType.Text });
      f.recorder.withRecording(() => {
        parent.children.push(child);
        child.parent = parent;
        f.root.children.push(parent);
        parent.parent = f.root;
        f.vtm.ensureBaseVariantSetting(parent);
        f.vtm.ensureBaseVariantSetting(child);
        RSH(ensure(tryGetVariantSetting(parent, [f.base])).rs, parent).set(
          "letter-spacing",
          "3px",
        );
      });

      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base], child),
        ["letter-spacing"],
      );
      expect(cellOf(projection, "letter-spacing").value).toBe("3px");
      expect(indicatorOf(projection, "letter-spacing").source).toBe(
        "parentTplStyle",
      );

      const publish = vi.fn();
      projection.store.subscribe(publish);
      syncAndPublish(f, projection, () => {
        RSH(
          ensure(tryGetVariantSetting(parent, [f.base])).rs,
          parent,
        ).set("letter-spacing", "7px");
      });
      expect(publish).toHaveBeenCalledTimes(1);
      expect(cellOf(projection, "letter-spacing").value).toBe("7px");
      projection.dispose();
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

  it("switches variant values without mixing target writes into reads", () => {
    const f = fixture();
    try {
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      f.recorder.withRecording(() => {
        RSH(baseVs.rs, f.root).set("opacity", "0.2");
        const variantVs = f.vtm.ensureVariantSetting(f.root, [f.variant]);
        RSH(variantVs.rs, f.root).set("opacity", "0.8");
      });

      const baseProjection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity"],
      );
      const variantProjection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.variant], [f.variant], [f.variant]),
        ["opacity"],
      );
      expect(cellOf(baseProjection, "opacity").value).toBe("0.2");
      expect(cellOf(variantProjection, "opacity").value).toBe("0.8");
      expect(indicatorOf(variantProjection, "opacity").source).toBe("set");
      baseProjection.dispose();
      variantProjection.dispose();
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

  it("handles a persisted command write and its model-level reverse", () => {
    const f = fixture();
    try {
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      f.recorder.withRecording(() => {
        RSH(baseVs.rs, f.root).set("opacity", "0.1");
      });
      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity"],
      );
      const publish = vi.fn();
      projection.store.subscribe(publish);

      syncAndPublish(f, projection, () => {
        RSH(baseVs.rs, f.root).set("opacity", "0.9");
      });
      expect(publish).toHaveBeenCalledTimes(1);
      expect(cellOf(projection, "opacity").value).toBe("0.9");

      // Reverse write is the model-level undo equivalent exercised here.
      syncAndPublish(f, projection, () => {
        RSH(baseVs.rs, f.root).set("opacity", "0.1");
      });
      expect(publish).toHaveBeenCalledTimes(2);
      expect(cellOf(projection, "opacity").value).toBe("0.1");
      projection.dispose();
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

  it("detaches every prepared-field stop on dispose and never publishes after it", () => {
    const f = fixture();
    try {
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      f.recorder.withRecording(() => {
        RSH(baseVs.rs, f.root).set("opacity", "0.5");
      });

      const original = f.snapshots.subscribePreparedField.bind(f.snapshots);
      const detached = vi.fn();
      vi.spyOn(f.snapshots, "subscribePreparedField").mockImplementation(
        (field, invalidate) => {
          const stop = original(field, invalidate);
          return () => {
            stop();
            detached();
          };
        },
      );

      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity"],
      );
      const before = projection.store.getState();
      const publish = vi.fn();
      projection.store.subscribe(publish);
      expect(detached).not.toHaveBeenCalled();
      projection.dispose();
      expect(detached).toHaveBeenCalled();
      expect(projection.store.getState()).toBe(before);

      const changes = f.recorder.withRecording(() => {
        RSH(baseVs.rs, f.root).set("opacity", "0.6");
      });
      f.snapshots.sync(changes.changes, () => projection.prepare());
      projection.publish();
      expect(publish).not.toHaveBeenCalled();
      expect(projection.store.getState()).toBe(before);
      f.snapshots.dispose();
    } finally {
      f.recorder.dispose();
    }
  });

  it("supports the separate SimpleRs mode without inventing a ViewCtx", () => {
    const rs = mkRuleSet({ values: { opacity: "0.6" } });
    const rsh = new RuleSetHelpers(rs, "div");
    const snapshots = new ModelSnapshots();
    const recorder = new ChangeRecorder({ inst: rs, _instUtil: instUtil });
    try {
      const source: SingleRsStyleSource = { kind: "singleRs", read: { kind: "ruleSet", rs, forTag: "div" } };
      const projection = new SingleRsStyleProjection(
        snapshots,
        source,
        ["opacity"],
      );
      const cell = cellOf(projection, "opacity");
      expect(cell.value).toBe("0.6");
      expect(cell.targetHas).toBe(true);
      const indicator = ensure(
        cell.indicator,
        cell.indicatorUnsupported ?? "expected a single-ruleset indicator",
      );
      expect(indicator.source).toBe("setNonVariable");
      expect(indicator.stack).toEqual([]);

      const publish = vi.fn();
      projection.store.subscribe(publish);
      const changes = recorder.withRecording(() => {
        rsh.set("color", "blue");
      });
      snapshots.sync(changes.changes, () => projection.prepare());
      projection.publish();
      expect(publish).not.toHaveBeenCalled();

      projection.dispose();
    } finally {
      snapshots.dispose();
      recorder.dispose();
    }
  });

  it("keeps indicator source-stack identities as refs, not live models", () => {
    const f = fixture();
    try {
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      let mixin!: Mixin;
      f.recorder.withRecording(() => {
        mixin = new Mixin({
          name: "Indicator Mixin",
          rs: mkRuleSet({ values: { opacity: "0.45" } }),
          preview: undefined,
          uuid: "indicator-mixin",
          forTheme: false,
          variantedRs: [],
        });
        f.site.mixins.push(mixin);
        baseVs.rs.mixins.push(mixin);
      });
      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity"],
      );
      const indicator = indicatorOf(projection, "opacity");
      expect(indicator.source).toBe("mixin");
      expect(indicator.theme).toBeUndefined();
      expect(indicator.mixin).toEqual({
        uid: mixin.uid,
        type: "Mixin",
      });
      expect(indicator.mixin).not.toBe(mixin);
      const mixinSource = indicator.stack.find(
        (source) => source.type === "mixin",
      );
      expect(mixinSource?.type).toBe("mixin");
      if (!mixinSource || mixinSource.type !== "mixin") {
        throw new Error("expected a mixin indicator source");
      }
      expect(mixinSource).not.toBeInstanceOf(Mixin);
      expect(mixinSource.mixin).not.toBe(mixin);
      const live = resolveDefinedIndicator(f.snapshots, indicator);
      expect(live.source).toBe("mixin");
      if (live.source === "mixin") {
        expect(live.mixin).toBe(mixin);
        expect(live.targetSource).toBe(live.stack[live.stack.length - 1]);
      }
      projection.dispose();
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });
  it("disposes a view registry from its lifetime signal", () => {
    const f = fixture();
    try {
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      f.recorder.withRecording(() => {
        RSH(baseVs.rs, f.root).set("opacity", "0.5");
      });
      const controller = new AbortController();
      const registry = new ViewStyleInputs(
        () => f.snapshots,
        controller.signal,
      );
      const handle = registry.get(
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity"],
      );
      expect(registry.isDisposed).toBe(false);
      expect(handle.projection.isDisposed).toBe(false);
      controller.abort();
      expect(registry.isDisposed).toBe(true);
      expect(handle.projection.isDisposed).toBe(true);
      expect(() =>
        registry.get(
          sourceFor(f, [f.base], [f.base], [f.base]),
          ["opacity"],
        ),
      ).toThrow("disposed view");
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

  it("installs final cells before field subscribers and publishes once for coalesced edits", () => {
    const f = fixture();
    try {
      const baseVs = ensure(tryGetVariantSetting(f.root, [f.base]));
      f.recorder.withRecording(() => {
        RSH(baseVs.rs, f.root).set("opacity", "0.1");
      });
      const projection = new TplStyleProjection(
        f.snapshots,
        sourceFor(f, [f.base], [f.base], [f.base]),
        ["opacity", "color"],
      );
      expect(cellOf(projection, "opacity").value).toBe("0.1");

      // A real field store on the declared RuleSet.values field. Its
      // publication runs after ModelSnapshots.install and beforePublish, so it
      // must already observe the final projected cells.
      const valuesStore = f.snapshots.declaredField(baseVs.rs, "values");
      const fieldObserved: string[] = [];
      valuesStore.subscribe(() => {
        fieldObserved.push(cellOf(projection, "opacity").value);
      });

      const published = vi.fn();
      projection.store.subscribe(published);

      const edit = (value: string, expectedCalls: number) => {
        const changes = f.recorder.withRecording(() => {
          RSH(baseVs.rs, f.root).set("opacity", value);
        });
        f.snapshots.sync(changes.changes, () => projection.prepare());
        expect(published).toHaveBeenCalledTimes(expectedCalls);
      };

      f.snapshots.deferPublication(() => {
        // Two separate recorded edits, each with its own beforePublish fence.
        edit("0.25", 0);
        edit("0.9", 0);
      });

      // Field publication is coalesced by ModelSnapshots.deferPublication and
      // each subscriber must read the final installed cell, not a pending one.
      expect(fieldObserved).toEqual(["0.9"]);
      expect(published).not.toHaveBeenCalled();
      projection.publish();
      expect(published).toHaveBeenCalledTimes(1);
      const stable = projection.store.getState();
      expect(cellOf(projection, "opacity").value).toBe("0.9");

      // A same-value write is a model no-op and must preserve the exact frozen
      // snapshot identity without another publication.
      edit("0.9", 1);
      projection.publish();
      expect(published).toHaveBeenCalledTimes(1);
      expect(projection.store.getState()).toBe(stable);
      expect(cellOf(projection, "opacity").value).toBe("0.9");
    } finally {
      f.snapshots.dispose();
      f.recorder.dispose();
    }
  });

});


it("invalidates typography classification from the real mutable TplTag.type field", () => {
  const f = fixture();
  try {
    const theme = ensure(f.site.activeTheme, "Active theme");
    f.recorder.withRecording(() => { new RuleSetHelpers(theme.defaultStyle.rs, "div").set("font-size", "37px"); });
    const projection = new TplStyleProjection(f.snapshots, sourceFor(f, [f.base], [f.base], [f.base]), ["font-size"]);
    expect(cellOf(projection, "font-size").value).not.toBe("37px");
    syncAndPublish(f, projection, () => { f.root.type = TplTagType.Text; });
    expect(cellOf(projection, "font-size").value).toBe("37px");
    projection.dispose();
  } finally { f.snapshots.dispose(); f.recorder.dispose(); }
});

function recordValue<Value>(f: Fixture, build: () => Value): Value {
  let value: Value | undefined;
  f.recorder.withRecording(() => { value = build(); });
  return ensure(value, "Recorded fixture value");
}

function passedSlots(f: Fixture) {
  return recordValue(f, () => {
    const card = f.tplMgr.addComponent({ name: "Card", type: ComponentType.Plain });
    const base = getBaseVariant(card);
    const firstParam = addSlotParam(f.site, card, "first"), secondParam = addSlotParam(f.site, card, "second");
    const first = mkSlot(firstParam), second = mkSlot(secondParam);
    first.vsettings = [mkVariantSetting({ variants: [base] })]; second.vsettings = [mkVariantSetting({ variants: [base] })];
    $$$(card.tplTree).append(first); $$$(card.tplTree).append(second);
    RSH(first.vsettings[0].rs, first).set("color", "red"); RSH(second.vsettings[0].rs, second).set("color", "blue");
    const text = mkTplTagX("span", { baseVariant: f.base, type: TplTagType.Text });
    const instance = mkTplComponentX({ component: card, baseVariant: f.base });
    $$$(f.root).append(instance); text.parent = instance;
    const firstExpr = new RenderExpr({ tpl: [text] }), secondExpr = new RenderExpr({ tpl: [] });
    const firstArg = new Arg({ param: firstParam, expr: firstExpr }), secondArg = new Arg({ param: secondParam, expr: secondExpr });
    ensure(tryGetVariantSetting(instance, [f.base])).args.push(firstArg, secondArg);
    return { card, base, first, second, text, instance, firstExpr, secondExpr };
  });
}

it("follows passed-slot styles and changes its mapping through real RenderExpr membership", () => {
  const f = fixture();
  try {
    const slot = passedSlots(f);
    const projection = new TplStyleProjection(f.snapshots, sourceFor(f, [f.base], [f.base], [f.base], slot.text), ["color"]);
    expect(cellOf(projection, "color").value).toBe("red");
    const initial = indicatorOf(projection, "color");
    expect(initial.source).toBe("parentTplStyle"); expect(initial.stack.some((source) => source.type === "slot")).toBe(true);
    syncAndPublish(f, projection, () => { RSH(slot.first.vsettings[0].rs, slot.first).set("color", "purple"); });
    expect(cellOf(projection, "color").value).toBe("purple");
    syncAndPublish(f, projection, () => { slot.firstExpr.tpl.splice(0); slot.secondExpr.tpl.push(slot.text); });
    expect(slot.text.parent).toBe(slot.instance);
    expect(cellOf(projection, "color").value).toBe("blue");
    projection.dispose();
  } finally { f.snapshots.dispose(); f.recorder.dispose(); }
});

it("switches the inherited slot context using the instance's actual VariantsRef argument", () => {
  const f = fixture();
  try {
    const slot = passedSlots(f);
    const setup = recordValue(f, () => {
      const group = f.tplMgr.createVariantGroup({ component: slot.card, name: "Mode" });
      const variant = f.tplMgr.createVariant(slot.card, group, "Dark");
      const vtm = createVariantTplMgr(f.site, f.tplMgr, slot.card);
      RSH(vtm.ensureVariantSetting(slot.first, [variant]).rs, slot.first).set("color", "black");
      const variants = new VariantsRef({ variants: [] });
      ensure(tryGetVariantSetting(slot.instance, [f.base])).args.push(new Arg({ param: group.param, expr: variants }));
      return { variants, variant };
    });
    const projection = new TplStyleProjection(f.snapshots, sourceFor(f, [f.base], [f.base], [f.base], slot.text), ["color"]);
    expect(cellOf(projection, "color").value).toBe("red");
    syncAndPublish(f, projection, () => { setup.variants.variants.push(setup.variant); });
    expect(cellOf(projection, "color").value).toBe("black");
    projection.dispose();
  } finally { f.snapshots.dispose(); f.recorder.dispose(); }
});

it("continues through nested passed slots and tracks an initially empty contributor", () => {
  const f = fixture();
  try {
    const slot = passedSlots(f);
    const nested = recordValue(f, () => {
      const wrapper = f.tplMgr.addComponent({ name: "Wrapper", type: ComponentType.Plain });
      const wrapperBase = getBaseVariant(wrapper);
      const param = addSlotParam(f.site, wrapper, "content");
      const destination = mkSlot(param);
      destination.vsettings = [mkVariantSetting({ variants: [wrapperBase] })];
      $$$(wrapper.tplTree).append(destination);
      RSH(destination.vsettings[0].rs, destination).set("color", "teal");
      RSH(slot.first.vsettings[0].rs, slot.first).clear("color");
      const instance = mkTplComponentX({ component: wrapper, baseVariant: slot.base });
      const cardRoot = ensureKnownTplTag(slot.card.tplTree);
      cardRoot.children.splice(cardRoot.children.indexOf(slot.first), 1);
      $$$(cardRoot).append(instance);
      slot.first.parent = instance;
      ensure(tryGetVariantSetting(instance, [slot.base])).args.push(
        new Arg({ param, expr: new RenderExpr({ tpl: [slot.first] }) })
      );
      return { destination };
    });
    const projection = new TplStyleProjection(f.snapshots, sourceFor(f, [f.base], [f.base], [f.base], slot.text), ["color"]);
    try {
      expect(cellOf(projection, "color").value).toBe("teal");
      syncAndPublish(f, projection, () => { RSH(nested.destination.vsettings[0].rs, nested.destination).set("color", "orange"); });
      expect(cellOf(projection, "color").value).toBe("orange");
      syncAndPublish(f, projection, () => { RSH(slot.first.vsettings[0].rs, slot.first).set("color", "purple"); });
      expect(cellOf(projection, "color").value).toBe("purple");
    } finally { projection.dispose(); }
  } finally { f.snapshots.dispose(); f.recorder.dispose(); }
});

it("materializes varianted SingleRs reads freshly in the same commit and keeps separate active contexts", () => {
  const f = fixture();
  try {
    const setup = recordValue(f, () => {
      const group = f.tplMgr.createGlobalVariantGroup("Mode"), dark = f.tplMgr.createGlobalVariant(group, "Dark");
      const varianted = new VariantedRuleSet({ variants: [dark], rs: mkRuleSet({ values: { opacity: "0.8" } }) });
      const mixin = new Mixin({ name: "Theme styles", uuid: "theme-styles", rs: mkRuleSet({ values: { opacity: "0.2" } }), variantedRs: [varianted], forTheme: true, preview: undefined });
      f.site.mixins.push(mixin); return { dark, varianted, mixin };
    });
    const owner = new SingleRsStyleInputs(() => f.snapshots);
    const source = (activeGlobalVariants: Variant[]): SingleRsStyleSource => ({ kind: "singleRs", themeTag: "",
      read: { kind: "mixin", site: f.site, mixin: setup.mixin, activeGlobalVariants, forTag: "" } });
    const base = owner.get(source([]), ["opacity"]), dark = owner.get(source([setup.dark]), ["opacity"]);
    const stops = [base.retain(), dark.retain()];
    const oldHelper = new VariantedRuleSetHelpers(setup.mixin, "", new VariantedStylesHelper(f.site, []));
    try {
      expect(base.projection).not.toBe(dark.projection);
      const changes = f.recorder.withRecording(() => { new RuleSetHelpers(setup.mixin.rs, "").set("opacity", "0.3"); new RuleSetHelpers(setup.varianted.rs, "").set("opacity", "0.9"); });
      f.snapshots.deferPublication(() => {
        f.snapshots.sync(changes.changes, () => owner.prepareCommit());
        expect(cellOf(base.projection, "opacity").value).toBe("0.3"); expect(cellOf(dark.projection, "opacity").value).toBe("0.9");
        owner.publishCommit();
      });
      expect(oldHelper.get("opacity")).toBe("0.2");
      expect(cellOf(base.projection, "opacity").value).toBe(new VariantedRuleSetHelpers(setup.mixin, "", new VariantedStylesHelper(f.site, [])).get("opacity"));
    } finally { stops.forEach((stop) => stop()); owner.dispose(); }
  } finally { f.snapshots.dispose(); f.recorder.dispose(); }
});

it("keeps theme layout defaults without persisting on read and follows first attachment and reverse", () => {
  const f = fixture();
  try {
    const theme = ensure(f.site.activeTheme, "Active theme");
    f.recorder.withRecording(() => { theme.layout = undefined; });
    const layout = new ThemeLayoutSettings({ rs: mkRuleSet({ values: {} }) });
    const projection = new SingleRsStyleProjection(f.snapshots, { kind: "singleRs", read: { kind: "themeLayout", theme, layout } }, ["plasmic-standard-width"]);
    const before = cellOf(projection, "plasmic-standard-width").value;
    expect(theme.layout).toBeUndefined();
    syncAndPublish(f, projection, () => { new ThemeLayoutRuleSetHelpers(layout, theme).set("plasmic-standard-width", "923px"); });
    expect(cellOf(projection, "plasmic-standard-width").value).toBe("923px");
    syncAndPublish(f, projection, () => { theme.layout = undefined; });
    expect(cellOf(projection, "plasmic-standard-width").value).toBe(before);
    projection.dispose();
  } finally { f.snapshots.dispose(); f.recorder.dispose(); }
});
