import { TextContentRow } from "@/wab/client/components/sidebar-tabs/TypographySection";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type {
  EditingTextContext,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import { assert, ensure } from "@/wab/shared/common";
import {
  RawTextLike,
  TplTagType,
  isTplTextBlock,
  mkTplTagX,
} from "@/wab/shared/core/tpls";
import { ValTextTag } from "@/wab/shared/core/val-nodes";
import type { EffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { RawText } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/tpl-text-ops", () => ({
  makeTplTextOps: (viewCtx: ViewCtx, tpl: TplExpsProvider["tpl"]) => ({
    effectiveVs: viewCtx.effectiveCurrentVariantSetting(tpl),
    indicator: { source: "none" },
    isDisabled: false,
    actions: {},
  }),
  makeTplTextMenu: () => null,
}));

afterEach(cleanup);

function setup() {
  const tpl = mkTplTagX("span", { type: TplTagType.Text });
  const text = new RawText({ text: "内部名称1", markers: [] });
  const context = observable.box<EditingTextContext | null>(null);
  const viewCtx = mock<ViewCtx>();
  viewCtx.editingTextContext.mockImplementation(() => context.get());
  const effectiveVs = mock<EffectiveVariantSetting>();
  Object.defineProperty(effectiveVs, "text", { value: text });
  viewCtx.effectiveCurrentVariantSetting.mockReturnValue(effectiveVs);
  const studioCtx = mock<StudioCtx>();
  const expsProvider = mock<TplExpsProvider>();
  Object.defineProperty(expsProvider, "tpl", { value: tpl });
  render(
    <StudioCtxContext.Provider value={studioCtx}>
      <TextContentRow viewCtx={viewCtx} expsProvider={expsProvider} />
    </StudioCtxContext.Provider>,
  );
  const startEditing = (node = tpl) => {
    assert(isTplTextBlock(node), "Expected a text template");
    runInAction(() =>
      context.set({
        val: new ValTextTag({
          tpl: node,
          key: node.uuid,
          fullKey: node.uuid,
          frameUid: 1,
          valOwner: undefined,
          parent: undefined,
          slotInfo: undefined,
          className: "text",
          children: [],
          fibers: [],
          text,
        }),
        targetVs: tpl.vsettings[0],
        draftText: text,
        run: undefined,
        editor: undefined,
      }),
    );
  };
  const draft = (value: string | undefined) =>
    runInAction(() => {
      ensure(context.get(), "Expected an active text edit").draftText =
        value === undefined ? undefined : new RawTextLike(value, []);
    });
  return { context, viewCtx, text, tpl, startEditing, draft };
}

it("shows typing, deletion and undo drafts immediately without committing the model", () => {
  const f = setup();
  const content = screen.getByRole("button", { name: "内部名称1" });
  act(() => f.startEditing());
  expect(f.context.get()?.val.tpl).toBe(f.tpl);
  act(() => f.draft("内部名称123"));
  expect(content.textContent).toBe("内部名称123");
  act(() => f.draft(""));
  expect(content.textContent).toBe("");
  act(() => f.draft("内部名称1"));
  expect(content.textContent).toBe("内部名称1");
  expect(f.text.text).toBe("内部名称1");
  expect(f.viewCtx.change).not.toHaveBeenCalled();
});

it("falls back to the model after the draft is cleared or editing ends", () => {
  const f = setup();
  const content = screen.getByRole("button", { name: "内部名称1" });
  act(() => f.startEditing());
  act(() => f.draft("Draft"));
  act(() => f.draft(undefined));
  expect(content.textContent).toBe("内部名称1");
  act(() => f.draft("Draft"));
  act(() => runInAction(() => f.context.set(null)));
  expect(content.textContent).toBe("内部名称1");
});

it("does not display another text node's draft", () => {
  const f = setup();
  act(() => f.startEditing(mkTplTagX("span", { type: TplTagType.Text })));
  act(() => f.draft("Other text"));
  expect(screen.getByRole("button", { name: "内部名称1" })).toBeTruthy();
});
