import {
  TEST_GLOBAL_VARIANT,
  buildValTree,
  mkTplTestText,
  renderStateForTests,
} from "@/wab/__testonly__/tpls";
import { FocusHeuristics } from "@/wab/client/focus-heuristics";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure, ensureInstance, maybe, tuple } from "@/wab/shared/common";
import * as Components from "@/wab/shared/core/components";
import { ComponentType } from "@/wab/shared/core/components";
import * as Lang from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import * as Tpls from "@/wab/shared/core/tpls";
import { mkTplComponentX } from "@/wab/shared/core/tpls";
import * as ValNodes from "@/wab/shared/core/val-nodes";
import {
  ValComponent,
  ValNode,
  ValSlot,
  slotContentValNode,
} from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { TplComponent, TplNode } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

describe("FocusHeuristics", function () {
  let children,
    doEval,
    evalTpl: (opts?: {
      tplTree: TplNode;
      showDefaultContentsFor?: TplComponent;
    }) => void,
    nestingSlot,
    slottedSlot,
    _spanA,
    _spanB,
    sysTree,
    valTree,
    defaultSlotChild,
    valState: ValState,
    getHeuristics: (ctx?: ComponentCtx) => FocusHeuristics;

  const componentB = Components.mkComponent({
    name: "B",
    params: [],
    tplTree: Tpls.mkTplTag("div", [(_spanB = Tpls.mkTplTag("span"))]),
    type: ComponentType.Plain,
  });
  const componentA = Components.mkComponent({
    name: "A",
    params: [],
    tplTree: Tpls.mkTplTag(
      "div",
      tuple(
        Tpls.mkTplComponent(componentB, TEST_GLOBAL_VARIANT),
        (_spanA = Tpls.mkTplTag("span")),
      ),
    ),
    type: ComponentType.Plain,
  });
  const slottedComponent = Components.mkComponent({
    name: "Slotted",
    params: [
      (children = Lang.mkParam({
        name: "children",
        type: typeFactory.renderable(),
        exportType: Lang.ParamExportType.External,
        paramType: "slot",
      })),
    ],
    tplTree: Tpls.mkTplTag(
      "div",
      (slottedSlot = Tpls.mkSlot(children, [
        (defaultSlotChild = Tpls.mkTplTagX(
          "div",
          {},
          mkTplTestText("slot for children"),
        )),
      ])),
    ),
    type: ComponentType.Plain,
  });
  const nestingSlottedComponent = Components.mkComponent({
    name: "Slotted",
    params: [
      (children = Lang.mkParam({
        name: "children",
        type: typeFactory.renderable(),
        exportType: Lang.ParamExportType.External,
        paramType: "slot",
      })),
    ],
    tplTree: Tpls.mkTplComponentX({
      component: slottedComponent,
      children: (nestingSlot = Tpls.mkSlot(children, [
        Tpls.mkTplTagX("div", {}, mkTplTestText("slot for children")),
      ])),
      baseVariant: TEST_GLOBAL_VARIANT,
    }),
    type: ComponentType.Plain,
  });

  const site = createSite();
  site.components.push(
    componentB,
    componentA,
    slottedComponent,
    nestingSlottedComponent,
  );

  beforeEach(function () {
    evalTpl = function (
      opts = {
        tplTree: Tpls.mkTplTag("div", [
          Tpls.mkTplComponent(componentA, TEST_GLOBAL_VARIANT), // 2-deep
          Tpls.mkTplComponent(componentB, TEST_GLOBAL_VARIANT), // 1-deep
          Tpls.mkTplTag("span"), // 0-deep
        ]),
      },
    ) {
      const tplMgr = new TplMgr({ site });
      doEval = function () {
        const rootComp = tplMgr.addComponent();
        rootComp.tplTree = opts.tplTree;
        const root = mkTplComponentX({
          component: rootComp,
          baseVariant: TEST_GLOBAL_VARIANT,
        });
        sysTree = buildValTree(root);
        valTree = sysTree.contents[0];
        valState = new ValState({
          sysRoot: sysTree,
          globalRoot: sysTree,
        });

        getHeuristics = (ctx?: ComponentCtx) => {
          const currentComponentCtx = ctx
            ? new ComponentCtx({
                valComponent: ensureInstance(
                  renderStateForTests.key2val(ctx.valComponent().key),
                  ValComponent,
                ),
              })
            : null;
          return new FocusHeuristics(
            site,
            tplMgr,
            valState,
            currentComponentCtx,
            !!opts.showDefaultContentsFor,
            (tpl, anchor) =>
              ValNodes.flattenVals(valTree).find(
                (val) => val.tpl === tpl && val.valOwner === anchor.valOwner,
              ),
          );
        };
      };
      doEval();
    };
  });

  describe("parentComponents", () =>
    it("should work", function () {
      evalTpl();
      const fh = getHeuristics();
      expect(fh.parentComponents(valTree.children[2])).toEqual([]);
      expect(fh.parentComponents(valTree.children[1])).toEqual([]);
      expect(fh.parentComponents(valTree.children[1].contents[0])).toEqual([
        valTree.children[1],
      ]);
      expect(
        fh.parentComponents(valTree.children[1].contents[0].children[0]),
      ).toEqual([valTree.children[1]]);
      expect(
        fh.parentComponents(valTree.children[0].contents[0].children[1]),
      ).toEqual([valTree.children[0]]);
      expect(
        fh.parentComponents(
          valTree.children[0].contents[0].children[0].contents[0].children[0],
        ),
      ).toEqual([
        valTree.children[0].contents[0].children[0],
        valTree.children[0],
      ]);
    }));

  describe("direct selection", () => {
    beforeEach(() => evalTpl());

    it("direct selection reaches the deepest editable owner while normal selection stays outside", () => {
      const outer = valTree.children[0];
      const inner = outer.contents[0].children[0];
      const leaf = inner.contents[0].children[0];
      const fh = getHeuristics();
      expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
        outer,
      );
      const direct = fh.bestFocusTarget(leaf, {
        exact: false,
        deepSelect: true,
      });
      expect(direct.focusTarget).toBe(leaf);
      expect(direct.componentCtx?.valComponent()).toBe(inner);
    });

    it("direct selection crosses a substituted slot back to its authored owner", () => {
      let target: TplNode;
      evalTpl({
        tplTree: Tpls.mkTplTag(
          "div",
          Tpls.mkTplComponentX({
            component: slottedComponent,
            children: (target = Tpls.mkTplTag("span")),
            baseVariant: TEST_GLOBAL_VARIANT,
          }),
        ),
      });
      const leaf = ensure(
        ValNodes.flattenVals(valTree).find((v) => v.tpl === target),
        "Slot content",
      );
      const fh = getHeuristics(
        new ComponentCtx({ valComponent: valTree.children[0] }),
      );
      expect(
        fh.bestFocusTarget(leaf, { exact: false }).focusTarget,
      ).toBeInstanceOf(ValSlot);
      const direct = fh.bestFocusTarget(leaf, {
        exact: false,
        deepSelect: true,
      });
      expect(direct.focusTarget).toBe(leaf);
      expect(direct.componentCtx).toBeNull();
    });

    it.each(["imported", "code"])(
      "direct selection respects the %s component boundary",
      (kind) => {
        const opaque =
          kind === "code"
            ? mkCodeComponent(
                "Opaque",
                { name: "Opaque", importPath: "./opaque", props: {} },
                {},
              )
            : Components.mkComponent({
                name: "Opaque",
                type: ComponentType.Plain,
                tplTree: () => Tpls.mkTplTag("div"),
              });
        opaque.tplTree = Tpls.mkTplTag("div", [Tpls.mkTplTag("span")]);
        evalTpl({
          tplTree: Tpls.mkTplTag("div", [
            Tpls.mkTplComponent(opaque, TEST_GLOBAL_VARIANT),
          ]),
        });
        const instance = valTree.children[0];
        const leaf = instance.contents[0].children[0];
        const direct = getHeuristics().bestFocusTarget(leaf, {
          exact: false,
          deepSelect: true,
        });
        expect(direct.focusTarget).toBe(instance);
        expect(direct.componentCtx).toBeNull();
      },
    );

    it("direct selection skips a locked child but stays in the editable owner", () => {
      const inner = valTree.children[0].contents[0].children[0];
      const root = inner.contents[0];
      const leaf = root.children[0];
      leaf.tpl.locked = true;
      try {
        const direct = getHeuristics().bestFocusTarget(leaf, {
          exact: false,
          deepSelect: true,
        });
        expect(direct.focusTarget).toBe(root);
        expect(direct.componentCtx?.valComponent()).toBe(inner);
      } finally {
        leaf.tpl.locked = null;
      }
    });

    it("direct selection cannot enter a locked component instance", () => {
      const outer = valTree.children[0];
      const root = outer.contents[0];
      const inner = root.children[0];
      const leaf = inner.contents[0].children[0];
      inner.tpl.locked = true;
      try {
        const direct = getHeuristics().bestFocusTarget(leaf, {
          exact: false,
          deepSelect: true,
        });
        expect(direct.focusTarget).toBe(root);
        expect(direct.componentCtx?.valComponent()).toBe(outer);
      } finally {
        inner.tpl.locked = null;
      }
    });

    it("normal selection respects a trapping component while direct selection reaches authored slot content", () => {
      let target: TplNode;
      const wasTrapping = slottedComponent.trapsFocus;
      slottedComponent.trapsFocus = true;
      try {
        evalTpl({
          tplTree: Tpls.mkTplTag(
            "div",
            Tpls.mkTplComponentX({
              component: slottedComponent,
              children: (target = Tpls.mkTplTag("span")),
              baseVariant: TEST_GLOBAL_VARIANT,
            }),
          ),
        });
        const leaf = ensure(
          ValNodes.flattenVals(valTree).find((v) => v.tpl === target),
          "Slot content",
        );
        const fh = getHeuristics();
        expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
          valTree.children[0],
        );
        expect(
          fh.bestFocusTarget(leaf, { exact: false, deepSelect: true })
            .focusTarget,
        ).toBe(leaf);
      } finally {
        slottedComponent.trapsFocus = wasTrapping;
      }
    });
  });

  describe("layout selection levels", () => {
    beforeEach(() =>
      evalTpl({
        tplTree: Tpls.mkTplTag("div", [
          Tpls.mkTplTag("main", [
            Tpls.mkTplTag("section", [
              Tpls.mkTplTag("span"),
              Tpls.mkTplTag("button"),
            ]),
            Tpls.mkTplTag("aside", [Tpls.mkTplTag("span")]),
          ]),
          Tpls.mkTplTag("footer", [Tpls.mkTplTag("span")]),
        ]),
      }),
    );

    it("normal selection chooses the outer layout, and repeated single clicks stay there", () => {
      const group = valTree.children[0];
      const leaf = group.children[0].children[0];
      const fh = getHeuristics();
      expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
        group,
      );
      expect(
        fh.bestFocusTarget(leaf, { exact: false, curFocused: group })
          .focusTarget,
      ).toBe(group);
      expect(fh.bestFocusTarget(leaf, { exact: true }).focusTarget).toBe(leaf);
      expect(
        fh.bestFocusTarget(leaf, { exact: false, deepSelect: true })
          .focusTarget,
      ).toBe(leaf);
    });

    it("double click descends one layout level and single click stays in the entered level", () => {
      const group = valTree.children[0];
      const nested = group.children[0];
      const leaf = nested.children[0];
      const fh = getHeuristics();
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: group,
          drillDown: true,
        }).focusTarget,
      ).toBe(nested);
      expect(
        fh.bestFocusTarget(leaf, { exact: false, curFocused: nested })
          .focusTarget,
      ).toBe(nested);
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: nested,
          drillDown: true,
        }).focusTarget,
      ).toBe(leaf);
      expect(
        fh.bestFocusTarget(nested.children[1], {
          exact: false,
          curFocused: leaf,
        }).focusTarget,
      ).toBe(nested.children[1]);
    });

    it("clicking outside the entered layout selects the branch at the common parent", () => {
      const group = valTree.children[0];
      const leaf = group.children[0].children[0];
      const fh = getHeuristics();
      expect(
        fh.bestFocusTarget(group.children[1].children[0], {
          exact: false,
          curFocused: leaf,
        }).focusTarget,
      ).toBe(group.children[1]);
      expect(
        fh.bestFocusTarget(valTree.children[1].children[0], {
          exact: false,
          curFocused: leaf,
        }).focusTarget,
      ).toBe(valTree.children[1]);
    });

    it("a nested component is selected through its enclosing authored layouts", () => {
      evalTpl({
        tplTree: Tpls.mkTplTag("div", [
          Tpls.mkTplTag("section", [
            Tpls.mkTplComponent(componentA, TEST_GLOBAL_VARIANT),
          ]),
        ]),
      });
      const group = valTree.children[0];
      const instance = group.children[0];
      const leaf = instance.contents[0].children[1];
      const fh = getHeuristics();
      expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
        group,
      );
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: group,
          drillDown: true,
        }).focusTarget,
      ).toBe(instance);
    });

    it("slot contents first select their containing instance, then its authored child", () => {
      let target: TplNode;
      evalTpl({
        tplTree: Tpls.mkTplTag(
          "div",
          Tpls.mkTplComponentX({
            component: slottedComponent,
            children: Tpls.mkTplTag("section", [
              (target = Tpls.mkTplTag("span")),
            ]),
            baseVariant: TEST_GLOBAL_VARIANT,
          }),
        ),
      });
      const instance = valTree.children[0];
      const leaf = ensure(
        ValNodes.flattenVals(valTree).find((v) => v.tpl === target),
        "Slot leaf",
      );
      const group = ensure(
        ValNodes.flattenVals(valTree).find((v) => v.tpl === target.parent),
        "Slot layout",
      );
      const fh = getHeuristics();
      expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
        instance,
      );
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: instance,
          drillDown: true,
        }).focusTarget,
      ).toBe(group);
      expect(
        fh.bestFocusTarget(leaf, { exact: false, curFocused: group })
          .focusTarget,
      ).toBe(group);
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: group,
          drillDown: true,
        }).focusTarget,
      ).toBe(leaf);
    });

    it("uses authored ancestors when a code component renders slot content outside its original Fiber parent", () => {
      let target: TplNode;
      evalTpl({
        tplTree: Tpls.mkTplTag("div", [
          Tpls.mkTplTag(
            "main",
            Tpls.mkTplComponentX({
              component: slottedComponent,
              children: (target = Tpls.mkTplTag("span")),
              baseVariant: TEST_GLOBAL_VARIANT,
            }),
          ),
        ]),
      });
      const group = valTree.children[0];
      const instance = group.children[0];
      const leaf = ensure(
        ValNodes.flattenVals(valTree).find((val) => val.tpl === target),
        "Moved slot content",
      );
      ValNodes.writeableValNode(leaf).parent = valTree;
      ValNodes.writeableValNode(leaf).slotInfo = undefined;
      const fh = getHeuristics();
      expect(fh.selectionParent(leaf)).toBe(instance);
      expect(fh.selectionChildren(instance)).toEqual([leaf]);
      expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
        group,
      );
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: group,
          drillDown: true,
        }).focusTarget,
      ).toBe(instance);
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: instance,
          drillDown: true,
        }).focusTarget,
      ).toBe(leaf);
      expect(
        fh.bestFocusTarget(leaf, { exact: false, curFocused: instance })
          .focusTarget,
      ).toBe(instance);
      expect(
        fh.bestFocusTarget(leaf, { exact: false, deepSelect: true })
          .focusTarget,
      ).toBe(leaf);
      // Renderless slot owners may not have a registered runtime value at all.
      // Their surrounding authored groups must still bound mouse selection.
      group.children = [];
      valTree.children = [group, leaf];
      expect(fh.selectionParent(leaf)).toBe(group);
      expect(fh.selectionChildren(group)).toEqual([leaf]);
      expect(fh.bestFocusTarget(leaf, { exact: false }).focusTarget).toBe(
        group,
      );
      expect(
        fh.bestFocusTarget(leaf, { exact: false, curFocused: group })
          .focusTarget,
      ).toBe(group);
      expect(
        fh.bestFocusTarget(leaf, {
          exact: false,
          curFocused: group,
          drillDown: true,
        }).focusTarget,
      ).toBe(leaf);
    });
  });

  describe("containingComponentWithinCurrentComponentCtx", function () {
    it("should work with null currentComponentCtx", function () {
      evalTpl();
      const fh = getHeuristics();
      expect(
        fh.containingComponentWithinCurrentComponentCtx(valTree.children[2]),
      ).toBe(null);
      expect(
        fh.containingComponentWithinCurrentComponentCtx(valTree.children[1]),
      ).toBe(null);
      expect(
        ensure(
          fh.containingComponentWithinCurrentComponentCtx(
            valTree.children[1].contents[0],
          ),
          () => `Didn't find valComp`,
        ).container,
      ).toBe(valTree.children[1]);
      expect(
        ensure(
          fh.containingComponentWithinCurrentComponentCtx(
            valTree.children[1].contents[0].children[0],
          ),
          () => `Didn't find valComp`,
        ).container,
      ).toBe(valTree.children[1]);
      expect(
        ensure(
          fh.containingComponentWithinCurrentComponentCtx(
            valTree.children[0].contents[0].children[1],
          ),
          () => `Didn't find valComp`,
        ).container,
      ).toBe(valTree.children[0]);
      return expect(
        ensure(
          fh.containingComponentWithinCurrentComponentCtx(
            valTree.children[0].contents[0].children[0].contents[0].children[0],
          ),
          () => `Didn't find valComp`,
        ).container,
      ).toBe(valTree.children[0]);
    });

    it("should work with currentComponentCtx", function () {
      evalTpl();
      let fh = getHeuristics(
        new ComponentCtx({
          valComponent: valTree.children[1],
        }),
      );
      expect(
        fh.containingComponentWithinCurrentComponentCtx(
          valTree.children[1].contents[0],
        ),
      ).toBe(null);
      expect(
        fh.containingComponentWithinCurrentComponentCtx(
          valTree.children[1].contents[0].children[0],
        ),
      ).toBe(null);

      fh = getHeuristics(
        new ComponentCtx({
          valComponent: valTree.children[0],
        }),
      );
      expect(
        fh.containingComponentWithinCurrentComponentCtx(
          valTree.children[0].contents[0].children[1],
        ),
      ).toBe(null);
      expect(
        ensure(
          fh.containingComponentWithinCurrentComponentCtx(
            valTree.children[0].contents[0].children[0].contents[0].children[0],
          ),
          () => `Didn't find valComp`,
        ).container,
      ).toBe(valTree.children[0].contents[0].children[0]);
    });

    describe("from inside a slotted component", function () {
      // DEAD There's no more defaultContents.
      it.skip("should stay put if target is slot still rendering default contents (no arg was passed in)", function () {
        evalTpl({
          tplTree: Tpls.mkTplTag(
            "div",
            Tpls.mkTplComponent(slottedComponent, TEST_GLOBAL_VARIANT),
          ),
        });
        const fh = getHeuristics(
          new ComponentCtx({
            valComponent: valTree.children[0],
          }),
        );
        expect(
          fh.containingComponentWithinCurrentComponentCtx(
            valTree.children[0].contents[0].children[0].contents[0], // defaultContents
          ),
        ).toBe(null);
      });

      it("should return null container if target is slot arg passed in from top level", function () {
        evalTpl({
          tplTree: Tpls.mkTplTag(
            "div",
            Tpls.mkTplComponentX({
              component: slottedComponent,
              children: Tpls.mkTplTag("span"),
              baseVariant: TEST_GLOBAL_VARIANT,
            }),
          ),
        });
        const fh = getHeuristics(
          new ComponentCtx({
            valComponent: valTree.children[0],
          }),
        );
        return expect(
          ensure(
            fh.containingComponentWithinCurrentComponentCtx(
              slotContentValNode(
                valTree.children[0].contents[0].children[0].contents[0],
              ), // span
            ),
            () => `Didn't find valComp`,
          ).container,
        ).toBe(null);
      });

      it("should return parent container if target is slot arg passed in from above", function () {
        evalTpl({
          tplTree: Tpls.mkTplTag(
            "div",
            Tpls.mkTplComponentX({
              component: nestingSlottedComponent,
              children: Tpls.mkTplTag("span"),
              baseVariant: TEST_GLOBAL_VARIANT,
            }),
          ),
        });
        // div > nesting > slotted > div > slotted's slot > nesting's slot > span
        //   child     cont      cont  child            cont             cont
        const fh = getHeuristics(
          new ComponentCtx({
            valComponent: valTree.children[0].contents[0],
          }),
        );
        return expect(
          ensure(
            fh.containingComponentWithinCurrentComponentCtx(
              slotContentValNode(
                valTree.children[0].contents[0].contents[0].children[0]
                  .contents[0],
              ), // nesting's slot passed into slotted
            ),
            () => `Didn't find valComp`,
          ).container,
        ).toBe(valTree.children[0]);
      });

      return it("should go up one level at a time if target is slot arg passed in from multiple levels up", function () {
        evalTpl({
          tplTree: Tpls.mkTplTag(
            "div",
            Tpls.mkTplComponentX({
              component: nestingSlottedComponent,
              children: Tpls.mkTplTag("span"),
              baseVariant: TEST_GLOBAL_VARIANT,
            }),
          ),
        });
        const fh = getHeuristics(
          new ComponentCtx({
            valComponent: valTree.children[0].contents[0],
          }),
        );
        return expect(
          ensure(
            fh.containingComponentWithinCurrentComponentCtx(
              slotContentValNode(
                ensureInstance(
                  slotContentValNode(
                    valTree.children[0].contents[0].contents[0].children[0]
                      .contents[0],
                  ),
                  ValSlot,
                ).contents![0],
              ), // span
            ),
            () => `Didn't find valComp`,
          ).container,
        ).toBe(valTree.children[0]);
      });
    });
  });

  describe("bestFocusTarget", function () {
    let test: (args: {
      desiredFocus: ValNode;
      newFocus?: ValNode;
      newComponent?: ValComponent | "none";
    }) => void;
    let activate: (comp: ValComponent | null) => void;
    let currentCtx: ComponentCtx | null;

    beforeEach(function () {
      evalTpl();
      activate = function (component) {
        currentCtx =
          component != null
            ? new ComponentCtx({ valComponent: component })
            : null;
      };
      test = function ({ desiredFocus, newFocus, newComponent }) {
        newComponent =
          newComponent ?? maybe(currentCtx, (x) => x.valComponent()) ?? "none";
        newFocus = newFocus ?? desiredFocus;
        const fh = getHeuristics(currentCtx || undefined);
        const bestFocus = fh.bestFocusTarget(desiredFocus, { exact: true });
        const expectedFocus = {
          componentCtx:
            newComponent === "none"
              ? null
              : new ComponentCtx({ valComponent: newComponent }),
          focusTarget: newFocus,
        };
        expect(bestFocus.componentCtx?.valComponent()).toBe(
          expectedFocus.componentCtx?.valComponent(),
        );
        expect(bestFocus.focusTarget).toBe(expectedFocus.focusTarget);
      };
    });

    it("should work with null currentComponentCtx", function () {
      activate(null);
      test({
        desiredFocus: valTree.children[2],
      });
      test({
        desiredFocus: valTree.children[1],
      });
      test({
        desiredFocus: valTree.children[1].contents[0],
        newFocus: valTree.children[1],
      });
      test({
        desiredFocus: valTree.children[1].contents[0].children[0],
        newFocus: valTree.children[1],
      });
      test({
        desiredFocus: valTree.children[0].contents[0].children[1],
        newFocus: valTree.children[0],
      });
      return test({
        desiredFocus:
          valTree.children[0].contents[0].children[0].contents[0].children[0],
        newFocus: valTree.children[0],
      });
    });

    it("should support clicking on something directly in the current component", function () {
      activate(valTree.children[1]);
      test({
        desiredFocus: valTree.children[1].contents[0],
      });
      test({
        desiredFocus: valTree.children[1].contents[0].children[0],
      });
      activate(valTree.children[0]);
      return test({
        desiredFocus: valTree.children[0].contents[0].children[1],
      });
    });

    it("should support clicking on something that may be in a sub-component", function () {
      activate(valTree.children[0]);
      return test({
        desiredFocus:
          valTree.children[0].contents[0].children[0].contents[0].children[0],
        newFocus: valTree.children[0].contents[0].children[0],
      });
    });

    it("should support moving back up to top of stack", function () {
      activate(valTree.children[1]);
      test({
        desiredFocus: valTree.children[1],
        newComponent: "none",
      });
      test({
        desiredFocus: valTree,
        newComponent: "none",
      });
    });

    it("should support moving back up to a higher component in the stack", function () {
      activate(valTree.children[0].contents[0].children[0]);
      return test({
        desiredFocus: valTree.children[0].contents[0].children[1],
        newComponent: valTree.children[0],
      });
    });

    it("should support moving up when targeting the currently active component itself", function () {
      activate(valTree.children[0].contents[0].children[0]);
      return test({
        desiredFocus: valTree.children[0].contents[0].children[0],
        newComponent: valTree.children[0],
      });
    });

    it("should support moving multiple steps up the stack", function () {
      activate(valTree.children[0].contents[0].children[0]);
      return test({
        desiredFocus: valTree,
        newComponent: "none",
      });
    });

    it('should support selecting the next-closer sub-component (a "deep-lateral move")', function () {
      activate(valTree.children[1]);
      return test({
        desiredFocus: valTree.children[0].contents[0].children[0].contents[0],
        newComponent: "none",
        newFocus: valTree.children[0],
      });
    });

    it("should select slot when trying to select slot content", function () {
      let target;
      evalTpl({
        tplTree: Tpls.mkTplTag(
          "div",
          Tpls.mkTplComponentX({
            component: slottedComponent,
            children: (target = Tpls.mkTplTag("span")),
            baseVariant: TEST_GLOBAL_VARIANT,
          }),
        ),
      });
      activate(valTree.children[0]);
      return test({
        desiredFocus: ensure(
          ValNodes.flattenVals(valTree).find((v) => v.tpl === target),
          () => `Didn't find node`,
        ), // .children[0].contents[0].children[0].contents[0] # span
        newFocus: ValNodes.flattenVals(valTree).find(
          (v) => v.tpl === slottedSlot,
        ),
      });
    });

    it("should select slot belonging to current context component when trying to select slot content even if slot content is itself passed as slot arg to another (nested) slotted component", function () {
      let target;
      evalTpl({
        tplTree: Tpls.mkTplTag(
          "div",
          Tpls.mkTplComponentX({
            component: nestingSlottedComponent,
            children: (target = Tpls.mkTplTag("span")),
            baseVariant: TEST_GLOBAL_VARIANT,
          }),
        ),
      });
      activate(valTree.children[0]);
      return test({
        desiredFocus: ensure(
          ValNodes.flattenVals(valTree).find((v) => v.tpl === target),
          () => `Didn't find node`,
        ),
        newFocus: ValNodes.flattenVals(valTree).find(
          (v) => v.tpl === nestingSlot,
        ),
      });
    });

    it("should select slot belonging to current context valcomponent instance when trying to select slot content that is under another component slot where that component was passed in as current component slot arg (and not being fooled by the fact that it is under another valcomponent instance of the same component!)", function () {
      let target;
      evalTpl({
        tplTree: Tpls.mkTplTag(
          "div",
          Tpls.mkTplComponentX({
            component: slottedComponent,
            children: Tpls.mkTplComponentX({
              component: slottedComponent,
              children: (target = Tpls.mkTplTag("span")),
              baseVariant: TEST_GLOBAL_VARIANT,
            }),
            baseVariant: TEST_GLOBAL_VARIANT,
          }),
        ),
      });
      activate(valTree.children[0]);
      return test({
        desiredFocus: ensure(
          ValNodes.flattenVals(valTree).find((v) => v.tpl === target),
          () => `Didn't find node`,
        ),
        newFocus: ValNodes.flattenVals(valTree).find(
          (v) => v.tpl === slottedSlot,
        ),
      });
    });

    it("should select val slot with component context", function () {
      evalTpl({
        tplTree: Tpls.mkTplTag(
          "div",
          Tpls.mkTplComponent(slottedComponent, TEST_GLOBAL_VARIANT),
        ),
      });
      activate(valTree.children[0]);
      return test({
        desiredFocus: ensure(
          ValNodes.flattenVals(valTree).find((v) => {
            return v.tpl === slottedSlot;
          }),
          () => `Didn't find node`,
        ),
      });
    });

    it("should select slot default content with component context", function () {
      const tpl = Tpls.mkTplComponent(slottedComponent, TEST_GLOBAL_VARIANT);
      evalTpl({
        tplTree: Tpls.mkTplTag("div", tpl),
        showDefaultContentsFor: tpl,
      });
      activate(valTree.children[0]);
      test({
        desiredFocus: ensure(
          ValNodes.flattenVals(valTree).find((v) => {
            return v.tpl === defaultSlotChild;
          }),
          () => `Didn't find node`,
        ),
      });
    });
  });
});
