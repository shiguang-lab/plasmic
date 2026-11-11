import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { $$$ } from "@/wab/shared/TplQuery";
import {
  mkBaseVariant,
  mkVariant,
  mkVariantSetting,
} from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import type { Component } from "@/wab/shared/model/classes";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";

function syncDocument(sc: StudioCtx, doc: Document, component: Component) {
  sc["styleMgr"].upsertStyleSheets(doc, component);
}

test("updates only changed canvas styles and leaves sheets in cascade order", async () => {
  const site = createSite();
  const component = mkComponent({
    name: "Styled",
    type: ComponentType.Plain,
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, styles: { color: "red" } }),
  });
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  const docs = [document.implementation.createHTMLDocument(), document.implementation.createHTMLDocument()];
  const sync = () => docs.forEach((doc) => syncDocument(sc, doc, component));
  try {
    sc.observeComponents([component]);
    sync();
    const order = docs.map((doc) => Array.from(doc.head.children));
    const moves = docs.map((doc) => vi.spyOn(doc.head, "insertBefore"));
    const writes = docs.map((doc) =>
      Array.from(doc.head.querySelectorAll("style"), (style) =>
        vi.spyOn(style, "textContent", "set"),
      ),
    );
    try {
      await sc.changeUnsafe(() => { component.tplTree.vsettings[0].rs.values.color = "blue"; });
      sync();
      for (let index = 0; index < docs.length; index++) {
        expect(Array.from(docs[index].head.children)).toEqual(order[index]);
        expect(moves[index]).not.toHaveBeenCalled();
        expect(writes[index].map((write) => write.mock.calls.length)).toEqual([0, 0, 0, 1]);
        expect(docs[index].getElementById(`plasmic-comp-${component.uuid}`)?.textContent).toContain("color: blue");
      }
    } finally {
      moves.forEach((spy) => spy.mockRestore());
      writes.flat().forEach((spy) => spy.mockRestore());
    }
  } finally {
    sc.dispose();
  }
});

test("detached subtree styles are removed from both documents and restored on undo", async () => {
  const site = createSite();
  const baseVariant = mkBaseVariant();
  const child = mkTplTagX("div", {
    baseVariant,
    styles: { color: "rgb(12, 34, 56)" },
  });
  const root = mkTplTagX("div", { baseVariant, styles: {} }, [child]);
  const component = mkComponent({
    name: "Styled",
    type: ComponentType.Plain,
    variants: [baseVariant],
    tplTree: root,
  });
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  const doc1 = document.implementation.createHTMLDocument();
  const doc2 = document.implementation.createHTMLDocument();
  const css = (doc: Document) =>
    doc.getElementById(`plasmic-comp-${component.uuid}`)?.textContent;
  const sync = () =>
    [doc1, doc2].forEach((doc) => syncDocument(sc, doc, component));
  try {
    sc.dbCtx().maybeObserveComponents([component]);
    sync();
    const original = css(doc1);
    expect(original).toContain("rgb(12, 34, 56)");
    sc.createViewStateUndoRecord();
    await sc.changeUnsafe(() => $$$(child).remove({ deep: true }));
    await sc.awaitEval();
    expect(ensureKnownTplTag(root).children).toHaveLength(0);
    sync();
    expect(css(doc1)).not.toContain("rgb(12, 34, 56)");
    expect(css(doc2)).toBe(css(doc1));
    expect(sc.canUndo()).toBe(true);
    await sc.undo();
    await sc.awaitEval();
    sync();
    expect(css(doc1)).toBe(original);
    expect(css(doc2)).toBe(original);
    await sc.redo();
    await sc.awaitEval();
    sync();
    expect(css(doc1)).not.toContain("rgb(12, 34, 56)");
    expect(css(doc2)).toBe(css(doc1));
  } finally {
    sc.dispose();
  }
});

test("deleting one component's child preserves another component's styles", async () => {
  const site = createSite();
  const base = mkBaseVariant();
  const child = mkTplTagX("div", {
    baseVariant: base,
    styles: { color: "red" },
  });
  const first = mkComponent({
    name: "First",
    type: ComponentType.Plain,
    variants: [base],
    tplTree: mkTplTagX("div", { baseVariant: base }, [child]),
  });
  const otherBase = mkBaseVariant();
  const other = mkComponent({
    name: "Other",
    type: ComponentType.Plain,
    variants: [otherBase],
    tplTree: mkTplTagX("div", {
      baseVariant: otherBase,
      styles: { color: "blue" },
    }),
  });
  site.components.push(first, other);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  const doc = document.implementation.createHTMLDocument();
  const sync = () => [first, other].forEach((c) => syncDocument(sc, doc, c));
  const css = (id: string) =>
    doc.getElementById(`plasmic-comp-${id}`)?.textContent;
  try {
    sc.dbCtx().maybeObserveComponents([first, other]);
    sync();
    const original = css(first.uuid),
      otherCss = css(other.uuid);
    sc.createViewStateUndoRecord();
    await sc.changeUnsafe(() => $$$(child).remove({ deep: true }));
    sync();
    expect(css(first.uuid)).not.toContain("color: red");
    expect(css(other.uuid)).toBe(otherCss);
    await sc.undo();
    sync();
    expect(css(first.uuid)).toBe(original);
    expect(css(other.uuid)).toBe(otherCss);
    await sc.redo();
    sync();
    expect(css(first.uuid)).not.toContain("color: red");
    expect(css(other.uuid)).toBe(otherCss);
  } finally {
    sc.dispose();
  }
});

test("deleting a variant setting preserves the base style and restores on undo", async () => {
  const site = createSite(),
    base = mkBaseVariant(),
    variant = mkVariant({ name: "Hover", selectors: [":hover"] });
  const root = mkTplTagX("div", {
    baseVariant: base,
    styles: { color: "red" },
  });
  root.vsettings.push(
    mkVariantSetting({ variants: [variant], styles: { color: "green" } }),
  );
  const component = mkComponent({
    name: "Variants",
    type: ComponentType.Plain,
    variants: [base, variant],
    tplTree: root,
  });
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  const doc = document.implementation.createHTMLDocument();
  const sync = () => syncDocument(sc, doc, component);
  const css = () =>
    doc.getElementById(`plasmic-comp-${component.uuid}`)?.textContent;
  try {
    sc.dbCtx().maybeObserveComponents([component]);
    sync();
    const original = css();
    expect(original).toContain("color: green");
    sc.createViewStateUndoRecord();
    await sc.changeUnsafe(() => root.vsettings.splice(1, 1));
    sync();
    expect(css()).toContain("color: red");
    expect(css()).not.toContain("color: green");
    await sc.undo();
    sync();
    expect(css()).toBe(original);
    await sc.redo();
    sync();
    expect(css()).not.toContain("color: green");
  } finally {
    sc.dispose();
  }
});
