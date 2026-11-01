// Diagnostic build entry only; never include in a release entry.
import { clone } from "@/wab/shared/core/tpls";
import { $$$ } from "@/wab/shared/TplQuery";
let scenario: string,
  count = 0,
  root: any,
  text: any,
  pending: any;
const editor = () => (window as any).studioCtx;
function payload(index: number) {
  let seed = index + 100000;
  const chars = new Array(16384);
  for (let i = 0; i < chars.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    chars[i] = String.fromCharCode(33 + (seed % 90));
  }
  const suffix = String(index).padStart(12, "0");
  return chars.join("").slice(0, 16384 - suffix.length) + suffix;
}
(window as any).__undoGrowth = {
  async setup(mode: string) {
    scenario = mode;
    count = 0;
    const s = editor(),
      component = s.site.pageArenas[0].component;
    let arena: any, frame: any;
    await s.changeUnsafe(() => {
      arena = s.tplMgr().addArena("UndoGrowth");
      frame = s
        .tplMgr()
        .addNewMixedArenaFrame(arena, "Growth", component, {
          width: 640,
          height: 480,
          insertPt: s.viewportCtx.visibleScalerBox().topLeft(),
        });
    });
    s.changeSelection(() => s.switchToArena(arena));
    await s.awaitStudioReady();
    const vc = s.tryGetViewCtxForFrame(frame);
    if (!vc) throw Error("Diagnostic frame missing");
    root = component.tplTree;
    text = root.children[0].vsettings[0].text;
    s.changeSelection(() =>
      vc.setStudioFocusByTpl(mode === "text" ? root.children[0] : root),
    );
    if (!text || typeof text.text !== "string")
      throw Error("Expected literal fixture text");
  },
  resetCounter() {
    count = 0;
  },
  async advance(n: number) {
    const s = editor();
    for (let k = 0; k < n; k++) {
      const index = ++count;
      await s.changeUnsafe(
        () => {
          if (scenario === "small" || scenario === "grouped")
            root.name = "Step" + index;
          else if (scenario === "text") text.text = payload(index);
          else if (index % 2 === 1) {
            pending = clone(root);
            Object.defineProperty(pending, "__subtreeProbe", {
              value: "deleted-subtree-" + index,
              configurable: true,
            });
            $$$(root).append(pending);
          } else {
            $$$(pending).remove({ deep: true });
            pending = null;
          }
        },
        { noUndoRecord: scenario === "grouped" && (index - 1) % 50 !== 0 },
      );
    }
  },
  state() {
    return {
      cachedRules: editor().styleMgr.componentToVsRules.get(
        editor().site.pageArenas[0].component,
      )?.length,
      styleCharacters: editor().styleMgr.componentToStyleText.get(
        editor().site.pageArenas[0].component,
      )?.styleText.length,
      scenario,
      rootChildren: root.children.length,
      name: root.name,
      textLength: text.text.length,
      textSuffix: text.text.slice(-12),
      pendingSubtree: !!pending,
    };
  },
  async verifyUndoRedo() {
    const s = editor(),
      before = this.state();
    await s.undo();
    await s.awaitStudioReady();
    const undone = this.state();
    await s.redo();
    await s.awaitStudioReady();
    const redone = this.state();
    const model = (v: any) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(v).filter(
            ([k]) => !["cachedRules", "styleCharacters"].includes(k),
          ),
        ),
      );
    if (model(before) !== model(redone)) throw Error("Redo changed model");
    if (
      (scenario === "small" || scenario === "grouped") &&
      undone.name !== "Step" + (count - (scenario === "grouped" ? 50 : 1))
    )
      throw Error("Rename undo failed");
    if (
      scenario === "text" &&
      undone.textSuffix !== String(count - 1).padStart(12, "0")
    )
      throw Error("Text undo failed");
    if (
      scenario === "subtree" &&
      undone.rootChildren !== before.rootChildren + 1
    )
      throw Error("Removed subtree was not restored");
    return { undo: true, redo: true, before, undone, redone };
  },
};
