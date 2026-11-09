import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import LeftLintIssuesPanel from "@/wab/client/components/sidebar/LeftLintIssuesPanel";
import type { ItemOrGroup } from "@/wab/client/components/sidebar/VirtualGroupedList";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import type { LintIssue, LintIssueType } from "@/wab/shared/linting/lint-types";
import { type Component, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/app-auth/app-auth-contexts", () => ({ useAppRoles: () => ({ roles: [] }) }));
vi.mock("@/wab/client/components/sidebar/VirtualGroupedList", () => ({
  VirtualGroupedList: ({ items, renderItem, renderGroupHeader }: {
    items: ItemOrGroup<Component | LintIssueType, LintIssue>[];
    renderItem: (issue: LintIssue) => React.ReactNode;
    renderGroupHeader: (group: Component | LintIssueType) => React.ReactNode;
  }) => {
    const rows = (entries: ItemOrGroup<Component | LintIssueType, LintIssue>[]): React.ReactNode => entries.map((entry) => entry.type === "item"
      ? <div key={entry.key}>{renderItem(entry.item)}</div>
      : <section key={entry.key}>{renderGroupHeader(entry.group)}{rows(entry.items)}</section>);
    return <div data-testid="lint-list">{rows(items)}</div>;
  },
}));
afterEach(cleanup);

it("removes real document lint issues after a model commit and retires the old panel at world closure", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Lint regression", type: ComponentType.Plain });
  const tpl = ensureKnownTplTag(component.tplTree); tpl.name = "Hidden content";
  tpl.vsettings[0].dataCond = codeLit(false);
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.dbCtx().maybeObserveComponents([component]);
  const focus = vi.spyOn(studio, "setStudioFocusOnTpl").mockResolvedValue(undefined);
  const mounted = render(<StudioCtxContext.Provider value={studio}><LeftLintIssuesPanel /></StudioCtxContext.Provider>);
  try {
    await waitFor(() => expect(screen.getByText("Hidden content")).toBeTruthy());
    expect(screen.queryByText("No issues!")).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => { tpl.vsettings[0].dataCond = codeLit(true); }); });
    expect(screen.queryByText("Hidden content")).toBeNull();
    expect(screen.getByText("No issues!")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { tpl.vsettings[0].dataCond = codeLit(false); }); });
    fireEvent.click(screen.getByText("Hidden content"));
    await waitFor(() => expect(focus).toHaveBeenCalledWith(component, tpl));
    act(() => studio.arenaState.reset());
    expect(screen.queryByText("Hidden content")).toBeNull();
    expect(screen.queryByRole("button", { name: /Deep inspect current/ })).toBeNull();
    expect(mounted.container.querySelector(".editor-issues-panel")).toBeTruthy();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
