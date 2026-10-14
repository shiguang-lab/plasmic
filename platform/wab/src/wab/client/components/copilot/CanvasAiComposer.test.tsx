import type { AppCtx } from "@/wab/client/app-ctx";
import { CanvasAiComposer } from "@/wab/client/components/copilot/CanvasAiComposer";
import { getLocalAiContext } from "@/wab/client/copilot/local-ai-context";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import {
  ArenaFrame,
  ArenaFrameGrid,
  PageArena,
} from "@/wab/shared/model/classes";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/copilot/local-edit-session", () => ({
  getLocalEditSession: () => ({
    subscribe: () => vi.fn(),
    snapshot: () => 0,
    draft: { prompt: "Create page", attachments: [] },
    tasks: [],
  }),
}));
vi.mock("@/wab/client/copilot/use-local-ai-status", () => ({
  useLocalAiStatus: () => ({}),
}));
vi.mock("@/wab/client/components/copilot/AiAttachments", () => ({
  useAiAttachments: () => ({ reading: false }),
}));
vi.mock("@/wab/client/components/copilot/AiComposer", () => ({
  AiComposer: (props: {
    canSubmit: boolean;
    availability?: string;
    placeholder?: string;
    scope?: string;
  }) => (
    <div>
      <button disabled={!props.canSubmit}>Send</button>
      <p>{props.availability}</p>
      <input placeholder={props.placeholder} />
      <span data-testid="scope">{props.scope}</span>
    </div>
  ),
}));
afterEach(cleanup);
it("explains the empty-canvas prerequisite in both the placeholder and visible status", () => {
  render(
    <CanvasAiComposer
      appCtx={{ appConfig: { enableLocalAiEditing: true } } as AppCtx}
      projectId="audit"
      context={{} as LocalAiContext}
      onSubmit={vi.fn()}
      hiddenByModal={false}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    screen.getByText("Create or select a page before using AI."),
  ).toBeTruthy();
  expect(
    screen.getByPlaceholderText("Create or select a page before using AI."),
  ).toBeTruthy();
});

it("keeps page editing available and restores page scope when selection and canvas focus are cleared", () => {
  const selected = mkTplTagX("div", { name: "StatusFilter" });
  const page = mkComponent({
    name: "Current page",
    type: ComponentType.Page,
    tplTree: selected,
  });
  const arena = new PageArena({
    component: page,
    matrix: new ArenaFrameGrid({ rows: [] }),
    customMatrix: new ArenaFrameGrid({ rows: [] }),
  });
  const view = mock<ViewCtx>();
  view.focusedTpl.mockReturnValue(selected);
  view.focusedTpls.mockReturnValue([selected]);
  view.currentComponent.mockReturnValue(page);
  view.arenaFrame.mockReturnValue(mock<ArenaFrame>({ uuid: "frame" }));
  const studio = mock<StudioCtx>({
    currentArena: arena,
    siteInfo: { id: "project" } as StudioCtx["siteInfo"],
    aiSessionId: "session",
    _changeCounter: 4,
  });
  studio.dbCtx.mockReturnValue(mock<ReturnType<StudioCtx["dbCtx"]>>());
  studio.focusedViewCtx.mockReturnValue(view);
  const context = getLocalAiContext(studio);
  const composer = (context: LocalAiContext) => (
    <CanvasAiComposer
      appCtx={{ appConfig: { enableLocalAiEditing: true } } as AppCtx}
      projectId="project"
      context={context}
      onSubmit={vi.fn()}
      hiddenByModal={false}
    />
  );
  const { rerender } = render(composer(context));
  const assertAvailable = () => {
    expect(
      screen.getByPlaceholderText("Describe changes to the current page…"),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      screen.queryByText("Create or select a page before using AI."),
    ).toBeNull();
  };
  assertAvailable();
  expect(screen.getByTestId("scope").textContent).toBe("StatusFilter");
  expect(context.binding?.elementUuids).toEqual([selected.uuid]);

  view.focusedTpl.mockReturnValue(null);
  view.focusedTpls.mockReturnValue([]);
  const unselectedContext = getLocalAiContext(studio);
  rerender(composer(unselectedContext));
  assertAvailable();
  expect(screen.getByTestId("scope").textContent).toBe(page.name);
  expect(unselectedContext.binding).toEqual({
    ...context.binding,
    elementUuids: [],
  });

  studio.focusedViewCtx.mockReturnValue(undefined);
  const clearedContext = getLocalAiContext(studio);
  rerender(composer(clearedContext));
  assertAvailable();
  expect(screen.getByTestId("scope").textContent).toBe(page.name);
  expect(clearedContext.binding).toEqual({
    ...context.binding,
    frameUuid: null,
    elementUuids: [],
  });
});
