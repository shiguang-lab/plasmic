import type { AppCtx } from "@/wab/client/app-ctx";
import { CanvasAiComposer } from "@/wab/client/components/copilot/CanvasAiComposer";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

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
  }) => (
    <div>
      <button disabled={!props.canSubmit}>Send</button>
      <p>{props.availability}</p>
      <input placeholder={props.placeholder} />
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
